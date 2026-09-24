import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, MapPin } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';

import customerApi from '../api/customerAxiosInstance';
import StorefrontAccountLinks from '../components/StorefrontAccountLinks';
import logo from '../assets/Spartan_BTY_logo.webp';
import '../styles/storefront.css';

function money(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
}

function date(value) {
  return value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';
}

export default function CustomerOrders() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState(id ? null : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await customerApi.get(id ? `/customer/orders/${id}` : '/customer/orders');
      setData(id ? response.data.order : response.data.orders || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your orders.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="storefront-page commerce-page">
      <header className="storefront-header"><div className="storefront-shell storefront-header-inner"><Link to="/" className="storefront-brand"><img src={logo} alt="" /><span>Spartan <strong>BTY</strong></span></Link><StorefrontAccountLinks /></div></header>
      <main className="storefront-shell commerce-main">
        <Link to={id ? '/orders' : '/account'} className="storefront-back-link"><ArrowLeft size={16} />{id ? 'All orders' : 'My account'}</Link>
        <div className="commerce-heading"><div><p className="storefront-eyebrow">CUSTOMER ORDERS</p><h1>{id ? 'Order details' : 'Your orders'}</h1></div><ClipboardList size={34} /></div>
        {location.state?.confirmation && <p className="commerce-success">{location.state.confirmation}</p>}
        {error && <p className="commerce-alert" role="alert">{error}</p>}
        {loading ? <div className="commerce-state" aria-busy="true">Loading orders…</div> : id && data ? (
          <article className="commerce-card commerce-order-detail">
            <div className="commerce-order-title"><div><p>{data.orderNumber}</p><h2>{data.status.label}</h2></div><strong>{money(data.totalAmount)}</strong></div>
            {data.statusMessage && <p className="commerce-order-message">{data.statusMessage}</p>}
            <p>Placed {date(data.placedAt)}</p>
            <div className="commerce-order-items">{data.items?.map((item) => <div key={item.productId}><span>{item.quantity} × {item.name}<small>{item.sku}</small></span><strong>{money(item.lineTotal)}</strong></div>)}</div>
            <div className="commerce-delivery"><MapPin size={19} /><div><strong>Delivery details captured with this order</strong><span>{data.delivery.fullName}</span><span>{data.delivery.contactNumber}</span><span>{data.delivery.address}</span></div></div>
            <p className="commerce-policy">Stock is not reserved before packing. Fulfillment rechecks it before the single inventory deduction.</p>
          </article>
        ) : Array.isArray(data) && data.length ? (
          <div className="commerce-order-list">{data.map((order) => <Link key={order.id} to={`/orders/${order.id}`} className="commerce-card commerce-order-row"><div><p>{order.orderNumber}</p><h2>{order.status.label}</h2><span>{date(order.placedAt)}</span></div><strong>{money(order.totalAmount)}</strong></Link>)}</div>
        ) : <div className="commerce-state"><ClipboardList size={30} /><h2>No online orders yet</h2><Link to="/#products">Browse products</Link></div>}
      </main>
    </div>
  );
}
