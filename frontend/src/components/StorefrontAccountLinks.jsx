import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function hasCustomerSession() {
  try {
    const customer = JSON.parse(
      localStorage.getItem('customerUser')
    );

    return Boolean(
      localStorage.getItem('customerToken') &&
      customer?.accountType === 'customer'
    );
  } catch {
    return false;
  }
}

export default function StorefrontAccountLinks() {
  const customerSignedIn = hasCustomerSession();

  return (
    <div className="storefront-header-actions">
      {customerSignedIn ? (
        <>
          <Link to="/cart" className="storefront-customer-link">Cart</Link>
          <Link to="/orders" className="storefront-customer-link">Orders</Link>
          <Link to="/account" className="storefront-customer-link">My account</Link>
        </>
      ) : (
        <>
          <Link
            to="/customer/login"
            className="storefront-customer-link"
          >
            Customer login
          </Link>
          <Link
            to="/customer/signup"
            className="storefront-signup-link"
          >
            Create account
          </Link>
        </>
      )}

      <Link to="/login" className="storefront-staff-link">
        Staff login
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
