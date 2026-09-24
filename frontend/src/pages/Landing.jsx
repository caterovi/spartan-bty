import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowRight,
  ChevronRight,
  LoaderCircle,
  MapPin,
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from 'lucide-react';

import { Link } from 'react-router-dom';

import api from '../api/axiosInstance';
import logo from '../assets/Spartan_BTY_logo.webp';
import StorefrontAccountLinks from '../components/StorefrontAccountLinks';
import AddToCartButton from '../components/AddToCartButton';
import '../styles/storefront.css';

const UNCATEGORIZED = 'Uncategorized';

function formatPrice(value) {
  if (value === null || value === undefined) {
    return 'Price unavailable';
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value));
}

function ProductImage({ product }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (product.imageUrl && !imageFailed) {
    return (
      <img
        src={product.imageUrl}
        alt={`${product.name} product`}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="storefront-product-placeholder" aria-hidden="true">
      <Sparkles size={28} strokeWidth={1.4} />
      <span>Product image coming soon</span>
    </div>
  );
}

function ProductCard({ product }) {
  const category = product.category || UNCATEGORIZED;

  return (
    <article className="storefront-product-card">
      <div className="storefront-product-image">
        <ProductImage product={product} />

        <span
          className={`storefront-availability storefront-availability-${product.availability.status}`}
        >
          {product.availability.label}
        </span>
      </div>

      <div className="storefront-product-copy">
        <p className="storefront-product-category">{category}</p>
        <h3>{product.name}</h3>
        <p className="storefront-product-description">
          {product.description ||
            'More product information will be added soon.'}
        </p>

        <div className="storefront-product-footer">
          <div>
            <strong>{formatPrice(product.price)}</strong>
            <span>{product.sku}</span>
          </div>

          <Link
            to={`/products/${product.id}`}
            aria-label={`View details for ${product.name}`}
          >
            View details
            <ChevronRight size={16} />
          </Link>
        </div>
        <AddToCartButton
          product={product}
          returnTo={`/products/${product.id}`}
          compact
        />
      </div>
    </article>
  );
}

function CatalogSkeleton() {
  return (
    <div
      className="storefront-product-grid"
      aria-label="Loading products"
      aria-busy="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div className="storefront-product-skeleton" key={index}>
          <div />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/storefront/products', {
          signal: controller.signal,
        });

        setProducts(response.data.products || []);
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED') {
          return;
        }

        setProducts([]);
        setError(
          requestError.response?.data?.message ||
            'The product catalog could not be loaded. Please try again.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => controller.abort();
  }, [requestVersion]);

  const categories = useMemo(
    () =>
      [...new Set(products.map((product) =>
        product.category || UNCATEGORIZED
      ))].sort((first, second) => first.localeCompare(second)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const productCategory = product.category || UNCATEGORIZED;
      const matchesCategory =
        category === 'all' || productCategory === category;
      const matchesSearch =
        !query ||
        [
          product.name,
          product.sku,
          product.description,
          productCategory,
        ].some((value) =>
          String(value || '').toLowerCase().includes(query)
        );

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
  };

  return (
    <div className="storefront-page">
      <header className="storefront-header">
        <div className="storefront-shell storefront-header-inner">
          <Link to="/" className="storefront-brand" aria-label="Spartan BTY home">
            <img src={logo} alt="" />
            <span>Spartan <strong>BTY</strong></span>
          </Link>

          <nav className="storefront-nav" aria-label="Storefront navigation">
            <a href="#products">Products</a>
            <a href="#ordering">How it works</a>
            <a href="#contact">Contact</a>
          </nav>

          <StorefrontAccountLinks />
        </div>
      </header>

      <main>
        <section className="storefront-hero">
          <div className="storefront-hero-orb storefront-hero-orb-one" />
          <div className="storefront-hero-orb storefront-hero-orb-two" />

          <div className="storefront-shell storefront-hero-grid">
            <div className="storefront-hero-copy">
              <p className="storefront-eyebrow">BEAUTY FROM IMUS, CAVITE</p>
              <h1>Discover your next Spartan BTY favorite.</h1>
              <p className="storefront-hero-description">
                Explore the current Spartan BTY catalog in one place, with
                product information and availability drawn directly from our
                management system.
              </p>

              <div className="storefront-hero-actions">
                <a href="#products" className="storefront-primary-button">
                  Shop products
                  <ArrowRight size={17} />
                </a>
                <a href="#ordering" className="storefront-text-link">
                  How ordering works
                </a>
              </div>

              <p className="storefront-phase-note">
                <ShieldCheck size={16} />
                Product browsing, customer accounts, carts, and Sales-reviewed
                ordering are now available. Online payment is not included.
              </p>
            </div>

            <div className="storefront-hero-art" aria-hidden="true">
              <div className="storefront-hero-card storefront-hero-card-back" />
              <div className="storefront-hero-card storefront-hero-card-main">
                <span>SPARTAN BTY</span>
                <img src={logo} alt="" />
                <strong>Beauty, clearly presented.</strong>
                <small>Established 2018</small>
              </div>
              <Sparkles className="storefront-hero-sparkle" size={34} />
            </div>
          </div>
        </section>

        <section id="products" className="storefront-products-section">
          <div className="storefront-shell">
            <div className="storefront-section-heading">
              <div>
                <p className="storefront-eyebrow">OUR PRODUCTS</p>
                <h2>Explore the collection</h2>
              </div>
              <p>
                Search the live catalog or narrow it by the categories currently
                recorded for each product.
              </p>
            </div>

            {!loading && !error && products.length > 0 && (
              <div className="storefront-catalog-tools">
                <label className="storefront-search-field">
                  <span>Search products</span>
                  <div>
                    <Search size={18} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, category, or SKU"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Clear product search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </label>

                <label className="storefront-category-field">
                  <span>Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="all">All products</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="storefront-catalog-status" aria-live="polite">
              {!loading && !error && products.length > 0 && (
                <span>
                  Showing {filteredProducts.length} of {products.length}{' '}
                  {products.length === 1 ? 'product' : 'products'}
                </span>
              )}
            </div>

            {loading ? (
              <CatalogSkeleton />
            ) : error ? (
              <div className="storefront-state-card" role="alert">
                <PackageSearch size={30} />
                <h3>We could not load the catalog</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="storefront-primary-button"
                  onClick={() => setRequestVersion((version) => version + 1)}
                >
                  <LoaderCircle size={17} />
                  Try again
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="storefront-state-card">
                <PackageSearch size={30} />
                <h3>No products are available yet</h3>
                <p>Active products will appear here once they are added to the catalog.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="storefront-state-card">
                <Search size={30} />
                <h3>No matching products</h3>
                <p>Try a different search term or view every category.</p>
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="storefront-product-grid">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="ordering" className="storefront-ordering-section">
          <div className="storefront-shell">
            <div className="storefront-section-heading storefront-section-heading-light">
              <div>
                <p className="storefront-eyebrow">HOW ORDERING WILL WORK</p>
                <h2>A clear path from browsing to after-sales care</h2>
              </div>
              <p>
                Customer orders are reviewed by Sales before they enter the
                existing confirmation and fulfillment workflow.
              </p>
            </div>

            <ol className="storefront-ordering-grid">
              <li>
                <span>01</span>
                <Store size={22} />
                <h3>Browse products</h3>
                <p>Explore active products, details, prices, and current availability.</p>
              </li>
              <li>
                <span>02</span>
                <ShieldCheck size={22} />
                <h3>Account and order</h3>
                <p>Create an account, review your cart, and place an order using
                  your saved contact and delivery details.</p>
              </li>
              <li>
                <span>03</span>
                <Sparkles size={22} />
                <h3>Staff review and care</h3>
                <p>Online orders pass through Sales review, CDM, Fulfillment, and CRM.</p>
              </li>
            </ol>
          </div>
        </section>

        <section id="contact" className="storefront-contact-section">
          <div className="storefront-shell storefront-contact-grid">
            <div>
              <p className="storefront-eyebrow">CONTACT & LOCATION</p>
              <h2>Visit Spartan BTY Inc.</h2>
              <p>
                The current company records provide the location below. A public
                phone number and email address are not configured in this system yet.
              </p>
            </div>

            <address className="storefront-address-card">
              <MapPin size={24} />
              <div>
                <strong>Spartan BTY Inc.</strong>
                <span>Tamsui Avenue, Bayan Luma II</span>
                <span>Imus, Cavite 4103</span>
              </div>
            </address>
          </div>
        </section>
      </main>

      <footer className="storefront-footer">
        <div className="storefront-shell storefront-footer-inner">
          <div className="storefront-footer-brand">
            <img src={logo} alt="" />
            <div>
              <strong>Spartan BTY Inc.</strong>
              <span>Beauty and cosmetics · Established 2018</span>
            </div>
          </div>

          <div className="storefront-footer-meta">
            <Link to="/login">Authorized staff access</Link>
            <span>© {new Date().getFullYear()} Spartan BTY Inc.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
