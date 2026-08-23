import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import api from '../api/axiosInstance';
import {
  colors,
  font,
} from '../styles/tokens';

const tabLabels = {
  overview: 'Management Overview',
  sales: 'Sales and Orders',
  cdm: 'Customer Data',
  inventory: 'Inventory and Supply Chain',
  fulfillment: 'Fulfillment',
  crm: 'Customer Relationship',
  marketing: 'Marketing Workflow',
};

const departmentReportMap = {
  sales: 'sales',
  cdm: 'cdm',
  supply_chain: 'inventory',
  fulfillment: 'fulfillment',
  crm: 'crm',
  marketing: 'marketing',
};

const statusLabels = {
  draft: 'Draft',
  for_confirmation: 'For Confirmation',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',

  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  for_revision: 'For Revision',
  approved: 'Approved',
  completed: 'Completed',

  pending_follow_up: 'Pending Follow-up',
  awaiting_customer: 'Awaiting Customer',
  resolved: 'Resolved',
  closed: 'Closed',

  not_started: 'Not Started',
  skipped: 'Skipped',

  pending_review: 'Pending Review',

  awaiting_waybill: 'Awaiting Waybill',
  pending_packing: 'Pending Packing',
  ready_for_packing: 'Ready for Packing',
  packing: 'Packing',
  packed: 'Packed',
  ready_for_shipment:
    'Ready for Shipment',
  shipped_out: 'Shipped Out',
  delivered: 'Delivered',
  returned_to_sender: 'Returned to Sender',

  checked: 'Checked',
  distributed: 'Distributed',
  adjustment_in: 'Adjustment In',
  adjustment_out: 'Adjustment Out',

  received: 'Received',
  not_received: 'Not Received',
  returned: 'Returned',

  none: 'No Concern',
  product_issue: 'Product Issue',
  delivery_issue: 'Delivery Issue',
  wrong_item: 'Wrong Item',
  damaged_item: 'Damaged Item',
  missing_item: 'Missing Item',
  payment_issue: 'Payment Issue',
  other: 'Other',

  poster: 'Poster',
  video: 'Video',
  caption: 'Caption',
  product_photo: 'Product Photo',
  social_media_post: 'Social Media Post',
  product_promotion: 'Product Promotion',

  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
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

function getDepartmentCode(user) {
  return (
    user?.departmentCode ||
    user?.department?.code ||
    ''
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    'en-PH',
    {
      style: 'currency',
      currency: 'PHP',
    }
  ).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    'en-US'
  ).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

function formatDateOnly(value) {
  if (!value) {
    return 'Not available';
  }

  const stringValue =
    String(value).slice(0, 10);

  const parts =
    stringValue.split('-');

  if (parts.length !== 3) {
    return stringValue;
  }

  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  if (Number.isNaN(date.getTime())) {
    return stringValue;
  }

  return date.toLocaleDateString(
    'en-PH',
    {
      dateStyle: 'medium',
    }
  );
}

function toDateInput(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const today = new Date();

  const firstDay =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

  return {
    startDate:
      toDateInput(firstDay),

    endDate:
      toDateInput(today),
  };
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
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
}

function getAllowedTabs(user) {
  if (user.role === 'head') {
    return [
      'overview',
      'sales',
      'cdm',
      'inventory',
      'fulfillment',
      'crm',
      'marketing',
    ];
  }

  if (user.role === 'specialist') {
    const departmentCode =
      getDepartmentCode(user);

    const reportTab =
      departmentReportMap[
        departmentCode
      ];

    return reportTab
      ? [reportTab]
      : [];
  }

  return [];
}

function escapeCsvValue(value) {
  const text =
    value === null ||
    value === undefined
      ? ''
      : String(value);

  return `"${text.replaceAll(
    '"',
    '""'
  )}"`;
}

function downloadCsv({
  filename,
  columns,
  rows,
}) {
  const header = columns
    .map((column) =>
      escapeCsvValue(column.label)
    )
    .join(',');

  const body = rows
    .map((row) =>
      columns
        .map((column) =>
          escapeCsvValue(
            typeof column.value ===
              'function'
              ? column.value(row)
              : row[column.value]
          )
        )
        .join(',')
    )
    .join('\n');

  const csvContent =
    `\uFEFF${header}\n${body}`;

  const blob = new Blob(
    [csvContent],
    {
      type:
        'text/csv;charset=utf-8;',
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function Reports() {
  const currentUser =
    getStoredUser();

  const allowedTabs =
    useMemo(
      () =>
        getAllowedTabs(
          currentUser
        ),
      []
    );

  const defaultRange =
    useMemo(
      () =>
        getDefaultDateRange(),
      []
    );

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    allowedTabs[0] || ''
  );

  const [
    dateForm,
    setDateForm,
  ] = useState(defaultRange);

  const [
    appliedRange,
    setAppliedRange,
  ] = useState(defaultRange);

  const [report, setReport] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const loadReport =
    useCallback(async () => {
      if (!activeTab) {
        return;
      }

      setLoading(true);
      setError('');
      setSuccess('');

      try {
        const response =
          await api.get(
            `/reports/${activeTab}`,
            {
              params: {
                startDate:
                  appliedRange
                    .startDate,

                endDate:
                  appliedRange
                    .endDate,
              },
            }
          );

        setReport(response.data);
      } catch (requestError) {
        setReport(null);

        setError(
          requestError.response?.data
            ?.message ||
            'Unable to retrieve the selected report.'
        );
      } finally {
        setLoading(false);
      }
    }, [
      activeTab,
      appliedRange,
    ]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDateChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setDateForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleApplyFilter = (
    event
  ) => {
    event.preventDefault();

    if (
      !dateForm.startDate ||
      !dateForm.endDate
    ) {
      setError(
        'Select the start and end dates.'
      );

      return;
    }

    if (
      dateForm.endDate <
      dateForm.startDate
    ) {
      setError(
        'End date cannot be earlier than the start date.'
      );

      return;
    }

    setError('');
    setAppliedRange({
      ...dateForm,
    });
  };

  const handleResetDate = () => {
    const range =
      getDefaultDateRange();

    setDateForm(range);
    setAppliedRange(range);
    setError('');
  };

  const exportConfig =
    useMemo(
      () =>
        buildExportConfig(
          activeTab,
          report,
          appliedRange
        ),
      [
        activeTab,
        report,
        appliedRange,
      ]
    );

  const handleExport = () => {
    if (
      !exportConfig ||
      exportConfig.rows.length === 0
    ) {
      setError(
        'There are no report records to export.'
      );

      return;
    }

    setExporting(true);
    setError('');

    try {
      downloadCsv(exportConfig);

      setSuccess(
        'Report exported successfully.'
      );
    } catch (exportError) {
      console.error(
        'Report export error:',
        exportError
      );

      setError(
        'Unable to export the report.'
      );
    } finally {
      setExporting(false);
    }
  };

  if (
    allowedTabs.length === 0
  ) {
    return (
      <div
        style={
          styles.accessMessage
        }
      >
        You do not have access to a
        department report.
      </div>
    );
  }

  return (
    <div>
      <section
        style={styles.pageHeader}
      >
        <div>
          <p style={styles.eyebrow}>
            REPORTS AND ANALYTICS
          </p>

          <h1
            style={styles.pageTitle}
          >
            Management Reports
          </h1>

          <p
            style={
              styles.pageDescription
            }
          >
            Review operational
            performance, activities,
            transactions, and outcomes
            across the authorized
            business modules.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={
            exporting ||
            loading ||
            !report
          }
          style={
            styles.exportButton
          }
        >
          {exporting
            ? 'Exporting...'
            : 'Export CSV'}
        </button>
      </section>

      <section
        style={styles.filterSection}
      >
        <form
          onSubmit={
            handleApplyFilter
          }
          style={styles.dateForm}
        >
          <Field label="Start date">
            <input
              type="date"
              name="startDate"
              value={
                dateForm.startDate
              }
              onChange={
                handleDateChange
              }
              style={styles.input}
            />
          </Field>

          <Field label="End date">
            <input
              type="date"
              name="endDate"
              value={
                dateForm.endDate
              }
              onChange={
                handleDateChange
              }
              style={styles.input}
            />
          </Field>

          <div
            style={
              styles.filterActions
            }
          >
            <button
              type="button"
              onClick={
                handleResetDate
              }
              style={
                styles.secondaryButton
              }
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={loading}
              style={
                styles.primaryButton
              }
            >
              {loading
                ? 'Loading...'
                : 'Apply Date Filter'}
            </button>
          </div>
        </form>

        <div
          style={
            styles.rangeDisplay
          }
        >
          <span>Report period</span>

          <strong>
            {formatDateOnly(
              appliedRange.startDate
            )}
            {' – '}
            {formatDateOnly(
              appliedRange.endDate
            )}
          </strong>
        </div>
      </section>

      {allowedTabs.length > 1 && (
        <nav
          style={styles.tabs}
        >
          {allowedTabs.map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() =>
                  setActiveTab(tab)
                }
                style={{
                  ...styles.tabButton,

                  ...(activeTab === tab
                    ? styles.activeTab
                    : {}),
                }}
              >
                {tabLabels[tab]}
              </button>
            )
          )}
        </nav>
      )}

      {error && (
        <div
          style={
            styles.errorMessage
          }
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={
            styles.successMessage
          }
        >
          {success}
        </div>
      )}

      {loading ? (
        <div
          style={styles.loadingState}
        >
          Loading{' '}
          {tabLabels[activeTab]}...
        </div>
      ) : !report ? (
        <div
          style={styles.emptyState}
        >
          No report data loaded.
        </div>
      ) : (
        <ReportContent
          activeTab={activeTab}
          report={report}
        />
      )}
    </div>
  );
}

function ReportContent({
  activeTab,
  report,
}) {
  switch (activeTab) {
    case 'overview':
      return (
        <OverviewReport
          report={report}
        />
      );

    case 'sales':
      return (
        <SalesReport
          report={report}
        />
      );

    case 'cdm':
      return (
        <CdmReport
          report={report}
        />
      );

    case 'inventory':
      return (
        <InventoryReport
          report={report}
        />
      );

    case 'fulfillment':
      return (
        <FulfillmentReport
          report={report}
        />
      );

    case 'crm':
      return (
        <CrmReport
          report={report}
        />
      );

    case 'marketing':
      return (
        <MarketingReport
          report={report}
        />
      );

    default:
      return null;
  }
}

function OverviewReport({
  report,
}) {
  const overview =
    report.overview || {};

  return (
    <>
      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="TOTAL ORDERS"
          value={
            overview.sales
              ?.totalOrders || 0
          }
        />

        <SummaryCard
          label="CONFIRMED SALES"
          value={formatCurrency(
            overview.sales
              ?.confirmedRevenue
          )}
        />

        <SummaryCard
          label="CDM RECORDS"
          value={
            overview.cdm
              ?.totalRecords || 0
          }
        />

        <SummaryCard
          label="INVENTORY BALANCE"
          value={
            overview.inventory
              ?.totalBalance || 0
          }
        />

        <SummaryCard
          label="DELIVERED"
          value={
            overview.fulfillment
              ?.delivered || 0
          }
        />

        <SummaryCard
          label="RETURNED"
          value={
            overview.fulfillment
              ?.returned || 0
          }
          danger={
            Number(
              overview.fulfillment
                ?.returned || 0
            ) > 0
          }
        />

        <SummaryCard
          label="CRM CASES"
          value={
            overview.crm
              ?.totalCases || 0
          }
        />

        <SummaryCard
          label="AVERAGE RATING"
          value={
            overview.crm
              ?.averageRating ===
            null
              ? '—'
              : `${
                  overview.crm
                    ?.averageRating || 0
                }/5`
          }
        />

        <SummaryCard
          label="MARKETING TASKS"
          value={
            overview.marketing
              ?.totalTasks || 0
          }
        />

        <SummaryCard
          label="MARKETING COMPLETED"
          value={
            overview.marketing
              ?.completedTasks || 0
          }
        />
      </section>

      <section
        style={styles.moduleGrid}
      >
        <ModuleOverviewCard
          title="Sales and Orders"
          items={[
            {
              label:
                'Total Orders',
              value:
                overview.sales
                  ?.totalOrders || 0,
            },
            {
              label:
                'Confirmed Orders',
              value:
                overview.sales
                  ?.confirmedOrders || 0,
            },
            {
              label:
                'Confirmed Revenue',
              value: formatCurrency(
                overview.sales
                  ?.confirmedRevenue
              ),
            },
          ]}
        />

        <ModuleOverviewCard
          title="Inventory and Supply Chain"
          items={[
            {
              label:
                'Inventory Items',
              value:
                overview.inventory
                  ?.totalItems || 0,
            },
            {
              label:
                'Low Stock Items',
              value:
                overview.inventory
                  ?.lowStockItems || 0,
            },
            {
              label:
                'Out of Stock',
              value:
                overview.inventory
                  ?.outOfStockItems || 0,
            },
          ]}
        />

        <ModuleOverviewCard
          title="Fulfillment"
          items={[
            {
              label:
                'Total Records',
              value:
                overview.fulfillment
                  ?.totalRecords || 0,
            },
            {
              label:
                'Delivered',
              value:
                overview.fulfillment
                  ?.delivered || 0,
            },
            {
              label:
                'Returned',
              value:
                overview.fulfillment
                  ?.returned || 0,
            },
          ]}
        />

        <ModuleOverviewCard
          title="Customer Relationship"
          items={[
            {
              label:
                'Total Cases',
              value:
                overview.crm
                  ?.totalCases || 0,
            },
            {
              label:
                'Closed Cases',
              value:
                overview.crm
                  ?.closedCases || 0,
            },
            {
              label:
                'Average Rating',
              value:
                overview.crm
                  ?.averageRating ===
                null
                  ? 'No ratings'
                  : `${
                      overview.crm
                        ?.averageRating
                    }/5`,
            },
          ]}
        />

        <ModuleOverviewCard
          title="Marketing Workflow"
          items={[
            {
              label:
                'Total Tasks',
              value:
                overview.marketing
                  ?.totalTasks || 0,
            },
            {
              label:
                'Completed',
              value:
                overview.marketing
                  ?.completedTasks || 0,
            },
            {
              label:
                'Overdue',
              value:
                overview.marketing
                  ?.overdueTasks || 0,
            },
          ]}
        />
      </section>
    </>
  );
}

function SalesReport({
  report,
}) {
  const summary =
    report.summary || {};

  return (
    <>
      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="TOTAL ORDERS"
          value={
            summary.totalOrders || 0
          }
        />

        <SummaryCard
          label="ORDER VALUE"
          value={formatCurrency(
            summary.totalOrderValue
          )}
        />

        <SummaryCard
          label="CONFIRMED REVENUE"
          value={formatCurrency(
            summary.confirmedRevenue
          )}
        />

        <SummaryCard
          label="AVERAGE ORDER"
          value={formatCurrency(
            summary.averageOrderValue
          )}
        />
      </section>

      <div
        style={styles.twoColumnGrid}
      >
        <ChartSection title="Order Status Distribution">
          <BarList
            items={
              report.statusDistribution ||
              []
            }
            labelKey="status"
            valueKey="total"
          />
        </ChartSection>

        <ChartSection title="Top Products">
          <BarList
            items={
              report.topProducts || []
            }
            labelKey="productName"
            valueKey="unitsSold"
            suffix=" units"
          />
        </ChartSection>
      </div>

      <ReportSection title="Daily Sales">
        <DataTable
          rows={
            report.dailySales || []
          }
          emptyMessage="No daily Sales records found."
          columns={[
            {
              label: 'Date',
              render: (row) =>
                formatDateOnly(
                  row.date
                ),
            },
            {
              label: 'Orders',
              render: (row) =>
                row.orderCount,
            },
            {
              label:
                'Confirmed Revenue',
              render: (row) =>
                formatCurrency(
                  row.confirmedRevenue
                ),
            },
          ]}
        />
      </ReportSection>

      <ReportSection title="Recent Orders">
        <DataTable
          rows={
            report.recentOrders || []
          }
          emptyMessage="No orders found in the selected date range."
          columns={[
            {
              label: 'Order Number',
              render: (row) =>
                row.orderNumber,
            },
            {
              label: 'Customer',
              render: (row) =>
                row.customerName,
            },
            {
              label: 'Encoded By',
              render: (row) =>
                row.encodedBy ||
                'Not available',
            },
            {
              label: 'Amount',
              render: (row) =>
                formatCurrency(
                  row.totalAmount
                ),
            },
            {
              label: 'Status',
              render: (row) => (
                <StatusBadge
                  status={
                    row.orderStatus
                  }
                />
              ),
            },
            {
              label: 'Date Encoded',
              render: (row) =>
                formatDate(
                  row.dateEncoded
                ),
            },
          ]}
        />
      </ReportSection>
    </>
  );
}

function CdmReport({
  report,
}) {
  return (
    <>
      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="TOTAL CDM RECORDS"
          value={
            report.summary
              ?.totalRecords || 0
          }
        />

        <SummaryCard
          label="PENDING"
          value={
            report.summary
              ?.pendingRecords || 0
          }
        />

        <SummaryCard
          label="COMPLETED"
          value={
            report.summary
              ?.completedRecords || 0
          }
        />
      </section>

      <ChartSection title="CDM Status Distribution">
        <BarList
          items={
            report.statusDistribution ||
            []
          }
          labelKey="status"
          valueKey="total"
        />
      </ChartSection>

      <ReportSection title="Recent CDM Records">
        <DataTable
          rows={
            report.recentRecords || []
          }
          emptyMessage="No Customer Data Management records found."
          columns={[
            {
              label: 'Order Number',
              render: (row) =>
                row.orderNumber,
            },
            {
              label: 'Customer',
              render: (row) =>
                row.customerName,
            },
            {
              label: 'Waybill',
              render: (row) =>
                row.waybillNumber ||
                'Not available',
            },
            {
              label: 'Status',
              render: (row) => (
                <StatusBadge
                  status={row.status}
                />
              ),
            },
            {
              label: 'Record Date',
              render: (row) =>
                formatDate(
                  row.recordDate
                ),
            },
          ]}
        />
      </ReportSection>
    </>
  );
}

function InventoryReport({
  report,
}) {
  const summary =
    report.summary || {};

  return (
    <>
      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="INVENTORY ITEMS"
          value={
            summary.totalItems || 0
          }
        />

        <SummaryCard
          label="CURRENT BALANCE"
          value={
            summary.totalBalance || 0
          }
        />

        <SummaryCard
          label="STOCK IN"
          value={
            summary.stockIn || 0
          }
        />

        <SummaryCard
          label="STOCK OUT"
          value={
            summary.stockOut || 0
          }
        />

        <SummaryCard
          label="DISTRIBUTED"
          value={
            summary.distributed || 0
          }
        />

        <SummaryCard
          label="LOW STOCK"
          value={
            summary.lowStockItems || 0
          }
          warning={
            Number(
              summary.lowStockItems ||
                0
            ) > 0
          }
        />

        <SummaryCard
          label="OUT OF STOCK"
          value={
            summary.outOfStockItems ||
            0
          }
          danger={
            Number(
              summary.outOfStockItems ||
                0
            ) > 0
          }
        />
      </section>

      <div
        style={styles.twoColumnGrid}
      >
        <ChartSection title="Inventory Categories">
          <BarList
            items={
              report.categoryDistribution ||
              []
            }
            labelKey="category"
            valueKey="totalBalance"
          />
        </ChartSection>

        <ChartSection title="Quality Check Results">
          <BarList
            items={
              report.qualityChecks ||
              []
            }
            labelKey="result"
            valueKey="total"
          />
        </ChartSection>
      </div>

      <ReportSection title="Inventory Item Balances">
        <DataTable
          rows={report.items || []}
          emptyMessage="No inventory items found."
          columns={[
            {
              label: 'Item',
              render: (row) =>
                row.itemName,
            },
            {
              label: 'Category',
              render: (row) =>
                getLabel(
                  row.itemCategory
                ),
            },
            {
              label:
                'Current Balance',
              render: (row) =>
                `${formatNumber(
                  row.currentBalance
                )}${
                  row.unit
                    ? ` ${row.unit}`
                    : ''
                }`,
            },
            {
              label:
                'Low Stock Level',
              render: (row) =>
                row.lowStockThreshold ===
                null
                  ? 'Not configured'
                  : `${formatNumber(
                      row.lowStockThreshold
                    )}${
                      row.unit
                        ? ` ${row.unit}`
                        : ''
                    }`,
            },
            {
              label:
                'Stock Condition',
              render: (row) => {
                const balance =
                  Number(
                    row.currentBalance ||
                      0
                  );

                if (balance <= 0) {
                  return (
                    <ConditionBadge
                      type="danger"
                      label="Out of Stock"
                    />
                  );
                }

                if (
                  row.lowStockThreshold !==
                    null &&
                  balance <=
                    Number(
                      row.lowStockThreshold
                    )
                ) {
                  return (
                    <ConditionBadge
                      type="warning"
                      label="Low Stock"
                    />
                  );
                }

                return (
                  <ConditionBadge
                    type="success"
                    label="Available"
                  />
                );
              },
            },
          ]}
        />
      </ReportSection>
    </>
  );
}

function FulfillmentReport({
  report,
}) {
  const summary =
    report.summary || {};

  return (
    <>
      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="TOTAL RECORDS"
          value={
            summary.totalRecords || 0
          }
        />

        <SummaryCard
          label="SHIPPED OUT"
          value={
            summary.shippedOut || 0
          }
        />

        <SummaryCard
          label="DELIVERED"
          value={
            summary.delivered || 0
          }
        />

        <SummaryCard
          label="RETURNED"
          value={
            summary.returned || 0
          }
          danger={
            Number(
              summary.returned || 0
            ) > 0
          }
        />

        <SummaryCard
          label="AVG. DELIVERY TIME"
          value={
            summary.averageDeliveryHours ===
            null
              ? '—'
              : `${summary.averageDeliveryHours} hrs`
          }
        />
      </section>

      <div
        style={styles.twoColumnGrid}
      >
        <ChartSection title="Fulfillment Status">
          <BarList
            items={
              report.statusDistribution ||
              []
            }
            labelKey="status"
            valueKey="total"
          />
        </ChartSection>

        <ReportSection title="Courier Performance">
          <DataTable
            rows={
              report.courierPerformance ||
              []
            }
            emptyMessage="No courier data found."
            columns={[
              {
                label: 'Courier',
                render: (row) =>
                  row.courierName,
              },
              {
                label: 'Shipments',
                render: (row) =>
                  row.totalShipments,
              },
              {
                label: 'Delivered',
                render: (row) =>
                  row.delivered,
              },
              {
                label: 'Returned',
                render: (row) =>
                  row.returned,
              },
            ]}
          />
        </ReportSection>
      </div>

      <ReportSection title="Recent Fulfillment Records">
        <DataTable
          rows={
            report.recentRecords || []
          }
          emptyMessage="No fulfillment records found."
          columns={[
            {
              label: 'Order Number',
              render: (row) =>
                row.orderNumber,
            },
            {
              label: 'Customer',
              render: (row) =>
                row.customerName,
            },
            {
              label: 'Courier',
              render: (row) =>
                row.courier ||
                'Not specified',
            },
            {
              label: 'Tracking Number',
              render: (row) =>
                row.trackingNumber ||
                'Not available',
            },
            {
              label: 'Status',
              render: (row) => (
                <StatusBadge
                  status={row.status}
                />
              ),
            },
            {
              label: 'Handled By',
              render: (row) =>
                row.handledBy ||
                'Not assigned',
            },
            {
              label: 'Delivered At',
              render: (row) =>
                formatDate(
                  row.deliveredAt
                ),
            },
          ]}
        />
      </ReportSection>
    </>
  );
}

function CrmReport({
  report,
}) {
  const summary =
    report.summary || {};

  const stepGroups = [1, 2, 3, 4].map(
    (stepNumber) => {
      const records = (
        report.stepDistribution ||
        []
      ).filter(
        (item) =>
          Number(
            item.stepNumber
          ) === stepNumber
      );

      return {
        stepNumber,
        records,
      };
    }
  );

  return (
    <>
      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="TOTAL CASES"
          value={
            summary.totalCases || 0
          }
        />

        <SummaryCard
          label="UNASSIGNED"
          value={
            summary.unassigned || 0
          }
          warning={
            Number(
              summary.unassigned || 0
            ) > 0
          }
        />

        <SummaryCard
          label="OPEN"
          value={
            summary.openCases || 0
          }
        />

        <SummaryCard
          label="OVERDUE"
          value={
            summary.overdueCases || 0
          }
          danger={
            Number(
              summary.overdueCases || 0
            ) > 0
          }
        />

        <SummaryCard
          label="RESOLVED"
          value={
            summary.resolved || 0
          }
        />

        <SummaryCard
          label="CLOSED"
          value={
            summary.closed || 0
          }
        />

        <SummaryCard
          label="AVERAGE RATING"
          value={
            summary.averageRating ===
            null
              ? '—'
              : `${summary.averageRating}/5`
          }
        />
      </section>

      <div
        style={styles.twoColumnGrid}
      >
        <ChartSection title="Case Status">
          <BarList
            items={
              report.statusDistribution ||
              []
            }
            labelKey="status"
            valueKey="total"
          />
        </ChartSection>

        <ChartSection title="Customer Concerns">
          <BarList
            items={
              report.concernDistribution ||
              []
            }
            labelKey="concernCategory"
            valueKey="total"
          />
        </ChartSection>

        <ChartSection title="Satisfaction Ratings">
          <BarList
            items={
              report.ratingDistribution ||
              []
            }
            labelKey="rating"
            valueKey="total"
            labelFormatter={(value) =>
              `${value} Star${
                Number(value) === 1
                  ? ''
                  : 's'
              }`
            }
          />
        </ChartSection>
      </div>

      <ReportSection title="Four-Step After-Sales Progress">
        <div
          style={
            styles.stepReportGrid
          }
        >
          {stepGroups.map(
            (group) => (
              <article
                key={
                  group.stepNumber
                }
                style={
                  styles.stepReportCard
                }
              >
                <h3
                  style={
                    styles.stepReportTitle
                  }
                >
                  Step{' '}
                  {group.stepNumber}
                </h3>

                {group.records.length ===
                0 ? (
                  <p
                    style={
                      styles.noDataText
                    }
                  >
                    No records
                  </p>
                ) : (
                  <BarList
                    items={
                      group.records
                    }
                    labelKey="stepStatus"
                    valueKey="total"
                  />
                )}
              </article>
            )
          )}
        </div>
      </ReportSection>

      <ReportSection title="Recent CRM Cases">
        <DataTable
          rows={
            report.recentCases || []
          }
          emptyMessage="No CRM cases found."
          columns={[
            {
              label: 'Order Number',
              render: (row) =>
                row.orderNumber,
            },
            {
              label: 'Customer',
              render: (row) =>
                row.customerName,
            },
            {
              label: 'Assigned User',
              render: (row) =>
                row.assignedUser ||
                'Unassigned',
            },
            {
              label: 'Current Step',
              render: (row) =>
                `Step ${row.currentStep} of 4`,
            },
            {
              label: 'Concern',
              render: (row) =>
                getLabel(
                  row.concernCategory
                ),
            },
            {
              label: 'Status',
              render: (row) => (
                <StatusBadge
                  status={
                    row.caseStatus
                  }
                />
              ),
            },
            {
              label: 'Rating',
              render: (row) =>
                row.satisfactionRating ===
                null
                  ? '—'
                  : `${row.satisfactionRating}/5`,
            },
            {
              label: 'Created At',
              render: (row) =>
                formatDate(
                  row.createdAt
                ),
            },
          ]}
        />
      </ReportSection>
    </>
  );
}

function MarketingReport({
  report,
}) {
  const summary =
    report.summary || {};

  return (
    <>
      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="CAMPAIGNS"
          value={
            summary.totalCampaigns ||
            0
          }
        />

        <SummaryCard
          label="ACTIVE CAMPAIGNS"
          value={
            summary.activeCampaigns ||
            0
          }
        />

        <SummaryCard
          label="TOTAL TASKS"
          value={
            summary.totalTasks || 0
          }
        />

        <SummaryCard
          label="COMPLETED TASKS"
          value={
            summary.completedTasks ||
            0
          }
        />

        <SummaryCard
          label="FOR REVISION"
          value={
            summary.revisionTasks ||
            0
          }
          warning={
            Number(
              summary.revisionTasks ||
                0
            ) > 0
          }
        />

        <SummaryCard
          label="OVERDUE TASKS"
          value={
            summary.overdueTasks || 0
          }
          danger={
            Number(
              summary.overdueTasks || 0
            ) > 0
          }
        />
      </section>

      <div
        style={styles.twoColumnGrid}
      >
        <ChartSection title="Task Status">
          <BarList
            items={
              report.statusDistribution ||
              []
            }
            labelKey="status"
            valueKey="total"
          />
        </ChartSection>

        <ChartSection title="Content Types">
          <BarList
            items={
              report.contentDistribution ||
              []
            }
            labelKey="contentType"
            valueKey="total"
          />
        </ChartSection>

        <ChartSection title="Task Priorities">
          <BarList
            items={
              report.priorityDistribution ||
              []
            }
            labelKey="priority"
            valueKey="total"
          />
        </ChartSection>

        <ChartSection title="Submission Reviews">
          <BarList
            items={
              report.submissionDistribution ||
              []
            }
            labelKey="reviewStatus"
            valueKey="total"
          />
        </ChartSection>
      </div>

      <ReportSection title="Recent Marketing Tasks">
        <DataTable
          rows={
            report.recentTasks || []
          }
          emptyMessage="No Marketing tasks found."
          columns={[
            {
              label: 'Task',
              render: (row) =>
                row.taskTitle,
            },
            {
              label: 'Campaign',
              render: (row) =>
                row.campaignName ||
                'No campaign',
            },
            {
              label: 'Content Type',
              render: (row) =>
                getLabel(
                  row.contentType
                ),
            },
            {
              label: 'Assigned User',
              render: (row) =>
                row.assignedUser ||
                'Unassigned',
            },
            {
              label: 'Priority',
              render: (row) => (
                <StatusBadge
                  status={row.priority}
                />
              ),
            },
            {
              label: 'Submissions',
              render: (row) =>
                row.submissionCount,
            },
            {
              label: 'Status',
              render: (row) => (
                <StatusBadge
                  status={
                    row.taskStatus
                  }
                />
              ),
            },
            {
              label: 'Due Date',
              render: (row) =>
                formatDate(
                  row.dueDate
                ),
            },
          ]}
        />
      </ReportSection>
    </>
  );
}

function buildExportConfig(
  activeTab,
  report,
  range
) {
  if (!report) {
    return null;
  }

  const suffix =
    `${range.startDate}_to_${range.endDate}`;

  if (activeTab === 'overview') {
    const overview =
      report.overview || {};

    const rows = [
      {
        module: 'Sales',
        metric: 'Total Orders',
        value:
          overview.sales
            ?.totalOrders || 0,
      },
      {
        module: 'Sales',
        metric:
          'Confirmed Orders',
        value:
          overview.sales
            ?.confirmedOrders || 0,
      },
      {
        module: 'Sales',
        metric:
          'Confirmed Revenue',
        value:
          overview.sales
            ?.confirmedRevenue || 0,
      },
      {
        module: 'CDM',
        metric: 'Total Records',
        value:
          overview.cdm
            ?.totalRecords || 0,
      },
      {
        module: 'Inventory',
        metric:
          'Current Balance',
        value:
          overview.inventory
            ?.totalBalance || 0,
      },
      {
        module: 'Fulfillment',
        metric: 'Delivered',
        value:
          overview.fulfillment
            ?.delivered || 0,
      },
      {
        module: 'CRM',
        metric: 'Total Cases',
        value:
          overview.crm
            ?.totalCases || 0,
      },
      {
        module: 'CRM',
        metric:
          'Average Rating',
        value:
          overview.crm
            ?.averageRating ?? '',
      },
      {
        module: 'Marketing',
        metric: 'Total Tasks',
        value:
          overview.marketing
            ?.totalTasks || 0,
      },
    ];

    return {
      filename:
        `management_overview_${suffix}.csv`,

      rows,

      columns: [
        {
          label: 'Module',
          value: 'module',
        },
        {
          label: 'Metric',
          value: 'metric',
        },
        {
          label: 'Value',
          value: 'value',
        },
      ],
    };
  }

  if (activeTab === 'sales') {
    return {
      filename:
        `sales_report_${suffix}.csv`,

      rows:
        report.recentOrders || [],

      columns: [
        {
          label: 'Order Number',
          value: 'orderNumber',
        },
        {
          label: 'Customer',
          value: 'customerName',
        },
        {
          label: 'Encoded By',
          value: 'encodedBy',
        },
        {
          label: 'Amount',
          value: 'totalAmount',
        },
        {
          label: 'Status',
          value: (row) =>
            getLabel(
              row.orderStatus
            ),
        },
        {
          label: 'Date Encoded',
          value: 'dateEncoded',
        },
      ],
    };
  }

  if (activeTab === 'cdm') {
    return {
      filename:
        `cdm_report_${suffix}.csv`,

      rows:
        report.recentRecords || [],

      columns: [
        {
          label: 'Order Number',
          value: 'orderNumber',
        },
        {
          label: 'Customer',
          value: 'customerName',
        },
        {
          label: 'Waybill Number',
          value: 'waybillNumber',
        },
        {
          label: 'Status',
          value: (row) =>
            getLabel(row.status),
        },
        {
          label: 'Record Date',
          value: 'recordDate',
        },
      ],
    };
  }

  if (
    activeTab === 'inventory'
  ) {
    return {
      filename:
        `inventory_report_${suffix}.csv`,

      rows: report.items || [],

      columns: [
        {
          label: 'Item',
          value: 'itemName',
        },
        {
          label: 'Category',
          value: (row) =>
            getLabel(
              row.itemCategory
            ),
        },
        {
          label:
            'Current Balance',
          value: 'currentBalance',
        },
        {
          label:
            'Low Stock Threshold',
          value:
            'lowStockThreshold',
        },
        {
          label: 'Unit',
          value: 'unit',
        },
      ],
    };
  }

  if (
    activeTab ===
    'fulfillment'
  ) {
    return {
      filename:
        `fulfillment_report_${suffix}.csv`,

      rows:
        report.recentRecords || [],

      columns: [
        {
          label: 'Order Number',
          value: 'orderNumber',
        },
        {
          label: 'Customer',
          value: 'customerName',
        },
        {
          label: 'Courier',
          value: 'courier',
        },
        {
          label:
            'Tracking Number',
          value: 'trackingNumber',
        },
        {
          label: 'Status',
          value: (row) =>
            getLabel(row.status),
        },
        {
          label: 'Handled By',
          value: 'handledBy',
        },
        {
          label: 'Delivered At',
          value: 'deliveredAt',
        },
        {
          label: 'Returned At',
          value: 'returnedAt',
        },
        {
          label: 'Return Reason',
          value: 'returnReason',
        },
      ],
    };
  }

  if (activeTab === 'crm') {
    return {
      filename:
        `crm_report_${suffix}.csv`,

      rows:
        report.recentCases || [],

      columns: [
        {
          label: 'Order Number',
          value: 'orderNumber',
        },
        {
          label: 'Customer',
          value: 'customerName',
        },
        {
          label: 'Assigned User',
          value: 'assignedUser',
        },
        {
          label: 'Current Step',
          value: 'currentStep',
        },
        {
          label: 'Concern',
          value: (row) =>
            getLabel(
              row.concernCategory
            ),
        },
        {
          label: 'Case Status',
          value: (row) =>
            getLabel(
              row.caseStatus
            ),
        },
        {
          label:
            'Satisfaction Rating',
          value:
            'satisfactionRating',
        },
        {
          label:
            'Would Repurchase',
          value:
            'wouldRepurchase',
        },
        {
          label: 'Created At',
          value: 'createdAt',
        },
      ],
    };
  }

  return {
    filename:
      `marketing_report_${suffix}.csv`,

    rows:
      report.recentTasks || [],

    columns: [
      {
        label: 'Task',
        value: 'taskTitle',
      },
      {
        label: 'Campaign',
        value: 'campaignName',
      },
      {
        label: 'Content Type',
        value: (row) =>
          getLabel(
            row.contentType
          ),
      },
      {
        label: 'Assigned User',
        value: 'assignedUser',
      },
      {
        label: 'Priority',
        value: (row) =>
          getLabel(row.priority),
      },
      {
        label: 'Submissions',
        value: 'submissionCount',
      },
      {
        label: 'Status',
        value: (row) =>
          getLabel(
            row.taskStatus
          ),
      },
      {
        label: 'Due Date',
        value: 'dueDate',
      },
      {
        label: 'Completed At',
        value: 'completedAt',
      },
    ],
  };
}

function SummaryCard({
  label,
  value,
  warning = false,
  danger = false,
}) {
  return (
    <article
      style={{
        ...styles.summaryCard,

        ...(warning
          ? styles.warningCard
          : {}),

        ...(danger
          ? styles.dangerCard
          : {}),
      }}
    >
      <p
        style={styles.summaryLabel}
      >
        {label}
      </p>

      <h2
        style={styles.summaryValue}
      >
        {value}
      </h2>
    </article>
  );
}

function ModuleOverviewCard({
  title,
  items,
}) {
  return (
    <article
      style={
        styles.moduleCard
      }
    >
      <h2
        style={
          styles.moduleCardTitle
        }
      >
        {title}
      </h2>

      <div
        style={
          styles.moduleMetrics
        }
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={
              styles.moduleMetric
            }
          >
            <span>
              {item.label}
            </span>

            <strong>
              {item.value}
            </strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ChartSection({
  title,
  children,
}) {
  return (
    <section
      style={
        styles.chartSection
      }
    >
      <h2
        style={
          styles.sectionTitle
        }
      >
        {title}
      </h2>

      <div
        style={
          styles.chartContent
        }
      >
        {children}
      </div>
    </section>
  );
}

function ReportSection({
  title,
  children,
}) {
  return (
    <section
      style={
        styles.reportSection
      }
    >
      <h2
        style={
          styles.sectionTitle
        }
      >
        {title}
      </h2>

      <div
        style={{
          marginTop: '14px',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function BarList({
  items,
  labelKey,
  valueKey,
  suffix = '',
  labelFormatter,
}) {
  if (!items || items.length === 0) {
    return (
      <div
        style={styles.noDataText}
      >
        No data available.
      </div>
    );
  }

  const maximum = Math.max(
    ...items.map((item) =>
      Number(item[valueKey] || 0)
    ),
    1
  );

  return (
    <div style={styles.barList}>
      {items.map((item, index) => {
        const value = Number(
          item[valueKey] || 0
        );

        const rawLabel =
          item[labelKey];

        const label =
          labelFormatter
            ? labelFormatter(
                rawLabel
              )
            : getLabel(rawLabel);

        const percentage =
          Math.max(
            (value / maximum) * 100,
            value > 0 ? 3 : 0
          );

        return (
          <div
            key={`${rawLabel}-${index}`}
            style={styles.barItem}
          >
            <div
              style={styles.barHeader}
            >
              <span>{label}</span>

              <strong>
                {formatNumber(value)}
                {suffix}
              </strong>
            </div>

            <div
              style={styles.barTrack}
            >
              <div
                style={{
                  ...styles.barFill,
                  width: `${percentage}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({
  rows,
  columns,
  emptyMessage,
}) {
  if (!rows || rows.length === 0) {
    return (
      <div
        style={styles.emptyTable}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      style={styles.tableWrapper}
    >
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map(
              (column) => (
                <th
                  key={column.label}
                  style={
                    styles.tableHeading
                  }
                >
                  {column.label}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row, rowIndex) => (
              <tr
                key={
                  row.id ||
                  row.orderNumber ||
                  row.taskTitle ||
                  rowIndex
                }
              >
                {columns.map(
                  (column) => (
                    <td
                      key={
                        column.label
                      }
                      style={
                        styles.tableCell
                      }
                    >
                      {column.render(
                        row
                      )}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({
  status,
}) {
  const normalized =
    String(status || '');

  const positiveStatuses = [
    'confirmed',
    'approved',
    'completed',
    'resolved',
    'closed',
    'delivered',
    'received',
  ];

  const warningStatuses = [
    'pending',
    'pending_follow_up',
    'assigned',
    'in_progress',
    'submitted',
    'for_revision',
    'awaiting_customer',
    'shipped_out',
  ];

  const dangerStatuses = [
    'rejected',
    'cancelled',
    'returned',
    'returned_to_sender',
    'not_received',
  ];

  let badgeStyle =
    styles.neutralBadge;

  if (
    positiveStatuses.includes(
      normalized
    )
  ) {
    badgeStyle =
      styles.successBadge;
  } else if (
    warningStatuses.includes(
      normalized
    )
  ) {
    badgeStyle =
      styles.warningBadge;
  } else if (
    dangerStatuses.includes(
      normalized
    )
  ) {
    badgeStyle =
      styles.dangerBadge;
  }

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...badgeStyle,
      }}
    >
      {getLabel(status)}
    </span>
  );
}

function ConditionBadge({
  type,
  label,
}) {
  const styleMap = {
    success:
      styles.successBadge,
    warning:
      styles.warningBadge,
    danger:
      styles.dangerBadge,
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(styleMap[type] ||
          styles.neutralBadge),
      }}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label}
      </label>

      {children}
    </div>
  );
}

const styles = {
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
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
    maxWidth: '690px',
    color: colors.mutedInk,
    fontSize: '12px',
    lineHeight: 1.6,
  },

  exportButton: {
    padding: '11px 17px',
    border: 'none',
    borderRadius: '9px',
    background: colors.rose,
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  filterSection: {
    display: 'flex',
    alignItems: 'end',
    justifyContent:
      'space-between',
    gap: '20px',
    marginTop: '18px',
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    flexWrap: 'wrap',
  },

  dateForm: {
    display: 'flex',
    alignItems: 'end',
    gap: '12px',
    flexWrap: 'wrap',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  label: {
    color: colors.ink,
    fontSize: '10px',
    fontWeight: 600,
  },

  input: {
    minWidth: '170px',
    padding: '10px 12px',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '11px',
  },

  filterActions: {
    display: 'flex',
    gap: '8px',
  },

  primaryButton: {
    padding: '10px 15px',
    border: 'none',
    borderRadius: '8px',
    background: colors.rose,
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '10px 15px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '10px',
    cursor: 'pointer',
  },

  rangeDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    color: colors.mutedInk,
    fontSize: '9px',
    textAlign: 'right',
  },

  tabs: {
    display: 'flex',
    gap: '8px',
    marginTop: '18px',
    padding: '7px',
    borderRadius: '12px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    overflowX: 'auto',
  },

  tabButton: {
    flex: '0 0 auto',
    padding: '10px 13px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: colors.mutedInk,
    fontFamily: font.body,
    fontSize: '10px',
    cursor: 'pointer',
  },

  activeTab: {
    background: colors.rose,
    color: '#ffffff',
    fontWeight: 600,
  },

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(145px, 1fr))',
    gap: '14px',
    marginTop: '18px',
  },

  summaryCard: {
    padding: '18px',
    borderRadius: '13px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  warningCard: {
    background: '#fffaf0',
    border: '1px solid #ead6a2',
  },

  dangerCard: {
    background: '#fff5f6',
    border: '1px solid #e7bec6',
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
    fontSize: '24px',
    fontWeight: 500,
  },

  moduleGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '14px',
    marginTop: '18px',
  },

  moduleCard: {
    padding: '18px',
    borderRadius: '13px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  moduleCardTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  moduleMetrics: {
    display: 'grid',
    gap: '8px',
    marginTop: '13px',
  },

  moduleMetric: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: '12px',
    padding: '9px 10px',
    borderRadius: '8px',
    background: colors.cream,
    color: colors.mutedInk,
    fontSize: '10px',
  },

  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(330px, 1fr))',
    gap: '16px',
    marginTop: '18px',
  },

  chartSection: {
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  reportSection: {
    marginTop: '18px',
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  sectionTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '19px',
    fontWeight: 500,
  },

  chartContent: {
    marginTop: '15px',
  },

  barList: {
    display: 'grid',
    gap: '13px',
  },

  barItem: {
    display: 'grid',
    gap: '6px',
  },

  barHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: '12px',
    color: colors.mutedInk,
    fontSize: '10px',
  },

  barTrack: {
    height: '8px',
    overflow: 'hidden',
    borderRadius: '999px',
    background: '#f0e9e7',
  },

  barFill: {
    height: '100%',
    borderRadius: '999px',
    background: colors.rose,
    transition:
      'width 0.3s ease',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    minWidth: '760px',
    borderCollapse: 'collapse',
  },

  tableHeading: {
    padding: '11px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '9px',
    letterSpacing: '0.8px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },

  tableCell: {
    padding: '12px 11px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.ink,
    fontSize: '10px',
    verticalAlign: 'middle',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '9px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  successBadge: {
    background: '#e9f7ee',
    color: '#287447',
  },

  warningBadge: {
    background: '#fff5d9',
    color: '#725b1e',
  },

  dangerBadge: {
    background: '#fff0f2',
    color: '#a33b51',
  },

  neutralBadge: {
    background: '#eeeeee',
    color: '#666666',
  },

  stepReportGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '12px',
  },

  stepReportCard: {
    padding: '14px',
    borderRadius: '10px',
    background: colors.cream,
    border: `1px solid ${colors.border}`,
  },

  stepReportTitle: {
    margin: '0 0 12px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '16px',
    fontWeight: 500,
  },

  noDataText: {
    margin: 0,
    padding: '18px',
    color: colors.mutedInk,
    fontSize: '10px',
    textAlign: 'center',
  },

  emptyTable: {
    padding: '30px',
    borderRadius: '9px',
    background: colors.cream,
    color: colors.mutedInk,
    textAlign: 'center',
    fontSize: '10px',
  },

  loadingState: {
    marginTop: '18px',
    padding: '60px 20px',
    borderRadius: '14px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    textAlign: 'center',
    fontSize: '12px',
  },

  emptyState: {
    marginTop: '18px',
    padding: '50px 20px',
    borderRadius: '14px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    textAlign: 'center',
    fontSize: '12px',
  },

  accessMessage: {
    padding: '30px',
    borderRadius: '12px',
    background: '#fff0f2',
    color: '#a33b51',
    fontSize: '12px',
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
