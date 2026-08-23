import { useEffect, useState } from 'react';

import api from '../api/axiosInstance';
import { colors, font } from '../styles/tokens';

const tabs = [
  ['overview', 'Overview'],
  ['orders', 'Orders'],
  ['fulfillment', 'Fulfillment'],
  ['crm', 'CRM / After-Sales'],
];

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value || 0));
}

function label(value) {
  if (!value) return 'Not available';
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Info({ title, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{title}</span>
      <strong style={styles.infoValue}>{value || 'Not available'}</strong>
    </div>
  );
}

function Empty({ children }) {
  return <div style={styles.empty}>{children}</div>;
}

export default function Customer360Modal({ customerId, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCustomer() {
      setLoading(true);
      setError('');

      try {
        const response = await api.get(`/customers/${customerId}/360`);
        if (active) setData(response.data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load Customer 360.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCustomer();
    return () => {
      active = false;
    };
  }, [customerId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { customer, summary, orders = [], crmCases = [] } = data || {};

  return (
    <div
      style={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section style={styles.modal} aria-modal="true" role="dialog">
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>CUSTOMER 360</p>
            <h2 style={styles.title}>{customer?.fullName || 'Customer profile'}</h2>
            {customer && (
              <p style={styles.subtitle}>
                {customer.contactNumber} · Customer #{customer.id}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </header>

        <nav style={styles.tabs} aria-label="Customer 360 sections">
          {tabs.map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                ...styles.tab,
                ...(activeTab === key ? styles.activeTab : {}),
              }}
            >
              {text}
            </button>
          ))}
        </nav>

        <div style={styles.content}>
          {loading && <Empty>Loading customer history…</Empty>}
          {error && <div style={styles.error}>{error}</div>}

          {!loading && !error && data && activeTab === 'overview' && (
            <div style={styles.stack}>
              <div style={styles.summaryGrid}>
                {[
                  ['Total orders', summary.totalOrders],
                  ['Confirmed', summary.confirmedOrders],
                  ['Confirmed value', formatCurrency(summary.totalConfirmedAmount)],
                  ['Delivered', summary.deliveredOrders],
                  ['Returned', summary.returnedOrders],
                  ['CRM cases', summary.crmCases],
                  ['Average rating', summary.averageRating === null ? 'No rating' : `${Number(summary.averageRating).toFixed(1)} / 5`],
                  ['Latest order', formatDate(summary.latestOrderAt)],
                ].map(([title, value]) => (
                  <div key={title} style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>{title}</span>
                    <strong style={styles.summaryValue}>{value}</strong>
                  </div>
                ))}
              </div>

              <div style={styles.panel}>
                <h3 style={styles.sectionTitle}>Basic customer information</h3>
                <div style={styles.infoGrid}>
                  <Info title="Customer name" value={customer.fullName} />
                  <Info title="Contact number" value={customer.contactNumber} />
                  <Info title="Address" value={customer.address} />
                  <Info title="Customer since" value={formatDate(customer.createdAt)} />
                </div>
              </div>
            </div>
          )}

          {!loading && !error && data && activeTab === 'orders' && (
            <div style={styles.stack}>
              {orders.length === 0 ? (
                <Empty>No orders recorded for this customer.</Empty>
              ) : (
                orders.map((order) => (
                  <article key={order.id} style={styles.panel}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{order.orderNumber}</h3>
                        <span style={styles.muted}>{formatDate(order.dateEncoded)}</span>
                      </div>
                      <span style={styles.status}>{label(order.orderStatus)}</span>
                    </div>
                    <div style={styles.itemList}>
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.productId}`} style={styles.itemRow}>
                          <span>{item.productName} <small style={styles.muted}>({item.sku})</small></span>
                          <strong>{item.quantity} × {formatCurrency(item.unitPrice)}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={styles.totalRow}>
                      <span>Total amount</span>
                      <strong>{formatCurrency(order.totalAmount)}</strong>
                    </div>
                    <div style={styles.compactGrid}>
                      <Info title="CDM status" value={label(order.cdm?.confirmationStatus)} />
                      <Info title="Confirmed / rejected" value={formatDate(order.cdm?.confirmedAt || order.cdm?.rejectedAt)} />
                      <Info title="Waybill" value={order.cdm?.waybillNumber} />
                      <Info title="Sent to customer" value={formatDate(order.cdm?.sentToCustomerAt)} />
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {!loading && !error && data && activeTab === 'fulfillment' && (
            <div style={styles.stack}>
              {orders.filter((order) => order.fulfillment).length === 0 ? (
                <Empty>No fulfillment history is available.</Empty>
              ) : (
                orders.filter((order) => order.fulfillment).map((order) => {
                  const fulfillment = order.fulfillment;
                  return (
                    <article key={order.id} style={styles.panel}>
                      <div style={styles.cardHeader}>
                        <h3 style={styles.cardTitle}>{order.orderNumber}</h3>
                        <span style={styles.status}>{label(fulfillment.status)}</span>
                      </div>
                      <div style={styles.compactGrid}>
                        <Info title="Packing started" value={formatDate(fulfillment.packingStartedAt)} />
                        <Info title="Packed" value={formatDate(fulfillment.packedAt)} />
                        <Info title="Ready to ship" value={formatDate(fulfillment.readyForShipmentAt)} />
                        <Info title="Shipped" value={formatDate(fulfillment.shippedOutAt)} />
                        <Info title="Delivered" value={formatDate(fulfillment.deliveredAt)} />
                        <Info title="Returned" value={formatDate(fulfillment.returnedAt)} />
                        <Info title="Courier" value={fulfillment.thirdPartyLogistics} />
                        <Info title="Tracking number" value={fulfillment.trackingNumber} />
                      </div>
                      {fulfillment.returnReason && (
                        <p style={styles.note}><strong>Return reason:</strong> {fulfillment.returnReason}</p>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {!loading && !error && data && activeTab === 'crm' && (
            <div style={styles.stack}>
              {crmCases.length === 0 ? (
                <Empty>No CRM or after-sales history is available.</Empty>
              ) : (
                crmCases.map((crmCase) => (
                  <article key={crmCase.id} style={styles.panel}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{crmCase.orderNumber}</h3>
                        <span style={styles.muted}>Step {crmCase.currentStep} of 4</span>
                      </div>
                      <span style={styles.status}>{label(crmCase.caseStatus)}</span>
                    </div>
                    <div style={styles.compactGrid}>
                      <Info title="Assigned specialist" value={crmCase.assignedUser?.fullName || 'Unassigned'} />
                      <Info title="Delivery result" value={label(crmCase.deliveryConfirmation)} />
                      <Info title="Concern" value={label(crmCase.concernCategory)} />
                      <Info title="Next follow-up" value={formatDate(crmCase.nextFollowUpAt)} />
                      <Info title="Follow-up status" value={label(crmCase.followUpStatus)} />
                      <Info title="Resolved" value={formatDate(crmCase.resolvedAt)} />
                      <Info title="Closed" value={formatDate(crmCase.closedAt)} />
                    </div>
                    {crmCase.concernDetails && <p style={styles.note}>{crmCase.concernDetails}</p>}
                    {crmCase.resolutionNotes && <p style={styles.note}><strong>Resolution:</strong> {crmCase.resolutionNotes}</p>}
                    {crmCase.steps.map((step) => (
                      <div key={step.id} style={styles.stepRow}>
                        <div style={styles.cardHeader}>
                          <strong>Step {step.stepNumber}</strong>
                          <span style={styles.muted}>{label(step.stepStatus)}</span>
                        </div>
                        {step.customerFeedback && <p style={styles.note}><strong>Customer:</strong> {step.customerFeedback}</p>}
                        {step.crmResponse && <p style={styles.note}><strong>CRM response:</strong> {step.crmResponse}</p>}
                        <span style={styles.muted}>Follow-up: {formatDate(step.followUpAt)} · Handler: {step.handledBy?.fullName || 'Unassigned'}</span>
                      </div>
                    ))}
                    <div style={styles.ratingRow}>
                      <strong>Satisfaction: {crmCase.satisfactionRating === null ? 'Not recorded' : `${crmCase.satisfactionRating} / 5`}</strong>
                      {crmCase.finalFeedback && <span>{crmCase.finalFeedback}</span>}
                      {crmCase.wouldRepurchase && <span>Would repurchase: {label(crmCase.wouldRepurchase)}</span>}
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(17, 24, 39, 0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' },
  modal: { width: 'min(1040px, 100%)', maxHeight: '92vh', background: '#fff', borderRadius: '16px', boxShadow: '0 24px 70px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: font.body },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '20px 22px 14px', borderBottom: `1px solid ${colors.border}` },
  eyebrow: { margin: '0 0 4px', color: colors.roseDeep, fontSize: '11px', fontWeight: 800, letterSpacing: '1.2px' },
  title: { margin: 0, color: colors.ink, fontSize: '24px' },
  subtitle: { margin: '5px 0 0', color: colors.mutedInk, fontSize: '13px' },
  closeButton: { width: '36px', height: '36px', border: `1px solid ${colors.border}`, borderRadius: '9px', background: '#fff', color: colors.ink, fontSize: '24px', cursor: 'pointer' },
  tabs: { display: 'flex', gap: '6px', padding: '10px 22px', borderBottom: `1px solid ${colors.border}`, overflowX: 'auto' },
  tab: { border: 0, borderRadius: '8px', padding: '9px 12px', color: colors.mutedInk, background: 'transparent', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' },
  activeTab: { color: '#fff', background: colors.roseDeep },
  content: { padding: '18px 22px 24px', overflowY: 'auto', background: colors.cream },
  stack: { display: 'grid', gap: '14px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '10px' },
  summaryCard: { background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '11px', padding: '13px' },
  summaryLabel: { display: 'block', color: colors.mutedInk, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' },
  summaryValue: { display: 'block', color: colors.ink, marginTop: '5px', fontSize: '17px' },
  panel: { background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '16px' },
  sectionTitle: { margin: '0 0 13px', color: colors.ink, fontSize: '16px' },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' },
  compactGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginTop: '13px' },
  infoItem: { minWidth: 0 },
  infoLabel: { display: 'block', color: colors.mutedInk, fontSize: '11px', marginBottom: '3px' },
  infoValue: { color: colors.ink, fontSize: '13px', overflowWrap: 'anywhere' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  cardTitle: { margin: 0, color: colors.ink, fontSize: '16px' },
  muted: { color: colors.mutedInk, fontSize: '12px' },
  status: { padding: '5px 8px', borderRadius: '999px', background: colors.blush, color: colors.roseDeep, fontSize: '11px', fontWeight: 800 },
  itemList: { marginTop: '13px', display: 'grid', gap: '7px' },
  itemRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' },
  totalRow: { display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${colors.border}`, color: colors.ink },
  note: { margin: '10px 0 0', color: colors.ink, fontSize: '13px', lineHeight: 1.5 },
  stepRow: { marginTop: '10px', padding: '11px', borderRadius: '9px', background: colors.cream, border: `1px solid ${colors.border}` },
  ratingRow: { display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '12px', paddingTop: '11px', borderTop: `1px solid ${colors.border}`, color: colors.ink, fontSize: '13px' },
  empty: { padding: '34px 18px', textAlign: 'center', color: colors.mutedInk, background: '#fff', border: `1px dashed ${colors.border}`, borderRadius: '12px' },
  error: { padding: '12px', color: colors.roseDeep, background: colors.blush, borderRadius: '9px' },
};
