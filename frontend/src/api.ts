import { catalog } from './data/catalog'
import type { Cart, CartItem, Order, Product } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
const mockMode = !API_BASE_URL
const mockCarts = new Map<string, Cart>()
const mockOrders = new Map<string, Order>()

const jsonHeaders = { 'Content-Type': 'application/json' }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Request failed (${response.status}): ${body}`)
  }

  return (await response.json()) as T
}

function nowIso(): string {
  return new Date().toISOString()
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
    return structuredClone(catalog)
  }
  return request<Product[]>('/products')
}

export async function getCart(sessionId: string): Promise<Cart> {
  if (mockMode) {
    return getMockCart(sessionId)
  }
  return request<Cart>(`/cart/${sessionId}`)
}

export async function addToCart(sessionId: string, item: CartItem): Promise<Cart> {
  if (mockMode) {
    const cart = getMockCart(sessionId)
    const existing = cart.items.find((row) => row.productId === item.productId)

    if (existing) {
      existing.qty += item.qty
    } else {
      cart.items.push(item)
    }

    cart.updatedAt = nowIso()
    mockCarts.set(sessionId, structuredClone(cart))
    return cart
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
    return cart
  }

  return request<Cart>(`/cart/${sessionId}/${productId}`, {
    method: 'DELETE',
  })
}

export async function checkout(sessionId: string): Promise<Order> {
  if (mockMode) {
    const cart = getMockCart(sessionId)
    const total = cart.items.reduce((sum, row) => sum + row.price * row.qty, 0)

    const order: Order = {
      orderId: `ord-${crypto.randomUUID().slice(0, 8)}`,
      sessionId,
      items: cart.items,
      total,
      status: 'confirmed',
      createdAt: nowIso(),
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
