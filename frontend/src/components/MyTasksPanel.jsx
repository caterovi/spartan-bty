import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
} from 'lucide-react';

import {
  colors,
  font,
} from '../styles/tokens';

const statusLabels = {
  draft: 'Draft',
  rejected: 'Rejected',
  for_confirmation:
    'For Confirmation',
  confirmed: 'Confirmed',
  out_of_stock: 'Out of Stock',
  low_stock: 'Low Stock',
  pending_packing:
    'Pending Packing',
  packing: 'Packing',
  packed: 'Packed',
  ready_for_shipment:
    'Ready for Shipment',
  shipped_out: 'Shipped Out',
  pending_follow_up:
    'Pending Follow-up',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  awaiting_customer:
    'Awaiting Customer',
  unassigned_crm:
    'Unassigned CRM Case',
  awaiting_schedule:
    'Awaiting Schedule',
  follow_up_upcoming:
    'Follow-up Upcoming',
  follow_up_due_today:
    'Follow-up Due Today',
  follow_up_overdue:
    'Follow-up Overdue',
  ready_for_satisfaction:
    'Ready for Satisfaction',
  ready_for_resolution:
    'Ready for Resolution',
  pending: 'Pending',
  submitted: 'For Review',
  for_revision: 'For Revision',
  approved: 'Approved',
};

function formatLabel(value) {
  if (!value) {
    return 'Needs Attention';
  }

  return (
    statusLabels[value] ||
    String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

function formatDueDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function SummaryItem({
  label,
  value,
  emphasis,
}) {
  return (
    <div
      style={{
        ...styles.summaryItem,
        ...(emphasis
          ? styles.summaryItemEmphasis
          : {}),
      }}
    >
      <span>{label}</span>
      <strong>{Number(value || 0)}</strong>
    </div>
  );
}

export default function MyTasksPanel({
  tasks,
  categorySummaries = [],
  navigate,
}) {
  const summary = tasks?.summary || {};
  const items = tasks?.items || [];
  const heading =
    tasks?.heading || 'My Tasks';

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div style={styles.headingCopy}>
          <div style={styles.iconBox}>
            <AlertTriangle size={18} />
          </div>

          <div>
            <p style={styles.eyebrow}>
              ACTIONABLE WORK
            </p>
            <h2 style={styles.title}>
              {heading}
            </h2>
            <span style={styles.description}>
              Derived from current operational records and assignments.
            </span>
          </div>
        </div>
      </header>

      <div style={styles.summaryGrid}>
        <SummaryItem
          label="Actionable"
          value={summary.totalActionable}
        />
        <SummaryItem
          label="Overdue"
          value={summary.overdue}
          emphasis={
            Number(summary.overdue) > 0
          }
        />
        <SummaryItem
          label="High Priority"
          value={summary.highPriority}
          emphasis={
            Number(
              summary.highPriority
            ) > 0
          }
        />
        <SummaryItem
          label="Due Today"
          value={summary.dueToday}
        />
      </div>

      {categorySummaries.length > 0 && (
        <div style={styles.categorySection}>
          <p style={styles.categoryHeading}>
            Operational categories
          </p>

          <div style={styles.categoryGrid}>
            {categorySummaries.map(
              (category) => (
                <button
                  type="button"
                  key={category.key}
                  title={category.description}
                  style={{
                    ...styles.categoryCard,
                    ...(category.severity ===
                    'danger'
                      ? styles.categoryDanger
                      : category.severity ===
                        'warning'
                      ? styles.categoryWarning
                      : styles.categoryInfo),
                  }}
                  onClick={() =>
                    navigate(category.path)
                  }
                >
                  <span>{category.label}</span>
                  <strong>
                    {Number(
                      category.value || 0
                    )}
                  </strong>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div style={styles.emptyState}>
          <CheckCircle2 size={20} />
          <span>No tasks need attention</span>
        </div>
      ) : (
        <div style={styles.taskList}>
          {items.map((task) => {
            const dueDate = formatDueDate(
              task.dueAt
            );

            return (
              <button
                type="button"
                key={task.id}
                style={styles.taskCard}
                onClick={() =>
                  navigate(task.actionPath)
                }
              >
                <div style={styles.taskTopRow}>
                  <span style={styles.moduleBadge}>
                    {task.module}
                  </span>

                  <span
                    style={{
                      ...styles.priorityBadge,
                      ...(task.priority === 'high'
                        ? styles.highPriority
                        : task.priority ===
                          'medium'
                        ? styles.mediumPriority
                        : styles.normalPriority),
                    }}
                  >
                    {formatLabel(task.priority)}
                  </span>
                </div>

                <strong style={styles.taskTitle}>
                  {task.title}
                </strong>

                <span style={styles.taskDescription}>
                  {task.description}
                </span>

                <div style={styles.taskMeta}>
                  <span>
                    {formatLabel(
                      task.category || task.status
                    )}
                  </span>

                  {dueDate && (
                    <span
                      style={
                        task.isOverdue
                          ? styles.overdueText
                          : undefined
                      }
                    >
                      <Clock3 size={13} />
                      {task.isOverdue
                        ? 'Overdue: '
                        : task.isDueToday
                        ? 'Due today: '
                        : 'Due: '}
                      {dueDate}
                    </span>
                  )}
                </div>

                <span style={styles.actionText}>
                  {task.actionLabel}
                  <ArrowRight size={14} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tasks?.hasMore && (
        <p style={styles.limitNote}>
          Showing the highest-priority items. Open the relevant module for the complete workload.
        </p>
      )}
    </section>
  );
}

const styles = {
  panel: {
    width: '100%',
    minWidth: 0,
    marginTop: '18px',
    padding: '17px',
    border: `1px solid ${colors.border}`,
    borderRadius: '14px',
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
  },
  header: {
    paddingBottom: '15px',
    borderBottom: `1px solid ${colors.border}`,
  },
  headingCopy: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '11px',
  },
  iconBox: {
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 38px',
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: colors.blush,
    color: colors.roseDeep,
  },
  eyebrow: {
    margin: '0 0 5px',
    color: colors.roseDeep,
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '20px',
    fontWeight: 500,
  },
  description: {
    display: 'block',
    marginTop: '6px',
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.6,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(105px, 1fr))',
    gap: '9px',
    marginTop: '15px',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
    gap: '8px',
    padding: '10px 11px',
    border: `1px solid ${colors.border}`,
    borderRadius: '9px',
    background: colors.cream,
    color: colors.mutedInk,
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  summaryItemEmphasis: {
    borderColor: '#e7aebb',
    background: '#fff4f6',
    color: '#a33b51',
  },
  categorySection: {
    marginTop: '15px',
    paddingTop: '14px',
    borderTop: `1px solid ${colors.border}`,
  },
  categoryHeading: {
    margin: '0 0 9px',
    color: colors.mutedInk,
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(135px, 1fr))',
    gap: '8px',
  },
  categoryCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
    minHeight: '48px',
    gap: '9px',
    padding: '9px 10px',
    borderRadius: '9px',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '9px',
    fontWeight: 700,
    lineHeight: 1.35,
    textAlign: 'left',
    cursor: 'pointer',
  },
  categoryDanger: {
    border: '1px solid #e7aebb',
    background: '#fff4f6',
  },
  categoryWarning: {
    border: '1px solid #ead6a8',
    background: '#fffaf0',
  },
  categoryInfo: {
    border: '1px solid #cddae7',
    background: '#f5f9fd',
  },
  taskList: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
    gap: '10px',
    maxHeight: '590px',
    marginTop: '15px',
    paddingRight: '3px',
    overflowY: 'auto',
  },
  taskCard: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: '190px',
    gap: '9px',
    padding: '13px',
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    textAlign: 'left',
    cursor: 'pointer',
  },
  taskTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  moduleBadge: {
    color: colors.roseDeep,
    fontSize: '8px',
    fontWeight: 800,
    letterSpacing: '0.7px',
    textTransform: 'uppercase',
  },
  priorityBadge: {
    padding: '4px 7px',
    borderRadius: '999px',
    fontSize: '8px',
    fontWeight: 800,
  },
  highPriority: {
    background: '#fff0f2',
    color: '#a33b51',
  },
  mediumPriority: {
    background: '#fff8e8',
    color: '#86600f',
  },
  normalPriority: {
    background: colors.blush,
    color: colors.roseDeep,
  },
  taskTitle: {
    color: colors.ink,
    fontSize: '12px',
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },
  taskDescription: {
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
  },
  taskMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    color: colors.mutedInk,
    fontSize: '9px',
  },
  overdueText: {
    color: '#a33b51',
    fontWeight: 700,
  },
  actionText: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: 'auto',
    color: colors.roseDeep,
    fontSize: '10px',
    fontWeight: 800,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '110px',
    gap: '9px',
    marginTop: '15px',
    borderRadius: '10px',
    background: '#edf9f1',
    color: '#287447',
    fontSize: '11px',
    fontWeight: 700,
  },
  limitNote: {
    margin: '12px 0 0',
    color: colors.mutedInk,
    fontSize: '9px',
    lineHeight: 1.5,
  },
};
