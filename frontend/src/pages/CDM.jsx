import { useEffect, useMemo, useState } from 'react';
import api from '../api/axiosInstance';
import Customer360Modal from '../components/Customer360Modal';
import WorkflowSummary from '../components/WorkflowSummary';
import { colors, font } from '../styles/tokens';

const statusLabels = {
  pending: 'Pending Confirmation',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    return {};
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function CDM() {
  const currentUser = getStoredUser();

  const canWrite =
    currentUser.role === 'specialist' &&
    currentUser.departmentCode === 'cdm';

  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [customer360Id, setCustomer360Id] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [confirmationNotes, setConfirmationNotes] =
    useState('');

  const [rejectionReason, setRejectionReason] =
    useState('');

  const [waybillNumber, setWaybillNumber] =
    useState('');

  const [waybillLink, setWaybillLink] =
    useState('');

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/cdm/orders');

      setOrders(response.data.orders || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to retrieve CDM orders.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial remote-data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return orders.filter((order) => {
      const status =
        order.confirmationStatus ||
        (order.orderStatus === 'for_confirmation'
          ? 'pending'
          : order.orderStatus);

      const matchesStatus =
        !statusFilter || status === statusFilter;

      const values = [
        order.orderNumber,
        order.customer?.fullName,
        order.customer?.contactNumber,
        order.waybillNumber,
        statusLabels[status],
      ];

      const matchesSearch =
        !keyword ||
        values.some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(keyword)
        );

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const pendingCount = orders.filter(
    (order) =>
      order.orderStatus === 'for_confirmation'
  ).length;

  const confirmedCount = orders.filter(
    (order) => order.orderStatus === 'confirmed'
  ).length;

  const rejectedCount = orders.filter(
    (order) => order.orderStatus === 'rejected'
  ).length;

  const withWaybillCount = orders.filter(
    (order) =>
      order.waybillNumber || order.waybillLink
  ).length;

  const sentCount = orders.filter(
    (order) => order.sentToCustomerAt
  ).length;

  const openOrder = async (orderId) => {
    setDetailsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.get(
        `/cdm/orders/${orderId}`
      );

      const order = response.data.order;

      setSelectedOrder(order);
      setConfirmationNotes(
        order.confirmationNotes || ''
      );
      setRejectionReason('');
      setWaybillNumber(
        order.waybillNumber || ''
      );
      setWaybillLink(order.waybillLink || '');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to retrieve order details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshSelectedOrder = async (orderId) => {
    const response = await api.get(
      `/cdm/orders/${orderId}`
    );

    const order = response.data.order;

    setSelectedOrder(order);
    setConfirmationNotes(
      order.confirmationNotes || ''
    );
    setWaybillNumber(order.waybillNumber || '');
    setWaybillLink(order.waybillLink || '');
  };

  const handleConfirm = async () => {
    if (!selectedOrder) {
      return;
    }

    const confirmed = window.confirm(
      `Confirm order ${selectedOrder.orderNumber}?`
    );

    if (!confirmed) {
      return;
    }

    setActionLoading('confirm');
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/cdm/orders/${selectedOrder.id}/confirm`,
        {
          confirmationNotes:
            confirmationNotes.trim(),
        }
      );

      setSuccess(response.data.message);

      await Promise.all([
        loadOrders(),
        refreshSelectedOrder(selectedOrder.id),
      ]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to confirm the order.'
      );
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!selectedOrder) {
      return;
    }

    if (!rejectionReason.trim()) {
      setError(
        'Enter a reason before rejecting the order.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Reject order ${selectedOrder.orderNumber}?`
    );

    if (!confirmed) {
      return;
    }

    setActionLoading('reject');
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/cdm/orders/${selectedOrder.id}/reject`,
        {
          rejectionReason:
            rejectionReason.trim(),
        }
      );

      setSuccess(response.data.message);

      await Promise.all([
        loadOrders(),
        refreshSelectedOrder(selectedOrder.id),
      ]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to reject the order.'
      );
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveWaybill = async () => {
    if (!selectedOrder) {
      return;
    }

    if (
      !waybillNumber.trim() &&
      !waybillLink.trim()
    ) {
      setError(
        'Enter a waybill number or waybill link.'
      );
      return;
    }

    setActionLoading('waybill');
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/cdm/orders/${selectedOrder.id}/waybill`,
        {
          waybillNumber: waybillNumber.trim(),
          waybillLink: waybillLink.trim(),
        }
      );

      setSuccess(response.data.message);

      await Promise.all([
        loadOrders(),
        refreshSelectedOrder(selectedOrder.id),
      ]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to save the waybill.'
      );
    } finally {
      setActionLoading('');
    }
  };

  const handleMarkSent = async () => {
    if (!selectedOrder) {
      return;
    }

    const confirmed = window.confirm(
      'Mark the waybill as sent to the customer?'
    );

    if (!confirmed) {
      return;
    }

    setActionLoading('send');
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/cdm/orders/${selectedOrder.id}/send`
      );

      setSuccess(response.data.message);

      await Promise.all([
        loadOrders(),
        refreshSelectedOrder(selectedOrder.id),
      ]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to update the sent status.'
      );
    } finally {
      setActionLoading('');
    }
  };

  const closeDetails = () => {
    if (actionLoading) {
      return;
    }

    setSelectedOrder(null);
    setConfirmationNotes('');
    setRejectionReason('');
    setWaybillNumber('');
    setWaybillLink('');
    setError('');
  };

  return (
    <div>
      <section style={styles.pageHeader}>
        <div>
          <p style={styles.eyebrow}>
            CUSTOMER DATA MANAGEMENT
          </p>

          <h1 style={styles.pageTitle}>
            Order Confirmation
          </h1>

          <p style={styles.pageDescription}>
            Review submitted orders, confirm or reject
            customer information, record waybill details,
            and monitor delivery of confirmation records.
          </p>
        </div>

        {!canWrite && (
          <span style={styles.readOnlyBadge}>
            View-only access
          </span>
        )}
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="PENDING"
          value={pendingCount}
        />

        <SummaryCard
          label="CONFIRMED"
          value={confirmedCount}
        />

        <SummaryCard
          label="REJECTED"
          value={rejectedCount}
        />

        <SummaryCard
          label="WITH WAYBILL"
          value={withWaybillCount}
        />

        <SummaryCard
          label="SENT TO CUSTOMER"
          value={sentCount}
        />
      </section>

      {success && (
        <div style={styles.successMessage}>
          {success}
        </div>
      )}

      {error && !selectedOrder && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}

      <section style={styles.tableSection}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              Submitted orders
            </h2>

            <p style={styles.sectionDescription}>
              {filteredOrders.length} order
              {filteredOrders.length === 1 ? '' : 's'}{' '}
              shown
            </p>
          </div>

          <div style={styles.filters}>
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search orders..."
              style={styles.searchInput}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              style={styles.filterSelect}
            >
              <option value="">
                All statuses
              </option>

              <option value="pending">
                Pending Confirmation
              </option>

              <option value="confirmed">
                Confirmed
              </option>

              <option value="rejected">
                Rejected
              </option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyState}>
            Loading CDM orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={styles.emptyState}>
            No submitted orders found.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeading}>
                    Order
                  </th>

                  <th style={styles.tableHeading}>
                    Customer
                  </th>

                  <th style={styles.tableHeading}>
                    Products
                  </th>

                  <th style={styles.tableHeading}>
                    Total
                  </th>

                  <th style={styles.tableHeading}>
                    Confirmation
                  </th>

                  <th style={styles.tableHeading}>
                    Waybill
                  </th>

                  <th style={styles.tableHeading}>
                    Submitted
                  </th>

                  <th style={styles.tableHeading}>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => {
                  const status =
                    order.confirmationStatus ||
                    (order.orderStatus ===
                    'for_confirmation'
                      ? 'pending'
                      : order.orderStatus);

                  return (
                    <tr key={order.id}>
                      <td style={styles.tableCell}>
                        <strong>
                          {order.orderNumber}
                        </strong>
                      </td>

                      <td style={styles.tableCell}>
                        <p style={styles.primaryText}>
                          {order.customer?.fullName}
                        </p>

                        <p style={styles.secondaryText}>
                          {
                            order.customer
                              ?.contactNumber
                          }
                        </p>
                      </td>

                      <td style={styles.tableCell}>
                        {order.itemCount} product
                        {Number(order.itemCount) === 1
                          ? ''
                          : 's'}

                        <br />

                        <span
                          style={styles.secondaryText}
                        >
                          {order.totalUnits} unit
                          {Number(order.totalUnits) ===
                          1
                            ? ''
                            : 's'}
                        </span>
                      </td>

                      <td style={styles.tableCell}>
                        <strong>
                          {formatCurrency(
                            order.totalAmount
                          )}
                        </strong>
                      </td>

                      <td style={styles.tableCell}>
                        <StatusBadge
                          status={status}
                        />

                        {order.workflow && (
                          <div
                            style={{
                              ...styles.secondaryText,
                              marginTop: '6px',
                            }}
                          >
                            {order.workflow.nextAction}
                          </div>
                        )}
                      </td>

                      <td style={styles.tableCell}>
                        {order.waybillNumber ||
                        order.waybillLink ? (
                          <>
                            <strong>
                              {order.waybillNumber ||
                                'Link recorded'}
                            </strong>

                            <br />

                            <span
                              style={
                                styles.secondaryText
                              }
                            >
                              {order.sentToCustomerAt
                                ? 'Sent to customer'
                                : 'Not yet sent'}
                            </span>
                          </>
                        ) : (
                          <span
                            style={
                              styles.secondaryText
                            }
                          >
                            No waybill
                          </span>
                        )}
                      </td>

                      <td style={styles.tableCell}>
                        {formatDate(order.submittedAt)}
                      </td>

                      <td style={styles.tableCell}>
                        <button
                          type="button"
                          onClick={() =>
                            openOrder(order.id)
                          }
                          disabled={detailsLoading}
                          style={styles.actionButton}
                        >
                          {detailsLoading
                            ? 'Loading...'
                            : 'Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedOrder && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeDetails();
            }
          }}
        >
          <section style={styles.detailsModal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.eyebrow}>
                  CDM ORDER REVIEW
                </p>

                <h2 style={styles.modalTitle}>
                  {selectedOrder.orderNumber}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                disabled={Boolean(actionLoading)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <WorkflowSummary
              workflow={selectedOrder.workflow}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setCustomer360Id(selectedOrder.customer?.id)}
                style={styles.secondaryButton}
              >
                View Customer 360
              </button>
            </div>

            <div style={styles.detailGrid}>
              <Detail
                label="Customer name"
                value={
                  selectedOrder.customer?.fullName
                }
              />

              <Detail
                label="Contact number"
                value={
                  selectedOrder.customer
                    ?.contactNumber
                }
              />

              <Detail
                label="Order status"
                value={
                  statusLabels[
                    selectedOrder.confirmationStatus
                  ] ||
                  selectedOrder.orderStatus
                }
              />

              <Detail
                label="Submitted"
                value={formatDate(
                  selectedOrder.submittedAt
                )}
              />

              <Detail
                label="Encoded by"
                value={
                  selectedOrder.encodedBy?.fullName
                }
              />

              <Detail
                label="Handled by"
                value={
                  selectedOrder.handledBy?.fullName ||
                  'Not yet assigned'
                }
              />

              <Detail
                label="Skin concern"
                value={
                  selectedOrder.skinConcern ||
                  'None'
                }
              />

              <Detail
                label="Tags"
                value={
                  selectedOrder.tags || 'None'
                }
              />

              <Detail
                label="Address"
                value={
                  selectedOrder.customer?.address
                }
                fullWidth
              />

              <Detail
                label="Conversation link"
                value={
                  selectedOrder.conversationLink ||
                  'None'
                }
                fullWidth
              />

              <Detail
                label="Sales notes"
                value={
                  selectedOrder.notes || 'None'
                }
                fullWidth
              />
            </div>

            <h3 style={styles.subsectionTitle}>
              Ordered products
            </h3>

            <div style={styles.itemsTableWrapper}>
              <table style={styles.itemsTable}>
                <thead>
                  <tr>
                    <th style={styles.tableHeading}>
                      Product
                    </th>

                    <th style={styles.tableHeading}>
                      Quantity
                    </th>

                    <th style={styles.tableHeading}>
                      Unit price
                    </th>

                    <th style={styles.tableHeading}>
                      Line total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.items?.map(
                    (item) => (
                      <tr key={item.id}>
                        <td style={styles.tableCell}>
                          {item.productName}
                        </td>

                        <td style={styles.tableCell}>
                          {item.quantity}
                        </td>

                        <td style={styles.tableCell}>
                          {formatCurrency(
                            item.unitPrice
                          )}
                        </td>

                        <td style={styles.tableCell}>
                          {formatCurrency(
                            item.lineTotal
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div style={styles.totalBox}>
              <span>Total amount</span>

              <strong>
                {formatCurrency(
                  selectedOrder.totalAmount
                )}
              </strong>
            </div>

            {selectedOrder.orderStatus ===
              'for_confirmation' &&
              canWrite && (
                <section style={styles.actionSection}>
                  <h3 style={styles.subsectionTitle}>
                    Confirm or reject order
                  </h3>

                  <label style={styles.label}>
                    Confirmation notes
                  </label>

                  <textarea
                    value={confirmationNotes}
                    onChange={(event) =>
                      setConfirmationNotes(
                        event.target.value
                      )
                    }
                    placeholder="Optional confirmation notes"
                    style={styles.textarea}
                  />

                  <label style={styles.label}>
                    Rejection reason
                  </label>

                  <textarea
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                    placeholder="Required only when rejecting"
                    style={styles.textarea}
                  />

                  <div style={styles.actionRow}>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={Boolean(actionLoading)}
                      style={styles.rejectButton}
                    >
                      {actionLoading === 'reject'
                        ? 'Rejecting...'
                        : 'Reject order'}
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={Boolean(actionLoading)}
                      style={styles.primaryButton}
                    >
                      {actionLoading === 'confirm'
                        ? 'Confirming...'
                        : 'Confirm order'}
                    </button>
                  </div>
                </section>
              )}

            {selectedOrder.orderStatus ===
              'confirmed' && (
              <section style={styles.actionSection}>
                <h3 style={styles.subsectionTitle}>
                  Waybill information
                </h3>

                <div style={styles.formGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      Waybill number
                    </label>

                    <input
                      value={waybillNumber}
                      onChange={(event) =>
                        setWaybillNumber(
                          event.target.value
                        )
                      }
                      placeholder="Enter waybill number"
                      style={styles.input}
                      disabled={!canWrite}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Waybill link
                    </label>

                    <input
                      type="url"
                      value={waybillLink}
                      onChange={(event) =>
                        setWaybillLink(
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                      style={styles.input}
                      disabled={!canWrite}
                    />
                  </div>
                </div>

                {selectedOrder.waybillGeneratedAt && (
                  <p style={styles.helperText}>
                    Waybill recorded:{' '}
                    {formatDate(
                      selectedOrder.waybillGeneratedAt
                    )}
                  </p>
                )}

                {selectedOrder.sentToCustomerAt && (
                  <div style={styles.sentMessage}>
                    Sent to customer on{' '}
                    {formatDate(
                      selectedOrder.sentToCustomerAt
                    )}
                  </div>
                )}

                {canWrite && (
                  <div style={styles.actionRow}>
                    <button
                      type="button"
                      onClick={handleSaveWaybill}
                      disabled={Boolean(actionLoading)}
                      style={styles.secondaryButton}
                    >
                      {actionLoading === 'waybill'
                        ? 'Saving...'
                        : 'Save waybill'}
                    </button>

                    {!selectedOrder.sentToCustomerAt && (
                      <button
                        type="button"
                        onClick={handleMarkSent}
                        disabled={Boolean(actionLoading)}
                        style={styles.primaryButton}
                      >
                        {actionLoading === 'send'
                          ? 'Updating...'
                          : 'Mark as sent to customer'}
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {selectedOrder.orderStatus ===
              'rejected' && (
              <section style={styles.rejectionBox}>
                <strong>Rejection reason</strong>

                <p>
                  {selectedOrder.confirmationNotes ||
                    'No rejection reason recorded.'}
                </p>

                <span>
                  Rejected:{' '}
                  {formatDate(
                    selectedOrder.rejectedAt
                  )}
                </span>
              </section>
            )}

            {error && (
              <div style={styles.errorMessage}>
                {error}
              </div>
            )}

            {success && (
              <div style={styles.successMessage}>
                {success}
              </div>
            )}
          </section>
        </div>
      )}

      {customer360Id && (
        <Customer360Modal
          customerId={customer360Id}
          onClose={() => setCustomer360Id(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article style={styles.summaryCard}>
      <p style={styles.summaryLabel}>{label}</p>
      <h2 style={styles.summaryValue}>{value}</h2>
    </article>
  );
}

function Detail({
  label,
  value,
  fullWidth = false,
}) {
  return (
    <div
      style={{
        ...styles.detailItem,
        ...(fullWidth
          ? styles.fullWidthField
          : {}),
      }}
    >
      <span style={styles.detailLabel}>
        {label}
      </span>

      <strong style={styles.detailValue}>
        {value || 'Not available'}
      </strong>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusStyle = {
    pending: styles.pendingStatus,
    confirmed: styles.confirmedStatus,
    rejected: styles.rejectedStatus,
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(statusStyle[status] || {}),
      }}
    >
      {statusLabels[status] || status}
    </span>
  );
}

const styles = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    padding: '24px',
    borderRadius: '16px',
    background: colors.blush,
    border: `1px solid ${colors.border}`,
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
    lineHeight: 1.6,
  },

  readOnlyBadge: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: '#f1eeee',
    color: colors.mutedInk,
    fontSize: '10px',
    fontWeight: 600,
  },

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(150px, 1fr))',
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
    flexWrap: 'wrap',
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

  filters: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },

  searchInput: {
    width: '230px',
    padding: '10px 12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    fontFamily: font.body,
    fontSize: '12px',
  },

  filterSelect: {
    padding: '10px 12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
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

  primaryText: {
    margin: 0,
    fontWeight: 600,
  },

  secondaryText: {
    margin: '3px 0 0',
    color: colors.mutedInk,
    fontSize: '10px',
  },

  actionButton: {
    padding: '7px 11px',
    borderRadius: '7px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '10px',
    cursor: 'pointer',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '9px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  pendingStatus: {
    background: '#fff5d9',
    color: '#725b1e',
  },

  confirmedStatus: {
    background: '#e8f7ee',
    color: '#287447',
  },

  rejectedStatus: {
    background: '#fff0f2',
    color: '#a33b51',
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
    zIndex: 1200,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(43, 36, 32, 0.6)',
  },

  detailsModal: {
    width: '100%',
    maxWidth: '900px',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
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
    fontSize: '27px',
    cursor: 'pointer',
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '12px',
    marginTop: '20px',
  },

  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '13px',
    borderRadius: '10px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  fullWidthField: {
    gridColumn: '1 / -1',
  },

  detailLabel: {
    color: colors.mutedInk,
    fontSize: '9px',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  },

  detailValue: {
    color: colors.ink,
    fontSize: '11px',
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },

  subsectionTitle: {
    margin: '22px 0 10px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  itemsTableWrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
  },

  itemsTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },

  totalBox: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '16px',
    padding: '15px',
    borderRadius: '10px',
    background: colors.blush,
    color: colors.ink,
  },

  actionSection: {
    marginTop: '22px',
    padding: '18px',
    borderRadius: '12px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  label: {
    display: 'block',
    margin: '12px 0 6px',
    color: colors.ink,
    fontSize: '11px',
    fontWeight: 600,
  },

  textarea: {
    width: '100%',
    minHeight: '75px',
    padding: '11px 12px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    resize: 'vertical',
    fontFamily: font.body,
    fontSize: '12px',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
  },

  input: {
    width: '100%',
    padding: '11px 12px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    fontFamily: font.body,
    fontSize: '12px',
  },

  actionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '16px',
    flexWrap: 'wrap',
  },

  primaryButton: {
    padding: '11px 16px',
    border: 'none',
    borderRadius: '9px',
    background: colors.rose,
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '11px',
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
    fontSize: '11px',
    cursor: 'pointer',
  },

  rejectButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: '1px solid #e8b7c1',
    background: '#fff0f2',
    color: '#a33b51',
    fontFamily: font.body,
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  helperText: {
    margin: '12px 0 0',
    color: colors.mutedInk,
    fontSize: '10px',
  },

  sentMessage: {
    marginTop: '13px',
    padding: '11px 13px',
    borderRadius: '8px',
    background: '#e9f7ee',
    color: '#287447',
    fontSize: '11px',
  },

  rejectionBox: {
    marginTop: '22px',
    padding: '16px',
    borderRadius: '10px',
    background: '#fff0f2',
    border: '1px solid #e8b7c1',
    color: '#8f3348',
    fontSize: '11px',
    lineHeight: 1.6,
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
};
