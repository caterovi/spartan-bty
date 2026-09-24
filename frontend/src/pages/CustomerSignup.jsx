import { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import customerApi from '../api/customerAxiosInstance';
import logo from '../assets/Spartan_BTY_logo.webp';
import '../styles/customer-auth.css';

const initialForm = {
  fullName: '',
  email: '',
  contactNumber: '',
  address: '',
  password: '',
  confirmPassword: '',
};

export default function CustomerSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await customerApi.post('/customer-auth/signup', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim(),
        address: form.address.trim(),
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
      navigate(safeCustomerPath ? requestedPath : '/account', {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to create the customer account.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="customer-auth-page customer-auth-page-signup">
      <section className="customer-auth-brand-panel">
        <Link to="/" className="customer-auth-back-link">
          <ArrowLeft size={16} />
          Back to storefront
        </Link>
        <div>
          <img src={logo} alt="Spartan BTY Inc." />
          <p>SPARTAN BTY CUSTOMER ACCOUNT</p>
          <h1>Create your customer account.</h1>
          <span>
            Public signup creates customer access only. Staff roles and
            departments are managed internally.
          </span>
        </div>
      </section>

      <section className="customer-auth-form-panel">
        <form onSubmit={handleSubmit} className="customer-auth-form">
          <div>
            <p className="customer-auth-eyebrow">CUSTOMER SIGNUP</p>
            <h2>Your account details</h2>
            <span>All fields are required.</span>
          </div>

          {error && <p className="customer-auth-error" role="alert">{error}</p>}

          <div className="customer-auth-field-grid">
            <label>
              <span>Full name</span>
              <input
                name="fullName"
                type="text"
                autoComplete="name"
                maxLength={150}
                value={form.fullName}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={150}
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Contact number</span>
              <input
                name="contactNumber"
                type="tel"
                autoComplete="tel"
                maxLength={30}
                value={form.contactNumber}
                onChange={handleChange}
                required
              />
            </label>

            <label className="customer-auth-full-field">
              <span>Address</span>
              <textarea
                name="address"
                autoComplete="street-address"
                maxLength={1000}
                rows={3}
                value={form.address}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Password</span>
              <div className="customer-auth-password-field">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={handleChange}
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

            <label>
              <span>Confirm password</span>
              <input
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            className="customer-auth-submit"
            disabled={loading}
          >
            <UserPlus size={17} />
            {loading ? 'Creating account…' : 'Create customer account'}
          </button>

          <p className="customer-auth-switch">
            Already registered?{' '}
            <Link to="/customer/login" state={location.state}>Customer login</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
