import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  Box,
  CheckCircle2,
  ChevronDown,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import api from '../api/axiosInstance';
import MyTasksPanel from '../components/MyTasksPanel';

import {
  colors,
  font,
} from '../styles/tokens';

const CHART_COLORS = [
  '#b96f80',
  '#7f3447',
  '#d89daa',
  '#8d6972',
  '#d4b0b8',
  '#5f4a50',
  '#e5c8cf',
];

const statusLabels = {
  draft: 'Draft',
  for_confirmation:
    'For Confirmation',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',

  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  submitted: 'For Review',
  for_revision: 'For Revision',
  approved: 'Approved',
  completed: 'Completed',

  pending_follow_up:
    'Pending Follow-up',
  awaiting_customer:
    'Awaiting Customer',
  resolved: 'Resolved',
  closed: 'Closed',

  awaiting_waybill:
    'Awaiting Waybill',
  pending_packing:
    'Pending Packing',
  ready_for_packing:
    'Ready for Packing',
  packing: 'Packing',
  packed: 'Packed',
  ready_for_shipment:
    'Ready for Shipment',
  shipped_out: 'Shipped Out',
  delivered: 'Delivered',
  returned_to_sender:
    'Returned to Sender',

  healthy: 'Healthy Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',

  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  distributed: 'Distributed',
  adjustment_in:
    'Adjustment In',
  adjustment_out:
    'Adjustment Out',
  in: 'Stock In',
  out: 'Stock Out',

  active: 'Active',
  inactive: 'Inactive',

  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const departmentRoutes = {
  sales: '/sales',
  cdm: '/cdm',
  supply_chain:
    '/supply-chain',
  fulfillment: '/fulfillment',
  crm: '/crm',
  marketing: '/marketing',
};

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

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getUserName(user) {
  return (
    user?.fullName ||
    user?.name ||
    user?.username ||
    'User'
  );
}

function getLabel(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Unspecified';
  }

  return (
    statusLabels[value] ||
    String(value)
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    'en-PH'
  ).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    'en-PH',
    {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }
  ).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);

  if (amount >= 1000000) {
    return `₱${(
      amount / 1000000
    ).toFixed(1)}M`;
  }

  if (amount >= 1000) {
    return `₱${(
      amount / 1000
    ).toFixed(1)}K`;
  }

  return `₱${formatNumber(amount)}`;
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const normalized =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2} /.test(
      value
    )
      ? value.replace(' ', 'T')
      : value;

  const date = new Date(normalized);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function formatDate(value) {
  const date =
    parseDateValue(value);

  if (!date) {
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

function useMediaQuery(query) {
  const [matches, setMatches] =
    useState(() => {
      if (
        typeof window ===
        'undefined'
      ) {
        return false;
      }

      return window.matchMedia(
        query
      ).matches;
    });

  useEffect(() => {
    const mediaQuery =
      window.matchMedia(query);

    const handleChange = (
      event
    ) => {
      setMatches(event.matches);
    };

    setMatches(
      mediaQuery.matches
    );

    mediaQuery.addEventListener(
      'change',
      handleChange
    );

    return () => {
      mediaQuery.removeEventListener(
        'change',
        handleChange
      );
    };
  }, [query]);

  return matches;
}

function getAttentionItems(
  attention = {}
) {
  const definitions = [
    {
      key:
        'outOfStockItems',
      label:
        'Out-of-Stock Items',
      description:
        'Inventory items currently have no remaining stock.',
      path: '/supply-chain',
      severity: 'danger',
    },
    {
      key: 'returnedOrders',
      label: 'Returned Orders',
      description:
        'Fulfilled orders were returned to the sender.',
      path: '/fulfillment',
      severity: 'danger',
    },
    {
      key: 'overdueCrmCases',
      label:
        'Overdue CRM Follow-ups',
      description:
        'Scheduled customer follow-ups are already overdue.',
      path: '/crm',
      severity: 'danger',
    },
    {
      key:
        'overdueMarketingTasks',
      label:
        'Overdue Marketing Tasks',
      description:
        'Marketing task deadlines have already passed.',
      path: '/marketing',
      severity: 'danger',
    },
    {
      key:
        'ordersForConfirmation',
      label:
        'Orders for Confirmation',
      description:
        'Sales orders are waiting for confirmation.',
      path: '/sales',
      severity: 'warning',
    },
    {
      key: 'pendingCdmRecords',
      label:
        'Pending CDM Records',
      description:
        'Customer order records still require CDM processing.',
      path: '/cdm',
      severity: 'warning',
    },
    {
      key: 'lowStockItems',
      label: 'Low-Stock Items',
      description:
        'Inventory items have reached their low-stock threshold.',
      path: '/supply-chain',
      severity: 'warning',
    },
    {
      key: 'pendingPacking',
      label:
        'Orders Pending Packing',
      description:
        'Fulfillment records are waiting for packing.',
      path: '/fulfillment',
      severity: 'warning',
    },
    {
      key:
        'unassignedCrmCases',
      label:
        'Unassigned CRM Cases',
      description:
        'After-sales cases still require a CRM specialist.',
      path: '/crm',
      severity: 'warning',
    },
    {
      key:
        'revisionMarketingTasks',
      label:
        'Marketing Tasks for Revision',
      description:
        'Submitted outputs require changes before approval.',
      path: '/marketing',
      severity: 'warning',
    },
    {
      key:
        'submittedMarketingTasks',
      label:
        'Marketing Outputs for Review',
      description:
        'Submitted marketing outputs are waiting for review.',
      path: '/marketing',
      severity: 'info',
    },
  ];

  return definitions
    .map((definition) => ({
      ...definition,
      value: Number(
        attention[
          definition.key
        ] || 0
      ),
    }))
    .filter(
      (item) =>
        item.value > 0 ||
        [
          'outOfStockItems',
          'lowStockItems',
          'returnedOrders',
          'unassignedCrmCases',
        ].includes(item.key)
    );
}

function normalizeDistribution(
  items = []
) {
  return items.map((item) => ({
    ...item,
    label:
      item.label ||
      getLabel(item.status),
    total: Number(
      item.total || 0
    ),
  }));
}

function buildRecentActivity(
  recent = {}
) {
  const activities = [];

  (recent.orders || []).forEach(
    (row) => {
      activities.push({
        id: `order-${row.id}`,
        type: 'Sales',
        title:
          row.orderNumber ||
          'Sales Order',
        description: `${
          row.customerName ||
          'Customer'
        } · ${getLabel(
          row.status
        )}`,
        date: row.dateEncoded,
        path: '/sales',
      });
    }
  );

  (recent.cdm || []).forEach(
    (row) => {
      activities.push({
        id: `cdm-${row.id}`,
        type: 'CDM',
        title:
          row.orderNumber ||
          'CDM Record',
        description: `${
          row.customerName ||
          'Customer'
        } · ${getLabel(
          row.status
        )}`,
        date: row.recordDate,
        path: '/cdm',
      });
    }
  );

  (
    recent.inventoryMovements ||
    []
  ).forEach((row) => {
    activities.push({
      id: `inventory-${row.id}`,
      type: 'Inventory',
      title:
        row.itemName ||
        'Inventory Item',
      description: `${getLabel(
        row.movementType
      )} · ${formatNumber(
        row.quantity
      )} units`,
      date: row.movementDate,
      path: '/supply-chain',
    });
  });

  (
    recent.fulfillment || []
  ).forEach((row) => {
    activities.push({
      id: `fulfillment-${row.id}`,
      type: 'Fulfillment',
      title:
        row.orderNumber ||
        'Fulfillment Record',
      description: `${
        row.customerName ||
        'Customer'
      } · ${getLabel(
        row.status
      )}`,
      date:
        row.updatedAt ||
        row.deliveredAt ||
        row.returnedAt,
      path: '/fulfillment',
    });
  });

  (recent.crm || []).forEach(
    (row) => {
      activities.push({
        id: `crm-${row.id}`,
        type: 'CRM',
        title:
          row.orderNumber ||
          'CRM Case',
        description: `${
          row.customerName ||
          'Customer'
        } · ${getLabel(
          row.status
        )}`,
        date:
          row.updatedAt ||
          row.nextFollowUpAt,
        path: '/crm',
      });
    }
  );

  (
    recent.marketing || []
  ).forEach((row) => {
    activities.push({
      id: `marketing-${row.id}`,
      type: 'Marketing',
      title:
        row.taskTitle ||
        'Marketing Task',
      description: `${
        row.campaignName ||
        'No campaign'
      } · ${getLabel(
        row.status
      )}`,
      date:
        row.updatedAt ||
        row.dueDate,
      path: '/marketing',
    });
  });

  return activities
    .sort((first, second) => {
      const firstDate =
        parseDateValue(
          first.date
        )?.getTime() || 0;

      const secondDate =
        parseDateValue(
          second.date
        )?.getTime() || 0;

      return (
        secondDate - firstDate
      );
    })
    .slice(0, 10);
}

export default function Dashboard() {
  const navigate = useNavigate();

  const currentUser =
    useMemo(
      () => getStoredUser(),
      []
    );

  const [dashboard, setDashboard] =
    useState(null);

  const [
    generatedAt,
    setGeneratedAt,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const loadDashboard =
    useCallback(
      async (
        silent = false
      ) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        try {
          const response =
            await api.get(
              '/dashboard'
            );

          setDashboard(
            response.data
              .dashboard || null
          );

          setGeneratedAt(
            response.data
              .generatedAt ||
              new Date()
          );
        } catch (
          requestError
        ) {
          setError(
            requestError.response
              ?.data?.message ||
              'Unable to retrieve the dashboard information.'
          );

          if (!silent) {
            setDashboard(null);
          }
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          loadDashboard(true);
        }
      }, 60000);

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [loadDashboard]);

  const role = normalizeRole(
    currentUser.role
  );

  return (
    <div className="dashboard-page">
      <style>
        {dashboardStyles}
      </style>

      <section className="dashboard-header">
        <div className="dashboard-header-copy">
          <div className="dashboard-live-label">
            <span className="dashboard-live-dot" />

            Live operational dashboard
          </div>

          <p className="dashboard-eyebrow">
            SPARTAN BTY MANAGEMENT
            INFORMATION SYSTEM
          </p>

          <h1>
            Welcome,{' '}
            {getUserName(
              currentUser
            )}
          </h1>

          <p className="dashboard-description">
            {dashboard?.view ===
            'specialist'
              ? dashboard.departmentName
              : dashboard?.view ===
                'system_configuration'
              ? 'System Configuration and User Access Management'
              : 'Company Operations and Management Overview'}
          </p>

          <p className="dashboard-updated">
            Last updated:{' '}
            {generatedAt
              ? formatDate(
                  generatedAt
                )
              : 'Waiting for data'}
          </p>
        </div>

        <div className="dashboard-header-actions">
          {role === 'head' && (
            <button
              type="button"
              className="dashboard-button dashboard-button-secondary"
              onClick={() =>
                navigate('/reports')
              }
            >
              <BarChart3 size={17} />
              Open Reports
            </button>
          )}

          <button
            type="button"
            className="dashboard-button dashboard-button-primary"
            onClick={() =>
              loadDashboard(true)
            }
            disabled={
              loading || refreshing
            }
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? 'dashboard-spin'
                  : ''
              }
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh Dashboard'}
          </button>
        </div>
      </section>

      {error && (
        <div
          className="dashboard-message dashboard-message-error"
          role="alert"
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <DashboardLoading />
      ) : !dashboard ? (
        <div className="dashboard-empty">
          No dashboard information
          was returned.
        </div>
      ) : dashboard.view ===
        'head' ? (
        <HeadDashboard
          dashboard={dashboard}
          navigate={navigate}
        />
      ) : dashboard.view ===
        'specialist' ? (
        <SpecialistDashboard
          dashboard={dashboard}
          navigate={navigate}
        />
      ) : dashboard.view ===
        'system_configuration' ? (
        <SystemConfigurationDashboard
          dashboard={dashboard}
          navigate={navigate}
        />
      ) : (
        <div className="dashboard-empty">
          This account does not
          have a supported dashboard.
        </div>
      )}
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="dashboard-loading">
      <RefreshCw
        size={24}
        className="dashboard-spin"
      />

      <span>
        Loading live dashboard
        information...
      </span>
    </div>
  );
}

function HeadDashboard({
  dashboard,
  navigate,
}) {
  const isDesktop =
    useMediaQuery(
      '(min-width: 900px)'
    );

  const [
    showAnalytics,
    setShowAnalytics,
  ] = useState(false);

  const summary =
    dashboard.summary || {};

  const analytics =
    dashboard.analytics || {};

  const attentionItems =
    getAttentionItems(
      dashboard.attention
    );

  const attentionCount =
    attentionItems.reduce(
      (total, item) =>
        total + item.value,
      0
    );

  const recentActivity =
    useMemo(
      () =>
        buildRecentActivity(
          dashboard.recent
        ),
      [dashboard.recent]
    );

  const salesTrend =
    analytics.salesTrend || [];

  const orderStatus =
    normalizeDistribution(
      analytics
        .orderStatusDistribution
    );

  const workflow =
    (
      analytics
        .operationalWorkflow || []
    ).map((item) => ({
      ...item,
      value: Number(
        item.value || 0
      ),
    }));

  const inventoryHealth =
    normalizeDistribution(
      analytics.inventoryHealth
    );

  const fulfillmentStatus =
    normalizeDistribution(
      analytics
        .fulfillmentStatus
    );

  const topProducts =
    (
      analytics.topProducts || []
    ).map((item) => ({
      ...item,
      label:
        item.productName ||
        'Product',
      unitsSold: Number(
        item.unitsSold || 0
      ),
      salesValue: Number(
        item.salesValue || 0
      ),
    }));

  const displayAnalytics =
    isDesktop || showAnalytics;

  return (
    <>
      <section className="dashboard-metric-grid">
        <MetricCard
          label="Total Orders"
          value={formatNumber(
            summary.sales
              ?.totalOrders
          )}
          helper={`${formatNumber(
            summary.sales
              ?.ordersToday
          )} encoded today`}
          icon={<ShoppingBag />}
          onClick={() =>
            navigate('/sales')
          }
        />

        <MetricCard
          label="Confirmed Revenue"
          value={formatCompactCurrency(
            summary.sales
              ?.confirmedRevenue
          )}
          helper={`${formatNumber(
            summary.sales
              ?.confirmedOrders
          )} confirmed orders`}
          icon={<BarChart3 />}
          onClick={() =>
            navigate('/sales')
          }
        />

        <MetricCard
          label="Inventory Balance"
          value={formatNumber(
            summary.inventory
              ?.totalBalance
          )}
          helper={`${formatNumber(
            summary.inventory
              ?.totalItems
          )} monitored items`}
          icon={<Box />}
          onClick={() =>
            navigate(
              '/supply-chain'
            )
          }
        />

        <MetricCard
          label="Delivered Orders"
          value={formatNumber(
            summary.fulfillment
              ?.delivered
          )}
          helper={`${formatNumber(
            summary.fulfillment
              ?.shippedOut
          )} currently shipped`}
          icon={<PackageCheck />}
          onClick={() =>
            navigate(
              '/fulfillment'
            )
          }
        />

        <MetricCard
          label="Open CRM Cases"
          value={formatNumber(
            summary.crm
              ?.openCases
          )}
          helper={
            summary.crm
              ?.averageRating ===
              null ||
            summary.crm
              ?.averageRating ===
              undefined
              ? 'No satisfaction rating yet'
              : `${summary.crm.averageRating}/5 satisfaction rating`
          }
          icon={<Users />}
          onClick={() =>
            navigate('/crm')
          }
        />

        <MetricCard
          label="Marketing Tasks"
          value={formatNumber(
            summary.marketing
              ?.totalTasks
          )}
          helper={`${formatNumber(
            summary.marketing
              ?.completed
          )} completed`}
          icon={<Clock3 />}
          onClick={() =>
            navigate('/marketing')
          }
        />

        <MetricCard
          label="Attention Required"
          value={formatNumber(
            attentionCount
          )}
          helper={
            attentionCount > 0
              ? 'Records require review'
              : 'No urgent records'
          }
          icon={<BellRing />}
          danger={
            attentionCount > 0
          }
        />
      </section>

      <button
        type="button"
        className="dashboard-analytics-toggle"
        onClick={() =>
          setShowAnalytics(
            (current) =>
              !current
          )
        }
        aria-expanded={
          showAnalytics
        }
      >
        <span>
          <BarChart3 size={18} />
          {showAnalytics
            ? 'Hide Analytics'
            : 'Show Analytics'}
        </span>

        <ChevronDown
          size={18}
          className={
            showAnalytics
              ? 'dashboard-chevron-open'
              : ''
          }
        />
      </button>

      {displayAnalytics && (
        <section className="dashboard-analytics-grid">
          <ChartCard
            title="Confirmed Sales Trend"
            description="Confirmed sales value for the latest six months."
            className="dashboard-chart-wide"
          >
            {salesTrend.length ===
            0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={270}
              >
                <AreaChart
                  data={
                    salesTrend
                  }
                  margin={{
                    top: 12,
                    right: 8,
                    left: -14,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="salesGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={
                          colors.rose
                        }
                        stopOpacity={
                          0.4
                        }
                      />

                      <stop
                        offset="95%"
                        stopColor={
                          colors.rose
                        }
                        stopOpacity={
                          0.03
                        }
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#eadfe2"
                  />

                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tickFormatter={
                      formatCompactCurrency
                    }
                    tick={{
                      fontSize: 10,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(
                      value,
                      name
                    ) => [
                      name ===
                      'salesValue'
                        ? formatCurrency(
                            value
                          )
                        : formatNumber(
                            value
                          ),
                      name ===
                      'salesValue'
                        ? 'Confirmed Sales'
                        : 'Orders',
                    ]}
                    labelFormatter={(
                      label
                    ) =>
                      `Month: ${label}`
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="salesValue"
                    stroke={
                      colors.roseDeep
                    }
                    strokeWidth={3}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Order Status"
            description="Current distribution of sales orders."
          >
            {orderStatus.length ===
            0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={260}
              >
                <BarChart
                  data={orderStatus}
                  margin={{
                    top: 10,
                    right: 6,
                    left: -24,
                    bottom: 18,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#eadfe2"
                  />

                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={55}
                    tick={{
                      fontSize: 9,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 10,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatNumber(
                        value
                      ),
                      'Orders',
                    ]}
                  />

                  <Bar
                    dataKey="total"
                    fill={colors.rose}
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Inventory Health"
            description="Healthy, low-stock, and out-of-stock inventory items."
          >
            {inventoryHealth.length ===
            0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={260}
              >
                <PieChart>
                  <Pie
                    data={
                      inventoryHealth
                    }
                    dataKey="total"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {inventoryHealth.map(
                      (
                        item,
                        index
                      ) => (
                        <Cell
                          key={
                            item.status ||
                            item.label
                          }
                          fill={
                            CHART_COLORS[
                              index %
                                CHART_COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatNumber(
                        value
                      ),
                      'Items',
                    ]}
                  />

                  <Legend
                    wrapperStyle={{
                      fontSize:
                        '10px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Operational Workflow"
            description="Order progress across the main business workflow."
            className="dashboard-chart-wide"
          >
            {workflow.length ===
            0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={290}
              >
                <BarChart
                  data={workflow}
                  layout="vertical"
                  margin={{
                    top: 6,
                    right: 20,
                    left: 28,
                    bottom: 6,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    horizontal={false}
                    stroke="#eadfe2"
                  />

                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{
                      fontSize: 10,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    type="category"
                    dataKey="label"
                    width={135}
                    tick={{
                      fontSize: 10,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatNumber(
                        value
                      ),
                      'Records',
                    ]}
                  />

                  <Bar
                    dataKey="value"
                    fill={
                      colors.roseDeep
                    }
                    radius={[
                      0,
                      7,
                      7,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Fulfillment Status"
            description="Current packing, shipping, delivery, and return records."
          >
            {fulfillmentStatus.length ===
            0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={260}
              >
                <BarChart
                  data={
                    fulfillmentStatus
                  }
                  margin={{
                    top: 10,
                    right: 6,
                    left: -24,
                    bottom: 18,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#eadfe2"
                  />

                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                    tick={{
                      fontSize: 9,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 10,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatNumber(
                        value
                      ),
                      'Orders',
                    ]}
                  />

                  <Bar
                    dataKey="total"
                    fill={colors.rose}
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Top-Selling Products"
            description="Products ranked by confirmed units sold."
          >
            {topProducts.length ===
            0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={260}
              >
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{
                    top: 6,
                    right: 12,
                    left: 18,
                    bottom: 6,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    horizontal={false}
                    stroke="#eadfe2"
                  />

                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{
                      fontSize: 10,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    type="category"
                    dataKey="label"
                    width={115}
                    tick={{
                      fontSize: 9,
                      fill:
                        colors.mutedInk,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatNumber(
                        value
                      ),
                      'Units Sold',
                    ]}
                  />

                  <Bar
                    dataKey="unitsSold"
                    fill={
                      colors.roseDeep
                    }
                    radius={[
                      0,
                      7,
                      7,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </section>
      )}

      <MyTasksPanel
        tasks={dashboard.tasks}
        categorySummaries={
          attentionItems
        }
        navigate={navigate}
      />

      <SectionCard
        eyebrow="RECENT ACTIVITY"
        title="Latest Operational Updates"
        description="Most recent records recorded across the system modules."
        icon={<Clock3 />}
      >
        <RecentActivityList
          activities={
            recentActivity
          }
          navigate={navigate}
        />
      </SectionCard>
    </>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  danger = false,
  warning = false,
  onClick,
}) {
  const className = [
    'dashboard-metric-card',
    danger
      ? 'dashboard-metric-danger'
      : '',
    warning
      ? 'dashboard-metric-warning'
      : '',
    onClick
      ? 'dashboard-metric-clickable'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="dashboard-metric-top">
        <span className="dashboard-metric-icon">
          {icon}
        </span>

        {onClick && (
          <ArrowRight
            size={17}
          />
        )}
      </div>

      <p className="dashboard-metric-label">
        {label}
      </p>

      <strong className="dashboard-metric-value">
        {value}
      </strong>

      <p className="dashboard-metric-helper">
        {helper}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={className}>
      {content}
    </article>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  icon,
  actionLabel,
  onAction,
  children,
}) {
  return (
    <section className="dashboard-section-card">
      <header className="dashboard-section-header">
        <div className="dashboard-section-title">
          {icon && (
            <span className="dashboard-section-icon">
              {icon}
            </span>
          )}

          <div>
            {eyebrow && (
              <p>{eyebrow}</p>
            )}

            <h2>{title}</h2>

            {description && (
              <span>
                {description}
              </span>
            )}
          </div>
        </div>

        {actionLabel &&
          onAction && (
            <button
              type="button"
              onClick={onAction}
              className="dashboard-text-button"
            >
              {actionLabel}
              <ArrowRight
                size={16}
              />
            </button>
          )}
      </header>

      <div className="dashboard-section-body">
        {children}
      </div>
    </section>
  );
}

function ChartCard({
  title,
  description,
  className = '',
  children,
}) {
  return (
    <article
      className={`dashboard-chart-card ${className}`}
    >
      <div className="dashboard-chart-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="dashboard-chart-body">
        {children}
      </div>
    </article>
  );
}

function ChartEmpty() {
  return (
    <div className="dashboard-chart-empty">
      <BarChart3 size={23} />

      <span>
        No chart data is available
        yet.
      </span>
    </div>
  );
}

function RecentActivityList({
  activities,
  navigate,
}) {
  if (
    !activities ||
    activities.length === 0
  ) {
    return (
      <div className="dashboard-empty-inline">
        No recent operational
        activity was found.
      </div>
    );
  }

  return (
    <div className="dashboard-activity-list">
      {activities.map(
        (activity) => (
          <button
            type="button"
            key={activity.id}
            className="dashboard-activity-item"
            onClick={() =>
              navigate(
                activity.path
              )
            }
          >
            <span className="dashboard-activity-dot" />

            <span className="dashboard-activity-copy">
              <span className="dashboard-activity-type">
                {activity.type}
              </span>

              <strong>
                {activity.title}
              </strong>

              <span>
                {activity.description}
              </span>
            </span>

            <span className="dashboard-activity-date">
              {formatDate(
                activity.date
              )}
            </span>

            <ArrowRight
              size={17}
            />
          </button>
        )
      )}
    </div>
  );
}

function SpecialistDashboard({
  dashboard,
  navigate,
}) {
  const route =
    departmentRoutes[
      dashboard.departmentCode
    ];

  const metrics =
    getSpecialistMetrics(
      dashboard
    );

  const distribution =
    getSpecialistDistribution(
      dashboard
    );

  const recent =
    getSpecialistRecent(
      dashboard
    );

  return (
    <>
      <section className="dashboard-department-banner">
        <div>
          <p>
            ASSIGNED DEPARTMENT
          </p>

          <h2>
            {dashboard.departmentName ||
              'Department Dashboard'}
          </h2>

          <span>
            Live operational records
            relevant to your assigned
            department.
          </span>
        </div>

        {route && (
          <button
            type="button"
            className="dashboard-button dashboard-button-primary"
            onClick={() =>
              navigate(route)
            }
          >
            Open Department
            <ArrowRight size={17} />
          </button>
        )}
      </section>

      <MyTasksPanel
        tasks={dashboard.tasks}
        navigate={navigate}
      />

      <section className="dashboard-metric-grid">
        {metrics.map(
          (metric) => (
            <MetricCard
              key={metric.label}
              {...metric}
              onClick={
                route
                  ? () =>
                      navigate(
                        route
                      )
                  : undefined
              }
            />
          )
        )}
      </section>

      <div className="dashboard-responsive-columns">
        <ChartCard
          title="Department Status"
          description="Current status distribution for your assigned records."
        >
          {distribution.length ===
          0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={270}
            >
              <BarChart
                data={
                  distribution
                }
                margin={{
                  top: 10,
                  right: 8,
                  left: -24,
                  bottom: 25,
                }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#eadfe2"
                />

                <XAxis
                  dataKey="label"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                  tick={{
                    fontSize: 9,
                    fill:
                      colors.mutedInk,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 10,
                    fill:
                      colors.mutedInk,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  formatter={(
                    value
                  ) => [
                    formatNumber(
                      value
                    ),
                    'Records',
                  ]}
                />

                <Bar
                  dataKey="total"
                  fill={colors.rose}
                  radius={[
                    6,
                    6,
                    0,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <SectionCard
          eyebrow="RECENT ACTIVITY"
          title="Latest Department Records"
          description="Recent records assigned to or processed by your department."
        >
          <RecentActivityList
            activities={recent}
            navigate={navigate}
          />
        </SectionCard>
      </div>
    </>
  );
}

function getSpecialistMetrics(
  dashboard
) {
  const summary =
    dashboard.summary || {};

  switch (
    dashboard.departmentCode
  ) {
    case 'sales':
      return [
        {
          label: 'Total Orders',
          value: formatNumber(
            summary.totalOrders
          ),
          helper: `${formatNumber(
            summary.ordersToday
          )} encoded today`,
          icon: <ShoppingBag />,
        },
        {
          label:
            'For Confirmation',
          value: formatNumber(
            summary.forConfirmation
          ),
          helper:
            'Waiting for review',
          icon: <Clock3 />,
          warning:
            Number(
              summary.forConfirmation
            ) > 0,
        },
        {
          label:
            'Confirmed Orders',
          value: formatNumber(
            summary.confirmedOrders
          ),
          helper:
            'Approved sales orders',
          icon: (
            <CheckCircle2 />
          ),
        },
        {
          label:
            'Confirmed Revenue',
          value:
            formatCompactCurrency(
              summary.confirmedRevenue
            ),
          helper:
            'Based on confirmed orders',
          icon: <BarChart3 />,
        },
      ];

    case 'cdm':
      return [
        {
          label:
            'Total CDM Records',
          value: formatNumber(
            summary.totalRecords
          ),
          helper:
            'All processing records',
          icon: <Users />,
        },
        {
          label:
            'Pending Records',
          value: formatNumber(
            summary.pendingRecords
          ),
          helper:
            'Require processing',
          icon: <Clock3 />,
          warning:
            Number(
              summary.pendingRecords
            ) > 0,
        },
        {
          label:
            'Completed Records',
          value: formatNumber(
            summary.completedRecords
          ),
          helper:
            'Finished CDM records',
          icon: (
            <CheckCircle2 />
          ),
        },
      ];

    case 'supply_chain':
      return [
        {
          label:
            'Inventory Items',
          value: formatNumber(
            summary.totalItems
          ),
          helper:
            'Monitored stock items',
          icon: <Box />,
        },
        {
          label:
            'Total Balance',
          value: formatNumber(
            summary.totalBalance
          ),
          helper:
            'Current stock units',
          icon: <BarChart3 />,
        },
        {
          label:
            'Low Stock',
          value: formatNumber(
            summary.lowStockItems
          ),
          helper:
            'Reached threshold',
          icon: <Clock3 />,
          warning:
            Number(
              summary.lowStockItems
            ) > 0,
        },
        {
          label:
            'Out of Stock',
          value: formatNumber(
            summary.outOfStockItems
          ),
          helper:
            'No remaining stock',
          icon: (
            <AlertTriangle />
          ),
          danger:
            Number(
              summary.outOfStockItems
            ) > 0,
        },
      ];

    case 'fulfillment':
      return [
        {
          label:
            'Fulfillment Records',
          value: formatNumber(
            summary.totalRecords
          ),
          helper:
            'All shipment records',
          icon: <PackageCheck />,
        },
        {
          label:
            'Pending Packing',
          value: formatNumber(
            summary.pendingPacking
          ),
          helper:
            'Awaiting packing',
          icon: <Clock3 />,
          warning:
            Number(
              summary.pendingPacking
            ) > 0,
        },
        {
          label: 'Shipped Out',
          value: formatNumber(
            summary.shippedOut
          ),
          helper:
            'Currently in transit',
          icon: <PackageCheck />,
        },
        {
          label: 'Delivered',
          value: formatNumber(
            summary.delivered
          ),
          helper:
            'Successfully delivered',
          icon: (
            <CheckCircle2 />
          ),
        },
        {
          label: 'Returned',
          value: formatNumber(
            summary.returned
          ),
          helper:
            'Returned to sender',
          icon: (
            <AlertTriangle />
          ),
          danger:
            Number(
              summary.returned
            ) > 0,
        },
      ];

    case 'crm':
      return [
        {
          label: 'Total Cases',
          value: formatNumber(
            summary.totalCases
          ),
          helper:
            'Assigned CRM cases',
          icon: <Users />,
        },
        {
          label: 'Open Cases',
          value: formatNumber(
            summary.openCases
          ),
          helper:
            'Still being handled',
          icon: <Clock3 />,
        },
        {
          label:
            'Overdue Follow-ups',
          value: formatNumber(
            summary.overdueCases
          ),
          helper:
            'Require immediate action',
          icon: (
            <AlertTriangle />
          ),
          danger:
            Number(
              summary.overdueCases
            ) > 0,
        },
        {
          label: 'Closed Cases',
          value: formatNumber(
            summary.closed
          ),
          helper:
            'Completed after-sales cases',
          icon: (
            <CheckCircle2 />
          ),
        },
      ];

    case 'marketing':
      return [
        {
          label:
            'Assigned Tasks',
          value: formatNumber(
            summary.totalTasks
          ),
          helper:
            'Total marketing workload',
          icon: <BarChart3 />,
        },
        {
          label: 'In Progress',
          value: formatNumber(
            summary.inProgress
          ),
          helper:
            'Currently being prepared',
          icon: <Clock3 />,
        },
        {
          label: 'For Review',
          value: formatNumber(
            summary.submitted
          ),
          helper:
            'Submitted outputs',
          icon: <ShieldCheck />,
        },
        {
          label:
            'For Revision',
          value: formatNumber(
            summary.forRevision
          ),
          helper:
            'Require changes',
          icon: (
            <AlertTriangle />
          ),
          warning:
            Number(
              summary.forRevision
            ) > 0,
        },
        {
          label: 'Completed',
          value: formatNumber(
            summary.completed
          ),
          helper:
            'Finished tasks',
          icon: (
            <CheckCircle2 />
          ),
        },
      ];

    default:
      return [];
  }
}

function getSpecialistDistribution(
  dashboard
) {
  const summary =
    dashboard.summary || {};

  if (
    dashboard.statusDistribution
  ) {
    return normalizeDistribution(
      dashboard.statusDistribution
    );
  }

  switch (
    dashboard.departmentCode
  ) {
    case 'sales':
      return [
        {
          label: 'Draft',
          total: Number(
            summary.draftOrders || 0
          ),
        },
        {
          label:
            'For Confirmation',
          total: Number(
            summary.forConfirmation ||
              0
          ),
        },
        {
          label: 'Confirmed',
          total: Number(
            summary.confirmedOrders ||
              0
          ),
        },
        {
          label: 'Rejected',
          total: Number(
            summary.rejectedOrders ||
              0
          ),
        },
        {
          label: 'Cancelled',
          total: Number(
            summary.cancelledOrders ||
              0
          ),
        },
      ];

    case 'supply_chain': {
      const healthy = Math.max(
        Number(
          summary.totalItems || 0
        ) -
          Number(
            summary.lowStockItems ||
              0
          ) -
          Number(
            summary.outOfStockItems ||
              0
          ),
        0
      );

      return [
        {
          label: 'Healthy',
          total: healthy,
        },
        {
          label: 'Low Stock',
          total: Number(
            summary.lowStockItems ||
              0
          ),
        },
        {
          label:
            'Out of Stock',
          total: Number(
            summary.outOfStockItems ||
              0
          ),
        },
      ];
    }

    case 'fulfillment':
      return [
        {
          label:
            'Pending Packing',
          total: Number(
            summary.pendingPacking ||
              0
          ),
        },
        {
          label: 'Packing',
          total: Number(
            summary.packing || 0
          ),
        },
        {
          label: 'Packed',
          total: Number(
            summary.packed || 0
          ),
        },
        {
          label:
            'Ready for Shipment',
          total: Number(
            summary.readyForShipment ||
              0
          ),
        },
        {
          label: 'Shipped Out',
          total: Number(
            summary.shippedOut || 0
          ),
        },
        {
          label: 'Delivered',
          total: Number(
            summary.delivered || 0
          ),
        },
        {
          label: 'Returned',
          total: Number(
            summary.returned || 0
          ),
        },
        {
          label: 'Cancelled',
          total: Number(
            summary.cancelled || 0
          ),
        },
      ];

    case 'crm':
      return [
        {
          label: 'Open',
          total: Number(
            summary.openCases || 0
          ),
        },
        {
          label: 'Overdue',
          total: Number(
            summary.overdueCases ||
              0
          ),
        },
        {
          label: 'Resolved',
          total: Number(
            summary.resolved || 0
          ),
        },
        {
          label: 'Closed',
          total: Number(
            summary.closed || 0
          ),
        },
      ];

    case 'marketing':
      return [
        {
          label: 'Pending',
          total: Number(
            summary.pending || 0
          ),
        },
        {
          label: 'Assigned',
          total: Number(
            summary.assigned || 0
          ),
        },
        {
          label: 'In Progress',
          total: Number(
            summary.inProgress || 0
          ),
        },
        {
          label: 'For Review',
          total: Number(
            summary.submitted || 0
          ),
        },
        {
          label:
            'For Revision',
          total: Number(
            summary.forRevision || 0
          ),
        },
        {
          label: 'Approved',
          total: Number(
            summary.approved || 0
          ),
        },
        {
          label: 'Completed',
          total: Number(
            summary.completed || 0
          ),
        },
        {
          label: 'Cancelled',
          total: Number(
            summary.cancelled || 0
          ),
        },
      ];

    default:
      return [];
  }
}

function getSpecialistRecent(
  dashboard
) {
  const rows =
    dashboard.recent || [];

  const route =
    departmentRoutes[
      dashboard.departmentCode
    ] || '/dashboard';

  return rows
    .map((row) => {
      switch (
        dashboard.departmentCode
      ) {
        case 'sales':
          return {
            id: `sales-${row.id}`,
            type: 'Sales',
            title:
              row.orderNumber ||
              'Sales Order',
            description: `${
              row.customerName ||
              'Customer'
            } · ${getLabel(
              row.status
            )}`,
            date:
              row.dateEncoded,
            path: route,
          };

        case 'cdm':
          return {
            id: `cdm-${row.id}`,
            type: 'CDM',
            title:
              row.orderNumber ||
              'CDM Record',
            description: `${
              row.customerName ||
              'Customer'
            } · ${getLabel(
              row.status
            )}`,
            date:
              row.recordDate,
            path: route,
          };

        case 'supply_chain':
          return {
            id: `inventory-${row.id}`,
            type: 'Inventory',
            title:
              row.itemName ||
              'Inventory Item',
            description: `${getLabel(
              row.movementType
            )} · ${formatNumber(
              row.quantity
            )} units`,
            date:
              row.movementDate,
            path: route,
          };

        case 'fulfillment':
          return {
            id: `fulfillment-${row.id}`,
            type: 'Fulfillment',
            title:
              row.orderNumber ||
              'Fulfillment Record',
            description: `${
              row.customerName ||
              'Customer'
            } · ${getLabel(
              row.status
            )}`,
            date:
              row.updatedAt,
            path: route,
          };

        case 'crm':
          return {
            id: `crm-${row.id}`,
            type: 'CRM',
            title:
              row.orderNumber ||
              'CRM Case',
            description: `${
              row.customerName ||
              'Customer'
            } · ${getLabel(
              row.status
            )}`,
            date:
              row.updatedAt ||
              row.nextFollowUpAt,
            path: route,
          };

        case 'marketing':
          return {
            id: `marketing-${row.id}`,
            type: 'Marketing',
            title:
              row.taskTitle ||
              'Marketing Task',
            description: `${
              row.campaignName ||
              'No campaign'
            } · ${getLabel(
              row.status
            )}`,
            date:
              row.updatedAt ||
              row.dueDate,
            path: route,
          };

        default:
          return null;
      }
    })
    .filter(Boolean);
}

function SystemConfigurationDashboard({
  dashboard,
  navigate,
}) {
  const summary =
    dashboard.summary || {};

  const distribution =
    (
      dashboard
        .departmentDistribution ||
      []
    ).map((item) => ({
      label:
        item.departmentName ||
        'Department',
      total: Number(
        item.userCount || 0
      ),
    }));

  const recentUsers =
    (
      dashboard.recentUsers || []
    ).map((user) => ({
      id: `user-${user.id}`,
      type: getLabel(user.role),
      title:
        user.fullName ||
        user.email ||
        'System User',
      description: `${
        user.departmentName ||
        'No assigned department'
      } · ${getLabel(
        user.status
      )}`,
      date: user.createdAt,
      path: '/users',
    }));

  return (
    <>
      <section className="dashboard-department-banner">
        <div>
          <p>
            SYSTEM CONFIGURATION
          </p>

          <h2>
            User and Access Management
          </h2>

          <span>
            Review system accounts,
            access status, departments,
            and recently created users.
          </span>
        </div>

        <button
          type="button"
          className="dashboard-button dashboard-button-primary"
          onClick={() =>
            navigate('/users')
          }
        >
          Open User Management
          <ArrowRight size={17} />
        </button>
      </section>

      <MyTasksPanel
        tasks={dashboard.tasks}
        navigate={navigate}
      />

      <section className="dashboard-metric-grid">
        <MetricCard
          label="Total Users"
          value={formatNumber(
            summary.totalUsers
          )}
          helper="All system accounts"
          icon={<Users />}
          onClick={() =>
            navigate('/users')
          }
        />

        <MetricCard
          label="Active Users"
          value={formatNumber(
            summary.activeUsers
          )}
          helper="Accounts with system access"
          icon={
            <CheckCircle2 />
          }
          onClick={() =>
            navigate('/users')
          }
        />

        <MetricCard
          label="Inactive Users"
          value={formatNumber(
            summary.inactiveUsers
          )}
          helper="Disabled user accounts"
          icon={
            <AlertTriangle />
          }
          warning={
            Number(
              summary.inactiveUsers
            ) > 0
          }
          onClick={() =>
            navigate('/users')
          }
        />

        <MetricCard
          label="Specialists"
          value={formatNumber(
            summary.specialistUsers
          )}
          helper="Department accounts"
          icon={<ShieldCheck />}
          onClick={() =>
            navigate('/users')
          }
        />

        <MetricCard
          label="Created Today"
          value={formatNumber(
            summary.createdToday
          )}
          helper="New accounts today"
          icon={<Clock3 />}
          onClick={() =>
            navigate('/users')
          }
        />
      </section>

      <div className="dashboard-responsive-columns">
        <ChartCard
          title="Active Users by Department"
          description="Distribution of active specialist accounts."
        >
          {distribution.length ===
          0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={280}
            >
              <BarChart
                data={distribution}
                layout="vertical"
                margin={{
                  top: 6,
                  right: 12,
                  left: 30,
                  bottom: 6,
                }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  horizontal={false}
                  stroke="#eadfe2"
                />

                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{
                    fontSize: 10,
                    fill:
                      colors.mutedInk,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  type="category"
                  dataKey="label"
                  width={125}
                  tick={{
                    fontSize: 9,
                    fill:
                      colors.mutedInk,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  formatter={(
                    value
                  ) => [
                    formatNumber(
                      value
                    ),
                    'Active Users',
                  ]}
                />

                <Bar
                  dataKey="total"
                  fill={
                    colors.roseDeep
                  }
                  radius={[
                    0,
                    7,
                    7,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <SectionCard
          eyebrow="RECENT USERS"
          title="Recently Created Accounts"
          description="The latest user accounts registered in the system."
        >
          <RecentActivityList
            activities={
              recentUsers
            }
            navigate={navigate}
          />
        </SectionCard>
      </div>
    </>
  );
}

const dashboardStyles = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .dashboard-page {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden;
    color: ${colors.ink};
    font-family: ${font.body};
  }

  .dashboard-page button {
    font-family: ${font.body};
  }

  .dashboard-header {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 22px;
    padding: 22px 18px;
    border: 1px solid ${colors.border};
    border-radius: 16px;
    background:
      linear-gradient(
        135deg,
        ${colors.blush} 0%,
        #fffafb 100%
      );
  }

  .dashboard-header-copy {
    min-width: 0;
    overflow-wrap: break-word;
  }

  .dashboard-live-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 30px;
    margin-bottom: 13px;
    padding: 5px 10px;
    border: 1px solid ${colors.border};
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.72);
    color: ${colors.roseDeep};
    font-size: 10px;
    font-weight: 700;
  }

  .dashboard-live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #35a563;
    box-shadow:
      0 0 0 4px
      rgba(53, 165, 99, 0.13);
  }

  .dashboard-eyebrow {
    margin: 0;
    color: ${colors.roseDeep};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.3px;
    line-height: 1.5;
  }

  .dashboard-header h1 {
    max-width: 100%;
    margin: 7px 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 28px;
    font-weight: 500;
    line-height: 1.15;
    overflow-wrap: break-word;
  }

  .dashboard-description {
    max-width: 65ch;
    margin: 0;
    color: ${colors.mutedInk};
    font-size: 12px;
    line-height: 1.65;
    overflow-wrap: break-word;
  }

  .dashboard-updated {
    margin: 10px 0 0;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.5;
  }

  .dashboard-header-actions {
    display: grid;
    width: 100%;
    max-width: 100%;
    gap: 10px;
  }

  .dashboard-button {
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
    text-decoration: none;
  }

  .dashboard-button-primary {
    border: 1px solid ${colors.roseDeep};
    background: ${colors.roseDeep};
    color: #ffffff;
  }

  .dashboard-button-secondary {
    border: 1px solid ${colors.border};
    background: #ffffff;
    color: ${colors.ink};
  }

  .dashboard-button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .dashboard-message {
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

  .dashboard-message svg {
    flex: 0 0 auto;
  }

  .dashboard-message-error {
    border: 1px solid #e7bec6;
    background: #fff0f2;
    color: #a33b51;
  }

  .dashboard-loading,
  .dashboard-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 100%;
    min-height: 240px;
    gap: 10px;
    margin-top: 18px;
    padding: 30px 18px;
    border: 1px solid ${colors.border};
    border-radius: 14px;
    background: #ffffff;
    color: ${colors.mutedInk};
    font-size: 12px;
    text-align: center;
  }

  .dashboard-spin {
    animation:
      dashboard-spin-animation
      900ms linear infinite;
  }

  @keyframes dashboard-spin-animation {
    to {
      transform: rotate(360deg);
    }
  }

  .dashboard-metric-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    width: 100%;
    max-width: 100%;
    gap: 12px;
    margin-top: 18px;
  }

  .dashboard-metric-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 158px;
    padding: 17px;
    border: 1px solid ${colors.border};
    border-radius: 13px;
    background: #ffffff;
    color: ${colors.ink};
    text-align: left;
    overflow-wrap: break-word;
  }

  button.dashboard-metric-card {
    cursor: pointer;
  }

  .dashboard-metric-clickable {
    transition:
      transform 150ms ease,
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .dashboard-metric-clickable:hover {
    transform: translateY(-2px);
    border-color: ${colors.rose};
    box-shadow:
      0 12px 28px
      rgba(80, 48, 57, 0.08);
  }

  .dashboard-metric-danger {
    border-color: #e6a9b4;
    background: #fff7f8;
  }

  .dashboard-metric-warning {
    border-color: #ead6a8;
    background: #fffdf6;
  }

  .dashboard-metric-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 34px;
    color: ${colors.roseDeep};
  }

  .dashboard-metric-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: ${colors.blush};
    color: ${colors.roseDeep};
  }

  .dashboard-metric-icon svg {
    width: 17px;
    height: 17px;
  }

  .dashboard-metric-label {
    margin: 15px 0 5px;
    color: ${colors.mutedInk};
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.8px;
    line-height: 1.5;
    text-transform: uppercase;
  }

  .dashboard-metric-value {
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 26px;
    font-weight: 500;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .dashboard-metric-helper {
    margin: 7px 0 0;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.55;
    overflow-wrap: break-word;
  }

  .dashboard-section-card,
  .dashboard-chart-card {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin-top: 18px;
    padding: 17px;
    border: 1px solid ${colors.border};
    border-radius: 14px;
    background: #ffffff;
  }

  .dashboard-section-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    padding-bottom: 15px;
    border-bottom: 1px solid ${colors.border};
  }

  .dashboard-section-title {
    display: flex;
    align-items: flex-start;
    min-width: 0;
    gap: 11px;
  }

  .dashboard-section-icon {
    display: grid;
    place-items: center;
    width: 38px;
    min-width: 38px;
    height: 38px;
    border-radius: 10px;
    background: ${colors.blush};
    color: ${colors.roseDeep};
  }

  .dashboard-section-icon svg {
    width: 18px;
    height: 18px;
  }

  .dashboard-section-title > div {
    min-width: 0;
  }

  .dashboard-section-title p {
    margin: 0 0 5px;
    color: ${colors.roseDeep};
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .dashboard-section-title h2 {
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 20px;
    font-weight: 500;
    line-height: 1.25;
    overflow-wrap: break-word;
  }

  .dashboard-section-title span {
    display: block;
    max-width: 65ch;
    margin-top: 6px;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.6;
    overflow-wrap: break-word;
  }

  .dashboard-section-body {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding-top: 16px;
  }

  .dashboard-text-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    gap: 7px;
    padding: 8px 12px;
    border: 1px solid ${colors.border};
    border-radius: 8px;
    background: #ffffff;
    color: ${colors.ink};
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .dashboard-success-state {
    display: flex;
    align-items: flex-start;
    width: 100%;
    max-width: 100%;
    gap: 10px;
    padding: 16px;
    border: 1px solid #bfe0cb;
    border-radius: 10px;
    background: #edf9f1;
    color: #287447;
    font-size: 11px;
    line-height: 1.6;
    overflow-wrap: break-word;
  }

  .dashboard-success-state svg {
    flex: 0 0 auto;
  }

  .dashboard-alert-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    width: 100%;
    max-width: 100%;
    gap: 11px;
  }

  .dashboard-alert-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 205px;
    gap: 14px;
    padding: 15px;
    border-radius: 11px;
    overflow-wrap: break-word;
  }

  .dashboard-alert-danger {
    border: 1px solid #e7aebb;
    background: #fff4f6;
  }

  .dashboard-alert-warning {
    border: 1px solid #ead6a8;
    background: #fffaf0;
  }

  .dashboard-alert-info {
    border: 1px solid #cddae7;
    background: #f5f9fd;
  }

  .dashboard-alert-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .dashboard-alert-icon {
    color: ${colors.roseDeep};
  }

  .dashboard-alert-count {
    display: grid;
    place-items: center;
    min-width: 32px;
    height: 32px;
    padding: 0 7px;
    border-radius: 999px;
    background: #ffffff;
    color: ${colors.roseDeep};
    font-size: 12px;
    font-weight: 700;
  }

  .dashboard-alert-card h3 {
    margin: 0;
    color: ${colors.ink};
    font-size: 12px;
    line-height: 1.4;
  }

  .dashboard-alert-card p {
    margin: 7px 0 0;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.6;
  }

  .dashboard-alert-card button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    gap: 7px;
    margin-top: auto;
    padding: 9px 12px;
    border: 1px solid ${colors.border};
    border-radius: 8px;
    background: #ffffff;
    color: ${colors.ink};
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .dashboard-analytics-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 100%;
    min-height: 48px;
    gap: 12px;
    margin-top: 18px;
    padding: 10px 14px;
    border: 1px solid ${colors.border};
    border-radius: 10px;
    background: #ffffff;
    color: ${colors.ink};
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .dashboard-analytics-toggle span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .dashboard-analytics-toggle svg {
    transition:
      transform 150ms ease;
  }

  .dashboard-chevron-open {
    transform: rotate(180deg);
  }

  .dashboard-analytics-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    width: 100%;
    max-width: 100%;
    gap: 14px;
    margin-top: 18px;
  }

  .dashboard-analytics-grid
    .dashboard-chart-card {
    margin-top: 0;
  }

  .dashboard-chart-header h3 {
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 18px;
    font-weight: 500;
    line-height: 1.3;
    overflow-wrap: break-word;
  }

  .dashboard-chart-header p {
    max-width: 60ch;
    margin: 6px 0 0;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.6;
    overflow-wrap: break-word;
  }

  .dashboard-chart-body {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 270px;
    margin-top: 14px;
    overflow: hidden;
  }

  .dashboard-chart-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    gap: 9px;
    border-radius: 10px;
    background: ${colors.cream};
    color: ${colors.mutedInk};
    font-size: 10px;
    text-align: center;
  }

  .dashboard-activity-list {
    display: grid;
    width: 100%;
    max-width: 100%;
    gap: 8px;
  }

  .dashboard-activity-item {
    display: grid;
    grid-template-columns:
      auto minmax(0, 1fr)
      auto;
    align-items: center;
    width: 100%;
    max-width: 100%;
    min-height: 70px;
    gap: 10px;
    padding: 11px;
    border: 1px solid ${colors.border};
    border-radius: 9px;
    background: #ffffff;
    color: ${colors.ink};
    text-align: left;
    cursor: pointer;
  }

  .dashboard-activity-item:hover {
    background: ${colors.blush};
  }

  .dashboard-activity-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: ${colors.rose};
  }

  .dashboard-activity-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 3px;
    overflow-wrap: anywhere;
  }

  .dashboard-activity-type {
    color: ${colors.roseDeep};
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
  }

  .dashboard-activity-copy strong {
    color: ${colors.ink};
    font-size: 11px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .dashboard-activity-copy span:last-child {
    color: ${colors.mutedInk};
    font-size: 9px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .dashboard-activity-date {
    display: none;
    color: ${colors.mutedInk};
    font-size: 8px;
    line-height: 1.5;
    text-align: right;
  }

  .dashboard-empty-inline {
    padding: 25px 15px;
    border-radius: 9px;
    background: ${colors.cream};
    color: ${colors.mutedInk};
    font-size: 10px;
    text-align: center;
  }

  .dashboard-department-banner {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 18px;
    margin-top: 18px;
    padding: 19px;
    border: 1px solid ${colors.border};
    border-radius: 14px;
    background: #ffffff;
  }

  .dashboard-department-banner > div {
    min-width: 0;
  }

  .dashboard-department-banner p {
    margin: 0 0 6px;
    color: ${colors.roseDeep};
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .dashboard-department-banner h2 {
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 21px;
    font-weight: 500;
    line-height: 1.25;
    overflow-wrap: break-word;
  }

  .dashboard-department-banner span {
    display: block;
    max-width: 65ch;
    margin-top: 7px;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.6;
    overflow-wrap: break-word;
  }

  .dashboard-responsive-columns {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr);
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 14px;
    margin-top: 18px;
  }

  .dashboard-responsive-columns
    > .dashboard-chart-card,
  .dashboard-responsive-columns
    > .dashboard-section-card {
    margin-top: 0;
  }

  @media (min-width: 520px) {
    .dashboard-metric-grid {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .dashboard-alert-grid {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .dashboard-header-actions {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }
  }

  @media (min-width: 700px) {
    .dashboard-header {
      padding: 25px;
    }

    .dashboard-section-card,
    .dashboard-chart-card {
      padding: 20px;
    }

    .dashboard-section-header {
      flex-direction: row;
      align-items: center;
      justify-content:
        space-between;
    }

    .dashboard-activity-item {
      grid-template-columns:
        auto minmax(0, 1fr)
        minmax(125px, auto)
        auto;
    }

    .dashboard-activity-date {
      display: block;
    }
  }

  @media (min-width: 900px) {
    .dashboard-header {
      flex-direction: row;
      align-items: center;
      justify-content:
        space-between;
      gap: 30px;
      padding: 28px;
    }

    .dashboard-header-actions {
      display: flex;
      width: auto;
      flex: 0 0 auto;
    }

    .dashboard-button {
      width: auto;
      min-width: 145px;
    }

    .dashboard-metric-grid {
      grid-template-columns:
        repeat(
          3,
          minmax(0, 1fr)
        );
    }

    .dashboard-analytics-toggle {
      display: none;
    }

    .dashboard-analytics-grid {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .dashboard-chart-wide {
      grid-column: span 2;
    }

    .dashboard-responsive-columns {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .dashboard-department-banner {
      flex-direction: row;
      align-items: center;
      justify-content:
        space-between;
      padding: 23px;
    }

    .dashboard-department-banner
      .dashboard-button {
      flex: 0 0 auto;
    }
  }

  @media (min-width: 1200px) {
    .dashboard-metric-grid {
      grid-template-columns:
        repeat(
          4,
          minmax(0, 1fr)
        );
    }

    .dashboard-alert-grid {
      grid-template-columns:
        repeat(
          3,
          minmax(0, 1fr)
        );
    }

    .dashboard-header h1 {
      font-size: 32px;
    }
  }

  @media (max-width: 374px) {
    .dashboard-header,
    .dashboard-section-card,
    .dashboard-chart-card,
    .dashboard-department-banner {
      padding-left: 14px;
      padding-right: 14px;
    }

    .dashboard-page {
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
