import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

function getStoredUser() {
  try {
    return (
      JSON.parse(
        localStorage.getItem('user')
      ) || null
    );
  } catch {
    return null;
  }
}

export default function ProtectedRoute() {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (
    user.mustChangePassword &&
    location.pathname !== '/settings'
  ) {
    return (
      <Navigate
        to="/settings"
        replace
      />
    );
  }

  return <Outlet />;
}