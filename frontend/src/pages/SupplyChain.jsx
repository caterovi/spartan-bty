import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import api from '../api/axiosInstance';
import { colors, font } from '../styles/tokens';

const categoryLabels = {
  finished_product: 'Finished Product',
  product_box: 'Product Box',
  air_column_roll: 'Air Column Roll',
  t4_box: 'T4 Box',
  thank_you_note: 'Thank You Note',
  other: 'Other',
};

const movementLabels = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  distributed: 'Distributed',
  adjustment_in: 'Adjustment In',
  adjustment_out: 'Adjustment Out',
};

const stockStatusLabels = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

const initialSummary = {
  totalItems: 0,
  finishedProductItems: 0,
  packagingItems: 0,
  outOfStockItems: 0,
  lowStockItems: 0,
  totalMovements: 0,
  totalQuantityIn: 0,
  totalQuantityOut: 0,
  totalDistributed: 0,
};

const initialMovementForm = {
  movementType: 'stock_in',
  quantity: '',
  referenceType: '',
  referenceId: '',
  notes: '',
};

const initialQualityForm = {
  checkedQuantity: '',
  approvedQuantity: '',
  rejectedQuantity: '',
  notes: '',
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

export default function SupplyChain() {
  const currentUser = getStoredUser();

  const canWrite =
    currentUser.role === 'specialist' &&
    currentUser.departmentCode ===
      'supply_chain';

  const [items, setItems] = useState([]);
  const [summary, setSummary] =
    useState(initialSummary);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState('');
  const [stockFilter, setStockFilter] =
    useState('');
  const [itemStatusFilter, setItemStatusFilter] =
    useState('active');

  const [selectedItem, setSelectedItem] =
    useState(null);

  const [movementItem, setMovementItem] =
    useState(null);
  const [qualityItem, setQualityItem] =
    useState(null);
  const [settingsItem, setSettingsItem] =
    useState(null);

  const [movementForm, setMovementForm] =
    useState(initialMovementForm);

  const [qualityForm, setQualityForm] =
    useState(initialQualityForm);

  const [settingsForm, setSettingsForm] =
    useState({
      reorderLevel: '',
      status: 'active',
    });

  const [loading, setLoading] =
    useState(true);
  const [detailsLoading, setDetailsLoading] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] =
    useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        itemsResponse,
        summaryResponse,
      ] = await Promise.all([
        api.get('/supply-chain/items'),
        api.get('/supply-chain/summary'),
      ]);

      setItems(
        itemsResponse.data.items || []
      );

      setSummary({
        ...initialSummary,
        ...(summaryResponse.data.summary ||
          {}),
      });
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve inventory records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !keyword ||
        [
          item.itemCode,
          item.itemName,
          item.productName,
          categoryLabels[item.category],
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(keyword)
        );

      const matchesCategory =
        !categoryFilter ||
        item.category === categoryFilter;

      const matchesStock =
        !stockFilter ||
        item.stockStatus === stockFilter;

      const matchesStatus =
        !itemStatusFilter ||
        item.status === itemStatusFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStock &&
        matchesStatus
      );
    });
  }, [
    items,
    search,
    categoryFilter,
    stockFilter,
    itemStatusFilter,
  ]);

  const openItemDetails = async (
    itemId
  ) => {
    setDetailsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.get(
        `/supply-chain/items/${itemId}`
      );

      setSelectedItem(
        response.data.item
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve inventory item details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshSelectedItem = async (
    itemId
  ) => {
    if (!itemId) {
      return;
    }

    const response = await api.get(
      `/supply-chain/items/${itemId}`
    );

    setSelectedItem(
      response.data.item
    );
  };

  const refreshAfterAction = async (
    itemId
  ) => {
    await loadData();

    if (
      selectedItem &&
      Number(selectedItem.id) ===
        Number(itemId)
    ) {
      await refreshSelectedItem(itemId);
    }
  };

  const openMovementModal = (item) => {
    setError('');
    setSuccess('');

    setMovementItem(item);

    setMovementForm({
      ...initialMovementForm,
      movementType:
        item.category ===
        'thank_you_note'
          ? 'stock_in'
          : 'stock_in',
    });
  };

  const closeMovementModal = () => {
    if (submitting) {
      return;
    }

    setMovementItem(null);
    setMovementForm(
      initialMovementForm
    );
    setError('');
  };

  const openQualityModal = (item) => {
    setError('');
    setSuccess('');
    setQualityItem(item);
    setQualityForm(
      initialQualityForm
    );
  };

  const closeQualityModal = () => {
    if (submitting) {
      return;
    }

    setQualityItem(null);
    setQualityForm(
      initialQualityForm
    );
    setError('');
  };

  const openSettingsModal = (item) => {
    setError('');
    setSuccess('');
    setSettingsItem(item);

    setSettingsForm({
      reorderLevel: String(
        item.reorderLevel ?? 0
      ),
      status: item.status || 'active',
    });
  };

  const closeSettingsModal = () => {
    if (submitting) {
      return;
    }

    setSettingsItem(null);
    setError('');
  };

  const handleMovementFormChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setMovementForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleQualityFormChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setQualityForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSettingsFormChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setSettingsForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleRecordMovement = async (
    event
  ) => {
    event.preventDefault();

    if (!movementItem) {
      return;
    }

    const quantity = Number(
      movementForm.quantity
    );

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setError(
        'Quantity must be a positive whole number.'
      );
      return;
    }

    if (
      [
        'adjustment_in',
        'adjustment_out',
      ].includes(
        movementForm.movementType
      ) &&
      !movementForm.notes.trim()
    ) {
      setError(
        'Notes are required for inventory adjustments.'
      );
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post(
        `/supply-chain/items/${movementItem.id}/movements`,
        {
          movementType:
            movementForm.movementType,

          quantity,

          referenceType:
            movementForm.referenceType.trim(),

          referenceId:
            movementForm.referenceId
              ? Number(
                  movementForm.referenceId
                )
              : null,

          notes:
            movementForm.notes.trim(),
        }
      );

      setSuccess(
        response.data.message
      );

      closeMovementModal();

      await refreshAfterAction(
        movementItem.id
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to record the inventory movement.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordQualityCheck =
    async (event) => {
      event.preventDefault();

      if (!qualityItem) {
        return;
      }

      const checkedQuantity = Number(
        qualityForm.checkedQuantity
      );

      const approvedQuantity = Number(
        qualityForm.approvedQuantity
      );

      const rejectedQuantity = Number(
        qualityForm.rejectedQuantity
      );

      if (
        !Number.isInteger(
          checkedQuantity
        ) ||
        checkedQuantity <= 0
      ) {
        setError(
          'Checked quantity must be a positive whole number.'
        );
        return;
      }

      if (
        !Number.isInteger(
          approvedQuantity
        ) ||
        approvedQuantity < 0
      ) {
        setError(
          'Approved quantity must be zero or a positive whole number.'
        );
        return;
      }

      if (
        !Number.isInteger(
          rejectedQuantity
        ) ||
        rejectedQuantity < 0
      ) {
        setError(
          'Rejected quantity must be zero or a positive whole number.'
        );
        return;
      }

      if (
        approvedQuantity +
          rejectedQuantity !==
        checkedQuantity
      ) {
        setError(
          'Approved and rejected quantities must equal the checked quantity.'
        );
        return;
      }

      setSubmitting(true);
      setError('');
      setSuccess('');

      try {
        const response = await api.post(
          `/supply-chain/items/${qualityItem.id}/quality-checks`,
          {
            checkedQuantity,
            approvedQuantity,
            rejectedQuantity,
            notes:
              qualityForm.notes.trim(),
          }
        );

        setSuccess(
          response.data.message
        );

        closeQualityModal();

        await refreshAfterAction(
          qualityItem.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to record the quality check.'
        );
      } finally {
        setSubmitting(false);
      }
    };

  const handleUpdateSettings =
    async (event) => {
      event.preventDefault();

      if (!settingsItem) {
        return;
      }

      const reorderLevel = Number(
        settingsForm.reorderLevel
      );

      if (
        !Number.isInteger(
          reorderLevel
        ) ||
        reorderLevel < 0
      ) {
        setError(
          'Reorder level must be zero or a positive whole number.'
        );
        return;
      }

      setSubmitting(true);
      setError('');
      setSuccess('');

      try {
        const response = await api.patch(
          `/supply-chain/items/${settingsItem.id}/settings`,
          {
            reorderLevel,
            status:
              settingsForm.status,
          }
        );

        setSuccess(
          response.data.message
        );

        closeSettingsModal();

        await refreshAfterAction(
          settingsItem.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to update the inventory item settings.'
        );
      } finally {
        setSubmitting(false);
      }
    };

  const closeDetails = () => {
    if (submitting) {
      return;
    }

    setSelectedItem(null);
    setError('');
  };

  const qualityTotal =
    Number(
      qualityForm.approvedQuantity ||
        0
    ) +
    Number(
      qualityForm.rejectedQuantity ||
        0
    );

  return (
    <div>
      <section style={styles.pageHeader}>
        <div>
          <p style={styles.eyebrow}>
            INVENTORY AND SUPPLY CHAIN
          </p>

          <h1 style={styles.pageTitle}>
            Inventory Monitoring
          </h1>

          <p
            style={
              styles.pageDescription
            }
          >
            Monitor products, boxes,
            packing materials, quality
            results, stock movements, and
            current balances.
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
          label="TOTAL ITEMS"
          value={summary.totalItems}
        />

        <SummaryCard
          label="PRODUCT ITEMS"
          value={
            summary.finishedProductItems
          }
        />

        <SummaryCard
          label="PACKING ITEMS"
          value={
            summary.packagingItems
          }
        />

        <SummaryCard
          label="LOW STOCK"
          value={
            summary.lowStockItems
          }
          warning={
            summary.lowStockItems > 0
          }
        />

        <SummaryCard
          label="OUT OF STOCK"
          value={
            summary.outOfStockItems
          }
          danger={
            summary.outOfStockItems >
            0
          }
        />

        <SummaryCard
          label="TOTAL STOCK IN"
          value={
            summary.totalQuantityIn
          }
        />

        <SummaryCard
          label="TOTAL STOCK OUT"
          value={
            summary.totalQuantityOut
          }
        />

        <SummaryCard
          label="DISTRIBUTED NOTES"
          value={
            summary.totalDistributed
          }
        />
      </section>

      {success && (
        <div
          style={
            styles.successMessage
          }
        >
          {success}
        </div>
      )}

      {error &&
        !movementItem &&
        !qualityItem &&
        !settingsItem &&
        !selectedItem && (
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
              Inventory items
            </h2>

            <p
              style={
                styles.sectionDescription
              }
            >
              {filteredItems.length}{' '}
              item
              {filteredItems.length ===
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
              placeholder="Search inventory..."
              style={
                styles.searchInput
              }
            />

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All categories
              </option>

              {Object.entries(
                categoryLabels
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

            <select
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All stock levels
              </option>

              <option value="in_stock">
                In Stock
              </option>

              <option value="low_stock">
                Low Stock
              </option>

              <option value="out_of_stock">
                Out of Stock
              </option>
            </select>

            <select
              value={
                itemStatusFilter
              }
              onChange={(event) =>
                setItemStatusFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All item statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </div>
        </div>

        {loading ? (
          <div
            style={styles.emptyState}
          >
            Loading inventory...
          </div>
        ) : filteredItems.length ===
          0 ? (
          <div
            style={styles.emptyState}
          >
            No inventory items found.
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
                    Item
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
                    Current Balance
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Reorder Level
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Stock Status
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Stock In
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Stock Out
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Approved
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Rejected
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map(
                  (item) => (
                    <tr key={item.id}>
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
                          {item.itemName}
                        </p>

                        <p
                          style={
                            styles.secondaryText
                          }
                        >
                          {item.itemCode}
                        </p>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          categoryLabels[
                            item.category
                          ]
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <strong
                          style={
                            styles.balanceValue
                          }
                        >
                          {
                            item.currentQuantity
                          }
                        </strong>{' '}
                        {item.unit}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          item.reorderLevel
                        }{' '}
                        {item.unit}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <StockBadge
                          status={
                            item.stockStatus
                          }
                        />
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          item.totalStockIn
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          item.totalStockOut
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          item.totalApproved
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          item.totalRejected
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <div
                          style={
                            styles.actionGroup
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openItemDetails(
                                item.id
                              )
                            }
                            disabled={
                              detailsLoading
                            }
                            style={
                              styles.actionButton
                            }
                          >
                            View
                          </button>

                          {canWrite && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openMovementModal(
                                    item
                                  )
                                }
                                style={{
                                  ...styles.actionButton,
                                  ...styles.stockButton,
                                }}
                              >
                                Movement
                              </button>

                              {item.qualityCheckAllowed && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openQualityModal(
                                      item
                                    )
                                  }
                                  style={{
                                    ...styles.actionButton,
                                    ...styles.qualityButton,
                                  }}
                                >
                                  Quality
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  openSettingsModal(
                                    item
                                  )
                                }
                                style={
                                  styles.actionButton
                                }
                              >
                                Settings
                              </button>
                            </>
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

      {movementItem && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeMovementModal();
            }
          }}
        >
          <section
            style={styles.smallModal}
          >
            <ModalHeader
              eyebrow="INVENTORY MOVEMENT"
              title={
                movementItem.itemName
              }
              onClose={
                closeMovementModal
              }
              disabled={submitting}
            />

            <div
              style={
                styles.currentBalanceBox
              }
            >
              <span>
                Current balance
              </span>

              <strong>
                {
                  movementItem.currentQuantity
                }{' '}
                {movementItem.unit}
              </strong>
            </div>

            <form
              onSubmit={
                handleRecordMovement
              }
              style={styles.form}
            >
              <Field label="Movement type">
                <select
                  name="movementType"
                  value={
                    movementForm.movementType
                  }
                  onChange={
                    handleMovementFormChange
                  }
                  style={styles.input}
                  required
                >
                  <option value="stock_in">
                    Stock In
                  </option>

                  <option value="stock_out">
                    Stock Out
                  </option>

                  {movementItem.category ===
                    'thank_you_note' && (
                    <option value="distributed">
                      Distributed
                    </option>
                  )}

                  <option value="adjustment_in">
                    Adjustment In
                  </option>

                  <option value="adjustment_out">
                    Adjustment Out
                  </option>
                </select>
              </Field>

              <Field label="Quantity">
                <input
                  type="number"
                  min="1"
                  step="1"
                  name="quantity"
                  value={
                    movementForm.quantity
                  }
                  onChange={
                    handleMovementFormChange
                  }
                  placeholder="Enter quantity"
                  style={styles.input}
                  required
                />
              </Field>

              <div
                style={
                  styles.formGrid
                }
              >
                <Field label="Reference type">
                  <input
                    name="referenceType"
                    value={
                      movementForm.referenceType
                    }
                    onChange={
                      handleMovementFormChange
                    }
                    placeholder="e.g. delivery"
                    style={styles.input}
                  />
                </Field>

                <Field label="Reference ID">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    name="referenceId"
                    value={
                      movementForm.referenceId
                    }
                    onChange={
                      handleMovementFormChange
                    }
                    placeholder="Optional"
                    style={styles.input}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  name="notes"
                  value={
                    movementForm.notes
                  }
                  onChange={
                    handleMovementFormChange
                  }
                  placeholder={
                    movementForm.movementType.includes(
                      'adjustment'
                    )
                      ? 'Required adjustment reason'
                      : 'Optional notes'
                  }
                  style={
                    styles.textarea
                  }
                />
              </Field>

              {error && (
                <div
                  style={
                    styles.errorMessage
                  }
                >
                  {error}
                </div>
              )}

              <div
                style={
                  styles.modalActions
                }
              >
                <button
                  type="button"
                  onClick={
                    closeMovementModal
                  }
                  disabled={submitting}
                  style={
                    styles.secondaryButton
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={
                    styles.primaryButton
                  }
                >
                  {submitting
                    ? 'Recording...'
                    : 'Record movement'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {qualityItem && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeQualityModal();
            }
          }}
        >
          <section
            style={styles.smallModal}
          >
            <ModalHeader
              eyebrow="QUALITY CHECK"
              title={
                qualityItem.itemName
              }
              onClose={
                closeQualityModal
              }
              disabled={submitting}
            />

            <div
              style={
                styles.qualityNotice
              }
            >
              Only the approved quantity
              will be added to the current
              inventory balance. Rejected
              quantities will be recorded
              separately.
            </div>

            <form
              onSubmit={
                handleRecordQualityCheck
              }
              style={styles.form}
            >
              <Field label="Checked quantity">
                <input
                  type="number"
                  min="1"
                  step="1"
                  name="checkedQuantity"
                  value={
                    qualityForm.checkedQuantity
                  }
                  onChange={
                    handleQualityFormChange
                  }
                  style={styles.input}
                  required
                />
              </Field>

              <div
                style={
                  styles.formGrid
                }
              >
                <Field label="Approved quantity">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="approvedQuantity"
                    value={
                      qualityForm.approvedQuantity
                    }
                    onChange={
                      handleQualityFormChange
                    }
                    style={styles.input}
                    required
                  />
                </Field>

                <Field label="Rejected quantity">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="rejectedQuantity"
                    value={
                      qualityForm.rejectedQuantity
                    }
                    onChange={
                      handleQualityFormChange
                    }
                    style={styles.input}
                    required
                  />
                </Field>
              </div>

              <div
                style={
                  styles.qualityTotal
                }
              >
                <span>
                  Approved + Rejected
                </span>

                <strong>
                  {qualityTotal}
                </strong>
              </div>

              <Field label="Quality-check notes">
                <textarea
                  name="notes"
                  value={
                    qualityForm.notes
                  }
                  onChange={
                    handleQualityFormChange
                  }
                  placeholder="Optional findings or remarks"
                  style={
                    styles.textarea
                  }
                />
              </Field>

              {error && (
                <div
                  style={
                    styles.errorMessage
                  }
                >
                  {error}
                </div>
              )}

              <div
                style={
                  styles.modalActions
                }
              >
                <button
                  type="button"
                  onClick={
                    closeQualityModal
                  }
                  disabled={submitting}
                  style={
                    styles.secondaryButton
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={
                    styles.primaryButton
                  }
                >
                  {submitting
                    ? 'Recording...'
                    : 'Record quality check'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {settingsItem && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeSettingsModal();
            }
          }}
        >
          <section
            style={styles.smallModal}
          >
            <ModalHeader
              eyebrow="ITEM SETTINGS"
              title={
                settingsItem.itemName
              }
              onClose={
                closeSettingsModal
              }
              disabled={submitting}
            />

            <form
              onSubmit={
                handleUpdateSettings
              }
              style={styles.form}
            >
              <Field label="Reorder level">
                <input
                  type="number"
                  min="0"
                  step="1"
                  name="reorderLevel"
                  value={
                    settingsForm.reorderLevel
                  }
                  onChange={
                    handleSettingsFormChange
                  }
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Item status">
                <select
                  name="status"
                  value={
                    settingsForm.status
                  }
                  onChange={
                    handleSettingsFormChange
                  }
                  style={styles.input}
                  required
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </Field>

              <p
                style={
                  styles.helperText
                }
              >
                A low-stock warning appears
                when the current balance is
                equal to or below the reorder
                level.
              </p>

              {error && (
                <div
                  style={
                    styles.errorMessage
                  }
                >
                  {error}
                </div>
              )}

              <div
                style={
                  styles.modalActions
                }
              >
                <button
                  type="button"
                  onClick={
                    closeSettingsModal
                  }
                  disabled={submitting}
                  style={
                    styles.secondaryButton
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={
                    styles.primaryButton
                  }
                >
                  {submitting
                    ? 'Saving...'
                    : 'Save settings'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedItem && (
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
            <ModalHeader
              eyebrow="INVENTORY DETAILS"
              title={
                selectedItem.itemName
              }
              onClose={closeDetails}
              disabled={submitting}
            />

            <div
              style={
                styles.detailGrid
              }
            >
              <Detail
                label="Item code"
                value={
                  selectedItem.itemCode
                }
              />

              <Detail
                label="Category"
                value={
                  categoryLabels[
                    selectedItem.category
                  ]
                }
              />

              <Detail
                label="Current balance"
                value={`${selectedItem.currentQuantity} ${selectedItem.unit}`}
              />

              <Detail
                label="Reorder level"
                value={`${selectedItem.reorderLevel} ${selectedItem.unit}`}
              />

              <Detail
                label="Stock status"
                value={
                  stockStatusLabels[
                    selectedItem.stockStatus
                  ]
                }
              />

              <Detail
                label="Item status"
                value={
                  selectedItem.status
                }
              />

              <Detail
                label="Total stock in"
                value={
                  selectedItem.totalStockIn
                }
              />

              <Detail
                label="Total stock out"
                value={
                  selectedItem.totalStockOut
                }
              />

              <Detail
                label="Total distributed"
                value={
                  selectedItem.totalDistributed
                }
              />

              <Detail
                label="Approved quantity"
                value={
                  selectedItem.totalApproved
                }
              />

              <Detail
                label="Rejected quantity"
                value={
                  selectedItem.totalRejected
                }
              />

              <Detail
                label="Last updated"
                value={formatDate(
                  selectedItem.updatedAt
                )}
              />
            </div>

            <div
              style={
                styles.detailsSection
              }
            >
              <h3
                style={
                  styles.subsectionTitle
                }
              >
                Movement history
              </h3>

              {!selectedItem.movements ||
              selectedItem.movements
                .length === 0 ? (
                <div
                  style={
                    styles.innerEmptyState
                  }
                >
                  No movement records.
                </div>
              ) : (
                <div
                  style={
                    styles.historyWrapper
                  }
                >
                  <table
                    style={
                      styles.historyTable
                    }
                  >
                    <thead>
                      <tr>
                        <th
                          style={
                            styles.tableHeading
                          }
                        >
                          Movement
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
                          Balance
                        </th>

                        <th
                          style={
                            styles.tableHeading
                          }
                        >
                          Recorded By
                        </th>

                        <th
                          style={
                            styles.tableHeading
                          }
                        >
                          Notes
                        </th>

                        <th
                          style={
                            styles.tableHeading
                          }
                        >
                          Date
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedItem.movements.map(
                        (movement) => (
                          <tr
                            key={
                              movement.id
                            }
                          >
                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {
                                movementLabels[
                                  movement
                                    .movementType
                                ]
                              }
                            </td>

                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {
                                movement.quantity
                              }
                            </td>

                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {
                                movement.balanceBefore
                              }{' '}
                              →{' '}
                              {
                                movement.balanceAfter
                              }
                            </td>

                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {
                                movement
                                  .recordedBy
                                  ?.fullName
                              }
                            </td>

                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {movement.notes ||
                                'None'}
                            </td>

                            <td
                              style={
                                styles.tableCell
                              }
                            >
                              {formatDate(
                                movement.createdAt
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedItem.qualityCheckAllowed && (
              <div
                style={
                  styles.detailsSection
                }
              >
                <h3
                  style={
                    styles.subsectionTitle
                  }
                >
                  Quality-check history
                </h3>

                {!selectedItem.qualityChecks ||
                selectedItem
                  .qualityChecks.length ===
                  0 ? (
                  <div
                    style={
                      styles.innerEmptyState
                    }
                  >
                    No quality-check
                    records.
                  </div>
                ) : (
                  <div
                    style={
                      styles.historyWrapper
                    }
                  >
                    <table
                      style={
                        styles.historyTable
                      }
                    >
                      <thead>
                        <tr>
                          <th
                            style={
                              styles.tableHeading
                            }
                          >
                            Checked
                          </th>

                          <th
                            style={
                              styles.tableHeading
                            }
                          >
                            Approved
                          </th>

                          <th
                            style={
                              styles.tableHeading
                            }
                          >
                            Rejected
                          </th>

                          <th
                            style={
                              styles.tableHeading
                            }
                          >
                            Checked By
                          </th>

                          <th
                            style={
                              styles.tableHeading
                            }
                          >
                            Notes
                          </th>

                          <th
                            style={
                              styles.tableHeading
                            }
                          >
                            Date
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedItem.qualityChecks.map(
                          (check) => (
                            <tr
                              key={
                                check.id
                              }
                            >
                              <td
                                style={
                                  styles.tableCell
                                }
                              >
                                {
                                  check.checkedQuantity
                                }
                              </td>

                              <td
                                style={
                                  styles.tableCell
                                }
                              >
                                <span
                                  style={
                                    styles.approvedText
                                  }
                                >
                                  {
                                    check.approvedQuantity
                                  }
                                </span>
                              </td>

                              <td
                                style={
                                  styles.tableCell
                                }
                              >
                                <span
                                  style={
                                    styles.rejectedText
                                  }
                                >
                                  {
                                    check.rejectedQuantity
                                  }
                                </span>
                              </td>

                              <td
                                style={
                                  styles.tableCell
                                }
                              >
                                {
                                  check.checkedBy
                                    ?.fullName
                                }
                              </td>

                              <td
                                style={
                                  styles.tableCell
                                }
                              >
                                {check.notes ||
                                  'None'}
                              </td>

                              <td
                                style={
                                  styles.tableCell
                                }
                              >
                                {formatDate(
                                  check.checkedAt
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
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

function ModalHeader({
  eyebrow,
  title,
  onClose,
  disabled,
}) {
  return (
    <div
      style={styles.modalHeader}
    >
      <div>
        <p style={styles.eyebrow}>
          {eyebrow}
        </p>

        <h2
          style={styles.modalTitle}
        >
          {title}
        </h2>
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        style={styles.closeButton}
      >
        ×
      </button>
    </div>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div
      style={styles.detailItem}
    >
      <span
        style={styles.detailLabel}
      >
        {label}
      </span>

      <strong
        style={styles.detailValue}
      >
        {value ?? 'Not available'}
      </strong>
    </div>
  );
}

function StockBadge({ status }) {
  const statusStyles = {
    in_stock: styles.inStockBadge,
    low_stock:
      styles.lowStockBadge,
    out_of_stock:
      styles.outOfStockBadge,
  };

  return (
    <span
      style={{
        ...styles.stockBadge,
        ...(statusStyles[status] ||
          {}),
      }}
    >
      {stockStatusLabels[status] ||
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
    alignItems: 'center',
    justifyContent:
      'space-between',
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
    gap: '9px',
    flexWrap: 'wrap',
  },

  searchInput: {
    width: '210px',
    padding: '10px 12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    outline: 'none',
    fontFamily: font.body,
    fontSize: '11px',
  },

  filterSelect: {
    padding: '10px 11px',
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
    minWidth: '1250px',
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
    fontSize: '9px',
  },

  balanceValue: {
    fontSize: '14px',
  },

  stockBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '9px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  inStockBadge: {
    background: '#e8f7ee',
    color: '#287447',
  },

  lowStockBadge: {
    background: '#fff5d9',
    color: '#725b1e',
  },

  outOfStockBadge: {
    background: '#fff0f2',
    color: '#a33b51',
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

  stockButton: {
    background: colors.blush,
    color: colors.roseDeep,
  },

  qualityButton: {
    background: '#e9f7ee',
    color: '#287447',
  },

  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: colors.mutedInk,
    fontSize: '12px',
  },

  innerEmptyState: {
    padding: '25px',
    textAlign: 'center',
    color: colors.mutedInk,
    fontSize: '11px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background:
      'rgba(43, 36, 32, 0.6)',
  },

  smallModal: {
    width: '100%',
    maxWidth: '570px',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: colors.cream,
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
    fontSize: '24px',
    fontWeight: 500,
  },

  closeButton: {
    border: 'none',
    background: 'transparent',
    color: colors.mutedInk,
    fontSize: '27px',
    cursor: 'pointer',
  },

  currentBalanceBox: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginTop: '18px',
    padding: '14px',
    borderRadius: '10px',
    background: colors.blush,
    color: colors.ink,
    fontSize: '12px',
  },

  qualityNotice: {
    marginTop: '18px',
    padding: '12px 14px',
    borderRadius: '9px',
    background: '#fff5d9',
    border: '1px solid #ecd89e',
    color: '#725b1e',
    fontSize: '10px',
    lineHeight: 1.55,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '20px',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '13px',
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

  qualityTotal: {
    display: 'flex',
    justifyContent:
      'space-between',
    padding: '12px 14px',
    borderRadius: '9px',
    background: colors.blush,
    color: colors.ink,
    fontSize: '11px',
  },

  helperText: {
    margin: 0,
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.55,
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '4px',
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

  detailGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',
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
    fontSize: '12px',
    lineHeight: 1.5,
    textTransform: 'capitalize',
  },

  detailsSection: {
    marginTop: '24px',
  },

  subsectionTitle: {
    margin: '0 0 10px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  historyWrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
  },

  historyTable: {
    width: '100%',
    minWidth: '800px',
    borderCollapse: 'collapse',
  },

  approvedText: {
    color: '#287447',
    fontWeight: 600,
  },

  rejectedText: {
    color: '#a33b51',
    fontWeight: 600,
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