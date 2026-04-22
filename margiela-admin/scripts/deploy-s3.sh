#!/usr/bin/env bash
# Deploy margiela-admin static export to S3.
# Prerequisites: AWS CLI configured, S3 bucket created.
# Optional: CloudFront in front of bucket for HTTPS/custom domain.
set -e

cd "$(dirname "$0")/.."

BUCKET="${S3_BUCKET:-}"
REGION="${AWS_REGION:-us-east-1}"
CF_DIST_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"

if [ -z "$BUCKET" ]; then
  echo "Error: S3_BUCKET is not set. Example: export S3_BUCKET=my-admin-bucket"
  exit 1
fi

echo "Building..."
npm run build

if [ ! -d "out" ]; then
  echo "Error: out/ not found. next build with output: 'export' should create it."
  exit 1
fi

echo "Syncing out/ to s3://$BUCKET ..."
aws s3 sync out/ "s3://$BUCKET" \
  --region "$REGION" \
  --delete

if [ -n "$CF_DIST_ID" ]; then
  echo "Invalidating CloudFront cache..."
  aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*"
fi

echo "Done."
echo "  S3 website URL (if enabled): http://$BUCKET.s3-website.$REGION.amazonaws.com"
echo "  Or use CloudFront / custom domain for HTTPS."
