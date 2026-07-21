export type Product = {
  id: string
  name: string
  description: string
  price: number
  imageUrl: string
  imageUrlWebp?: string
  stock: number
  category: string
}

export type CartItem = {
  productId: string
  qty: number
  price: number
}

export type Cart = {
  sessionId: string
  items: CartItem[]
  updatedAt: string
}

export type Order = {
  orderId: string
  sessionId: string
  items: CartItem[]
  total: number
  status: 'confirmed'
  createdAt: string
}
