import { useState } from 'react';
import api from '../api/axiosInstance';
import { colors, font } from '../styles/tokens';

export default function EditUserModal({
  user,
  departments,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    fullName: user.fullName || '',
    username: user.username || '',
    email: user.email || '',
    role: user.role || 'specialist',
    departmentId: user.departmentId || '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'role' && value !== 'specialist'
        ? { departmentId: '' }
        : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setError('');

    try {
      const response = await api.patch(`/users/${user.id}`, {
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        departmentId:
          form.role === 'specialist'
            ? Number(form.departmentId)
            : null,
      });

      onSaved(response.data.user);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to update the account.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <section style={styles.modal}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>EDIT ACCOUNT</p>
            <h2 style={styles.title}>{user.fullName}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGrid}>
            <Field label="Full name">
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </Field>

            <Field label="Username">
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </Field>

            <Field label="Role">
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="head">Head</option>
                <option value="specialist">Specialist</option>
                <option value="system_configuration">
                  System Configuration
                </option>
              </select>
            </Field>

            {form.role === 'specialist' && (
              <Field label="Assigned department">
                <select
                  name="departmentId"
                  value={form.departmentId}
                  onChange={handleChange}
                  style={styles.input}
                  required
                >
                  <option value="">Select department</option>

                  {departments.map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

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
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
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
    maxWidth: '650px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  eyebrow: {
    margin: 0,
    color: colors.roseDeep,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.3px',
  },
  title: {
    margin: '6px 0 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '25px',
    fontWeight: 500,
  },
  closeButton: {
    border: 'none',
    background: 'transparent',
    fontSize: '26px',
    cursor: 'pointer',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '15px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
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
    fontFamily: font.body,
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