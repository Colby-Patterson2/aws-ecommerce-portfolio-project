import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const productsTable = process.env.PRODUCTS_TABLE
const cartsTable = process.env.CARTS_TABLE
const ordersTable = process.env.ORDERS_TABLE

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': '*',
    },
    body: JSON.stringify(body),
  }
}

function parseJson(body) {
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

async function getProducts() {
  const data = await ddb.send(new ScanCommand({ TableName: productsTable }))
  return response(200, (data.Items ?? []).sort((a, b) => a.name.localeCompare(b.name)))
}

async function getProductById(id) {
  const data = await ddb.send(
    new GetCommand({
      TableName: productsTable,
      Key: { id },
    }),
  )

  if (!data.Item) {
    return response(404, { message: 'Product not found.' })
  }

  return response(200, data.Item)
}

async function getCart(sessionId) {
  const data = await ddb.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  return response(200, data.Item ?? { sessionId, items: [], updatedAt: new Date().toISOString() })
}

async function upsertCartItem(sessionId, body) {
  const parsed = parseJson(body)
  if (!parsed || !parsed.productId || !parsed.qty || !parsed.price) {
    return response(400, { message: 'Body must include productId, qty, price.' })
  }

  const existing = await ddb.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  const cart = existing.Item ?? { sessionId, items: [], updatedAt: new Date().toISOString() }

  const item = cart.items.find((row) => row.productId === parsed.productId)
  if (item) {
    item.qty += Number(parsed.qty)
  } else {
    cart.items.push({
      productId: String(parsed.productId),
      qty: Number(parsed.qty),
      price: Number(parsed.price),
    })
  }

  cart.updatedAt = new Date().toISOString()

  await ddb.send(
    new PutCommand({
      TableName: cartsTable,
      Item: cart,
    }),
  )

  return response(200, cart)
}

async function removeCartItem(sessionId, productId) {
  const existing = await ddb.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  const cart = existing.Item ?? { sessionId, items: [], updatedAt: new Date().toISOString() }
  cart.items = cart.items.filter((row) => row.productId !== productId)
  cart.updatedAt = new Date().toISOString()

  await ddb.send(
    new PutCommand({
      TableName: cartsTable,
      Item: cart,
    }),
  )

  return response(200, cart)
}

async function checkout(body) {
  const parsed = parseJson(body)
  if (!parsed || !parsed.sessionId) {
    return response(400, { message: 'Body must include sessionId.' })
  }

  const sessionId = String(parsed.sessionId)
  const cartResponse = await ddb.send(
    new GetCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  const cart = cartResponse.Item
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return response(400, { message: 'Cart is empty.' })
  }

  const total = cart.items.reduce((sum, row) => sum + Number(row.price) * Number(row.qty), 0)

  const order = {
    orderId: `ord-${randomUUID().slice(0, 8)}`,
    sessionId,
    items: cart.items,
    total,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  }

  await ddb.send(
    new PutCommand({
      TableName: ordersTable,
      Item: order,
    }),
  )

  await ddb.send(
    new DeleteCommand({
      TableName: cartsTable,
      Key: { sessionId },
    }),
  )

  return response(200, order)
}

async function getOrderById(orderId) {
  const data = await ddb.send(
    new GetCommand({
      TableName: ordersTable,
      Key: { orderId },
    }),
  )

  if (!data.Item) {
    return response(404, { message: 'Order not found.' })
  }

  return response(200, data.Item)
}

export async function handler(event) {
  try {
    const method = event.requestContext?.http?.method
    const path = event.rawPath ?? ''
    const params = event.pathParameters ?? {}

    if (method === 'OPTIONS') {
      return response(200, { ok: true })
    }

    if (method === 'GET' && path === '/products') {
      return await getProducts()
    }

    if (method === 'GET' && path.startsWith('/products/')) {
      return await getProductById(params.id)
    }

    if (method === 'GET' && path.startsWith('/cart/')) {
      return await getCart(params.sessionId)
    }

    if (method === 'POST' && path.startsWith('/cart/')) {
      return await upsertCartItem(params.sessionId, event.body)
    }

    if (method === 'DELETE' && path.startsWith('/cart/')) {
      return await removeCartItem(params.sessionId, params.productId)
    }

    if (method === 'POST' && path === '/checkout') {
      return await checkout(event.body)
    }

    if (method === 'GET' && path.startsWith('/orders/')) {
      return await getOrderById(params.orderId)
    }

    return response(404, { message: 'Route not found.' })
  } catch (error) {
    console.error(error)
    return response(500, { message: 'Internal server error.' })
  }
}
