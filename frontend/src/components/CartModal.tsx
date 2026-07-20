import type { Cart, Product } from '../types'

type CartModalProps = {
  isOpen: boolean
  cart: Cart
  cartTotal: number
  productById: Map<string, Product>
  onClose: () => void
  onRemove: (productId: string) => void
  onGoToCheckout: () => void
}

export default function CartModal({
  isOpen,
  cart,
  cartTotal,
  productById,
  onClose,
  onRemove,
  onGoToCheckout,
}: CartModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <aside
        className="cart-panel modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <h2>Cart</h2>
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
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
                <button type="button" onClick={() => onRemove(item.productId)}>
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
          <button type="button" onClick={onGoToCheckout}>
            Go to Checkout
          </button>
        </div>
      </aside>
    </div>
  )
}
