import { useState } from 'react';
import api from '../api/axiosInstance';
import { colors, font } from '../styles/tokens';

export default function ResetPasswordModal({
  user,
  onClose,
  onReset,
}) {
  const [temporaryPassword, setTemporaryPassword] =
    useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setError('');

    try {
      const response = await api.patch(
        `/users/${user.id}/reset-password`,
        { temporaryPassword }
      );

      onReset(response.data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to reset the password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <section style={styles.modal}>
        <p style={styles.eyebrow}>PASSWORD RESET</p>

        <h2 style={styles.title}>
          Reset password for {user.fullName}
        </h2>

        <p style={styles.description}>
          The user will be required to change this temporary
          password after signing in.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Temporary password</label>

          <input
            type={showPassword ? 'text' : 'password'}
            value={temporaryPassword}
            onChange={(event) =>
              setTemporaryPassword(event.target.value)
            }
            minLength={8}
            autoComplete="new-password"
            style={styles.input}
            required
          />

          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) =>
                setShowPassword(event.target.checked)
              }
            />
            Show password
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={submitting}
            >
              {submitting
                ? 'Resetting...'
                : 'Reset password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(43, 36, 32, 0.55)',
  },
  modal: {
    width: '100%',
    maxWidth: '470px',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
  },
  eyebrow: {
    margin: 0,
    color: colors.roseDeep,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.3px',
  },
  title: {
    margin: '7px 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '23px',
    fontWeight: 500,
  },
  description: {
    color: colors.mutedInk,
    fontSize: '11px',
    lineHeight: 1.6,
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    color: colors.ink,
    fontSize: '11px',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '11px 12px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
  },
  checkbox: {
    display: 'flex',
    gap: '7px',
    marginTop: '10px',
    color: colors.mutedInk,
    fontSize: '11px',
  },
  error: {
    marginTop: '14px',
    padding: '11px',
    borderRadius: '8px',
    background: '#fff0f2',
    color: '#a33b51',
    fontSize: '11px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  primaryButton: {
    padding: '11px 16px',
    border: 'none',
    borderRadius: '9px',
    background: colors.rose,
    color: '#ffffff',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    cursor: 'pointer',
  },
};