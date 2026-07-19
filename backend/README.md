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
sam build
sam deploy --guided
```

After deployment, copy `ApiBaseUrl` from stack outputs.

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
