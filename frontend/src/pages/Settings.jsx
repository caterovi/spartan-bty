import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  AtSign,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import api from '../api/axiosInstance';

import {
  colors,
  font,
} from '../styles/tokens';

function getStoredUser() {
  try {
    return (
      JSON.parse(
        localStorage.getItem('user')
      ) || {}
    );
  } catch {
    return {};
  }
}

function getDepartmentName(user) {
  return (
    user?.departmentName ||
    user?.department?.name ||
    'Not assigned'
  );
}

function formatLabel(value) {
  if (!value) {
    return 'Not available';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDate(value) {
  if (!value) {
    return 'Not available';
  }

  const normalizedValue =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2} /.test(
      value
    )
      ? value.replace(' ', 'T')
      : value;

  const date =
    new Date(normalizedValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Not available';
  }

  return date.toLocaleString(
    'en-PH',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );
}

const initialPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function Settings() {
  const [user, setUser] =
    useState(getStoredUser());

  const [
    passwordForm,
    setPasswordForm,
  ] = useState(
    initialPasswordForm
  );

  const [
    showPasswords,
    setShowPasswords,
  ] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const loadProfile =
    useCallback(async () => {
      setLoading(true);
      setError('');

      try {
        const response =
          await api.get('/auth/me');

        const profile =
          response.data.user ||
          response.data.data ||
          response.data;

        if (profile) {
          setUser(profile);

          localStorage.setItem(
            'user',
            JSON.stringify(profile)
          );
        }
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to retrieve your account information.'
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handlePasswordChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setPasswordForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );

    setError('');
    setSuccess('');
  };

  const togglePassword = (
    field
  ) => {
    setShowPasswords(
      (current) => ({
        ...current,
        [field]:
          !current[field],
      })
    );
  };

  const validatePasswordForm =
    () => {
      if (
        !passwordForm
          .currentPassword ||
        !passwordForm.newPassword ||
        !passwordForm
          .confirmPassword
      ) {
        return 'Complete all password fields.';
      }

      if (
        passwordForm
          .newPassword.length < 8
      ) {
        return 'The new password must contain at least 8 characters.';
      }

      if (
        passwordForm
          .newPassword ===
        passwordForm
          .currentPassword
      ) {
        return 'The new password must be different from the current password.';
      }

      if (
        passwordForm
          .newPassword !==
        passwordForm
          .confirmPassword
      ) {
        return 'The new password and confirmation do not match.';
      }

      return '';
    };

  const handleSubmitPassword =
    async (event) => {
      event.preventDefault();

      const validationError =
        validatePasswordForm();

      if (validationError) {
        setError(
          validationError
        );

        setSuccess('');
        return;
      }

      setSaving(true);
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            '/auth/change-password',
            {
              currentPassword:
                passwordForm
                  .currentPassword,

              newPassword:
                passwordForm
                  .newPassword,

              confirmPassword:
                passwordForm
                  .confirmPassword,
            }
          );

        setPasswordForm(
          initialPasswordForm
        );

        setShowPasswords({
          currentPassword: false,
          newPassword: false,
          confirmPassword: false,
        });

        setSuccess(
          response.data.message ||
          'Your password was changed successfully.'
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to change your password.'
        );
      } finally {
        setSaving(false);
      }
    };

  const handleResetPasswordForm =
    () => {
      setPasswordForm(
        initialPasswordForm
      );

      setShowPasswords({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });

      setError('');
      setSuccess('');
    };

  return (
    <div className="settings-page">
      <style>
        {settingsStyles}
      </style>

      <section className="settings-header">
        <div className="settings-header-copy">
          <p className="settings-eyebrow">
            ACCOUNT SETTINGS
          </p>

          <h1>My Account</h1>

          <p>
            Review your personal
            information, assigned
            access, and account
            security.
          </p>
        </div>

        <button
          type="button"
          onClick={loadProfile}
          disabled={loading}
          className="settings-refresh-button"
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? 'settings-spin'
                : ''
            }
          />

          {loading
            ? 'Refreshing...'
            : 'Refresh Account'}
        </button>
      </section>

      {error && (
        <div
          className="settings-message settings-error"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle size={19} />

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          className="settings-message settings-success"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2
            size={19}
          />

          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="settings-loading">
          <RefreshCw
            size={24}
            className="settings-spin"
          />

          <span>
            Loading account
            information...
          </span>
        </div>
      ) : (
        <div className="settings-grid">
          <AccountCard
            user={user}
          />

          <PasswordCard
            form={passwordForm}
            showPasswords={
              showPasswords
            }
            saving={saving}
            onChange={
              handlePasswordChange
            }
            onToggle={
              togglePassword
            }
            onSubmit={
              handleSubmitPassword
            }
            onReset={
              handleResetPasswordForm
            }
          />

          <AccessCard
            user={user}
          />
        </div>
      )}
    </div>
  );
}

function AccountCard({ user }) {
  const displayName =
    user?.fullName ||
    user?.name ||
    user?.username ||
    'System User';

  const initial =
    String(displayName)
      .charAt(0)
      .toUpperCase();

  return (
    <section className="settings-card settings-account-card">
      <div className="settings-profile-header">
        <div className="settings-avatar">
          {initial}
        </div>

        <div className="settings-profile-copy">
          <p className="settings-card-eyebrow">
            PERSONAL INFORMATION
          </p>

          <h2>{displayName}</h2>

          <p>
            {user?.email ||
              user?.username ||
              'No account email'}
          </p>
        </div>
      </div>

      <div className="settings-information-grid">
        <InformationItem
          icon={<UserRound />}
          label="Full name"
          value={displayName}
        />

        <InformationItem
          icon={<AtSign />}
          label="Username"
          value={
            user?.username ||
            'Not available'
          }
        />

        <InformationItem
          icon={<Mail />}
          label="Email address"
          value={
            user?.email ||
            'Not available'
          }
        />

        <InformationItem
          icon={<Hash />}
          label="Account ID"
          value={
            user?.id ||
            'Not available'
          }
        />
      </div>

      <div className="settings-neutral-notice">
        <UserRound size={18} />

        <p>
          Your personal and access
          information is managed
          through User Management.
          Contact the System
          Configuration user when
          account details need to be
          corrected.
        </p>
      </div>
    </section>
  );
}

function AccessCard({ user }) {
  const role =
    user?.role ||
    'Not available';

  const status =
    user?.status ||
    (
      user?.isActive === true
        ? 'active'
        : user?.isActive === false
        ? 'inactive'
        : 'Not available'
    );

  return (
    <section className="settings-card settings-access-card">
      <div className="settings-card-header">
        <div>
          <p className="settings-card-eyebrow">
            ACCESS INFORMATION
          </p>

          <h2>
            Role and Department
          </h2>

          <p className="settings-card-description">
            Review the role and
            department currently
            assigned to your account.
          </p>
        </div>

        <StatusBadge
          status={status}
        />
      </div>

      <div className="settings-information-grid">
        <InformationItem
          icon={<BadgeCheck />}
          label="System role"
          value={
            formatLabel(role)
          }
        />

        <InformationItem
          icon={<Building2 />}
          label="Assigned department"
          value={
            getDepartmentName(user)
          }
        />

        <InformationItem
          icon={<Hash />}
          label="Department code"
          value={
            user?.departmentCode ||
            user?.department?.code ||
            'Not assigned'
          }
        />

        <InformationItem
          icon={<CalendarDays />}
          label="Account created"
          value={formatDate(
            user?.createdAt ||
            user?.created_at
          )}
        />
      </div>

      <div className="settings-access-explanation">
        <ShieldCheck size={20} />

        <div>
          <strong>
            Current account access
          </strong>

          <p>
            {getAccessDescription(
              role,
              getDepartmentName(user)
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function PasswordCard({
  form,
  showPasswords,
  saving,
  onChange,
  onToggle,
  onSubmit,
  onReset,
}) {
  const formHasValues =
    Boolean(
      form.currentPassword ||
      form.newPassword ||
      form.confirmPassword
    );

  const passwordsMatch =
    Boolean(
      form.confirmPassword &&
      form.newPassword ===
        form.confirmPassword
    );

  return (
    <section className="settings-card settings-password-card">
      <div className="settings-password-heading">
        <div className="settings-card-icon">
          <KeyRound size={20} />
        </div>

        <div>
          <p className="settings-card-eyebrow">
            SECURITY
          </p>

          <h2>
            Change Password
          </h2>

          <p className="settings-card-description">
            Use a strong password
            that you do not use for
            another account.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="settings-password-form"
        noValidate
      >
        <PasswordField
          label="Current password"
          name="currentPassword"
          value={
            form.currentPassword
          }
          visible={
            showPasswords
              .currentPassword
          }
          onChange={onChange}
          onToggle={onToggle}
          autoComplete="current-password"
          disabled={saving}
        />

        <PasswordField
          label="New password"
          name="newPassword"
          value={
            form.newPassword
          }
          visible={
            showPasswords
              .newPassword
          }
          onChange={onChange}
          onToggle={onToggle}
          autoComplete="new-password"
          disabled={saving}
        />

        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          value={
            form.confirmPassword
          }
          visible={
            showPasswords
              .confirmPassword
          }
          onChange={onChange}
          onToggle={onToggle}
          autoComplete="new-password"
          disabled={saving}
        />

        {form.confirmPassword && (
          <div
            className={
              passwordsMatch
                ? 'settings-match-message settings-match-success'
                : 'settings-match-message settings-match-error'
            }
          >
            {passwordsMatch ? (
              <Check size={16} />
            ) : (
              <AlertCircle
                size={16}
              />
            )}

            <span>
              {passwordsMatch
                ? 'The new passwords match.'
                : 'The new passwords do not match.'}
            </span>
          </div>
        )}

        <PasswordRequirements
          password={
            form.newPassword
          }
        />

        <div className="settings-form-actions">
          <button
            type="button"
            onClick={onReset}
            disabled={
              saving ||
              !formHasValues
            }
            className="settings-secondary-button"
          >
            Clear Fields
          </button>

          <button
            type="submit"
            disabled={saving}
            className="settings-primary-button"
          >
            {saving ? (
              <>
                <RefreshCw
                  size={17}
                  className="settings-spin"
                />

                Updating...
              </>
            ) : (
              <>
                <LockKeyhole
                  size={17}
                />

                Update Password
              </>
            )}
          </button>
        </div>
      </form>

      <div className="settings-security-notice">
        <ShieldCheck size={20} />

        <div>
          <strong>
            Security reminder
          </strong>

          <p>
            Never share your password
            with other system users.
            System Configuration can
            reset an account password
            when access is lost.
          </p>
        </div>
      </div>
    </section>
  );
}

function PasswordField({
  label,
  name,
  value,
  visible,
  onChange,
  onToggle,
  autoComplete,
  disabled,
}) {
  return (
    <div className="settings-field">
      <label htmlFor={name}>
        {label}
      </label>

      <div className="settings-password-input-wrapper">
        <input
          id={name}
          type={
            visible
              ? 'text'
              : 'password'
          }
          name={name}
          value={value}
          onChange={onChange}
          autoComplete={
            autoComplete
          }
          disabled={disabled}
          placeholder={`Enter ${label.toLowerCase()}`}
        />

        <button
          type="button"
          onClick={() =>
            onToggle(name)
          }
          disabled={disabled}
          className="settings-visibility-button"
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          title={
            visible
              ? 'Hide password'
              : 'Show password'
          }
        >
          {visible ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

function PasswordRequirements({
  password,
}) {
  const requirements =
    useMemo(
      () => [
        {
          label:
            'At least 8 characters',
          passed:
            password.length >= 8,
        },
        {
          label:
            'One uppercase letter',
          passed:
            /[A-Z]/.test(
              password
            ),
        },
        {
          label:
            'One lowercase letter',
          passed:
            /[a-z]/.test(
              password
            ),
        },
        {
          label: 'One number',
          passed:
            /\d/.test(password),
        },
      ],
      [password]
    );

  return (
    <div className="settings-requirement-box">
      <div className="settings-requirement-heading">
        <LockKeyhole
          size={17}
        />

        <strong>
          Recommended password
          requirements
        </strong>
      </div>

      <div className="settings-requirement-list">
        {requirements.map(
          (requirement) => (
            <div
              key={
                requirement.label
              }
              className={
                requirement.passed
                  ? 'settings-requirement settings-requirement-passed'
                  : 'settings-requirement'
              }
            >
              <span className="settings-requirement-icon">
                {requirement.passed ? (
                  <Check size={13} />
                ) : (
                  <span />
                )}
              </span>

              <span>
                {requirement.label}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function InformationItem({
  icon,
  label,
  value,
}) {
  return (
    <div className="settings-information-item">
      <span className="settings-information-icon">
        {icon}
      </span>

      <div>
        <span className="settings-information-label">
          {label}
        </span>

        <strong className="settings-information-value">
          {value}
        </strong>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}) {
  const normalized =
    String(status || '')
      .trim()
      .toLowerCase();

  const isActive =
    normalized === 'active' ||
    normalized === '1' ||
    normalized === 'true';

  return (
    <span
      className={
        isActive
          ? 'settings-status-badge settings-status-active'
          : 'settings-status-badge settings-status-inactive'
      }
    >
      <span />

      {formatLabel(status)}
    </span>
  );
}

function getAccessDescription(
  role,
  departmentName
) {
  const normalizedRole =
    String(role || '')
      .trim()
      .toLowerCase()
      .replaceAll(' ', '_');

  if (
    normalizedRole === 'head'
  ) {
    return 'This account can access all operational modules, management reports, the dashboard, and authorized settings.';
  }

  if (
    normalizedRole ===
    'system_configuration'
  ) {
    return 'This account manages system users, account access, password resets, and configuration-related settings.';
  }

  if (
    normalizedRole ===
    'specialist'
  ) {
    return `This account can access the ${departmentName} module, its authorized report, the dashboard, and account settings.`;
  }

  return 'No access description is available for this account role.';
}

const settingsStyles = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .settings-page {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden;
    color: ${colors.ink};
    font-family: ${font.body};
  }

  .settings-page button,
  .settings-page input {
    font-family: ${font.body};
  }

  .settings-header {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 20px;
    padding: 20px 17px;
    border: 1px solid ${colors.border};
    border-radius: 15px;
    background:
      linear-gradient(
        135deg,
        ${colors.blush} 0%,
        #fffafb 100%
      );
  }

  .settings-header-copy {
    min-width: 0;
    overflow-wrap: break-word;
  }

  .settings-eyebrow,
  .settings-card-eyebrow {
    margin: 0;
    color: ${colors.roseDeep};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.3px;
    line-height: 1.5;
  }

  .settings-header h1 {
    margin: 6px 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 27px;
    font-weight: 500;
    line-height: 1.2;
  }

  .settings-header-copy > p:last-child {
    max-width: 62ch;
    margin: 0;
    color: ${colors.mutedInk};
    font-size: 12px;
    line-height: 1.65;
    overflow-wrap: break-word;
  }

  .settings-refresh-button,
  .settings-primary-button,
  .settings-secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 100%;
    min-height: 46px;
    gap: 8px;
    padding: 10px 15px;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      border-color 150ms ease,
      opacity 150ms ease;
  }

  .settings-refresh-button,
  .settings-primary-button {
    border: 1px solid ${colors.roseDeep};
    background: ${colors.roseDeep};
    color: #ffffff;
  }

  .settings-secondary-button {
    border: 1px solid ${colors.border};
    background: #ffffff;
    color: ${colors.ink};
  }

  .settings-refresh-button:hover:not(:disabled),
  .settings-primary-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow:
      0 10px 24px
      rgba(127, 52, 71, 0.2);
  }

  .settings-secondary-button:hover:not(:disabled) {
    border-color: ${colors.rose};
    background: ${colors.blush};
  }

  .settings-refresh-button:disabled,
  .settings-primary-button:disabled,
  .settings-secondary-button:disabled,
  .settings-visibility-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .settings-message {
    display: flex;
    align-items: flex-start;
    width: 100%;
    max-width: 100%;
    gap: 10px;
    margin-top: 14px;
    padding: 13px 14px;
    border-radius: 9px;
    font-size: 11px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .settings-message svg {
    flex: 0 0 auto;
  }

  .settings-error {
    border: 1px solid #e7bec6;
    background: #fff0f2;
    color: #a33b51;
  }

  .settings-success {
    border: 1px solid #bfe0cb;
    background: #eaf8ef;
    color: #287447;
  }

  .settings-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 100%;
    min-height: 260px;
    gap: 11px;
    margin-top: 18px;
    padding: 35px 18px;
    border: 1px solid ${colors.border};
    border-radius: 14px;
    background: #ffffff;
    color: ${colors.mutedInk};
    font-size: 12px;
    text-align: center;
  }

  .settings-spin {
    animation:
      settings-spin-animation
      850ms linear infinite;
  }

  @keyframes settings-spin-animation {
    to {
      transform: rotate(360deg);
    }
  }

  /*
   * Mobile-first grid:
   * Account
   * Password
   * Access
   */

  .settings-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    grid-template-areas:
      "account"
      "password"
      "access";
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 15px;
    margin-top: 17px;
  }

  .settings-card {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 17px;
    border: 1px solid ${colors.border};
    border-radius: 14px;
    background: #ffffff;
    overflow-wrap: break-word;
  }

  .settings-account-card {
    grid-area: account;
  }

  .settings-password-card {
    grid-area: password;
  }

  .settings-access-card {
    grid-area: access;
  }

  .settings-profile-header {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 13px;
    padding-bottom: 17px;
    border-bottom: 1px solid ${colors.border};
  }

  .settings-avatar {
    display: grid;
    place-items: center;
    width: 52px;
    min-width: 52px;
    height: 52px;
    border-radius: 50%;
    background:
      linear-gradient(
        135deg,
        ${colors.rose} 0%,
        ${colors.roseDeep} 100%
      );
    color: #ffffff;
    font-family: ${font.display};
    font-size: 21px;
    font-weight: 500;
  }

  .settings-profile-copy {
    min-width: 0;
  }

  .settings-profile-copy h2,
  .settings-card-header h2,
  .settings-password-heading h2 {
    margin: 4px 0 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 20px;
    font-weight: 500;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .settings-profile-copy > p:last-child {
    margin: 5px 0 0;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .settings-information-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    width: 100%;
    max-width: 100%;
    gap: 10px;
    margin-top: 16px;
  }

  .settings-information-item {
    display: flex;
    align-items: flex-start;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 10px;
    padding: 13px;
    border: 1px solid ${colors.border};
    border-radius: 10px;
    background: ${colors.cream};
  }

  .settings-information-icon {
    display: grid;
    place-items: center;
    width: 34px;
    min-width: 34px;
    height: 34px;
    border-radius: 9px;
    background: #ffffff;
    color: ${colors.roseDeep};
  }

  .settings-information-icon svg {
    width: 16px;
    height: 16px;
  }

  .settings-information-item > div {
    min-width: 0;
  }

  .settings-information-label {
    display: block;
    color: ${colors.mutedInk};
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.65px;
    line-height: 1.45;
    text-transform: uppercase;
  }

  .settings-information-value {
    display: block;
    margin-top: 5px;
    color: ${colors.ink};
    font-size: 10px;
    line-height: 1.55;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .settings-neutral-notice,
  .settings-access-explanation,
  .settings-security-notice {
    display: flex;
    align-items: flex-start;
    width: 100%;
    max-width: 100%;
    gap: 11px;
    margin-top: 15px;
    padding: 13px;
    border-radius: 10px;
  }

  .settings-neutral-notice {
    background: #f7f3f4;
    color: ${colors.mutedInk};
  }

  .settings-access-explanation {
    border: 1px solid ${colors.border};
    background: #fff8fa;
    color: ${colors.ink};
  }

  .settings-security-notice {
    border: 1px solid #ead6a8;
    background: #fff9ea;
    color: ${colors.ink};
  }

  .settings-neutral-notice svg,
  .settings-access-explanation svg,
  .settings-security-notice svg {
    flex: 0 0 auto;
    color: ${colors.roseDeep};
  }

  .settings-neutral-notice p,
  .settings-access-explanation p,
  .settings-security-notice p {
    margin: 0;
    color: ${colors.mutedInk};
    font-size: 9px;
    line-height: 1.65;
    overflow-wrap: break-word;
  }

  .settings-access-explanation strong,
  .settings-security-notice strong {
    display: block;
    margin-bottom: 4px;
    color: ${colors.ink};
    font-size: 11px;
    line-height: 1.45;
  }

  .settings-card-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    gap: 13px;
  }

  .settings-card-header > div {
    min-width: 0;
  }

  .settings-card-description {
    max-width: 60ch;
    margin: 7px 0 0;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.6;
    overflow-wrap: break-word;
  }

  .settings-status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    gap: 7px;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
  }

  .settings-status-badge > span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .settings-status-active {
    background: #e9f7ee;
    color: #287447;
  }

  .settings-status-active > span {
    background: #35a563;
  }

  .settings-status-inactive {
    background: #fff0f2;
    color: #a33b51;
  }

  .settings-status-inactive > span {
    background: #c75369;
  }

  .settings-password-heading {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 17px;
    border-bottom: 1px solid ${colors.border};
  }

  .settings-password-heading > div:last-child {
    min-width: 0;
  }

  .settings-card-icon {
    display: grid;
    place-items: center;
    width: 40px;
    min-width: 40px;
    height: 40px;
    border-radius: 10px;
    background: ${colors.blush};
    color: ${colors.roseDeep};
  }

  .settings-password-form {
    display: grid;
    width: 100%;
    max-width: 100%;
    gap: 15px;
    margin-top: 18px;
  }

  .settings-field {
    display: grid;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 7px;
  }

  .settings-field label {
    color: ${colors.ink};
    font-size: 10px;
    font-weight: 700;
    line-height: 1.5;
  }

  .settings-password-input-wrapper {
    display: flex;
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid ${colors.border};
    border-radius: 9px;
    background: #ffffff;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .settings-password-input-wrapper:focus-within {
    border-color: ${colors.rose};
    box-shadow:
      0 0 0 3px
      ${colors.rose}20;
  }

  .settings-password-input-wrapper input {
    flex: 1;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: 11px 13px;
    border: none;
    outline: none;
    background: transparent;
    color: ${colors.ink};
    font-size: 11px;
    line-height: 1.5;
  }

  .settings-password-input-wrapper input:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }

  .settings-visibility-button {
    display: grid;
    place-items: center;
    width: 48px;
    min-width: 48px;
    min-height: 48px;
    padding: 0;
    border: none;
    border-left: 1px solid ${colors.border};
    background: ${colors.cream};
    color: ${colors.roseDeep};
    cursor: pointer;
  }

  .settings-visibility-button:hover:not(:disabled) {
    background: ${colors.blush};
  }

  .settings-match-message {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 100%;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 9px;
    line-height: 1.55;
  }

  .settings-match-success {
    border: 1px solid #bfe0cb;
    background: #edf9f1;
    color: #287447;
  }

  .settings-match-error {
    border: 1px solid #e7bec6;
    background: #fff0f2;
    color: #a33b51;
  }

  .settings-requirement-box {
    width: 100%;
    max-width: 100%;
    padding: 13px;
    border: 1px solid ${colors.border};
    border-radius: 10px;
    background: ${colors.cream};
  }

  .settings-requirement-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${colors.ink};
    font-size: 10px;
    line-height: 1.45;
  }

  .settings-requirement-heading svg {
    flex: 0 0 auto;
    color: ${colors.roseDeep};
  }

  .settings-requirement-list {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    gap: 9px;
    margin-top: 12px;
  }

  .settings-requirement {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
    color: ${colors.mutedInk};
    font-size: 9px;
    line-height: 1.5;
    overflow-wrap: break-word;
  }

  .settings-requirement-icon {
    display: grid;
    place-items: center;
    width: 20px;
    min-width: 20px;
    height: 20px;
    border: 1px solid ${colors.border};
    border-radius: 50%;
    background: #ffffff;
  }

  .settings-requirement-icon > span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${colors.border};
  }

  .settings-requirement-passed {
    color: #287447;
  }

  .settings-requirement-passed
    .settings-requirement-icon {
    border-color: #acd7bb;
    background: #e9f7ee;
    color: #287447;
  }

  .settings-form-actions {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    width: 100%;
    max-width: 100%;
    gap: 9px;
  }

  .settings-security-notice {
    margin-top: 17px;
  }

  /*
   * Tablet
   */

  @media (min-width: 600px) {
    .settings-header {
      padding: 23px;
    }

    .settings-card {
      padding: 20px;
    }

    .settings-information-grid {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .settings-requirement-list {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .settings-form-actions {
      grid-template-columns:
        minmax(0, 0.7fr)
        minmax(0, 1fr);
    }

    .settings-card-header {
      flex-direction: row;
      align-items: flex-start;
      justify-content:
        space-between;
    }
  }

  /*
   * Desktop
   */

  @media (min-width: 900px) {
    .settings-header {
      flex-direction: row;
      align-items: center;
      justify-content:
        space-between;
      gap: 28px;
      padding: 25px;
    }

    .settings-refresh-button {
      width: auto;
      min-width: 155px;
      flex: 0 0 auto;
    }

    .settings-grid {
      grid-template-columns:
        minmax(0, 1.1fr)
        minmax(360px, 0.9fr);
      grid-template-areas:
        "account password"
        "access password";
      align-items: start;
      gap: 16px;
    }

    .settings-password-card {
      position: sticky;
      top: 18px;
    }
  }

  /*
   * Large desktop
   */

  @media (min-width: 1200px) {
    .settings-grid {
      grid-template-columns:
        minmax(0, 1.15fr)
        minmax(390px, 0.85fr);
      gap: 18px;
    }

    .settings-header h1 {
      font-size: 30px;
    }
  }

  /*
   * Very small devices
   */

  @media (max-width: 374px) {
    .settings-header,
    .settings-card {
      padding-left: 14px;
      padding-right: 14px;
    }

    .settings-page {
      overflow-wrap: anywhere;
    }
  }

  @media (
    prefers-reduced-motion:
    reduce
  ) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;