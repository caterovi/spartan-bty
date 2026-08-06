import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import api from '../api/axiosInstance';
import {
  colors,
  font,
} from '../styles/tokens';

const statusLabels = {
  pending_packing: 'Pending Packing',
  packing: 'Packing',
  packed: 'Packed',
  ready_for_shipment:
    'Ready for Shipment',
  shipped_out: 'Shipped Out',
  delivered: 'Delivered',
  returned_to_sender:
    'Returned to Sender',
  cancelled: 'Cancelled',
};

const categoryLabels = {
  product_box: 'Product Box',
  air_column_roll:
    'Air Column Roll',
  t4_box: 'T4 Box',
  thank_you_note:
    'Thank You Note',
  other: 'Other',
};

const initialSummary = {
  totalOrders: 0,
  pendingPacking: 0,
  packing: 0,
  packed: 0,
  readyForShipment: 0,
  shippedOut: 0,
  delivered: 0,
  returnedToSender: 0,
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

function formatCurrency(value) {
  return new Intl.NumberFormat(
    'en-PH',
    {
      style: 'currency',
      currency: 'PHP',
    }
  ).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
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

export default function Fulfillment() {
  const currentUser =
    getStoredUser();

  const canWrite =
    currentUser.role ===
      'specialist' &&
    currentUser.departmentCode ===
      'fulfillment';

  const [orders, setOrders] =
    useState([]);

  const [
    packagingItems,
    setPackagingItems,
  ] = useState([]);

  const [summary, setSummary] =
    useState(initialSummary);

  const [
    selectedOrder,
    setSelectedOrder,
  ] = useState(null);

  const [search, setSearch] =
    useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('');

  const [
    packingNotes,
    setPackingNotes,
  ] = useState('');

  const [
    packagingQuantities,
    setPackagingQuantities,
  ] = useState({});

  const [
    readyNotes,
    setReadyNotes,
  ] = useState('');

  const [
    thirdPartyLogistics,
    setThirdPartyLogistics,
  ] = useState('');

  const [
    trackingNumber,
    setTrackingNumber,
  ] = useState('');

  const [
    shippingNotes,
    setShippingNotes,
  ] = useState('');

  const [
    deliveryNotes,
    setDeliveryNotes,
  ] = useState('');

  const [
    returnReason,
    setReturnReason,
  ] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState('');

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        orderResponse,
        summaryResponse,
        packagingResponse,
      ] = await Promise.all([
        api.get(
          '/fulfillment/orders'
        ),

        api.get(
          '/fulfillment/summary'
        ),

        api.get(
          '/fulfillment/packaging-items'
        ),
      ]);

      setOrders(
        orderResponse.data.orders || []
      );

      setSummary({
        ...initialSummary,
        ...(summaryResponse.data
          .summary || {}),
      });

      setPackagingItems(
        packagingResponse.data.items ||
          []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve fulfillment records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredOrders =
    useMemo(() => {
      const keyword = search
        .trim()
        .toLowerCase();

      return orders.filter(
        (order) => {
          const matchesStatus =
            !statusFilter ||
            order.fulfillmentStatus ===
              statusFilter;

          const searchableValues = [
            order.orderNumber,
            order.customer?.fullName,
            order.customer
              ?.contactNumber,
            order.waybillNumber,
            order.trackingNumber,
            order.thirdPartyLogistics,
            statusLabels[
              order
                .fulfillmentStatus
            ],
          ];

          const matchesSearch =
            !keyword ||
            searchableValues.some(
              (value) =>
                String(value || '')
                  .toLowerCase()
                  .includes(keyword)
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      orders,
      search,
      statusFilter,
    ]);

  const resetActionFields = (
    order
  ) => {
    setPackingNotes(
      order?.packingNotes || ''
    );

    setReadyNotes('');

    setThirdPartyLogistics(
      order?.thirdPartyLogistics ||
        ''
    );

    setTrackingNumber(
      order?.trackingNumber || ''
    );

    setShippingNotes(
      order?.shippingNotes || ''
    );

    setDeliveryNotes('');

    setReturnReason(
      order?.returnReason || ''
    );

    const quantities = {};

    order?.packagingUsage?.forEach(
      (usage) => {
        quantities[
          usage.inventoryItemId
        ] = String(
          usage.quantityUsed
        );
      }
    );

    setPackagingQuantities(
      quantities
    );
  };

  const openOrder = async (
    fulfillmentOrderId
  ) => {
    setDetailsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response =
        await api.get(
          `/fulfillment/orders/${fulfillmentOrderId}`
        );

      const order =
        response.data.order;

      setSelectedOrder(order);
      resetActionFields(order);
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve fulfillment order details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshSelectedOrder =
    async (
      fulfillmentOrderId
    ) => {
      const response =
        await api.get(
          `/fulfillment/orders/${fulfillmentOrderId}`
        );

      const order =
        response.data.order;

      setSelectedOrder(order);
      resetActionFields(order);
    };

  const refreshAfterAction =
    async (
      fulfillmentOrderId
    ) => {
      await loadData();

      await refreshSelectedOrder(
        fulfillmentOrderId
      );
    };

  const handleStartPacking =
    async () => {
      if (!selectedOrder) {
        return;
      }

      const confirmed =
        window.confirm(
          `Start packing order ${selectedOrder.orderNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        'start-packing'
      );

      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/fulfillment/orders/${selectedOrder.id}/start-packing`,
            {
              packingNotes:
                packingNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedOrder.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to start packing.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handlePackagingChange = (
    inventoryItemId,
    value
  ) => {
    setPackagingQuantities(
      (current) => ({
        ...current,
        [inventoryItemId]: value,
      })
    );
  };

  const handleCompletePacking =
    async () => {
      if (!selectedOrder) {
        return;
      }

      const packagingUsage =
        Object.entries(
          packagingQuantities
        )
          .map(
            ([
              inventoryItemId,
              quantityUsed,
            ]) => ({
              inventoryItemId:
                Number(
                  inventoryItemId
                ),

              quantityUsed: Number(
                quantityUsed
              ),
            })
          )
          .filter(
            (entry) =>
              Number.isInteger(
                entry.quantityUsed
              ) &&
              entry.quantityUsed > 0
          );

      if (
        packagingUsage.length === 0
      ) {
        setError(
          'Select at least one packing material and enter its quantity.'
        );

        return;
      }

      const confirmed =
        window.confirm(
          'Complete packing? Ordered products and packing materials will be deducted from inventory.'
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        'complete-packing'
      );

      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/fulfillment/orders/${selectedOrder.id}/complete-packing`,
            {
              packingNotes:
                packingNotes.trim(),

              packagingUsage,
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedOrder.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to complete packing.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleMarkReady =
    async () => {
      if (!selectedOrder) {
        return;
      }

      const confirmed =
        window.confirm(
          'Mark this order as ready for shipment?'
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('ready');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/fulfillment/orders/${selectedOrder.id}/ready`,
            {
              notes:
                readyNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedOrder.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to mark the order as ready for shipment.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleShipOrder =
    async () => {
      if (!selectedOrder) {
        return;
      }

      if (
        !thirdPartyLogistics.trim()
      ) {
        setError(
          'Enter the third-party logistics provider.'
        );

        return;
      }

      if (!trackingNumber.trim()) {
        setError(
          'Enter the tracking number.'
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Ship out order ${selectedOrder.orderNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('ship');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/fulfillment/orders/${selectedOrder.id}/ship`,
            {
              thirdPartyLogistics:
                thirdPartyLogistics.trim(),

              trackingNumber:
                trackingNumber.trim(),

              shippingNotes:
                shippingNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedOrder.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to ship the order.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleDelivered =
    async () => {
      if (!selectedOrder) {
        return;
      }

      const confirmed =
        window.confirm(
          'Mark this order as delivered?'
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('deliver');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/fulfillment/orders/${selectedOrder.id}/deliver`,
            {
              notes:
                deliveryNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedOrder.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to mark the order as delivered.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleReturned =
    async () => {
      if (!selectedOrder) {
        return;
      }

      if (!returnReason.trim()) {
        setError(
          'Enter the return-to-sender reason.'
        );

        return;
      }

      const confirmed =
        window.confirm(
          'Mark this order as returned to sender?'
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('return');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/fulfillment/orders/${selectedOrder.id}/return`,
            {
              returnReason:
                returnReason.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedOrder.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to mark the order as returned to sender.'
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
    setError('');
    setSuccess('');
    setPackagingQuantities({});
  };

  return (
    <div>
      <section
        style={styles.pageHeader}
      >
        <div>
          <p style={styles.eyebrow}>
            FULFILLMENT AND LOGISTICS
          </p>

          <h1
            style={styles.pageTitle}
          >
            Order Fulfillment
          </h1>

          <p
            style={
              styles.pageDescription
            }
          >
            Prepare confirmed orders,
            consume products and packing
            materials, record shipping
            details, and monitor delivery
            or return-to-sender status.
          </p>
        </div>

        {!canWrite && (
          <span
            style={
              styles.readOnlyBadge
            }
          >
            View-only access
          </span>
        )}
      </section>

      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="TOTAL ORDERS"
          value={summary.totalOrders}
        />

        <SummaryCard
          label="PENDING PACKING"
          value={
            summary.pendingPacking
          }
        />

        <SummaryCard
          label="PACKING"
          value={summary.packing}
        />

        <SummaryCard
          label="PACKED"
          value={summary.packed}
        />

        <SummaryCard
          label="READY TO SHIP"
          value={
            summary.readyForShipment
          }
        />

        <SummaryCard
          label="SHIPPED OUT"
          value={summary.shippedOut}
        />

        <SummaryCard
          label="DELIVERED"
          value={summary.delivered}
        />

        <SummaryCard
          label="RETURNED"
          value={
            summary.returnedToSender
          }
          danger={
            summary.returnedToSender >
            0
          }
        />
      </section>

      {success &&
        !selectedOrder && (
          <div
            style={
              styles.successMessage
            }
          >
            {success}
          </div>
        )}

      {error &&
        !selectedOrder && (
          <div
            style={
              styles.errorMessage
            }
          >
            {error}
          </div>
        )}

      <section
        style={styles.tableSection}
      >
        <div
          style={styles.tableHeader}
        >
          <div>
            <h2
              style={
                styles.sectionTitle
              }
            >
              Fulfillment orders
            </h2>

            <p
              style={
                styles.sectionDescription
              }
            >
              {filteredOrders.length}{' '}
              order
              {filteredOrders.length ===
              1
                ? ''
                : 's'}{' '}
              shown
            </p>
          </div>

          <div
            style={styles.filters}
          >
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search order..."
              style={
                styles.searchInput
              }
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All statuses
              </option>

              {Object.entries(
                statusLabels
              ).map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {loading ? (
          <div
            style={styles.emptyState}
          >
            Loading fulfillment
            orders...
          </div>
        ) : filteredOrders.length ===
          0 ? (
          <div
            style={styles.emptyState}
          >
            No fulfillment orders
            found.
          </div>
        ) : (
          <div
            style={
              styles.tableWrapper
            }
          >
            <table
              style={styles.table}
            >
              <thead>
                <tr>
                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Order
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Customer
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Products
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Total
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Waybill
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    3PL / Tracking
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Status
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Updated
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map(
                  (order) => (
                    <tr key={order.id}>
                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <strong>
                          {
                            order.orderNumber
                          }
                        </strong>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <p
                          style={
                            styles.primaryText
                          }
                        >
                          {
                            order.customer
                              ?.fullName
                          }
                        </p>

                        <p
                          style={
                            styles.secondaryText
                          }
                        >
                          {
                            order.customer
                              ?.contactNumber
                          }
                        </p>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {order.itemCount}{' '}
                        product
                        {Number(
                          order.itemCount
                        ) === 1
                          ? ''
                          : 's'}

                        <br />

                        <span
                          style={
                            styles.secondaryText
                          }
                        >
                          {
                            order.totalUnits
                          }{' '}
                          unit
                          {Number(
                            order.totalUnits
                          ) === 1
                            ? ''
                            : 's'}
                        </span>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <strong>
                          {formatCurrency(
                            order.totalAmount
                          )}
                        </strong>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {order.waybillNumber ||
                          'No number'}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {order.thirdPartyLogistics ? (
                          <>
                            <strong>
                              {
                                order.thirdPartyLogistics
                              }
                            </strong>

                            <br />

                            <span
                              style={
                                styles.secondaryText
                              }
                            >
                              {
                                order.trackingNumber
                              }
                            </span>
                          </>
                        ) : (
                          <span
                            style={
                              styles.secondaryText
                            }
                          >
                            Not assigned
                          </span>
                        )}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <StatusBadge
                          status={
                            order.fulfillmentStatus
                          }
                        />
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {formatDate(
                          order.updatedAt
                        )}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openOrder(
                              order.id
                            )
                          }
                          disabled={
                            detailsLoading
                          }
                          style={
                            styles.actionButton
                          }
                        >
                          {detailsLoading
                            ? 'Loading...'
                            : canWrite
                            ? 'Process'
                            : 'View'}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedOrder && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDetails();
            }
          }}
        >
          <section
            style={styles.detailsModal}
          >
            <div
              style={
                styles.modalHeader
              }
            >
              <div>
                <p
                  style={
                    styles.eyebrow
                  }
                >
                  FULFILLMENT ORDER
                </p>

                <h2
                  style={
                    styles.modalTitle
                  }
                >
                  {
                    selectedOrder.orderNumber
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                disabled={Boolean(
                  actionLoading
                )}
                style={
                  styles.closeButton
                }
              >
                ×
              </button>
            </div>

            <div
              style={
                styles.statusBanner
              }
            >
              <span>
                Current status
              </span>

              <StatusBadge
                status={
                  selectedOrder.fulfillmentStatus
                }
              />
            </div>

            <div
              style={
                styles.detailGrid
              }
            >
              <Detail
                label="Customer"
                value={
                  selectedOrder.customer
                    ?.fullName
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
                label="Total amount"
                value={formatCurrency(
                  selectedOrder.totalAmount
                )}
              />

              <Detail
                label="Waybill number"
                value={
                  selectedOrder.waybillNumber ||
                  'Not available'
                }
              />

              <Detail
                label="Handled by"
                value={
                  selectedOrder.handledBy
                    ?.fullName ||
                  'Not yet assigned'
                }
              />

              <Detail
                label="Inventory deducted"
                value={
                  selectedOrder.inventoryDeductedAt
                    ? formatDate(
                        selectedOrder.inventoryDeductedAt
                      )
                    : 'Not yet'
                }
              />

              <Detail
                label="Delivery address"
                value={
                  selectedOrder.customer
                    ?.address
                }
                fullWidth
              />
            </div>

            <h3
              style={
                styles.subsectionTitle
              }
            >
              Ordered products
            </h3>

            <div
              style={
                styles.tableWrapper
              }
            >
              <table
                style={
                  styles.innerTable
                }
              >
                <thead>
                  <tr>
                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Product
                    </th>

                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Required
                    </th>

                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Available Stock
                    </th>

                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Availability
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.items?.map(
                    (item) => {
                      const sufficient =
                        Number(
                          item.availableInventory
                        ) >=
                        Number(
                          item.quantity
                        );

                      return (
                        <tr
                          key={item.id}
                        >
                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            {
                              item.productName
                            }
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            {
                              item.quantity
                            }
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            {
                              item.availableInventory
                            }
                          </td>

                          <td
                            style={
                              styles.tableCell
                            }
                          >
                            <span
                              style={
                                sufficient
                                  ? styles.availableText
                                  : styles.insufficientText
                              }
                            >
                              {sufficient
                                ? 'Sufficient'
                                : 'Insufficient'}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {selectedOrder
              .fulfillmentStatus ===
              'pending_packing' &&
              canWrite && (
                <ActionSection
                  title="Start packing"
                  description="Assign this order to yourself and begin the packing process."
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Packing notes
                  </label>

                  <textarea
                    value={
                      packingNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setPackingNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional preparation notes"
                    style={
                      styles.textarea
                    }
                  />

                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleStartPacking
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'start-packing'
                        ? 'Starting...'
                        : 'Start packing'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {selectedOrder
              .fulfillmentStatus ===
              'packing' &&
              canWrite && (
                <ActionSection
                  title="Complete packing"
                  description="Select the materials used. Products and materials will be deducted from inventory after confirmation."
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Packing materials
                  </label>

                  <div
                    style={
                      styles.packagingGrid
                    }
                  >
                    {packagingItems.map(
                      (item) => (
                        <div
                          key={
                            item.id
                          }
                          style={
                            styles.packagingItem
                          }
                        >
                          <div>
                            <strong>
                              {
                                item.itemName
                              }
                            </strong>

                            <p
                              style={
                                styles.secondaryText
                              }
                            >
                              {
                                categoryLabels[
                                  item
                                    .category
                                ]
                              }
                              {' · '}
                              Available:{' '}
                              {
                                item.currentQuantity
                              }{' '}
                              {item.unit}
                            </p>
                          </div>

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              packagingQuantities[
                                item.id
                              ] || ''
                            }
                            onChange={(
                              event
                            ) =>
                              handlePackagingChange(
                                item.id,
                                event.target
                                  .value
                              )
                            }
                            placeholder="Qty"
                            style={
                              styles.quantityInput
                            }
                          />
                        </div>
                      )
                    )}
                  </div>

                  <label
                    style={
                      styles.label
                    }
                  >
                    Final packing notes
                  </label>

                  <textarea
                    value={
                      packingNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setPackingNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional packing remarks"
                    style={
                      styles.textarea
                    }
                  />

                  <div
                    style={
                      styles.warningBox
                    }
                  >
                    Completing packing
                    will automatically
                    deduct the ordered
                    products and selected
                    packing materials.
                  </div>

                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleCompletePacking
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'complete-packing'
                        ? 'Completing...'
                        : 'Complete packing'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {selectedOrder
              .packagingUsage
              ?.length > 0 && (
              <>
                <h3
                  style={
                    styles.subsectionTitle
                  }
                >
                  Packing materials used
                </h3>

                <div
                  style={
                    styles.tableWrapper
                  }
                >
                  <table
                    style={
                      styles.innerTable
                    }
                  >
                    <thead>
                      <tr>
                        <th
                          style={
                            styles.tableHeading
                          }
                        >
                          Material
                        </th>

                        <th
                          style={
                            styles.tableHeading
                          }
                        >
                          Category
                        </th>

                        <th
                          style={
                            styles.tableHeading
                          }
                        >
                          Quantity Used
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedOrder.packagingUsage.map(
                        (usage) => (
                          <tr
                            key={
                              usage.id
                            }
                          >
                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {
                                usage.itemName
                              }
                            </td>

                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {
                                categoryLabels[
                                  usage
                                    .category
                                ]
                              }
                            </td>

                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {
                                usage.quantityUsed
                              }{' '}
                              {usage.unit}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {selectedOrder
              .fulfillmentStatus ===
              'packed' &&
              canWrite && (
                <ActionSection
                  title="Ready for shipment"
                  description="Confirm that the packed order is ready to be handed over to the courier."
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Notes
                  </label>

                  <textarea
                    value={
                      readyNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setReadyNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional readiness notes"
                    style={
                      styles.textarea
                    }
                  />

                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleMarkReady
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'ready'
                        ? 'Updating...'
                        : 'Mark ready for shipment'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {selectedOrder
              .fulfillmentStatus ===
              'ready_for_shipment' &&
              canWrite && (
                <ActionSection
                  title="Ship order"
                  description="Record the courier and tracking information before marking the order as shipped out."
                >
                  <div
                    style={
                      styles.formGrid
                    }
                  >
                    <div>
                      <label
                        style={
                          styles.label
                        }
                      >
                        Third-party
                        logistics
                      </label>

                      <input
                        value={
                          thirdPartyLogistics
                        }
                        onChange={(
                          event
                        ) =>
                          setThirdPartyLogistics(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="e.g. J&T Express"
                        style={
                          styles.input
                        }
                      />
                    </div>

                    <div>
                      <label
                        style={
                          styles.label
                        }
                      >
                        Tracking number
                      </label>

                      <input
                        value={
                          trackingNumber
                        }
                        onChange={(
                          event
                        ) =>
                          setTrackingNumber(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="Enter tracking number"
                        style={
                          styles.input
                        }
                      />
                    </div>
                  </div>

                  <label
                    style={
                      styles.label
                    }
                  >
                    Shipping notes
                  </label>

                  <textarea
                    value={
                      shippingNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setShippingNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional courier or shipment notes"
                    style={
                      styles.textarea
                    }
                  />

                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleShipOrder
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'ship'
                        ? 'Shipping...'
                        : 'Mark as shipped out'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {selectedOrder
              .fulfillmentStatus ===
              'shipped_out' &&
              canWrite && (
                <ActionSection
                  title="Shipment outcome"
                  description="Record whether the shipment was delivered or returned to sender."
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Delivery notes
                  </label>

                  <textarea
                    value={
                      deliveryNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setDeliveryNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional delivery notes"
                    style={
                      styles.textarea
                    }
                  />

                  <label
                    style={
                      styles.label
                    }
                  >
                    Return-to-sender
                    reason
                  </label>

                  <textarea
                    value={
                      returnReason
                    }
                    onChange={(
                      event
                    ) =>
                      setReturnReason(
                        event.target
                          .value
                      )
                    }
                    placeholder="Required only when marking as returned"
                    style={
                      styles.textarea
                    }
                  />

                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleReturned
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.returnButton
                      }
                    >
                      {actionLoading ===
                      'return'
                        ? 'Updating...'
                        : 'Returned to sender'}
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleDelivered
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'deliver'
                        ? 'Updating...'
                        : 'Mark as delivered'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {selectedOrder
              .fulfillmentStatus ===
              'delivered' && (
              <div
                style={
                  styles.completedBox
                }
              >
                <strong>
                  Order delivered
                </strong>

                <span>
                  {formatDate(
                    selectedOrder.deliveredAt
                  )}
                </span>
              </div>
            )}

            {selectedOrder
              .fulfillmentStatus ===
              'returned_to_sender' && (
              <div
                style={
                  styles.returnedBox
                }
              >
                <strong>
                  Returned to sender
                </strong>

                <p>
                  {
                    selectedOrder.returnReason
                  }
                </p>

                <span>
                  {formatDate(
                    selectedOrder.returnedAt
                  )}
                </span>
              </div>
            )}

            <h3
              style={
                styles.subsectionTitle
              }
            >
              Status history
            </h3>

            {!selectedOrder
              .statusHistory ||
            selectedOrder.statusHistory
              .length === 0 ? (
              <div
                style={
                  styles.emptyHistory
                }
              >
                No status history yet.
              </div>
            ) : (
              <div
                style={
                  styles.historyList
                }
              >
                {selectedOrder.statusHistory.map(
                  (history) => (
                    <div
                      key={history.id}
                      style={
                        styles.historyItem
                      }
                    >
                      <div>
                        <strong>
                          {
                            statusLabels[
                              history
                                .newStatus
                            ]
                          }
                        </strong>

                        <p
                          style={
                            styles.secondaryText
                          }
                        >
                          Changed by{' '}
                          {
                            history
                              .changedBy
                              ?.fullName
                          }
                        </p>
                      </div>

                      <div
                        style={
                          styles.historyRight
                        }
                      >
                        <span>
                          {formatDate(
                            history.createdAt
                          )}
                        </span>

                        {history.notes && (
                          <p>
                            {
                              history.notes
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
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
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  danger = false,
}) {
  return (
    <article
      style={{
        ...styles.summaryCard,
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
          ? styles.fullWidth
          : {}),
      }}
    >
      <span
        style={styles.detailLabel}
      >
        {label}
      </span>

      <strong
        style={styles.detailValue}
      >
        {value || 'Not available'}
      </strong>
    </div>
  );
}

function ActionSection({
  title,
  description,
  children,
}) {
  return (
    <section
      style={styles.actionSection}
    >
      <h3
        style={
          styles.actionSectionTitle
        }
      >
        {title}
      </h3>

      <p
        style={
          styles.actionDescription
        }
      >
        {description}
      </p>

      {children}
    </section>
  );
}

function StatusBadge({ status }) {
  const statusStyles = {
    pending_packing:
      styles.pendingBadge,

    packing:
      styles.packingBadge,

    packed:
      styles.packedBadge,

    ready_for_shipment:
      styles.readyBadge,

    shipped_out:
      styles.shippedBadge,

    delivered:
      styles.deliveredBadge,

    returned_to_sender:
      styles.returnedBadge,

    cancelled:
      styles.cancelledBadge,
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(statusStyles[status] ||
          {}),
      }}
    >
      {statusLabels[status] ||
        status}
    </span>
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

  dangerCard: {
    background: '#fff5f6',
    border: '1px solid #e6b9c2',
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
    fontSize: '25px',
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
    justifyContent:
      'space-between',
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
    width: '220px',
    padding: '10px 12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    fontFamily: font.body,
    fontSize: '11px',
  },

  filterSelect: {
    padding: '10px 12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    fontFamily: font.body,
    fontSize: '11px',
  },

  tableWrapper: {
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    minWidth: '1150px',
    borderCollapse: 'collapse',
  },

  innerTable: {
    width: '100%',
    minWidth: '650px',
    borderCollapse: 'collapse',
    background: '#ffffff',
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
    background:
      'rgba(43, 36, 32, 0.62)',
  },

  detailsModal: {
    width: '100%',
    maxWidth: '1000px',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
  },

  modalHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
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

  statusBanner: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginTop: '18px',
    padding: '14px',
    borderRadius: '10px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '11px',
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(0, 1fr))',
    gap: '12px',
    marginTop: '16px',
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

  fullWidth: {
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
  },

  subsectionTitle: {
    margin: '24px 0 10px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  availableText: {
    color: '#287447',
    fontWeight: 600,
  },

  insufficientText: {
    color: '#a33b51',
    fontWeight: 600,
  },

  actionSection: {
    marginTop: '22px',
    padding: '18px',
    borderRadius: '12px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  actionSectionTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '19px',
    fontWeight: 500,
  },

  actionDescription: {
    margin: '5px 0 14px',
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.6,
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
    minHeight: '76px',
    padding: '11px 12px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    resize: 'vertical',
    fontFamily: font.body,
    fontSize: '11px',
  },

  input: {
    width: '100%',
    padding: '11px 12px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    fontFamily: font.body,
    fontSize: '11px',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },

  packagingGrid: {
    display: 'grid',
    gap: '9px',
  },

  packagingItem: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: colors.cream,
    color: colors.ink,
    fontSize: '11px',
  },

  quantityInput: {
    width: '85px',
    padding: '9px 10px',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    fontFamily: font.body,
    fontSize: '11px',
  },

  warningBox: {
    marginTop: '14px',
    padding: '11px 13px',
    borderRadius: '8px',
    background: '#fff5d9',
    border: '1px solid #ead6a2',
    color: '#725b1e',
    fontSize: '10px',
    lineHeight: 1.55,
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

  returnButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: '1px solid #e5b1bc',
    background: '#fff0f2',
    color: '#a33b51',
    fontFamily: font.body,
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  completedBox: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginTop: '20px',
    padding: '14px',
    borderRadius: '9px',
    background: '#e9f7ee',
    color: '#287447',
    fontSize: '11px',
  },

  returnedBox: {
    marginTop: '20px',
    padding: '14px',
    borderRadius: '9px',
    background: '#fff0f2',
    color: '#a33b51',
    fontSize: '11px',
    lineHeight: 1.6,
  },

  historyList: {
    display: 'grid',
    gap: '9px',
  },

  historyItem: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: '20px',
    padding: '13px',
    borderRadius: '9px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.ink,
    fontSize: '11px',
  },

  historyRight: {
    color: colors.mutedInk,
    fontSize: '10px',
    textAlign: 'right',
  },

  emptyHistory: {
    padding: '24px',
    borderRadius: '9px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    textAlign: 'center',
    fontSize: '11px',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '9px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  pendingBadge: {
    background: '#fff5d9',
    color: '#725b1e',
  },

  packingBadge: {
    background: '#f4ecff',
    color: '#7044a0',
  },

  packedBadge: {
    background: '#edf2ff',
    color: '#4863a8',
  },

  readyBadge: {
    background: '#e6f5f7',
    color: '#26727a',
  },

  shippedBadge: {
    background: '#eaf0ff',
    color: '#355ca8',
  },

  deliveredBadge: {
    background: '#e9f7ee',
    color: '#287447',
  },

  returnedBadge: {
    background: '#fff0f2',
    color: '#a33b51',
  },

  cancelledBadge: {
    background: '#eeeeee',
    color: '#666666',
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