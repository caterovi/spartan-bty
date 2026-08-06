import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import Layout from './components/Layout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Marketing from './pages/Marketing';
import Sales from './pages/Sales';
import SupplyChain from './pages/SupplyChain';
import Fulfillment from './pages/Fulfillment';
import CDM from './pages/CDM';
import CRM from './pages/CRM';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Reports from './pages/Reports';

import { colors, font } from './styles/tokens';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
}

function ProtectedRoute() {
  const token = localStorage.getItem('token');
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function OperationalRoute({ departmentCode, children }) {
  const user = getStoredUser();

  const allowed =
    user?.role === 'head' ||
    (user?.role === 'specialist' &&
      user?.departmentCode === departmentCode);

  return allowed ? children : <Navigate to="/unauthorized" replace />;
}

function RoleRoute({ allowedRoles, children }) {
  const user = getStoredUser();

  return allowedRoles.includes(user?.role)
    ? children
    : <Navigate to="/unauthorized" replace />;
}

function ComingSoon({ title, description }) {
  return (
    <section style={styles.placeholder}>
      <p style={styles.eyebrow}>MODULE FOUNDATION</p>
      <h1 style={styles.title}>{title}</h1>
      <p style={styles.description}>{description}</p>
    </section>
  );
}

function Unauthorized() {
  return (
    <section style={styles.placeholder}>
      <p style={styles.eyebrow}>ACCESS DENIED</p>
      <h1 style={styles.title}>Unauthorized page</h1>
      <p style={styles.description}>
        Your account does not have permission to access this module.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />

            <Route
              path="/marketing"
              element={
                <OperationalRoute departmentCode="marketing">
                  <Marketing />
                </OperationalRoute>
              }
            />

            <Route
              path="/sales"
              element={
                <OperationalRoute departmentCode="sales">
                  <Sales />
                </OperationalRoute>
              }
            />

            <Route
              path="/supply-chain"
              element={
                <OperationalRoute departmentCode="supply_chain">
                  <SupplyChain />
                </OperationalRoute>
              }
            />

            <Route
              path="/fulfillment"
              element={
                <OperationalRoute departmentCode="fulfillment">
                  <Fulfillment />
                </OperationalRoute>
              }
            />

            <Route
              path="/cdm"
              element={
                <OperationalRoute departmentCode="cdm">
                  <CDM />
                </OperationalRoute>
              }
            />

            <Route
              path="/crm"
              element={
                <OperationalRoute departmentCode="crm">
                  <CRM />
                </OperationalRoute>
              }
            />

           <Route
  path="/reports"
  element={<Reports />}
/>

            <Route
  path="/users"
  element={
    <RoleRoute allowedRoles={['system_configuration']}>
      <UserManagement />
    </RoleRoute>
  }
/>

            <Route
  path="/settings"
  element={<Settings />}
/>


            <Route path="/unauthorized" element={<Unauthorized />} />

            <Route
              path="*"
              element={<Navigate to="/dashboard" replace />}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const styles = {
  placeholder: {
    padding: '30px',
    borderRadius: '16px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    fontFamily: font.body,
  },

  eyebrow: {
    margin: 0,
    color: colors.roseDeep,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.4px',
  },

  title: {
    margin: '8px 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '28px',
    fontWeight: 500,
  },

  description: {
    margin: 0,
    color: colors.mutedInk,
    fontSize: '13px',
    lineHeight: 1.6,
  },
};