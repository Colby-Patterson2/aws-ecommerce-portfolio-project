import { useEffect, useMemo, useState } from 'react'
import {
  addToCart,
  checkout,
  getCart,
  getProducts,
  isMockMode,
  removeFromCart,
} from './api'
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
  const [sessionId] = useState(getSessionId)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart>({ sessionId, items: [], updatedAt: '' })
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null)

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
      setIsCheckingOut(true)
      const order = await checkout(sessionId)
      setConfirmedOrder(order)
      setCart({ sessionId, items: [], updatedAt: new Date().toISOString() })
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
      </header>

      {error && <p className="error-banner">{error}</p>}

      <main className="content-grid">
        <section className="catalog-panel">
          <div className="panel-head">
            <h2>Catalog</h2>
            <div className="category-row" role="tablist" aria-label="Filter products">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={selectedCategory === category ? 'chip active' : 'chip'}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="status">Loading products...</p>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <img src={product.imageUrl} alt={product.name} loading="lazy" />
                  <div className="card-body">
                    <p className="category">{product.category}</p>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <div className="card-footer">
                      <strong>${product.price}</strong>
                      <button type="button" onClick={() => handleAddToCart(product)}>
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="cart-panel">
          <div className="panel-head">
            <h2>Cart</h2>
            <p>{cart.items.length} item types</p>
          </div>

          <ul className="cart-list">
            {cart.items.map((item) => {
              const product = productById.get(item.productId)
              return (
                <li key={item.productId}>
                  <div>
                    <h3>{product?.name ?? item.productId}</h3>
                    <p>
                      Qty {item.qty} · ${item.price} each
                    </p>
                  </div>
                  <button type="button" onClick={() => handleRemoveFromCart(item.productId)}>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>

          {cart.items.length === 0 && <p className="status">Your cart is currently empty.</p>}

          <div className="checkout-box">
            <p>Total</p>
            <h3>${cartTotal.toFixed(2)}</h3>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={cart.items.length === 0 || isCheckingOut}
            >
              {isCheckingOut ? 'Processing...' : 'Simulate Checkout'}
            </button>
          </div>

          {confirmedOrder && (
            <div className="order-success">
              <h3>Order Confirmed</h3>
              <p>Order ID: {confirmedOrder.orderId}</p>
              <p>Status: {confirmedOrder.status}</p>
              <p>Total: ${confirmedOrder.total.toFixed(2)}</p>
            </div>
          )}
        </aside>
      </main>
      <footer className="footnote">
        <p>Session: {sessionId}</p>
        <p>{isMockMode() ? 'Using local mock API mode.' : 'Connected to live AWS API.'}</p>
      </footer>
    </div>
  )
}

export default App
