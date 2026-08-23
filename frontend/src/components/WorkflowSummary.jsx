import {
  colors,
  font,
} from '../styles/tokens';

function formatHandoffDate(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function WorkflowSummary({
  workflow,
}) {
  if (!workflow) {
    return null;
  }

  return (
    <section style={styles.container}>
      <div style={styles.headingRow}>
        <div>
          <p style={styles.eyebrow}>
            AUTOMATIC MODULE HANDOFF
          </p>

          <strong style={styles.stateLabel}>
            {workflow.stateLabel}
          </strong>
        </div>

        {workflow.needsAttention && (
          <span style={styles.attentionBadge}>
            Action needed
          </span>
        )}
      </div>

      <div style={styles.grid}>
        <div style={styles.item}>
          <span style={styles.label}>
            Current stage
          </span>
          <strong>{workflow.currentStage}</strong>
        </div>

        <div style={styles.item}>
          <span style={styles.label}>
            Previous completed stage
          </span>
          <strong>
            {workflow.previousStage || 'None'}
          </strong>
        </div>

        <div style={styles.item}>
          <span style={styles.label}>
            Next action
          </span>
          <strong>{workflow.nextAction}</strong>
        </div>

        <div style={styles.item}>
          <span style={styles.label}>
            Responsible module
          </span>
          <strong>
            {workflow.nextResponsibleModule ||
              'None'}
          </strong>
        </div>

        <div style={styles.item}>
          <span style={styles.label}>
            Stage handoff
          </span>
          <strong>
            {formatHandoffDate(
              workflow.handoffAt
            )}
          </strong>
        </div>
      </div>
    </section>
  );
}

const styles = {
  container: {
    marginBottom: '20px',
    padding: '16px',
    border: `1px solid ${colors.border}`,
    borderLeft: `4px solid ${colors.rose}`,
    borderRadius: '10px',
    background: colors.cream,
    fontFamily: font.body,
  },
  headingRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
  },
  eyebrow: {
    margin: '0 0 4px',
    color: colors.mutedInk,
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.1em',
  },
  stateLabel: {
    color: colors.ink,
    fontSize: '14px',
  },
  attentionBadge: {
    flexShrink: 0,
    padding: '5px 9px',
    borderRadius: '999px',
    background: '#fff4df',
    color: '#8a5a00',
    fontSize: '11px',
    fontWeight: 800,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(145px, 1fr))',
    gap: '12px',
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: colors.ink,
    fontSize: '12px',
  },
  label: {
    color: colors.mutedInk,
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
};
