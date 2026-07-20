import type { Cart, Product } from '../types'

type CheckoutPageProps = {
  cart: Cart
  cartTotal: number
  productById: Map<string, Product>
  isCheckingOut: boolean
  onRemove: (productId: string) => void
  onPlaceOrder: () => void
  onContinueShopping: () => void
}

export default function CheckoutPage({
  cart,
  cartTotal,
  productById,
  isCheckingOut,
  onRemove,
  onPlaceOrder,
  onContinueShopping,
}: CheckoutPageProps) {
  return (
    <section className="checkout-page">
      <div className="panel-head">
        <h2>Checkout</h2>
        <p>{cart.items.length} item types</p>
      </div>

      {cart.items.length === 0 ? (
        <div className="checkout-empty">
          <h3>Your cart is empty</h3>
          <p>Add products from the catalog, then return here to place your order.</p>
          <button type="button" onClick={onContinueShopping}>
            Continue Shopping
          </button>
        </div>
      ) : (
        <>
          <ul className="cart-list checkout-list">
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
                  <button type="button" onClick={() => onRemove(item.productId)}>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="checkout-box checkout-summary">
            <p>Total</p>
            <h3>${cartTotal.toFixed(2)}</h3>
            <button type="button" onClick={onPlaceOrder} disabled={isCheckingOut}>
              {isCheckingOut ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
