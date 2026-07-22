import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ApiError,
  addToCart,
  checkout,
  getCart,
  getProducts,
  removeFromCart,
} from './api'
import CartModal from './components/CartModal'
import CatalogPanel from './components/CatalogPanel'
import CheckoutPage from './components/CheckoutPage'
import OrderConfirmationPage from './components/OrderConfirmationPage'
import type { Cart, Order, Product } from './types'
import './App.css'

const SESSION_KEY = 'ecommerce-demo-session'
const ADDED_LABEL_DURATION_MS = 3000

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'OUT_OF_STOCK') {
      const details = error.details as
        | { productId?: string; availableQty?: number; requestedQty?: number }
        | undefined

      if (details?.productId && Number.isFinite(details.availableQty)) {
        return `Only ${details.availableQty} item(s) of ${details.productId} are available.`
      }

      return error.message
    }

    if (error.code === 'PRODUCT_NOT_FOUND') {
      return 'This product is no longer available.'
    }

    if (error.code === 'CART_EMPTY') {
      return 'Your cart is empty.'
    }

    if (error.code === 'STOCK_CONFLICT') {
      return 'Inventory changed while checking out. Refresh your cart and try again.'
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

function getSessionId(): string {
  const saved = localStorage.getItem(SESSION_KEY)
  if (saved) {
    return saved
  }

  const created = `session-${crypto.randomUUID().slice(0, 10)}`
  localStorage.setItem(SESSION_KEY, created)
  return created
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sessionId] = useState(getSessionId)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart>({ sessionId, items: [], updatedAt: '' })
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(() => new Set())
  const addedLabelTimersRef = useRef<Map<string, number>>(new Map())

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  const categories = useMemo(() => {
    return ['All', ...new Set(products.map((product) => product.category))]
  }, [products])

  const visibleProducts = useMemo(() => {
    if (selectedCategory === 'All') {
      return products
    }

    return products.filter((product) => product.category === selectedCategory)
  }, [products, selectedCategory])

  const cartTotal = useMemo(() => {
    return cart.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  }, [cart.items])

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [fetchedProducts, fetchedCart] = await Promise.all([
          getProducts(),
          getCart(sessionId),
        ])
        setProducts(fetchedProducts)
        setCart(fetchedCart)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load storefront data.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [sessionId])

  useEffect(() => {
    return () => {
      for (const timerId of addedLabelTimersRef.current.values()) {
        window.clearTimeout(timerId)
      }
      addedLabelTimersRef.current.clear()
    }
  }, [])

  async function handleAddToCart(product: Product) {
    try {
      setError('')
      const updatedCart = await addToCart(sessionId, {
        productId: product.id,
        qty: 1,
      })
      setCart(updatedCart)

      setAddedProductIds((previous) => {
        const next = new Set(previous)
        next.add(product.id)
        return next
      })

      const existingTimer = addedLabelTimersRef.current.get(product.id)
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer)
      }

      const timerId = window.setTimeout(() => {
        setAddedProductIds((previous) => {
          if (!previous.has(product.id)) {
            return previous
          }

          const next = new Set(previous)
          next.delete(product.id)
          return next
        })
        addedLabelTimersRef.current.delete(product.id)
      }, ADDED_LABEL_DURATION_MS)

      addedLabelTimersRef.current.set(product.id, timerId)
    } catch (addError) {
      setError(toErrorMessage(addError))
    }
  }

  async function handleRemoveFromCart(productId: string) {
    try {
      setError('')
      const updatedCart = await removeFromCart(sessionId, productId)
      setCart(updatedCart)
    } catch (removeError) {
      setError(toErrorMessage(removeError))
    }
  }

  async function handleCheckout() {
    try {
      setError('')
      setIsCheckingOut(true)
      const order = await checkout(sessionId)
      setConfirmedOrder(order)
      setCart({ sessionId, items: [], updatedAt: new Date().toISOString() })
      setIsCartOpen(false)
      navigate(`/order/${order.orderId}`, { state: { order } })
    } catch (checkoutError) {
      setError(toErrorMessage(checkoutError))
    } finally {
      setIsCheckingOut(false)
    }
  }

  function handleGoToCheckout() {
    setIsCartOpen(false)
    navigate('/checkout')
  }

  function handleBackToCatalog() {
    setIsCartOpen(false)
    navigate('/')
  }

  const orderFromRoute =
    location.pathname.startsWith('/order/') &&
    typeof location.state === 'object' &&
    location.state !== null &&
    'order' in location.state
      ? ((location.state as { order?: Order }).order ?? confirmedOrder)
      : confirmedOrder

  return (
    <div className="app-shell">
      <header className="hero-banner">
        <div>
          <p className="eyebrow">Portfolio Project · React + AWS</p>
          <h1>Northstar Outfitters</h1>
          <p className="hero-copy">
            A demo ecommerce storefront with a serverless backend on API Gateway,
            Lambda, and DynamoDB.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="cart-trigger" onClick={() => setIsCartOpen(true)}>
            Cart ({cart.items.reduce((sum, item) => sum + item.qty, 0)})
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}

      <main className="content-grid route-grid">
        <Routes>
          <Route
            path="/"
            element={
              <CatalogPanel
                categories={categories}
                selectedCategory={selectedCategory}
                isLoading={isLoading}
                visibleProducts={visibleProducts}
                onSelectCategory={setSelectedCategory}
                onAddToCart={handleAddToCart}
                addedProductIds={addedProductIds}
              />
            }
          />
          <Route
            path="/checkout"
            element={
              <CheckoutPage
                cart={cart}
                cartTotal={cartTotal}
                productById={productById}
                isCheckingOut={isCheckingOut}
                onRemove={handleRemoveFromCart}
                onPlaceOrder={handleCheckout}
                onContinueShopping={handleBackToCatalog}
              />
            }
          />
          <Route
            path="/order/:orderId"
            element={<OrderConfirmationPage order={orderFromRoute} onBackToCatalog={handleBackToCatalog} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <CartModal
        isOpen={isCartOpen}
        cart={cart}
        cartTotal={cartTotal}
        productById={productById}
        onClose={() => setIsCartOpen(false)}
        onRemove={handleRemoveFromCart}
        onGoToCheckout={handleGoToCheckout}
      />

      <footer className="footnote">
        <p>Session: {sessionId}</p>
      </footer>
    </div>
  )
}

export default App
