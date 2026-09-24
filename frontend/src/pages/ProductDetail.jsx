import { useEffect, useState } from 'react';

import {
  ArrowLeft,
  PackageSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import api from '../api/axiosInstance';
import logo from '../assets/Spartan_BTY_logo.webp';
import StorefrontAccountLinks from '../components/StorefrontAccountLinks';
import '../styles/storefront.css';

function formatPrice(value) {
  if (value === null || value === undefined) {
    return 'Price unavailable';
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value));
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    window.scrollTo({ top: 0 });

    async function loadProduct() {
      setLoading(true);
      setError('');
      setImageFailed(false);

      try {
        const response = await api.get(`/storefront/products/${id}`, {
          signal: controller.signal,
        });

        setProduct(response.data.product || null);
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED') {
          return;
        }

        setProduct(null);
        setError(
          requestError.response?.data?.message ||
            'The product details could not be loaded.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProduct();
    return () => controller.abort();
  }, [id]);

  return (
    <div className="storefront-page">
      <header className="storefront-header">
        <div className="storefront-shell storefront-header-inner">
          <Link to="/" className="storefront-brand" aria-label="Spartan BTY home">
            <img src={logo} alt="" />
            <span>Spartan <strong>BTY</strong></span>
          </Link>

          <StorefrontAccountLinks />
        </div>
      </header>

      <main className="storefront-detail-main">
        <div className="storefront-shell">
          <Link to="/#products" className="storefront-back-link">
            <ArrowLeft size={16} />
            Back to products
          </Link>

          {loading ? (
            <div className="storefront-detail-loading" aria-busy="true">
              <div />
              <div>
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : error || !product ? (
            <div className="storefront-state-card storefront-detail-state" role="alert">
              <PackageSearch size={34} />
              <h1>Product unavailable</h1>
              <p>{error || 'This product could not be found.'}</p>
              <Link to="/#products" className="storefront-primary-button">
                Browse products
              </Link>
            </div>
          ) : (
            <article className="storefront-detail-grid">
              <div className="storefront-detail-image">
                {product.imageUrl && !imageFailed ? (
                  <img
                    src={product.imageUrl}
                    alt={`${product.name} product`}
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="storefront-product-placeholder" aria-hidden="true">
                    <Sparkles size={40} strokeWidth={1.3} />
                    <span>Product image coming soon</span>
                  </div>
                )}
              </div>

              <div className="storefront-detail-copy">
                <p className="storefront-eyebrow">
                  {product.category || 'UNCATEGORIZED'}
                </p>
                <h1>{product.name}</h1>
                <p className="storefront-detail-sku">SKU {product.sku}</p>

                <div className="storefront-detail-price-row">
                  <strong>{formatPrice(product.price)}</strong>
                  <span
                    className={`storefront-availability storefront-availability-${product.availability.status}`}
                  >
                    {product.availability.label}
                  </span>
                </div>

                <div className="storefront-detail-description">
                  <h2>Product details</h2>
                  <p>
                    {product.description ||
                      'A full product description has not been entered yet.'}
                  </p>
                </div>

                <div className="storefront-detail-notice">
                  <ShieldCheck size={21} />
                  <div>
                    <strong>Browsing-only release</strong>
                    <p>
                      Customer accounts are available. Cart, checkout, and
                      online payments are not active in this storefront phase.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          )}
        </div>
      </main>

      <footer className="storefront-footer">
        <div className="storefront-shell storefront-footer-inner">
          <div className="storefront-footer-brand">
            <img src={logo} alt="" />
            <div>
              <strong>Spartan BTY Inc.</strong>
              <span>Tamsui Avenue, Bayan Luma II, Imus, Cavite 4103</span>
            </div>
          </div>
          <span>© {new Date().getFullYear()} Spartan BTY Inc.</span>
        </div>
      </footer>
    </div>
  );
}
