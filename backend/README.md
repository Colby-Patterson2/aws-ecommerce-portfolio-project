# Backend (AWS Serverless)

This backend uses API Gateway (HTTP API), Lambda, and DynamoDB.

## Endpoints

- `GET /products`
- `GET /products/{id}`
- `GET /cart/{sessionId}`
- `POST /cart/{sessionId}`
- `DELETE /cart/{sessionId}/{productId}`
- `POST /checkout`
- `GET /orders/{orderId}`

## Prerequisites

- AWS CLI configured
- AWS SAM CLI installed
- Node.js 22+

## Deploy

```bash
cd backend
sam build --use-container
sam deploy --guided
```

After deployment, copy `ApiBaseUrl` from stack outputs.

## Product Image Optimization Pipeline

The stack now includes an S3-triggered Lambda that optimizes uploaded product PNG files.

Flow:

1. Upload a source PNG to the upload bucket at `products/{id}.png`.
2. The optimizer Lambda is triggered automatically.
3. Lambda writes optimized outputs to the publish bucket:
	- `products/{id}.png`
	- `products/{id}.webp`
4. Lambda updates the matching item in `ProductsTable`:
	- `imageUrl` gets the CloudFront PNG URL.
	- `imageUrlWebp` gets the CloudFront WebP URL.

Key stack outputs:

- `ProductImageUploadBucketName`
- `ProductImagesBucketName`
- `ProductImagesCloudFrontBaseUrl`

Why `sam build --use-container`:

- The optimizer uses `sharp`, which includes native binaries.
- Building in a container ensures Linux-compatible binaries for Lambda runtime.

## Seed Product Data

1. Install dependencies.

```bash
cd backend
npm install
```

2. Seed data after deployment by exporting table name from stack output.

```bash
$env:PRODUCTS_TABLE="<ProductsTableName>"
$env:AWS_REGION="<your-region>"
npm run seed
```
