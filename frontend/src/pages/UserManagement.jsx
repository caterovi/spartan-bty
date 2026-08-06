import { useEffect, useMemo, useState } from 'react';
import api from '../api/axiosInstance';
import EditUserModal from '../components/EditUserModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { colors, font } from '../styles/tokens';

const initialForm = {
  fullName: '',
  username: '',
  email: '',
  role: 'specialist',
  departmentId: '',
  temporaryPassword: '',
};

const roleLabels = {
  head: 'Head',
  specialist: 'Specialist',
  system_configuration: 'System Configuration',
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    return {};
  }
}

function formatDate(value) {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString();
}

export default function UserManagement() {
  const storedUser = getStoredUser();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState(null);

  const [resettingUser, setResettingUser] =
    useState(null);

  const [actionLoadingId, setActionLoadingId] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        usersResponse,
        departmentsResponse,
      ] = await Promise.all([
        api.get('/users'),
        api.get('/users/departments'),
      ]);

      setUsers(usersResponse.data.users || []);

      setDepartments(
        departmentsResponse.data.departments || []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to load user accounts.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const values = [
        user.fullName,
        user.username,
        user.email,
        roleLabels[user.role],
        user.departmentName,
        user.status,
      ];

      return values.some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [users, search]);

  const totalActive = users.filter(
    (user) => user.status === 'active'
  ).length;

  const totalSpecialists = users.filter(
    (user) => user.role === 'specialist'
  ).length;

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,

      ...(name === 'role' &&
      value !== 'specialist'
        ? {
            departmentId: '',
          }
        : {}),
    }));
  };

  const resetCreateForm = () => {
    setForm(initialForm);
    setError('');
    setSuccess('');
  };

  const openCreateForm = () => {
    resetCreateForm();
    setShowCreateForm(true);
  };

  const closeCreateForm = () => {
    if (submitting) {
      return;
    }

    setShowCreateForm(false);
    resetCreateForm();
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        fullName: form.fullName.trim(),

        username: form.username
          .trim()
          .toLowerCase(),

        email: form.email
          .trim()
          .toLowerCase(),

        role: form.role,

        departmentId:
          form.role === 'specialist'
            ? Number(form.departmentId)
            : null,

        temporaryPassword:
          form.temporaryPassword,
      };

      const response = await api.post(
        '/users',
        payload
      );

      setUsers((current) => [
        ...current,
        response.data.user,
      ]);

      setForm(initialForm);

      setSuccess(
        response.data.message ||
          'User account created successfully.'
      );

      window.setTimeout(() => {
        setShowCreateForm(false);
        setSuccess('');
      }, 1200);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to create the user account.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUserSaved = (updatedUser) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === updatedUser.id
          ? updatedUser
          : user
      )
    );

    setEditingUser(null);
    setError('');
    setSuccess(
      'User account updated successfully.'
    );

    if (
      Number(updatedUser.id) ===
      Number(storedUser.id)
    ) {
      const updatedStoredUser = {
        ...storedUser,
        ...updatedUser,
      };

      localStorage.setItem(
        'user',
        JSON.stringify(updatedStoredUser)
      );

      window.location.reload();
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus =
      user.status === 'active'
        ? 'inactive'
        : 'active';

    const actionLabel =
      nextStatus === 'active'
        ? 'Activate'
        : 'Deactivate';

    const confirmed = window.confirm(
      `${actionLabel} ${user.fullName}?`
    );

    if (!confirmed) {
      return;
    }

    setActionLoadingId(user.id);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/users/${user.id}/status`,
        {
          status: nextStatus,
        }
      );

      setUsers((current) =>
        current.map((account) =>
          account.id === user.id
            ? {
                ...account,
                status: response.data.status,
              }
            : account
        )
      );

      setSuccess(
        response.data.message ||
          'Account status updated successfully.'
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to update account status.'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePasswordReset = (message) => {
    if (!resettingUser) {
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === resettingUser.id
          ? {
              ...user,
              mustChangePassword: true,
            }
          : user
      )
    );

    setResettingUser(null);
    setError('');
    setSuccess(
      message ||
        'Temporary password assigned successfully.'
    );
  };

  return (
    <div>
      <section style={styles.pageHeader}>
        <div>
          <p style={styles.eyebrow}>
            SYSTEM CONFIGURATION
          </p>

          <h1 style={styles.pageTitle}>
            User Management
          </h1>

          <p style={styles.pageDescription}>
            Create accounts, assign roles and
            departments, and manage system access.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          style={styles.primaryButton}
        >
          + Create user
        </button>
      </section>

      <section style={styles.summaryGrid}>
        <article style={styles.summaryCard}>
          <p style={styles.summaryLabel}>
            TOTAL ACCOUNTS
          </p>

          <h2 style={styles.summaryValue}>
            {users.length}
          </h2>
        </article>

        <article style={styles.summaryCard}>
          <p style={styles.summaryLabel}>
            ACTIVE ACCOUNTS
          </p>

          <h2 style={styles.summaryValue}>
            {totalActive}
          </h2>
        </article>

        <article style={styles.summaryCard}>
          <p style={styles.summaryLabel}>
            SPECIALISTS
          </p>

          <h2 style={styles.summaryValue}>
            {totalSpecialists}
          </h2>
        </article>

        <article style={styles.summaryCard}>
          <p style={styles.summaryLabel}>
            DEPARTMENTS
          </p>

          <h2 style={styles.summaryValue}>
            {departments.length}
          </h2>
        </article>
      </section>

      <section style={styles.tableSection}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              User accounts
            </h2>

            <p style={styles.sectionDescription}>
              {filteredUsers.length} account
              {filteredUsers.length === 1
                ? ''
                : 's'}{' '}
              shown
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search users..."
            style={styles.searchInput}
          />
        </div>

        {error && !showCreateForm && (
          <div style={styles.errorMessage}>
            {error}
          </div>
        )}

        {success && !showCreateForm && (
          <div style={styles.successMessage}>
            {success}
          </div>
        )}

        {loading ? (
          <div style={styles.emptyState}>
            Loading user accounts...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={styles.emptyState}>
            No user accounts found.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeading}>
                    User
                  </th>

                  <th style={styles.tableHeading}>
                    Role
                  </th>

                  <th style={styles.tableHeading}>
                    Department
                  </th>

                  <th style={styles.tableHeading}>
                    Status
                  </th>

                  <th style={styles.tableHeading}>
                    Last login
                  </th>

                  <th style={styles.tableHeading}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const isCurrentUser =
                    Number(user.id) ===
                    Number(storedUser.id);

                  const isUpdatingStatus =
                    actionLoadingId === user.id;

                  return (
                    <tr key={user.id}>
                      <td style={styles.tableCell}>
                        <div style={styles.userCell}>
                          <div style={styles.avatar}>
                            {(user.fullName ||
                              user.username ||
                              'U')
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p style={styles.userName}>
                              {user.fullName}
                            </p>

                            <p
                              style={
                                styles.userDetails
                              }
                            >
                              @{user.username} ·{' '}
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td style={styles.tableCell}>
                        <span
                          style={styles.roleBadge}
                        >
                          {roleLabels[user.role] ||
                            user.role}
                        </span>
                      </td>

                      <td style={styles.tableCell}>
                        {user.departmentName ||
                          'System-wide'}
                      </td>

                      <td style={styles.tableCell}>
                        <span
                          style={{
                            ...styles.statusBadge,

                            ...(user.status ===
                            'active'
                              ? styles.activeStatus
                              : styles.inactiveStatus),
                          }}
                        >
                          {user.status}
                        </span>
                      </td>

                      <td style={styles.tableCell}>
                        {formatDate(
                          user.lastLoginAt
                        )}
                      </td>

                      <td style={styles.tableCell}>
                        <div
                          style={styles.actionGroup}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setError('');
                              setSuccess('');
                              setEditingUser(user);
                            }}
                            style={
                              styles.actionButton
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleToggleStatus(
                                user
                              )
                            }
                            disabled={
                              isCurrentUser ||
                              isUpdatingStatus
                            }
                            style={{
                              ...styles.actionButton,

                              ...(user.status ===
                              'active'
                                ? styles.dangerAction
                                : styles.activateAction),

                              ...(isCurrentUser
                                ? styles.disabledButton
                                : {}),
                            }}
                            title={
                              isCurrentUser
                                ? 'You cannot deactivate your own account.'
                                : ''
                            }
                          >
                            {isUpdatingStatus
                              ? 'Updating...'
                              : user.status ===
                                  'active'
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setError('');
                              setSuccess('');
                              setResettingUser(
                                user
                              );
                            }}
                            disabled={isCurrentUser}
                            style={{
                              ...styles.actionButton,

                              ...(isCurrentUser
                                ? styles.disabledButton
                                : {}),
                            }}
                            title={
                              isCurrentUser
                                ? 'Use Settings to change your own password.'
                                : ''
                            }
                          >
                            Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreateForm && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateForm();
            }
          }}
        >
          <section style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.eyebrow}>
                  NEW ACCOUNT
                </p>

                <h2 style={styles.modalTitle}>
                  Create user
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCreateForm}
                style={styles.closeButton}
                disabled={submitting}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleCreateUser}
              style={styles.form}
            >
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>
                    Full name
                  </label>

                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleFormChange}
                    placeholder="Enter full name"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    Username
                  </label>

                  <input
                    name="username"
                    value={form.username}
                    onChange={handleFormChange}
                    placeholder="e.g. juandelacruz"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    Email address
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="name@spartanbty.com"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    User role
                  </label>

                  <select
                    name="role"
                    value={form.role}
                    onChange={handleFormChange}
                    style={styles.input}
                    required
                  >
                    <option value="specialist">
                      Specialist
                    </option>

                    <option value="head">
                      Head
                    </option>

                    <option value="system_configuration">
                      System Configuration
                    </option>
                  </select>
                </div>

                {form.role === 'specialist' && (
                  <div style={styles.field}>
                    <label style={styles.label}>
                      Assigned department
                    </label>

                    <select
                      name="departmentId"
                      value={form.departmentId}
                      onChange={
                        handleFormChange
                      }
                      style={styles.input}
                      required
                    >
                      <option value="">
                        Select department
                      </option>

                      {departments.map(
                        (department) => (
                          <option
                            key={department.id}
                            value={department.id}
                          >
                            {department.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}

                <div style={styles.field}>
                  <label style={styles.label}>
                    Temporary password
                  </label>

                  <input
                    type="password"
                    name="temporaryPassword"
                    value={
                      form.temporaryPassword
                    }
                    onChange={handleFormChange}
                    placeholder="At least 8 characters"
                    minLength={8}
                    style={styles.input}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <p style={styles.passwordNote}>
                The user will be required to
                change this temporary password
                after signing in.
              </p>

              {error && (
                <div
                  style={styles.errorMessage}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={styles.successMessage}
                >
                  {success}
                </div>
              )}

              <div style={styles.formActions}>
                <button
                  type="button"
                  onClick={closeCreateForm}
                  style={
                    styles.secondaryButton
                  }
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
                    ? 'Creating...'
                    : 'Create account'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          departments={departments}
          onClose={() =>
            setEditingUser(null)
          }
          onSaved={handleUserSaved}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() =>
            setResettingUser(null)
          }
          onReset={handlePasswordReset}
        />
      )}
    </div>
  );
}

const styles = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    padding: '24px',
    background: colors.blush,
    border: `1px solid ${colors.border}`,
    borderRadius: '16px',
  },

  eyebrow: {
    margin: 0,
    color: colors.roseDeep,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.4px',
  },

  pageTitle: {
    margin: '6px 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '28px',
    fontWeight: 500,
  },

  pageDescription: {
    margin: 0,
    color: colors.mutedInk,
    fontSize: '12px',
  },

  primaryButton: {
    padding: '11px 16px',
    border: 'none',
    borderRadius: '9px',
    background: colors.rose,
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '12px',
    cursor: 'pointer',
  },

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '14px',
    marginTop: '18px',
  },

  summaryCard: {
    padding: '18px',
    borderRadius: '13px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  summaryLabel: {
    margin: 0,
    color: colors.roseDeep,
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1px',
  },

  summaryValue: {
    margin: '9px 0 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '26px',
    fontWeight: 500,
  },

  tableSection: {
    marginTop: '18px',
    padding: '20px',
    borderRadius: '15px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },

  sectionTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '21px',
    fontWeight: 500,
  },

  sectionDescription: {
    margin: '4px 0 0',
    color: colors.mutedInk,
    fontSize: '11px',
  },

  searchInput: {
    width: '240px',
    padding: '10px 12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    outline: 'none',
    fontFamily: font.body,
    fontSize: '12px',
  },

  tableWrapper: {
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    minWidth: '1050px',
    borderCollapse: 'collapse',
  },

  tableHeading: {
    padding: '11px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '9px',
    letterSpacing: '1px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },

  tableCell: {
    padding: '13px 11px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.ink,
    fontSize: '11px',
    verticalAlign: 'middle',
  },

  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  avatar: {
    width: '34px',
    height: '34px',
    minWidth: '34px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    background: colors.blush,
    color: colors.roseDeep,
    fontWeight: 700,
  },

  userName: {
    margin: 0,
    fontWeight: 600,
  },

  userDetails: {
    margin: '3px 0 0',
    color: colors.mutedInk,
    fontSize: '10px',
    whiteSpace: 'nowrap',
  },

  roleBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    background: colors.blush,
    color: colors.roseDeep,
    fontSize: '10px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'capitalize',
  },

  activeStatus: {
    background: '#e8f7ee',
    color: '#287447',
  },

  inactiveStatus: {
    background: '#f4eeee',
    color: '#91515a',
  },

  actionGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    minWidth: '230px',
  },

  actionButton: {
    padding: '6px 9px',
    borderRadius: '7px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '9px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  dangerAction: {
    background: '#fff0f2',
    color: '#a33b51',
  },

  activateAction: {
    background: '#e9f7ee',
    color: '#287447',
  },

  disabledButton: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },

  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: colors.mutedInk,
    fontSize: '12px',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(43, 36, 32, 0.55)',
  },

  modal: {
    width: '100%',
    maxWidth: '680px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
    boxShadow:
      '0 24px 70px rgba(0,0,0,0.2)',
  },

  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  modalTitle: {
    margin: '5px 0 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '25px',
    fontWeight: 500,
  },

  closeButton: {
    border: 'none',
    background: 'transparent',
    color: colors.mutedInk,
    fontSize: '26px',
    cursor: 'pointer',
  },

  form: {
    marginTop: '20px',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(240px, 1fr))',
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
    outline: 'none',
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '12px',
  },

  passwordNote: {
    margin: '13px 0 0',
    color: colors.mutedInk,
    fontSize: '10px',
  },

  errorMessage: {
    marginTop: '14px',
    padding: '11px 13px',
    borderRadius: '8px',
    background: '#fff0f2',
    color: '#a33b51',
    fontSize: '11px',
  },

  successMessage: {
    marginTop: '14px',
    padding: '11px 13px',
    borderRadius: '8px',
    background: '#e9f7ee',
    color: '#287447',
    fontSize: '11px',
  },

  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
};