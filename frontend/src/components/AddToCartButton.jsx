import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import customerApi from '../api/customerAxiosInstance';

function hasCustomerSession() {
  try {
    const customer = JSON.parse(localStorage.getItem('customerUser'));
    return Boolean(
      localStorage.getItem('customerToken') &&
      customer?.accountType === 'customer'
    );
  } catch {
    return false;
  }
}

export default function AddToCartButton({ product, returnTo, compact = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const canOrder =
    product.price !== null && product.availability?.status === 'in_stock';

  const addToCart = async () => {
    if (!hasCustomerSession()) {
      navigate('/customer/login', {
        state: { from: returnTo || `/products/${product.id}` },
      });
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await customerApi.post('/customer/cart/items', {
        productId: product.id,
        quantity: 1,
      });
      setMessage('Added');
    } catch (error) {
      setMessage(
        error.response?.data?.message || 'Could not add this product.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`storefront-add-control${compact ? ' compact' : ''}`}>
      <button
        type="button"
        onClick={addToCart}
        disabled={!canOrder || loading}
      >
        <ShoppingBag size={16} />
        {loading ? 'Adding…' : canOrder ? 'Add to cart' : 'Unavailable'}
      </button>
      {message && (
        message === 'Added' ? (
          <Link to="/cart">Added · View cart</Link>
        ) : (
          <span role="alert">{message}</span>
        )
      )}
    </div>
  );
}
