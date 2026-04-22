#!/usr/bin/env bash
# Bật public read cho prefix pdfs/* trên S3 bucket margiela-pdfs.
# Cần AWS CLI đã cấu hình (aws configure).
#
# Usage: ./scripts/s3-public-read-pdfs.sh

set -e

BUCKET="margiela-pdfs"
REGION="ap-southeast-1"

echo "=== Step 1: Tắt Block Public Access cho bucket ${BUCKET} ==="
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --region "$REGION"
echo "Block Public Access: OFF"

echo ""
echo "=== Step 2: Bucket policy – public read cho pdfs/* ==="
POLICY=$(cat <<'POLICY_JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadPDFs",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::margiela-pdfs/pdfs/*"
    }
  ]
}
POLICY_JSON
)

aws s3api put-bucket-policy \
  --bucket "$BUCKET" \
  --policy "$POLICY" \
  --region "$REGION"
echo "Bucket policy applied: public read on ${BUCKET}/pdfs/*"

echo ""
echo "=== Done ==="
echo "Test: curl -I https://${BUCKET}.s3.${REGION}.amazonaws.com/pdfs/<any-file>.pdf"
echo "Expect: HTTP 200"
