import type { Order } from '../types'

type OrderConfirmationPageProps = {
  order: Order | null
  onBackToCatalog: () => void
}

export default function OrderConfirmationPage({
  order,
  onBackToCatalog,
}: OrderConfirmationPageProps) {
  if (!order) {
    return (
      <section className="order-page">
        <div className="order-success">
          <h3>Order Not Found</h3>
          <p>We could not find that order in this session.</p>
          <button type="button" onClick={onBackToCatalog}>
            Back to Catalog
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="order-page">
      <div className="order-success order-card">
        <h3>Order Confirmed</h3>
        <p>Order ID: {order.orderId}</p>
        <p>Status: {order.status}</p>
        <p>Total: ${order.total.toFixed(2)}</p>
        <p>Placed: {new Date(order.createdAt).toLocaleString()}</p>
        <button type="button" onClick={onBackToCatalog}>
          Back to Catalog
        </button>
      </div>
    </section>
  )
}
