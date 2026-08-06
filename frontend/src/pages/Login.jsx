import { useState } from 'react';

import {
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import api from '../api/axiosInstance';

import {
  colors,
  font,
} from '../styles/tokens';

const PRODUCTS = [
  'Instaglow',
  'Daily Radiance',
  'Overnight Mask',
  'Bright and Light',
  'Sunstick',
];

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] =
    useState({
      username: '',
      password: '',
    });

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setError('');
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const username =
      formData.username.trim();

    const password =
      formData.password;

    if (!username || !password) {
      setError(
        'Enter your username or email and password.'
      );

      return;
    }

    setLoading(true);
    setError('');

    try {
      const response =
        await api.post(
          '/auth/login',
          {
            username,
            password,
          }
        );

      const {
        accessToken,
        refreshToken,
        user,
      } = response.data;

      if (!accessToken || !user) {
        throw new Error(
          'Invalid login response.'
        );
      }

      localStorage.setItem(
        'token',
        accessToken
      );

      localStorage.setItem(
        'refreshToken',
        refreshToken || ''
      );

      localStorage.setItem(
        'user',
        JSON.stringify(user)
      );

      navigate(
        user.mustChangePassword
          ? '/settings'
          : '/dashboard',
        {
          replace: true,
        }
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to sign in. Please check your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <style>{loginStyles}</style>

      {/* Desktop branding panel */}
      <section className="login-brand-panel">
        <div className="login-glow-ring" />

        <div className="login-glow-blob" />

        <div className="login-brand-content">
          <Link
            to="/"
            className="login-home-link"
          >
            <ArrowLeft size={16} />

            Return to Home
          </Link>

          <p className="login-eyebrow">
            SPARTAN BTY INC.
          </p>

          <h1 className="login-wordmark">
            Skin that speaks
            <br />
            for itself.
          </h1>

          <p className="login-tagline">
            The internal management
            system supporting company
            operations, order processing,
            customer service, and
            business monitoring.
          </p>

          <div className="login-product-strip">
            {PRODUCTS.map(
              (product) => (
                <div
                  key={product}
                  className="login-product-item"
                >
                  <span className="login-product-dot" />

                  <span>
                    {product}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Login form panel */}
      <section className="login-form-panel">
        <div className="login-card">
          
          <div className="login-access-label">
            <ShieldCheck size={15} />

            <span>
              Authorized personnel only
            </span>
          </div>

          <h2 className="login-form-title">
            Sign in
          </h2>

          <p className="login-form-subtitle">
            Enter your assigned Spartan
            BTY staff account.
          </p>

          <form
            onSubmit={handleSubmit}
            className="login-form"
            noValidate
          >
            <div className="login-field">
              <label htmlFor="username">
                Username or email
              </label>

              <input
                id="username"
                name="username"
                type="text"
                value={
                  formData.username
                }
                onChange={
                  handleChange
                }
                placeholder="Enter your username or email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">
                Password
              </label>

              <div className="login-password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={
                    formData.password
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current
                    )
                  }
                  className="login-password-toggle"
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  title={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="login-error"
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-submit-button"
            >
              {loading
                ? 'Signing in...'
                : 'Sign in'}
            </button>
            <Link
    to="/"
    className="mobile-home-link"
  >
    <ArrowLeft size={16} />
    Return to Home
  </Link>
          </form>

          <div className="login-support-note">
            Account creation and password
            resets are managed by the
            System Configuration user.
          </div>
        </div>
      </section>
    </div>
  );
}

const loginStyles = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    max-width: 100%;
    min-height: 100%;
    margin: 0;
  }

  body {
    overflow-x: hidden;
  }

  /*
   * MOBILE-FIRST
   * Left panel is hidden by default.
   */

  .login-page {
    display: block;
    width: 100%;
    max-width: 100%;
    min-height: 100vh;
    overflow-x: hidden;
    background: ${colors.cream};
    color: ${colors.ink};
    font-family: ${font.body};
  }

  .login-brand-panel {
    display: none;
  }

  .login-form-panel {
    display: grid;
    place-items: center;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 100vh;
    padding: 24px 14px;
    background: ${colors.cream};
  }

  .login-card {
    width: 100%;
    max-width: 390px;
    min-width: 0;
    padding: 24px 18px;
    border:
      1px solid
      ${colors.border};
    border-radius: 16px;
    background: #ffffff;
    box-shadow:
      0 18px 50px
      rgba(50, 35, 40, 0.08);
  }

  .mobile-home-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: 7px;
  margin-top: -5px;
  padding: 0 12px;
  color: ${colors.mutedInk};
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.mobile-home-link:hover {
  color: ${colors.roseDeep};
}

.mobile-home-link:focus-visible {
  border-radius: 7px;
  outline:
    3px solid
    ${colors.rose}45;
  outline-offset: 2px;
}

  .login-access-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    max-width: 100%;
    gap: 7px;
    margin-bottom: 16px;
    padding: 7px 10px;
    border:
      1px solid
      ${colors.border};
    border-radius: 999px;
    background: ${colors.blush};
    color: ${colors.roseDeep};
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    line-height: 1.4;
    text-transform: uppercase;
    overflow-wrap: break-word;
  }

  .login-form-title {
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 30px;
    font-weight: 500;
    line-height: 1.15;
  }

  .login-form-subtitle {
    max-width: 55ch;
    margin: 8px 0 26px;
    color: ${colors.mutedInk};
    font-size: 12px;
    line-height: 1.6;
    overflow-wrap: break-word;
  }

  .login-form {
    display: grid;
    width: 100%;
    max-width: 100%;
    gap: 17px;
  }

  .login-field {
    display: grid;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 7px;
  }

  .login-field label {
    color: ${colors.ink};
    font-size: 11px;
    font-weight: 700;
    line-height: 1.5;
  }

  .login-field > input {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: 11px 13px;
    border:
      1px solid
      ${colors.border};
    border-radius: 9px;
    outline: none;
    background: #ffffff;
    color: ${colors.ink};
    font-family: ${font.body};
    font-size: 13px;
    line-height: 1.5;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .login-field > input:focus {
    border-color: ${colors.rose};
    box-shadow:
      0 0 0 3px
      ${colors.rose}20;
  }

  .login-field > input:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }

  .login-password-wrapper {
    display: flex;
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    border:
      1px solid
      ${colors.border};
    border-radius: 9px;
    background: #ffffff;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .login-password-wrapper:focus-within {
    border-color: ${colors.rose};
    box-shadow:
      0 0 0 3px
      ${colors.rose}20;
  }

  .login-password-wrapper input {
    flex: 1;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: 11px 13px;
    border: none;
    outline: none;
    background: #ffffff;
    color: ${colors.ink};
    font-family: ${font.body};
    font-size: 13px;
    line-height: 1.5;
  }

  .login-password-wrapper input:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }

  .login-password-toggle {
    display: grid;
    place-items: center;
    width: 48px;
    min-width: 48px;
    min-height: 48px;
    padding: 0;
    border: none;
    border-left:
      1px solid
      ${colors.border};
    background: ${colors.blush};
    color: ${colors.roseDeep};
    cursor: pointer;
  }

  .login-password-toggle:hover {
    background: #f9e9ed;
  }

  .login-password-toggle:focus-visible {
    outline:
      3px solid
      ${colors.rose}45;
    outline-offset: -3px;
  }

  .login-error {
    width: 100%;
    max-width: 100%;
    padding: 11px 12px;
    border: 1px solid #e7bec6;
    border-radius: 8px;
    background: #fff0f2;
    color: #a33b51;
    font-size: 12px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .login-submit-button {
    width: 100%;
    max-width: 100%;
    min-height: 48px;
    margin-top: 2px;
    padding: 11px 18px;
    border: none;
    border-radius: 9px;
    background: ${colors.rose};
    color: #ffffff;
    font-family: ${font.body};
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      opacity 150ms ease;
  }

  .login-submit-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow:
      0 11px 25px
      rgba(127, 52, 71, 0.2);
  }

  .login-submit-button:focus-visible {
    outline:
      3px solid
      ${colors.rose}50;
    outline-offset: 3px;
  }

  .login-submit-button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .login-support-note {
    max-width: 60ch;
    margin-top: 21px;
    padding-top: 17px;
    border-top:
      1px solid
      ${colors.border};
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.6;
    text-align: center;
    overflow-wrap: break-word;
  }

  /*
   * TABLET
   * Left panel remains hidden.
   */

  @media (min-width: 600px) {
    .login-form-panel {
      padding: 42px 28px;
    }

    .login-card {
      max-width: 410px;
      padding: 30px;
    }

    .login-form-title {
      font-size: 32px;
    }
  }

  /*
   * DESKTOP
   * Show left branding panel.
   */

  @media (min-width: 900px) {
    .login-page {
      display: grid;
      grid-template-columns:
        minmax(0, 58%)
        minmax(390px, 42%);
      min-height: 100vh;
    }

    .login-brand-panel {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 100vh;
      overflow: hidden;
      padding: 50px 52px;
      background: ${colors.blush};
    }

    .login-brand-content {
      position: relative;
      z-index: 2;
      width: min(100%, 520px);
      min-width: 0;
    }

    .login-home-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      gap: 7px;
      margin-bottom: 27px;
      padding: 0 3px;
      color: ${colors.ink};
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
    }

    .login-home-link:hover {
      color: ${colors.roseDeep};
    }

    .login-eyebrow {
      margin: 0 0 17px;
      color: ${colors.roseDeep};
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.7px;
      line-height: 1.5;
    }

    .login-wordmark {
      max-width: 12ch;
      margin: 0;
      color: ${colors.ink};
      font-family: ${font.display};
      font-size: 56px;
      font-weight: 500;
      line-height: 1.04;
      letter-spacing: -0.8px;
      overflow-wrap: break-word;
    }

    .login-tagline {
      max-width: 58ch;
      margin: 21px 0 0;
      color: ${colors.mutedInk};
      font-size: 14px;
      line-height: 1.65;
      overflow-wrap: break-word;
    }

    .login-product-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 11px 17px;
      margin-top: 34px;
    }

    .login-product-item {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 7px;
      color: ${colors.mutedInk};
      font-size: 11px;
      font-weight: 500;
    }

    .login-product-dot {
      display: block;
      width: 7px;
      height: 7px;
      min-width: 7px;
      border-radius: 50%;
      background: ${colors.rose};
    }

    .login-glow-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 470px;
      height: 470px;
      transform:
        translate(-50%, -50%);
      border:
        1px dashed
        ${colors.rose}55;
      border-radius: 50%;
      pointer-events: none;
    }

    .login-glow-blob {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 350px;
      height: 350px;
      transform:
        translate(-50%, -50%);
      border-radius: 50%;
      background:
        radial-gradient(
          circle,
          ${colors.rose}50 0%,
          ${colors.rose}00 72%
        );
      pointer-events: none;
    }

    .login-form-panel {
      min-height: 100vh;
      padding: 42px 34px;
    }

    .login-card {
      max-width: 350px;
      padding: 28px;
    }

    .mobile-home-link {
      display: none;
    }
  }

  /*
   * LARGE DESKTOP
   */

  @media (min-width: 1200px) {
    .login-brand-panel {
      padding: 60px 72px;
    }

    .login-brand-content {
      width: min(100%, 550px);
    }

    .login-wordmark {
      font-size: 60px;
    }

    .login-card {
      max-width: 370px;
      padding: 30px;
    }
  }

  /*
   * SHORT DESKTOP SCREENS
   */

  @media (
    min-width: 900px
  ) and (
    max-height: 700px
  ) {
    .login-brand-panel {
      padding-top: 28px;
      padding-bottom: 28px;
    }

    .login-home-link {
      margin-bottom: 14px;
    }

    .login-wordmark {
      font-size: 48px;
    }

    .login-tagline {
      margin-top: 14px;
    }

    .login-product-strip {
      margin-top: 22px;
    }

    .login-form-panel {
      padding-top: 22px;
      padding-bottom: 22px;
    }
  }

  /*
   * VERY SMALL MOBILE DEVICES
   */

  @media (max-width: 374px) {
    .login-form-panel {
      padding-inline: 10px;
    }

    .login-card {
      padding-inline: 15px;
    }

    .login-access-label {
      font-size: 8px;
      letter-spacing: 0.25px;
    }
  }

  @media (
    prefers-reduced-motion:
    reduce
  ) {
    *,
    *::before,
    *::after {
      transition: none !important;
    }
  }
`;