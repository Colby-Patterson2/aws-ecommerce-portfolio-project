# Ecommerce Demo 3.0 (Portfolio MVP)

React storefront deployed on AWS Amplify Hosting, backed by AWS API Gateway + Lambda + DynamoDB.

## Architecture

- Frontend: React + TypeScript + Vite
- Frontend Hosting: AWS Amplify Hosting
- API: API Gateway HTTP API
- Compute: AWS Lambda (Node.js)
- Database: DynamoDB (Products, Carts, Orders)

## Project Structure

- `frontend/`: React app with product listing, cart, and simulated checkout
- `backend/`: SAM template and Lambda handler for ecommerce API

## MVP Features

- Product catalog
- Cart add/remove
- Simulated checkout (no real payment provider)
- Order confirmation
- Local mock mode for frontend when API is not configured

## Local Frontend Run

```bash
cd frontend
npm install
npm run dev
```

By default, the app runs in mock mode if `VITE_API_BASE_URL` is not set.

To use deployed API:

```bash
cp .env.example .env
# Set VITE_API_BASE_URL to your deployed API base URL
npm run dev
```

## Backend Deploy (AWS)

```bash
cd backend
npm install
sam build
sam deploy --guided
```

After deploy, copy `ApiBaseUrl` from stack outputs and set it in `frontend/.env` as `VITE_API_BASE_URL`.

## Seed Products Table

```bash
cd backend
$env:PRODUCTS_TABLE="<ProductsTableName>"
$env:AWS_REGION="<region>"
npm run seed
```

## Deploy Frontend to Amplify Hosting

1. Push this repo to GitHub.
2. In AWS Amplify, choose **New app** -> **Host web app**.
3. Connect GitHub repository.
4. Set app root to `frontend`.
5. Build command: `npm run build`
6. Output directory: `dist`
7. Add environment variable `VITE_API_BASE_URL` with your API base URL.
8. Deploy.

## Suggested Next Enhancements

- Add AWS Cognito authentication
- Add quantity update controls in cart
- Add admin inventory dashboard
- Add CI checks (lint/build) via GitHub Actions
