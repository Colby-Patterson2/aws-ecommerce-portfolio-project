import type { Product } from '../types'

type CatalogPanelProps = {
  categories: string[]
  selectedCategory: string
  isLoading: boolean
  visibleProducts: Product[]
  onSelectCategory: (category: string) => void
  onAddToCart: (product: Product) => void
  addedProductIds: ReadonlySet<string>
}

export default function CatalogPanel({
  categories,
  selectedCategory,
  isLoading,
  visibleProducts,
  onSelectCategory,
  onAddToCart,
  addedProductIds,
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
              <picture>
                {product.imageUrlWebp ? (
                  <source srcSet={product.imageUrlWebp} type="image/webp" />
                ) : null}
                <img src={product.imageUrl} alt={product.name} loading="lazy" />
              </picture>
              <div className="card-body">
                <p className="category">{product.category}</p>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="card-footer">
                  <strong>${product.price}</strong>
                  <button
                    type="button"
                    className={addedProductIds.has(product.id) ? 'added-state' : undefined}
                    onClick={() => onAddToCart(product)}
                  >
                    {addedProductIds.has(product.id) ? 'Added' : 'Add to Cart'}
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
