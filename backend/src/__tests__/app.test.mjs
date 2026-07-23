import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { __resetDdbClientForTests, __setDdbClientForTests, handler } from '../app.mjs'

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE ?? 'ProductsTable'
const CARTS_TABLE = process.env.CARTS_TABLE ?? 'CartsTable'
const ORDERS_TABLE = process.env.ORDERS_TABLE ?? 'OrdersTable'

function createEvent(method, path, body, pathParameters = {}) {
  return {
    requestContext: { http: { method } },
    rawPath: path,
    pathParameters,
    headers: { origin: 'http://localhost:5173' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

function createMockClient(seed = {}) {
  const products = new Map((seed.products ?? []).map((item) => [item.id, { ...item }]))
  const carts = new Map((seed.carts ?? []).map((item) => [item.sessionId, structuredClone(item)]))
  const orders = new Map((seed.orders ?? []).map((item) => [item.orderId, structuredClone(item)]))

  const tables = {
    [PRODUCTS_TABLE]: products,
    [CARTS_TABLE]: carts,
    [ORDERS_TABLE]: orders,
  }

  function getTable(tableName) {
    const table = tables[tableName]
    if (!table) {
      throw new Error(`Unknown table ${tableName}`)
    }
    return table
  }

  function getKeyValue(key) {
    return key.id ?? key.sessionId ?? key.orderId
  }

  function cloneItem(item) {
    return item ? structuredClone(item) : item
  }

  return {
    state: { products, carts, orders },
    send: async (command) => {
      if (command instanceof ScanCommand) {
        const table = getTable(command.input.TableName)
        return { Items: [...table.values()].map(cloneItem) }
      }

      if (command instanceof GetCommand) {
        const table = getTable(command.input.TableName)
        return { Item: cloneItem(table.get(getKeyValue(command.input.Key))) }
      }

      if (command instanceof PutCommand) {
        const table = getTable(command.input.TableName)
        table.set(getKeyValue(command.input.Item), cloneItem(command.input.Item))
        return {}
      }

      if (command instanceof DeleteCommand) {
        const table = getTable(command.input.TableName)
        table.delete(getKeyValue(command.input.Key))
        return {}
      }

      if (command instanceof BatchGetCommand) {
        const output = { Responses: {} }

        for (const [tableName, request] of Object.entries(command.input.RequestItems ?? {})) {
          const table = getTable(tableName)
          output.Responses[tableName] = (request.Keys ?? [])
            .map((key) => cloneItem(table.get(getKeyValue(key))))
            .filter(Boolean)
        }

        return output
      }

      if (command instanceof TransactWriteCommand) {
        const operations = command.input.TransactItems ?? []

        for (const operation of operations) {
          if (operation.Update) {
            const table = getTable(operation.Update.TableName)
            const id = operation.Update.Key.id
            const row = table.get(id)
            const qty = Number(operation.Update.ExpressionAttributeValues[':qty'])

            if (!row || Number(row.stock) < qty) {
              const error = new Error('Transaction cancelled')
              error.name = 'TransactionCanceledException'
              throw error
            }
          }
        }

        for (const operation of operations) {
          if (operation.Update) {
            const table = getTable(operation.Update.TableName)
            const id = operation.Update.Key.id
            const row = table.get(id)
            const qty = Number(operation.Update.ExpressionAttributeValues[':qty'])
            table.set(id, { ...row, stock: Number(row.stock) - qty })
            continue
          }

          if (operation.Put) {
            const table = getTable(operation.Put.TableName)
            table.set(getKeyValue(operation.Put.Item), cloneItem(operation.Put.Item))
            continue
          }

          if (operation.Delete) {
            const table = getTable(operation.Delete.TableName)
            table.delete(getKeyValue(operation.Delete.Key))
          }
        }

        return {}
      }

      throw new Error(`Unsupported command ${command.constructor.name}`)
    },
  }
}

function parseResponse(response) {
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: JSON.parse(response.body),
  }
}

test.afterEach(() => {
  __resetDdbClientForTests()
})

test('POST /cart ignores client-supplied price and uses server price', async () => {
  const mock = createMockClient({
    products: [{ id: 'p1', name: 'Trail Bottle', price: 45, stock: 10 }],
  })
  __setDdbClientForTests(mock)

  const response = await handler(
    createEvent('POST', '/cart/sess-1', { productId: 'p1', qty: 1, price: 1 }, { sessionId: 'sess-1' }),
  )
  const parsed = parseResponse(response)

  assert.equal(parsed.statusCode, 200)
  assert.equal(parsed.body.items[0].price, 45)
  assert.equal(parsed.body.items[0].qty, 1)
})

test('POST /cart returns OUT_OF_STOCK when requested quantity exceeds stock', async () => {
  const mock = createMockClient({
    products: [{ id: 'p2', name: 'Duffel', price: 120, stock: 2 }],
  })
  __setDdbClientForTests(mock)

  const response = await handler(
    createEvent('POST', '/cart/sess-2', { productId: 'p2', qty: 3 }, { sessionId: 'sess-2' }),
  )
  const parsed = parseResponse(response)

  assert.equal(parsed.statusCode, 409)
  assert.equal(parsed.body.code, 'OUT_OF_STOCK')
  assert.equal(parsed.body.details.availableQty, 2)
})

test('POST /checkout recalculates total from current product prices and decrements stock', async () => {
  const mock = createMockClient({
    products: [{ id: 'p3', name: 'Jacket', price: 100, stock: 4 }],
  })
  __setDdbClientForTests(mock)

  await handler(createEvent('POST', '/cart/sess-3', { productId: 'p3', qty: 2 }, { sessionId: 'sess-3' }))

  const product = mock.state.products.get('p3')
  product.price = 130

  const checkoutResponse = await handler(
    createEvent('POST', '/checkout', { sessionId: 'sess-3' }),
  )
  const parsed = parseResponse(checkoutResponse)

  assert.equal(parsed.statusCode, 200)
  assert.equal(parsed.body.total, 260)
  assert.equal(parsed.body.items[0].price, 130)
  assert.equal(mock.state.products.get('p3').stock, 2)
  assert.equal(mock.state.carts.has('sess-3'), false)
  assert.equal(mock.state.orders.size, 1)
})

test('Concurrent checkout on last stock permits only one success', async () => {
  const mock = createMockClient({
    products: [{ id: 'p4', name: 'Lantern', price: 60, stock: 1 }],
  })
  __setDdbClientForTests(mock)

  await handler(createEvent('POST', '/cart/sess-a', { productId: 'p4', qty: 1 }, { sessionId: 'sess-a' }))
  await handler(createEvent('POST', '/cart/sess-b', { productId: 'p4', qty: 1 }, { sessionId: 'sess-b' }))

  const [resA, resB] = await Promise.all([
    handler(createEvent('POST', '/checkout', { sessionId: 'sess-a' })),
    handler(createEvent('POST', '/checkout', { sessionId: 'sess-b' })),
  ])

  const parsedA = parseResponse(resA)
  const parsedB = parseResponse(resB)
  const statuses = [parsedA.statusCode, parsedB.statusCode].sort((a, b) => a - b)

  assert.deepEqual(statuses, [200, 409])
  assert.equal(mock.state.products.get('p4').stock, 0)
  assert.equal(mock.state.orders.size, 1)
})

test('POST /checkout rejects missing sessionId', async () => {
  const mock = createMockClient({})
  __setDdbClientForTests(mock)

  const response = await handler(createEvent('POST', '/checkout', {}))
  const parsed = parseResponse(response)

  assert.equal(parsed.statusCode, 400)
  assert.equal(parsed.body.code, 'INVALID_REQUEST')
})
