import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import api from '../api/axiosInstance';
import { colors, font } from '../styles/tokens';

const initialItem = {
  productId: '',
  quantity: 1,
  unitPrice: '',
};

const initialForm = {
  customerMode: 'existing',
  customerId: '',
  fullName: '',
  contactNumber: '',
  address: '',
  conversationLink: '',
  skinConcern: '',
  tags: '',
  notes: '',
  items: [{ ...initialItem }],
};

const statusLabels = {
  draft: 'Draft',
  for_confirmation: 'For Confirmation',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function getStoredUser() {
  try {
    return (
      JSON.parse(localStorage.getItem('user')) ||
      {}
    );
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

export default function Sales() {
  const currentUser = getStoredUser();

  const canWrite =
    currentUser.role === 'specialist' &&
    currentUser.departmentCode === 'sales';

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState('');

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [actionLoadingId, setActionLoadingId] =
    useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState(initialForm);
  const [customerSearch, setCustomerSearch] =
    useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        ordersResponse,
        productsResponse,
        customersResponse,
      ] = await Promise.all([
        api.get('/sales/orders'),
        api.get('/sales/products'),
        api.get('/sales/customers'),
      ]);

      setOrders(
        ordersResponse.data.orders || []
      );

      setProducts(
        productsResponse.data.products || []
      );

      setCustomers(
        customersResponse.data.customers || []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to load Sales records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredOrders = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        !statusFilter ||
        order.orderStatus === statusFilter;

      const searchableValues = [
        order.orderNumber,
        order.customer?.fullName,
        order.customer?.contactNumber,
        order.encodedBy?.fullName,
        statusLabels[order.orderStatus],
      ];

      const matchesSearch =
        !keyword ||
        searchableValues.some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(keyword)
        );

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const keyword = customerSearch
      .trim()
      .toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        customer.fullName,
        customer.contactNumber,
        customer.address,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(keyword)
      )
    );
  }, [customers, customerSearch]);

  const totalSales = orders
    .filter(
      (order) =>
        order.orderStatus !== 'cancelled' &&
        order.orderStatus !== 'rejected'
    )
    .reduce(
      (total, order) =>
        total + Number(order.totalAmount || 0),
      0
    );

  const draftCount = orders.filter(
    (order) => order.orderStatus === 'draft'
  ).length;

  const forConfirmationCount = orders.filter(
    (order) =>
      order.orderStatus === 'for_confirmation'
  ).length;

  const confirmedCount = orders.filter(
    (order) =>
      order.orderStatus === 'confirmed'
  ).length;

  const orderTotal = form.items.reduce(
    (total, item) => {
      const quantity = Number(
        item.quantity || 0
      );

      const unitPrice = Number(
        item.unitPrice || 0
      );

      return total + quantity * unitPrice;
    },
    0
  );

  const resetForm = () => {
    setForm({
      ...initialForm,
      items: [{ ...initialItem }],
    });

    setCustomerSearch('');
    setError('');
  };

  const openCreateModal = () => {
    resetForm();
    setSuccess('');
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (submitting) {
      return;
    }

    setShowCreateModal(false);
    resetForm();
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const changeCustomerMode = (mode) => {
    setForm((current) => ({
      ...current,
      customerMode: mode,
      customerId: '',
      fullName: '',
      contactNumber: '',
      address: '',
    }));

    setCustomerSearch('');
  };

  const handleItemChange = (
    index,
    field,
    value
  ) => {
    setForm((current) => {
      const updatedItems = current.items.map(
        (item, itemIndex) => {
          if (itemIndex !== index) {
            return item;
          }

          if (field === 'productId') {
            const selectedProduct =
              products.find(
                (product) =>
                  Number(product.id) ===
                  Number(value)
              );

            return {
              ...item,
              productId: value,
              unitPrice:
                selectedProduct &&
                Number(
                  selectedProduct.defaultPrice
                ) > 0
                  ? String(
                      selectedProduct.defaultPrice
                    )
                  : item.unitPrice,
            };
          }

          return {
            ...item,
            [field]: value,
          };
        }
      );

      return {
        ...current,
        items: updatedItems,
      };
    });
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        { ...initialItem },
      ],
    }));
  };

  const removeItem = (index) => {
    setForm((current) => {
      if (current.items.length === 1) {
        return current;
      }

      return {
        ...current,
        items: current.items.filter(
          (_, itemIndex) =>
            itemIndex !== index
        ),
      };
    });
  };

  const validateOrderForm = () => {
    if (
      form.customerMode === 'existing' &&
      !form.customerId
    ) {
      return 'Select an existing customer.';
    }

    if (form.customerMode === 'new') {
      if (
        !form.fullName.trim() ||
        !form.contactNumber.trim() ||
        !form.address.trim()
      ) {
        return 'Customer name, contact number, and address are required.';
      }
    }

    if (form.items.length === 0) {
      return 'Add at least one product.';
    }

    const selectedProductIds = new Set();

    for (const item of form.items) {
      const productId = Number(
        item.productId
      );

      const quantity = Number(
        item.quantity
      );

      const unitPrice = Number(
        item.unitPrice
      );

      if (!productId) {
        return 'Select a product for every order item.';
      }

      if (
        selectedProductIds.has(productId)
      ) {
        return 'The same product cannot be added more than once.';
      }

      selectedProductIds.add(productId);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return 'Quantity must be a positive whole number.';
      }

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0
      ) {
        return 'Unit price must be greater than zero.';
      }
    }

    return '';
  };

  const handleCreateOrder = async (
    orderStatus
  ) => {
    const validationMessage =
      validateOrderForm();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        customerId:
          form.customerMode === 'existing'
            ? Number(form.customerId)
            : null,

        customer:
          form.customerMode === 'new'
            ? {
                fullName:
                  form.fullName.trim(),

                contactNumber:
                  form.contactNumber.trim(),

                address:
                  form.address.trim(),
              }
            : null,

        conversationLink:
          form.conversationLink.trim(),

        skinConcern:
          form.skinConcern.trim(),

        tags: form.tags.trim(),
        notes: form.notes.trim(),

        orderStatus,

        items: form.items.map((item) => ({
          productId: Number(
            item.productId
          ),

          quantity: Number(
            item.quantity
          ),

          unitPrice: Number(
            item.unitPrice
          ),
        })),
      };

      const response = await api.post(
        '/sales/orders',
        payload
      );

      setSuccess(response.data.message);

      closeCreateModal();
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to create the order.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const viewOrder = async (orderId) => {
    setDetailsLoading(true);
    setError('');

    try {
      const response = await api.get(
        `/sales/orders/${orderId}`
      );

      setSelectedOrder(
        response.data.order
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to retrieve order details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const submitDraft = async (order) => {
    const confirmed = window.confirm(
      `Submit ${order.orderNumber} to Customer Data Management?`
    );

    if (!confirmed) {
      return;
    }

    setActionLoadingId(order.id);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/sales/orders/${order.id}/submit`
      );

      setOrders((current) =>
        current.map((record) =>
          record.id === order.id
            ? {
                ...record,
                orderStatus:
                  response.data.orderStatus,
                submittedAt: new Date(),
              }
            : record
        )
      );

      setSuccess(response.data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to submit the order.'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div>
      <section style={styles.pageHeader}>
        <div>
          <p style={styles.eyebrow}>
            SALES AND ORDER MANAGEMENT
          </p>

          <h1 style={styles.pageTitle}>
            Sales Orders
          </h1>

          <p style={styles.pageDescription}>
            Encode customer information, add
            products, calculate totals, and submit
            orders for confirmation.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={openCreateModal}
            style={styles.primaryButton}
          >
            + Create order
          </button>
        )}
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="TOTAL ORDERS"
          value={orders.length}
        />

        <SummaryCard
          label="DRAFT ORDERS"
          value={draftCount}
        />

        <SummaryCard
          label="FOR CONFIRMATION"
          value={forConfirmationCount}
        />

        <SummaryCard
          label="CONFIRMED"
          value={confirmedCount}
        />

        <SummaryCard
          label="ORDER VALUE"
          value={formatCurrency(totalSales)}
          small
        />
      </section>

      {success && (
        <div style={styles.successMessage}>
          {success}
        </div>
      )}

      {error && !showCreateModal && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}

      <section style={styles.tableSection}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              Order records
            </h2>

            <p style={styles.sectionDescription}>
              {filteredOrders.length} order
              {filteredOrders.length === 1
                ? ''
                : 's'}{' '}
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
                setStatusFilter(
                  event.target.value
                )
              }
              style={styles.filterSelect}
            >
              <option value="">
                All statuses
              </option>

              <option value="draft">
                Draft
              </option>

              <option value="for_confirmation">
                For Confirmation
              </option>

              <option value="confirmed">
                Confirmed
              </option>

              <option value="rejected">
                Rejected
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyState}>
            Loading sales orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={styles.emptyState}>
            No sales orders found.
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
                    Items
                  </th>

                  <th style={styles.tableHeading}>
                    Total
                  </th>

                  <th style={styles.tableHeading}>
                    Status
                  </th>

                  <th style={styles.tableHeading}>
                    Date encoded
                  </th>

                  <th style={styles.tableHeading}>
                    Encoded by
                  </th>

                  <th style={styles.tableHeading}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map(
                  (order) => (
                    <tr key={order.id}>
                      <td
                        style={styles.tableCell}
                      >
                        <strong>
                          {order.orderNumber}
                        </strong>
                      </td>

                      <td
                        style={styles.tableCell}
                      >
                        <p
                          style={
                            styles.customerName
                          }
                        >
                          {
                            order.customer
                              ?.fullName
                          }
                        </p>

                        <p
                          style={
                            styles.customerDetails
                          }
                        >
                          {
                            order.customer
                              ?.contactNumber
                          }
                        </p>
                      </td>

                      <td
                        style={styles.tableCell}
                      >
                        {order.itemCount} product
                        {Number(
                          order.itemCount
                        ) === 1
                          ? ''
                          : 's'}
                        <br />
                        <span
                          style={
                            styles.mutedText
                          }
                        >
                          {order.totalUnits}{' '}
                          unit
                          {Number(
                            order.totalUnits
                          ) === 1
                            ? ''
                            : 's'}
                        </span>
                      </td>

                      <td
                        style={styles.tableCell}
                      >
                        <strong>
                          {formatCurrency(
                            order.totalAmount
                          )}
                        </strong>
                      </td>

                      <td
                        style={styles.tableCell}
                      >
                        <StatusBadge
                          status={
                            order.orderStatus
                          }
                        />
                      </td>

                      <td
                        style={styles.tableCell}
                      >
                        {formatDate(
                          order.dateEncoded
                        )}
                      </td>

                      <td
                        style={styles.tableCell}
                      >
                        {
                          order.encodedBy
                            ?.fullName
                        }
                      </td>

                      <td
                        style={styles.tableCell}
                      >
                        <div
                          style={
                            styles.actionGroup
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              viewOrder(
                                order.id
                              )
                            }
                            style={
                              styles.actionButton
                            }
                            disabled={
                              detailsLoading
                            }
                          >
                            View
                          </button>

                          {canWrite &&
                            order.orderStatus ===
                              'draft' && (
                              <button
                                type="button"
                                onClick={() =>
                                  submitDraft(
                                    order
                                  )
                                }
                                disabled={
                                  actionLoadingId ===
                                  order.id
                                }
                                style={{
                                  ...styles.actionButton,
                                  ...styles.submitButton,
                                }}
                              >
                                {actionLoadingId ===
                                order.id
                                  ? 'Submitting...'
                                  : 'Submit'}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreateModal && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <section style={styles.orderModal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.eyebrow}>
                  NEW SALES ORDER
                </p>

                <h2 style={styles.modalTitle}>
                  Create order
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={submitting}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={styles.formSection}>
              <h3 style={styles.formSectionTitle}>
                Customer information
              </h3>

              <div
                style={
                  styles.customerModeButtons
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    changeCustomerMode(
                      'existing'
                    )
                  }
                  style={{
                    ...styles.modeButton,
                    ...(form.customerMode ===
                    'existing'
                      ? styles.activeModeButton
                      : {}),
                  }}
                >
                  Existing customer
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeCustomerMode('new')
                  }
                  style={{
                    ...styles.modeButton,
                    ...(form.customerMode ===
                    'new'
                      ? styles.activeModeButton
                      : {}),
                  }}
                >
                  New customer
                </button>
              </div>

              {form.customerMode ===
              'existing' ? (
                <div style={styles.formGrid}>
                  <Field
                    label="Search customer"
                    fullWidth
                  >
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={(event) =>
                        setCustomerSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search name or contact number"
                      style={styles.input}
                    />
                  </Field>

                  <Field
                    label="Select customer"
                    fullWidth
                  >
                    <select
                      name="customerId"
                      value={form.customerId}
                      onChange={
                        handleFormChange
                      }
                      style={styles.input}
                      required
                    >
                      <option value="">
                        Select customer
                      </option>

                      {filteredCustomers.map(
                        (customer) => (
                          <option
                            key={customer.id}
                            value={customer.id}
                          >
                            {
                              customer.fullName
                            }{' '}
                            —{' '}
                            {
                              customer.contactNumber
                            }
                          </option>
                        )
                      )}
                    </select>
                  </Field>
                </div>
              ) : (
                <div style={styles.formGrid}>
                  <Field label="Customer name">
                    <input
                      name="fullName"
                      value={form.fullName}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Enter customer name"
                      style={styles.input}
                      required
                    />
                  </Field>

                  <Field label="Contact number">
                    <input
                      name="contactNumber"
                      value={
                        form.contactNumber
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="Enter contact number"
                      style={styles.input}
                      required
                    />
                  </Field>

                  <Field
                    label="Complete address"
                    fullWidth
                  >
                    <textarea
                      name="address"
                      value={form.address}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Enter customer address"
                      style={styles.textarea}
                      required
                    />
                  </Field>
                </div>
              )}
            </div>

            <div style={styles.formSection}>
              <h3 style={styles.formSectionTitle}>
                Order information
              </h3>

              <div style={styles.formGrid}>
                <Field label="Conversation link">
                  <input
                    type="url"
                    name="conversationLink"
                    value={
                      form.conversationLink
                    }
                    onChange={handleFormChange}
                    placeholder="https://..."
                    style={styles.input}
                  />
                </Field>

                <Field label="Skin concern">
                  <input
                    name="skinConcern"
                    value={form.skinConcern}
                    onChange={handleFormChange}
                    placeholder="Enter skin concern"
                    style={styles.input}
                  />
                </Field>

                <Field label="Tags">
                  <input
                    name="tags"
                    value={form.tags}
                    onChange={handleFormChange}
                    placeholder="e.g. repeat buyer, acne"
                    style={styles.input}
                  />
                </Field>

                <Field label="Notes">
                  <input
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    placeholder="Additional notes"
                    style={styles.input}
                  />
                </Field>
              </div>
            </div>

            <div style={styles.formSection}>
              <div style={styles.itemsHeader}>
                <div>
                  <h3
                    style={
                      styles.formSectionTitle
                    }
                  >
                    Products
                  </h3>

                  <p
                    style={
                      styles.sectionDescription
                    }
                  >
                    Add the products, quantity,
                    and actual selling price.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  style={styles.secondaryButton}
                >
                  + Add product
                </button>
              </div>

              <div style={styles.itemsList}>
                {form.items.map(
                  (item, index) => {
                    const lineTotal =
                      Number(
                        item.quantity || 0
                      ) *
                      Number(
                        item.unitPrice || 0
                      );

                    return (
                      <div
                        key={index}
                        style={styles.itemRow}
                      >
                        <Field label="Product">
                          <select
                            value={
                              item.productId
                            }
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                'productId',
                                event.target
                                  .value
                              )
                            }
                            style={styles.input}
                            required
                          >
                            <option value="">
                              Select product
                            </option>

                            {products.map(
                              (product) => (
                                <option
                                  key={
                                    product.id
                                  }
                                  value={
                                    product.id
                                  }
                                >
                                  {
                                    product.productName
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </Field>

                        <Field label="Quantity">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={
                              item.quantity
                            }
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                'quantity',
                                event.target
                                  .value
                              )
                            }
                            style={styles.input}
                            required
                          />
                        </Field>

                        <Field label="Unit price">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={
                              item.unitPrice
                            }
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                'unitPrice',
                                event.target
                                  .value
                              )
                            }
                            placeholder="0.00"
                            style={styles.input}
                            required
                          />
                        </Field>

                        <div
                          style={
                            styles.lineTotal
                          }
                        >
                          <span
                            style={
                              styles.lineTotalLabel
                            }
                          >
                            Line total
                          </span>

                          <strong>
                            {formatCurrency(
                              lineTotal
                            )}
                          </strong>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(index)
                          }
                          disabled={
                            form.items.length ===
                            1
                          }
                          style={{
                            ...styles.removeButton,
                            ...(form.items
                              .length === 1
                              ? styles.disabledButton
                              : {}),
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <div style={styles.orderSummary}>
              <span>Total amount</span>

              <strong>
                {formatCurrency(orderTotal)}
              </strong>
            </div>

            {error && (
              <div style={styles.errorMessage}>
                {error}
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={closeCreateModal}
                style={styles.secondaryButton}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCreateOrder('draft')
                }
                style={styles.draftButton}
                disabled={submitting}
              >
                {submitting
                  ? 'Saving...'
                  : 'Save as draft'}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCreateOrder(
                    'for_confirmation'
                  )
                }
                style={styles.primaryButton}
                disabled={submitting}
              >
                {submitting
                  ? 'Submitting...'
                  : 'Submit for confirmation'}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedOrder && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedOrder(null);
            }
          }}
        >
          <section style={styles.detailsModal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.eyebrow}>
                  ORDER DETAILS
                </p>

                <h2 style={styles.modalTitle}>
                  {
                    selectedOrder.orderNumber
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedOrder(null)
                }
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={styles.detailGrid}>
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
                label="Order status"
                value={
                  statusLabels[
                    selectedOrder.orderStatus
                  ]
                }
              />

              <Detail
                label="Date encoded"
                value={formatDate(
                  selectedOrder.dateEncoded
                )}
              />

              <Detail
                label="Encoded by"
                value={
                  selectedOrder.encodedBy
                    ?.fullName
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
                  selectedOrder.tags ||
                  'None'
                }
              />

              <Detail
                label="Conversation link"
                value={
                  selectedOrder.conversationLink ||
                  'None'
                }
              />

              <Detail
                label="Address"
                value={
                  selectedOrder.customer
                    ?.address
                }
                fullWidth
              />

              <Detail
                label="Notes"
                value={
                  selectedOrder.notes ||
                  'None'
                }
                fullWidth
              />
            </div>

            <h3 style={styles.itemsTitle}>
              Products
            </h3>

            <div style={styles.detailsTableWrapper}>
              <table style={styles.detailsTable}>
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
                      Quantity
                    </th>

                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Unit price
                    </th>

                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Line total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.items?.map(
                    (item) => (
                      <tr key={item.id}>
                        <td
                          style={
                            styles.tableCell
                          }
                        >
                          {item.productName}
                        </td>

                        <td
                          style={
                            styles.tableCell
                          }
                        >
                          {item.quantity}
                        </td>

                        <td
                          style={
                            styles.tableCell
                          }
                        >
                          {formatCurrency(
                            item.unitPrice
                          )}
                        </td>

                        <td
                          style={
                            styles.tableCell
                          }
                        >
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

            <div style={styles.orderSummary}>
              <span>Total amount</span>

              <strong>
                {formatCurrency(
                  selectedOrder.totalAmount
                )}
              </strong>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  small = false,
}) {
  return (
    <article style={styles.summaryCard}>
      <p style={styles.summaryLabel}>
        {label}
      </p>

      <h2
        style={{
          ...styles.summaryValue,
          ...(small
            ? styles.smallSummaryValue
            : {}),
        }}
      >
        {value}
      </h2>
    </article>
  );
}

function Field({
  label,
  children,
  fullWidth = false,
}) {
  return (
    <div
      style={{
        ...styles.field,
        ...(fullWidth
          ? styles.fullWidthField
          : {}),
      }}
    >
      <label style={styles.label}>
        {label}
      </label>

      {children}
    </div>
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
  const statusStyles = {
    draft: styles.draftStatus,
    for_confirmation:
      styles.confirmationStatus,
    confirmed: styles.confirmedStatus,
    rejected: styles.rejectedStatus,
    cancelled: styles.cancelledStatus,
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(statusStyles[status] || {}),
      }}
    >
      {statusLabels[status] || status}
    </span>
  );
}

const styles = {
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    padding: '10px 14px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '11px',
    cursor: 'pointer',
  },

  draftButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: `1px solid ${colors.rose}`,
    background: colors.blush,
    color: colors.roseDeep,
    fontFamily: font.body,
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
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

  smallSummaryValue: {
    fontSize: '19px',
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    outline: 'none',
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

  customerName: {
    margin: 0,
    fontWeight: 600,
  },

  customerDetails: {
    margin: '3px 0 0',
    color: colors.mutedInk,
    fontSize: '10px',
  },

  mutedText: {
    color: colors.mutedInk,
    fontSize: '10px',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '9px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  draftStatus: {
    background: '#f1eeee',
    color: '#645b57',
  },

  confirmationStatus: {
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

  cancelledStatus: {
    background: '#f1eeee',
    color: '#795f64',
  },

  actionGroup: {
    display: 'flex',
    gap: '6px',
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

  submitButton: {
    background: colors.blush,
    color: colors.roseDeep,
  },

  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: colors.mutedInk,
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

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(43, 36, 32, 0.6)',
  },

  orderModal: {
    width: '100%',
    maxWidth: '980px',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
    boxShadow:
      '0 25px 80px rgba(0,0,0,0.22)',
  },

  detailsModal: {
    width: '100%',
    maxWidth: '850px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
  },

  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
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

  formSection: {
    marginTop: '22px',
    paddingTop: '19px',
    borderTop: `1px solid ${colors.border}`,
  },

  formSectionTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '14px',
    marginTop: '14px',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  fullWidthField: {
    gridColumn: '1 / -1',
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

  textarea: {
    width: '100%',
    minHeight: '78px',
    resize: 'vertical',
    padding: '11px 12px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    outline: 'none',
    background: '#ffffff',
    fontFamily: font.body,
    fontSize: '12px',
  },

  customerModeButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '14px',
  },

  modeButton: {
    padding: '9px 13px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.mutedInk,
    fontFamily: font.body,
    fontSize: '11px',
    cursor: 'pointer',
  },

  activeModeButton: {
    background: colors.rose,
    color: '#ffffff',
    borderColor: colors.rose,
  },

  itemsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '15px',
  },

  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '14px',
  },

  itemRow: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(220px, 2fr) minmax(90px, 0.7fr) minmax(120px, 1fr) minmax(120px, 1fr) auto',
    gap: '10px',
    alignItems: 'end',
    padding: '14px',
    borderRadius: '11px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
  },

  lineTotal: {
    display: 'flex',
    minHeight: '39px',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '3px',
  },

  lineTotalLabel: {
    color: colors.mutedInk,
    fontSize: '9px',
  },

  removeButton: {
    minHeight: '39px',
    padding: '0 10px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: '#fff0f2',
    color: '#a33b51',
    fontFamily: font.body,
    fontSize: '9px',
    cursor: 'pointer',
  },

  disabledButton: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },

  orderSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '15px',
    marginTop: '20px',
    padding: '16px',
    borderRadius: '11px',
    background: colors.blush,
    color: colors.ink,
    fontSize: '14px',
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
    flexWrap: 'wrap',
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

  itemsTitle: {
    margin: '22px 0 10px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  detailsTableWrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
  },

  detailsTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
};