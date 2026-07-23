import { catalog } from './data/catalog'
import type { Cart, CartItem, CartItemInput, Order, Product } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
const mockMode = !API_BASE_URL
const mockCarts = new Map<string, Cart>()
const mockOrders = new Map<string, Order>()
const mockInventory = new Map(catalog.map((product) => [product.id, product.stock]))

const jsonHeaders = { 'Content-Type': 'application/json' }

type ApiErrorBody = {
  code?: string
  message?: string
  details?: unknown
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function parseErrorBody(text: string): ApiErrorBody | null {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as ApiErrorBody
  } catch {
    return null
  }
}

function throwApiError(status: number, code: string, message: string, details?: unknown): never {
  throw new ApiError(status, message, code, details)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const bodyText = await response.text()
    const parsed = parseErrorBody(bodyText)
    throw new ApiError(
      response.status,
      parsed?.message ?? `Request failed (${response.status})`,
      parsed?.code,
      parsed?.details,
    )
  }

  return (await response.json()) as T
}

function nowIso(): string {
  return new Date().toISOString()
}

function toAvailableStock(productId: string): number {
  return mockInventory.get(productId) ?? 0
}

function getMockProduct(productId: string): Product | undefined {
  const product = catalog.find((entry) => entry.id === productId)
  if (!product) {
    return undefined
  }

  return {
    ...product,
    stock: toAvailableStock(productId),
  }
}

function buildMockProducts(): Product[] {
  return catalog.map((product) => ({
    ...product,
    stock: toAvailableStock(product.id),
  }))
}

function cloneCartWithServerPrices(cart: Cart): Cart {
  const withServerPrices = cart.items.map((item) => {
    const product = getMockProduct(item.productId)
    return {
      productId: item.productId,
      qty: item.qty,
      price: product ? product.price : item.price,
    }
  })

  return {
    ...cart,
    items: withServerPrices,
  }
}

function emptyCart(sessionId: string): Cart {
  return { sessionId, items: [], updatedAt: nowIso() }
}

function getMockCart(sessionId: string): Cart {
  if (!mockCarts.has(sessionId)) {
    mockCarts.set(sessionId, emptyCart(sessionId))
  }
  return structuredClone(mockCarts.get(sessionId)!)
}

export function isMockMode(): boolean {
  return mockMode
}

export async function getProducts(): Promise<Product[]> {
  if (mockMode) {
    return structuredClone(buildMockProducts())
  }
  return request<Product[]>('/products')
}

export async function getCart(sessionId: string): Promise<Cart> {
  if (mockMode) {
    return cloneCartWithServerPrices(getMockCart(sessionId))
  }
  return request<Cart>(`/cart/${sessionId}`)
}

export async function addToCart(sessionId: string, item: CartItemInput): Promise<Cart> {
  if (mockMode) {
    const product = getMockProduct(item.productId)
    if (!product) {
      throwApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.', {
        productId: item.productId,
      })
    }

    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throwApiError(400, 'INVALID_REQUEST', 'Body must include productId and qty.')
    }

    const cart = getMockCart(sessionId)
    const existing = cart.items.find((row) => row.productId === item.productId)
    const nextQty = (existing?.qty ?? 0) + item.qty

    if (nextQty > product.stock) {
      throwApiError(409, 'OUT_OF_STOCK', 'Requested quantity exceeds available stock.', {
        productId: item.productId,
        availableQty: product.stock,
        requestedQty: nextQty,
      })
    }

    if (existing) {
      existing.qty += item.qty
      existing.price = product.price
    } else {
      const cartItem: CartItem = {
        productId: item.productId,
        qty: item.qty,
        price: product.price,
      }
      cart.items.push(cartItem)
    }

    cart.updatedAt = nowIso()
    mockCarts.set(sessionId, structuredClone(cart))
    return cloneCartWithServerPrices(cart)
  }

  return request<Cart>(`/cart/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(item),
  })
}

export async function removeFromCart(sessionId: string, productId: string): Promise<Cart> {
  if (mockMode) {
    const cart = getMockCart(sessionId)
    cart.items = cart.items.filter((row) => row.productId !== productId)
    cart.updatedAt = nowIso()
    mockCarts.set(sessionId, structuredClone(cart))
    return cloneCartWithServerPrices(cart)
  }

  return request<Cart>(`/cart/${sessionId}/${productId}`, {
    method: 'DELETE',
  })
}

export async function checkout(sessionId: string): Promise<Order> {
  if (mockMode) {
    const cart = getMockCart(sessionId)
    if (cart.items.length === 0) {
      throwApiError(400, 'CART_EMPTY', 'Cart is empty.')
    }

    const orderItems: CartItem[] = cart.items.map((row) => {
      const product = getMockProduct(row.productId)
      if (!product) {
        throwApiError(404, 'PRODUCT_NOT_FOUND', 'One or more products in the cart no longer exist.', {
          productIds: [row.productId],
        })
      }

      if (row.qty > product.stock) {
        throwApiError(409, 'OUT_OF_STOCK', 'Insufficient stock for one or more items.', {
          productId: row.productId,
          availableQty: product.stock,
          requestedQty: row.qty,
        })
      }

      return {
        productId: row.productId,
        qty: row.qty,
        price: product.price,
      }
    })

    for (const row of orderItems) {
      mockInventory.set(row.productId, toAvailableStock(row.productId) - row.qty)
    }

    const total = orderItems.reduce((sum, row) => sum + row.price * row.qty, 0)

    const order: Order = {
      orderId: `ord-${crypto.randomUUID().slice(0, 8)}`,
      sessionId,
      items: orderItems,
      total,
      status: 'confirmed',
      createdAt: nowIso(),
      confirmationCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
    }

    mockOrders.set(order.orderId, structuredClone(order))
    mockCarts.set(sessionId, emptyCart(sessionId))
    return order
  }

  return request<Order>('/checkout', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}
