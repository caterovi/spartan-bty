import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ArrowLeft,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import customerApi, {
  clearCustomerAuthentication,
} from '../api/customerAxiosInstance';
import logo from '../assets/Spartan_BTY_logo.webp';
import '../styles/customer-auth.css';

export default function CustomerAccount() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await customerApi.get('/customer-auth/me');
      setCustomer(response.data.customer);
      localStorage.setItem(
        'customerUser',
        JSON.stringify(response.data.customer)
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to load your customer profile.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile();
  }, [loadProfile]);

  const handleLogout = () => {
    clearCustomerAuthentication();
    navigate('/', { replace: true });
  };

  return (
    <div className="customer-account-page">
      <header className="customer-account-header">
        <Link to="/" className="customer-account-brand">
          <img src={logo} alt="" />
          <span>Spartan <strong>BTY</strong></span>
        </Link>
        <button type="button" onClick={handleLogout}>
          <LogOut size={16} />
          Sign out
        </button>
      </header>

      <main className="customer-account-main">
        <Link to="/" className="customer-auth-back-link customer-account-back">
          <ArrowLeft size={16} />
          Back to storefront
        </Link>

        {loading ? (
          <div className="customer-account-state" aria-busy="true">
            Loading your profile…
          </div>
        ) : error ? (
          <div className="customer-account-state" role="alert">
            <p>{error}</p>
            <button type="button" onClick={loadProfile}>Try again</button>
          </div>
        ) : (
          <>
            <section className="customer-account-welcome">
              <div>
                <p>CUSTOMER ACCOUNT</p>
                <h1>Welcome, {customer.fullName}.</h1>
                <span>Your profile is linked to customer record #{customer.customerId}.</span>
              </div>
              <ShieldCheck size={38} />
            </section>

            <section className="customer-account-card">
              <h2>Your profile</h2>
              <div className="customer-account-details">
                <div>
                  <UserRound size={19} />
                  <span>Full name</span>
                  <strong>{customer.fullName}</strong>
                </div>
                <div>
                  <Mail size={19} />
                  <span>Email</span>
                  <strong>{customer.email}</strong>
                </div>
                <div>
                  <Phone size={19} />
                  <span>Contact number</span>
                  <strong>{customer.contactNumber}</strong>
                </div>
                <div>
                  <MapPin size={19} />
                  <span>Address</span>
                  <strong>{customer.address}</strong>
                </div>
              </div>
            </section>

            <section className="customer-account-coming-soon">
              <h2>Storefront account features</h2>
              <p>
                Cart, online order history, and eligible feedback will be added
                in later storefront phases. They are not active in this release.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
