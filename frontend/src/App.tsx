import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  addToCart,
  checkout,
  getCart,
  getProducts,
  isMockMode,
  removeFromCart,
} from './api'
import CartModal from './components/CartModal'
import CatalogPanel from './components/CatalogPanel'
import CheckoutPage from './components/CheckoutPage'
import OrderConfirmationPage from './components/OrderConfirmationPage'
import type { Cart, Order, Product } from './types'
import './App.css'

const SESSION_KEY = 'ecommerce-demo-session'

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

  async function handleAddToCart(product: Product) {
    try {
      setError('')
      const updatedCart = await addToCart(sessionId, {
        productId: product.id,
        qty: 1,
        price: product.price,
      })
      setCart(updatedCart)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to add item.')
    }
  }

  async function handleRemoveFromCart(productId: string) {
    try {
      setError('')
      const updatedCart = await removeFromCart(sessionId, productId)
      setCart(updatedCart)
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : 'Failed to remove item.',
      )
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
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Checkout failed. Try again.',
      )
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
        <div className="hero-stats">
          <article>
            <h2>{products.length}</h2>
            <p>Products</p>
          </article>
          <article>
            <h2>{cart.items.reduce((sum, item) => sum + item.qty, 0)}</h2>
            <p>Items in Cart</p>
          </article>
          <article>
            <h2>{isMockMode() ? 'Mock' : 'Live'}</h2>
            <p>API Mode</p>
          </article>
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
        <p>{isMockMode() ? 'Using local mock API mode.' : 'Connected to live AWS API.'}</p>
      </footer>
    </div>
  )
}

export default App
