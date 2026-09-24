import { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react';
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import customerApi from '../api/customerAxiosInstance';
import logo from '../assets/Spartan_BTY_logo.webp';
import '../styles/customer-auth.css';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      setError('Enter your customer email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await customerApi.post('/customer-auth/login', {
        email: form.email.trim(),
        password: form.password,
      });

      localStorage.setItem('customerToken', response.data.accessToken);
      localStorage.setItem(
        'customerRefreshToken',
        response.data.refreshToken
      );
      localStorage.setItem(
        'customerUser',
        JSON.stringify(response.data.customer)
      );

      const requestedPath = location.state?.from;
      const safeCustomerPath =
        typeof requestedPath === 'string' &&
        (requestedPath === '/' ||
          requestedPath.startsWith('/account') ||
          requestedPath.startsWith('/cart') ||
          requestedPath.startsWith('/orders') ||
          requestedPath.startsWith('/products/'));
      navigate(
        safeCustomerPath ? requestedPath : '/account',
        { replace: true }
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to sign in to your customer account.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="customer-auth-page">
      <section className="customer-auth-brand-panel">
        <Link to="/" className="customer-auth-back-link">
          <ArrowLeft size={16} />
          Back to storefront
        </Link>
        <div>
          <img src={logo} alt="Spartan BTY Inc." />
          <p>SPARTAN BTY CUSTOMER ACCOUNT</p>
          <h1>Welcome back.</h1>
          <span>
            Customer access is separate from the internal staff management
            system.
          </span>
        </div>
      </section>

      <section className="customer-auth-form-panel">
        <form onSubmit={handleSubmit} className="customer-auth-form">
          <div>
            <p className="customer-auth-eyebrow">CUSTOMER LOGIN</p>
            <h2>Sign in to your account</h2>
            <span>Use the email registered with your customer account.</span>
          </div>

          {error && <p className="customer-auth-error" role="alert">{error}</p>}

          <label>
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              required
            />
          </label>

          <label>
            <span>Password</span>
            <div className="customer-auth-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="customer-auth-submit"
            disabled={loading}
          >
            <LogIn size={17} />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="customer-auth-switch">
            New customer?{' '}
            <Link to="/customer/signup" state={location.state}>
              Create an account
            </Link>
          </p>

          <p className="customer-auth-staff-note">
            Spartan BTY personnel should use the{' '}
            <Link to="/login">staff login</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}
