import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import customerApi from '../api/customerAxiosInstance';
import StorefrontAccountLinks from '../components/StorefrontAccountLinks';
import logo from '../assets/Spartan_BTY_logo.webp';
import '../styles/storefront.css';

function money(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value || 0));
}

export default function CustomerCart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyProductId, setBusyProductId] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const loadCart = useCallback(async () => {
    setError('');
    try {
      const [cartResponse, profileResponse] = await Promise.all([
        customerApi.get('/customer/cart'),
        customerApi.get('/customer-auth/me'),
      ]);
      setCart(cartResponse.data.cart);
      setCustomer(profileResponse.data.customer);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your cart.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCart();
  }, [loadCart]);

  const updateQuantity = async (productId, quantity) => {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError('Quantity must be a positive whole number.');
      return;
    }
    setBusyProductId(productId);
    setError('');
    try {
      const response = await customerApi.patch(
        `/customer/cart/items/${productId}`,
        { quantity: parsed }
      );
      setCart(response.data.cart);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update the quantity.');
      await loadCart();
    } finally {
      setBusyProductId(null);
    }
  };

  const removeItem = async (productId) => {
    setBusyProductId(productId);
    setError('');
    try {
      const response = await customerApi.delete(
        `/customer/cart/items/${productId}`
      );
      setCart(response.data.cart);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to remove the product.');
    } finally {
      setBusyProductId(null);
    }
  };

  const placeOrder = async () => {
    if (!confirmed || placing) return;
    setPlacing(true);
    setError('');
    let key = sessionStorage.getItem('customerOrderSubmissionKey');
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem('customerOrderSubmissionKey', key);
    }

    try {
      const response = await customerApi.post(
        '/customer/orders',
        { confirmDeliveryDetails: true },
        { headers: { 'Idempotency-Key': key } }
      );
      sessionStorage.removeItem('customerOrderSubmissionKey');
      navigate(`/orders/${response.data.order.id}`, {
        replace: true,
        state: { confirmation: response.data.message },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to place your order.');
      if ([400, 409].includes(requestError.response?.status)) {
        await loadCart();
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="storefront-page commerce-page">
      <header className="storefront-header">
        <div className="storefront-shell storefront-header-inner">
          <Link to="/" className="storefront-brand"><img src={logo} alt="" /><span>Spartan <strong>BTY</strong></span></Link>
          <StorefrontAccountLinks />
        </div>
      </header>
      <main className="storefront-shell commerce-main">
        <Link to="/#products" className="storefront-back-link"><ArrowLeft size={16} />Continue shopping</Link>
        <div className="commerce-heading">
          <div><p className="storefront-eyebrow">YOUR CART</p><h1>Review your products</h1></div>
          <ShoppingBag size={34} />
        </div>

        {error && <p className="commerce-alert" role="alert">{error}</p>}
        {loading ? (
          <div className="commerce-state" aria-busy="true">Loading your cart…</div>
        ) : !cart?.items?.length ? (
          <div className="commerce-state"><ShoppingBag size={30} /><h2>Your cart is empty</h2><Link to="/#products">Browse products</Link></div>
        ) : (
          <div className="commerce-cart-grid">
            <section className="commerce-card commerce-items">
              {cart.items.map((item) => (
                <article key={item.productId} className="commerce-cart-item">
                  <div><p>{item.sku}</p><h2>{item.name}</h2><strong>{money(item.unitPrice)}</strong><span className={`commerce-stock ${item.availability.status}`}>{item.availability.label}</span></div>
                  <label>Quantity<input key={item.quantity} type="number" min="1" step="1" defaultValue={item.quantity} disabled={busyProductId === item.productId} onBlur={(event) => updateQuantity(item.productId, event.target.value)} /></label>
                  <strong>{money(item.lineTotal)}</strong>
                  <button type="button" onClick={() => removeItem(item.productId)} disabled={busyProductId === item.productId} aria-label={`Remove ${item.name}`}><Trash2 size={17} /></button>
                </article>
              ))}
            </section>

            <aside className="commerce-card commerce-summary">
              <h2>Order summary</h2>
              <div><span>{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</span><strong>{money(cart.totalAmount)}</strong></div>
              <div className="commerce-delivery"><MapPin size={19} /><div><strong>Delivery details</strong><span>{customer?.fullName}</span><span>{customer?.contactNumber}</span><span>{customer?.address}</span></div></div>
              <label className="commerce-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I confirm these contact and delivery details are correct.</label>
              <p className="commerce-policy"><PackageCheck size={17} />Stock is checked now and again during packing, but is not reserved. Sales may contact you if availability changes.</p>
              <button type="button" className="commerce-primary" onClick={placeOrder} disabled={!confirmed || !cart.readyToOrder || placing}>{placing ? 'Placing order…' : 'Place order for Sales review'}</button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
