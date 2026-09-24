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
  const isStaffUser = [
    'head',
    'specialist',
    'system_configuration',
  ].includes(user?.role) && user?.accountType === 'staff';

  if (!token || !user || !isStaffUser) {
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
