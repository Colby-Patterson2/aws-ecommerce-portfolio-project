import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
let ddbClient = ddb

const productsTable = process.env.PRODUCTS_TABLE ?? 'ProductsTable'
const cartsTable = process.env.CARTS_TABLE ?? 'CartsTable'
const ordersTable = process.env.ORDERS_TABLE ?? 'OrdersTable'
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? '*'
const allowedOrigins = frontendOrigin
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const ERROR = {
  INVALID_JSON: 'INVALID_JSON',
  INVALID_REQUEST: 'INVALID_REQUEST',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  CART_EMPTY: 'CART_EMPTY',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  STOCK_CONFLICT: 'STOCK_CONFLICT',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
}

function resolveCorsOrigin(requestOrigin) {
  if (allowedOrigins.includes('*')) {
    return '*'
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  return allowedOrigins[0] ?? '*'
}

function response(requestId, requestOrigin, statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'access-control-allow-origin': resolveCorsOrigin(requestOrigin),
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,x-requested-with,authorization',
      vary: 'origin',
    },
    body: JSON.stringify(body),
  }
}

function errorResponse(requestId, requestOrigin, statusCode, code, message, details) {
  return response(requestId, requestOrigin, statusCode, {
    code,
    message,
    ...(details ? { details } : {}),
  })
}

function parseJson(body) {
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function toPositiveInteger(value) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    return null
  }
  return number
}

function buildConfirmationCode() {
  return randomUUID().slice(0, 8).toUpperCase()
}

async function getProducts(requestId, requestOrigin) {
  const data = await ddbClient.send(new ScanCommand({ TableName: productsTable }))
  return response(
    requestId,
    requestOrigin,
    200,
    (data.Items ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  )
}

async function getProductById(requestId, requestOrigin, id) {
  const data = await ddbClient.send(
    new GetCommand({
      TableName: productsTable,
      Key: { id },
    }),
  )

  if (!data.Item) {
    return errorResponse(
      requestId,
      requestOrigin,
      404,
      ERROR.PRODUCT_NOT_FOUND,
      'Product not found.',
      { productId: id },
    )
  }

  return response(requestId, requestOrigin, 200, data.Item)
}

async function getCart(requestId, requestOrigin, sessionId) {
  const data = await ddbClient.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  return response(
    requestId,
    requestOrigin,
    200,
    data.Item ?? { sessionId, items: [], updatedAt: new Date().toISOString() },
  )
}

async function upsertCartItem(requestId, requestOrigin, sessionId, body) {
  const parsed = parseJson(body)
  if (!parsed) {
    return errorResponse(
      requestId,
      requestOrigin,
      400,
      ERROR.INVALID_JSON,
      'Request body must be valid JSON.',
    )
  }

  if (!sessionId) {
    return errorResponse(
      requestId,
      requestOrigin,
      400,
      ERROR.INVALID_REQUEST,
      'Path parameter sessionId is required.',
    )
  }

  const productId = typeof parsed.productId === 'string' ? parsed.productId.trim() : ''
  const qty = toPositiveInteger(parsed.qty)

  if (!productId || qty === null) {
    return errorResponse(
      requestId,
      requestOrigin,
      400,
      ERROR.INVALID_REQUEST,
      'Body must include productId (string) and qty (positive integer).',
    )
  }

  const productResult = await ddbClient.send(
    new GetCommand({
      TableName: productsTable,
      Key: { id: productId },
    }),
  )

  const product = productResult.Item
  if (!product) {
    return errorResponse(
      requestId,
      requestOrigin,
      404,
      ERROR.PRODUCT_NOT_FOUND,
      'Product not found.',
      { productId },
    )
  }

  const existing = await ddbClient.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  const cart = existing.Item ?? { sessionId, items: [], updatedAt: new Date().toISOString() }

  const item = cart.items.find((row) => row.productId === productId)
  const stock = Number(product.stock) || 0

  if (item) {
    const nextQty = Number(item.qty) + qty
    if (nextQty > stock) {
      return errorResponse(
        requestId,
        requestOrigin,
        409,
        ERROR.OUT_OF_STOCK,
        'Requested quantity exceeds available stock.',
        {
          productId,
          availableQty: stock,
          requestedQty: nextQty,
        },
      )
    }

    item.qty = nextQty
    item.price = Number(product.price)
  } else {
    if (qty > stock) {
      return errorResponse(
        requestId,
        requestOrigin,
        409,
        ERROR.OUT_OF_STOCK,
        'Requested quantity exceeds available stock.',
        {
          productId,
          availableQty: stock,
          requestedQty: qty,
        },
      )
    }

    cart.items.push({
      productId,
      qty,
      price: Number(product.price),
    })
  }

  cart.updatedAt = new Date().toISOString()

  await ddbClient.send(
    new PutCommand({
      TableName: cartsTable,
      Item: cart,
    }),
  )

  return response(requestId, requestOrigin, 200, cart)
}

async function removeCartItem(requestId, requestOrigin, sessionId, productId) {
  const existing = await ddbClient.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  const cart = existing.Item ?? { sessionId, items: [], updatedAt: new Date().toISOString() }
  cart.items = cart.items.filter((row) => row.productId !== productId)
  cart.updatedAt = new Date().toISOString()

  await ddbClient.send(
    new PutCommand({
      TableName: cartsTable,
      Item: cart,
    }),
  )

  return response(requestId, requestOrigin, 200, cart)
}

async function fetchProductsByIds(productIds) {
  if (productIds.length === 0) {
    return new Map()
  }

  const productsResponse = await ddbClient.send(
    new BatchGetCommand({
      RequestItems: {
        [productsTable]: {
          Keys: productIds.map((id) => ({ id })),
        },
      },
    }),
  )

  const foundProducts = productsResponse.Responses?.[productsTable] ?? []
  return new Map(foundProducts.map((product) => [product.id, product]))
}

async function checkout(requestId, requestOrigin, body) {
  const parsed = parseJson(body)
  if (!parsed) {
    return errorResponse(
      requestId,
      requestOrigin,
      400,
      ERROR.INVALID_JSON,
      'Request body must be valid JSON.',
    )
  }

  if (typeof parsed.sessionId !== 'string' || parsed.sessionId.trim() === '') {
    return errorResponse(
      requestId,
      requestOrigin,
      400,
      ERROR.INVALID_REQUEST,
      'Body must include sessionId.',
    )
  }

  const sessionId = parsed.sessionId.trim()
  const cartResponse = await ddbClient.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  const cart = cartResponse.Item
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return errorResponse(requestId, requestOrigin, 400, ERROR.CART_EMPTY, 'Cart is empty.')
  }

  const invalidItem = cart.items.find((row) => toPositiveInteger(row.qty) === null)
  if (invalidItem) {
    return errorResponse(
      requestId,
      requestOrigin,
      400,
      ERROR.INVALID_REQUEST,
      'Cart contains an invalid quantity.',
      { productId: invalidItem.productId },
    )
  }

  const productIds = [...new Set(cart.items.map((row) => row.productId))]
  const productsById = await fetchProductsByIds(productIds)

  const missingProductIds = productIds.filter((id) => !productsById.has(id))
  if (missingProductIds.length > 0) {
    return errorResponse(
      requestId,
      requestOrigin,
      404,
      ERROR.PRODUCT_NOT_FOUND,
      'One or more products in the cart no longer exist.',
      { productIds: missingProductIds },
    )
  }

  const outOfStockItem = cart.items.find((row) => {
    const product = productsById.get(row.productId)
    return Number(product.stock) < Number(row.qty)
  })

  if (outOfStockItem) {
    const product = productsById.get(outOfStockItem.productId)
    return errorResponse(
      requestId,
      requestOrigin,
      409,
      ERROR.OUT_OF_STOCK,
      'Insufficient stock for one or more items.',
      {
        productId: outOfStockItem.productId,
        availableQty: Number(product.stock) || 0,
        requestedQty: Number(outOfStockItem.qty),
      },
    )
  }

  const orderItems = cart.items.map((row) => {
    const product = productsById.get(row.productId)
    return {
      productId: row.productId,
      qty: Number(row.qty),
      price: Number(product.price),
    }
  })

  const total = orderItems.reduce((sum, row) => sum + row.price * row.qty, 0)

  const orderId = `ord-${randomUUID().slice(0, 8)}`
  const createdAt = new Date().toISOString()

  const order = {
    orderId,
    sessionId,
    items: orderItems,
    total,
    status: 'confirmed',
    createdAt,
    confirmationCode: buildConfirmationCode(),
  }

  try {
    await ddbClient.send(
      new TransactWriteCommand({
        TransactItems: [
          ...orderItems.map((item) => ({
            Update: {
              TableName: productsTable,
              Key: { id: item.productId },
              UpdateExpression: 'SET stock = stock - :qty',
              ConditionExpression: 'attribute_exists(id) AND stock >= :qty',
              ExpressionAttributeValues: {
                ':qty': item.qty,
              },
            },
          })),
          {
            Put: {
              TableName: ordersTable,
              Item: order,
              ConditionExpression: 'attribute_not_exists(orderId)',
            },
          },
          {
            Delete: {
              TableName: cartsTable,
              Key: { sessionId },
            },
          },
        ],
      }),
    )
  } catch (error) {
    if (error?.name === 'TransactionCanceledException') {
      return errorResponse(
        requestId,
        requestOrigin,
        409,
        ERROR.STOCK_CONFLICT,
        'Inventory changed during checkout. Refresh your cart and try again.',
      )
    }

    throw error
  }

  return response(requestId, requestOrigin, 200, order)
}

async function getOrderById(requestId, requestOrigin, orderId) {
  const data = await ddbClient.send(
    new GetCommand({
      TableName: ordersTable,
      Key: { orderId },
    }),
  )

  if (!data.Item) {
    return errorResponse(
      requestId,
      requestOrigin,
      404,
      ERROR.INVALID_REQUEST,
      'Order not found.',
      { orderId },
    )
  }

  return response(requestId, requestOrigin, 200, data.Item)
}

export async function handler(event) {
  const requestId = randomUUID()
  const requestOrigin = event?.headers?.origin ?? event?.headers?.Origin

  try {
    const method = event.requestContext?.http?.method
    const path = event.rawPath ?? ''
    const params = event.pathParameters ?? {}

    if (method === 'OPTIONS') {
      return response(requestId, requestOrigin, 200, { ok: true })
    }

    if (method === 'GET' && path === '/products') {
      return await getProducts(requestId, requestOrigin)
    }

    if (method === 'GET' && path.startsWith('/products/')) {
      return await getProductById(requestId, requestOrigin, params.id)
    }

    if (method === 'GET' && path.startsWith('/cart/')) {
      return await getCart(requestId, requestOrigin, params.sessionId)
    }

    if (method === 'POST' && path.startsWith('/cart/')) {
      return await upsertCartItem(requestId, requestOrigin, params.sessionId, event.body)
    }

    if (method === 'DELETE' && path.startsWith('/cart/')) {
      return await removeCartItem(requestId, requestOrigin, params.sessionId, params.productId)
    }

    if (method === 'POST' && path === '/checkout') {
      return await checkout(requestId, requestOrigin, event.body)
    }

    if (method === 'GET' && path.startsWith('/orders/')) {
      return await getOrderById(requestId, requestOrigin, params.orderId)
    }

    return errorResponse(requestId, requestOrigin, 404, ERROR.INVALID_REQUEST, 'Route not found.')
  } catch (error) {
    console.error(
      JSON.stringify({
        requestId,
        message: 'Unhandled backend error.',
        errorName: error?.name,
        errorMessage: error?.message,
      }),
    )
    return errorResponse(
      requestId,
      requestOrigin,
      500,
      ERROR.INTERNAL,
      'Internal server error.',
    )
  }
}

export function __setDdbClientForTests(client) {
  ddbClient = client
}

export function __resetDdbClientForTests() {
  ddbClient = ddb
}
