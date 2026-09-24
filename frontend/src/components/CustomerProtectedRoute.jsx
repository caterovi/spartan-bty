import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

function getStoredCustomer() {
  try {
    return (
      JSON.parse(localStorage.getItem('customerUser')) || null
    );
  } catch {
    return null;
  }
}

export default function CustomerProtectedRoute() {
  const token = localStorage.getItem('customerToken');
  const customer = getStoredCustomer();
  const location = useLocation();

  if (
    !token ||
    !customer ||
    customer.accountType !== 'customer'
  ) {
    return (
      <Navigate
        to="/customer/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
