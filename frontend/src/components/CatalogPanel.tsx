import type { Product } from '../types'

type CatalogPanelProps = {
  categories: string[]
  selectedCategory: string
  isLoading: boolean
  visibleProducts: Product[]
  onSelectCategory: (category: string) => void
  onAddToCart: (product: Product) => void
}

export default function CatalogPanel({
  categories,
  selectedCategory,
  isLoading,
  visibleProducts,
  onSelectCategory,
  onAddToCart,
}: CatalogPanelProps) {
  return (
    <section className="catalog-panel">
      <div className="panel-head">
        <h2>Catalog</h2>
        <div className="category-row" role="tablist" aria-label="Filter products">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={selectedCategory === category ? 'chip active' : 'chip'}
              onClick={() => onSelectCategory(category)}
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
                  <button type="button" onClick={() => onAddToCart(product)}>
                    Add to Cart
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
