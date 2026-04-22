#!/usr/bin/env bash
# Full ECS deploy: build image, push to ECR, register task definition with .env, update service.
# Usage: ./scripts/ecs-deploy.sh [path-to-.env]
# Default .env: margiela-fe/.env
# Requires: docker, aws cli, jq. Env: AWS_PROFILE (default newtofu), AWS_REGION (default ap-southeast-1).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:-$FE_ROOT/.env}"

AWS_PROFILE="${AWS_PROFILE:-newtofu}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
ECR_URI="427901343757.dkr.ecr.${AWS_REGION}.amazonaws.com/margiela-fe:latest"
export AWS_PROFILE AWS_REGION

echo "=== 1. Build Docker image (linux/amd64 for Fargate) ==="
cd "$FE_ROOT"
docker build --platform linux/amd64 -t margiela-fe:latest .

echo "=== 2. Login to ECR ==="
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "427901343757.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "=== 3. Tag and push to ECR ==="
docker tag margiela-fe:latest "$ECR_URI"
docker push "$ECR_URI"

echo "=== 4. Register task definition with env and update service ==="
"$SCRIPT_DIR/ecs-register-task-def-with-env.sh" "$ENV_FILE"

echo "Deploy done. Service is rolling out; check: aws ecs describe-services --cluster margiela-cluster --services margiela-fe-service --region $AWS_REGION"
