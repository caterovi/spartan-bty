function ProtectedRoute() {
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