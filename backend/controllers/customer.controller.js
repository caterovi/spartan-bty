const pool = require('../config/db');

function cleanText(value) {
  return String(value || '').trim();
}

function mapCustomer(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    contactNumber: row.contact_number,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/customers/search?q=
exports.searchCustomers = async (req, res) => {
  try {
    const query = cleanText(req.query.q).slice(0, 100);
    const keyword = `%${query}%`;

    const [rows] = await pool.execute(
      `
        SELECT
          c.id,
          c.full_name,
          c.contact_number,
          c.address,
          c.created_at,
          c.updated_at,
          COUNT(o.id) AS order_count,
          MAX(o.date_encoded) AS latest_order_at
        FROM customers c
        LEFT JOIN orders o
          ON o.customer_id = c.id
        WHERE (
          ? = ''
          OR c.full_name LIKE ?
          OR c.contact_number LIKE ?
        )
        GROUP BY
          c.id,
          c.full_name,
          c.contact_number,
          c.address,
          c.created_at,
          c.updated_at
        ORDER BY
          CASE WHEN ? = '' THEN c.updated_at END DESC,
          c.full_name ASC
        LIMIT 20
      `,
      [query, keyword, keyword, query]
    );

    return res.json({
      success: true,
      customers: rows.map((row) => ({
        ...mapCustomer(row),
        orderCount: Number(row.order_count || 0),
        latestOrderAt: row.latest_order_at,
      })),
    });
  } catch (error) {
    console.error('Customer search error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to search customers.',
    });
  }
};

// GET /api/customers/:id/360
exports.getCustomer360 = async (req, res) => {
  try {
    const customerId = Number(req.params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid customer ID is required.',
      });
    }

    const [customerRows] = await pool.execute(
      `
        SELECT
          id,
          full_name,
          contact_number,
          address,
          created_at,
          updated_at
        FROM customers
        WHERE id = ?
        LIMIT 1
      `,
      [customerId]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.',
      });
    }

    const [orderResult, itemResult, caseResult, stepResult] =
      await Promise.all([
        pool.execute(
          `
            SELECT
              o.id,
              o.order_number,
              o.total_amount,
              o.order_status,
              o.date_encoded,
              o.submitted_at,
              o.confirmed_at AS order_confirmed_at,
              o.rejected_at AS order_rejected_at,
              o.cancelled_at,

              cp.confirmation_status,
              cp.waybill_number,
              cp.waybill_link,
              cp.confirmed_at AS cdm_confirmed_at,
              cp.rejected_at AS cdm_rejected_at,
              cp.waybill_generated_at,
              cp.sent_to_customer_at,

              fo.fulfillment_status,
              fo.third_party_logistics,
              fo.tracking_number,
              fo.return_reason,
              fo.packing_started_at,
              fo.packed_at,
              fo.ready_for_shipment_at,
              fo.shipped_out_at,
              fo.delivered_at,
              fo.returned_at
            FROM orders o
            LEFT JOIN cdm_order_processing cp
              ON cp.order_id = o.id
            LEFT JOIN fulfillment_orders fo
              ON fo.order_id = o.id
            WHERE o.customer_id = ?
            ORDER BY o.date_encoded DESC, o.id DESC
          `,
          [customerId]
        ),
        pool.execute(
          `
            SELECT
              oi.order_id,
              oi.product_id,
              oi.quantity,
              oi.unit_price,
              oi.line_total,
              p.sku,
              p.product_name
            FROM order_items oi
            INNER JOIN products p
              ON p.id = oi.product_id
            INNER JOIN orders o
              ON o.id = oi.order_id
            WHERE o.customer_id = ?
            ORDER BY oi.order_id DESC, p.product_name ASC
          `,
          [customerId]
        ),
        pool.execute(
          `
            SELECT
              cc.id,
              cc.order_id,
              o.order_number,
              cc.case_status,
              cc.current_step,
              cc.delivery_confirmation,
              cc.concern_category,
              cc.concern_details,
              cc.next_follow_up_at,
              cc.first_contacted_at,
              cc.resolution_notes,
              cc.resolved_at,
              cc.closed_at,
              cc.created_at,
              u.id AS assigned_user_id,
              u.full_name AS assigned_user_name,
              cf.satisfaction_rating,
              cf.feedback,
              cf.would_repurchase,
              cf.submitted_at AS feedback_submitted_at,
              CASE
                WHEN cc.case_status IN ('resolved', 'closed')
                THEN 'complete'
                WHEN cc.handled_by IS NULL
                THEN 'unassigned'
                WHEN NOT EXISTS (
                  SELECT 1
                  FROM crm_after_sales_steps unfinished
                  WHERE unfinished.crm_case_id = cc.id
                    AND unfinished.step_status NOT IN (
                      'completed',
                      'skipped'
                    )
                )
                THEN 'follow_up_complete'
                WHEN cc.next_follow_up_at IS NULL
                THEN 'unscheduled'
                WHEN cc.next_follow_up_at < NOW()
                THEN 'overdue'
                WHEN DATE(cc.next_follow_up_at) = CURRENT_DATE()
                THEN 'due_today'
                ELSE 'upcoming'
              END AS follow_up_status,
              CASE
                WHEN cc.next_follow_up_at < NOW()
                THEN GREATEST(
                  DATEDIFF(
                    CURRENT_DATE(),
                    DATE(cc.next_follow_up_at)
                  ),
                  0
                )
                ELSE 0
              END AS overdue_days
            FROM crm_cases cc
            INNER JOIN orders o
              ON o.id = cc.order_id
            LEFT JOIN users u
              ON u.id = cc.handled_by
            LEFT JOIN crm_feedback cf
              ON cf.crm_case_id = cc.id
            WHERE o.customer_id = ?
            ORDER BY cc.created_at DESC, cc.id DESC
          `,
          [customerId]
        ),
        pool.execute(
          `
            SELECT
              s.id,
              s.crm_case_id,
              s.step_number,
              s.step_status,
              s.customer_feedback,
              s.crm_response,
              s.follow_up_at,
              s.started_at,
              s.completed_at,
              u.id AS handled_by_id,
              u.full_name AS handled_by_name
            FROM crm_after_sales_steps s
            INNER JOIN crm_cases cc
              ON cc.id = s.crm_case_id
            INNER JOIN orders o
              ON o.id = cc.order_id
            LEFT JOIN users u
              ON u.id = s.handled_by
            WHERE o.customer_id = ?
            ORDER BY s.crm_case_id DESC, s.step_number ASC
          `,
          [customerId]
        ),
      ]);

    const [orderRows] = orderResult;
    const [itemRows] = itemResult;
    const [caseRows] = caseResult;
    const [stepRows] = stepResult;

    const itemsByOrder = new Map();

    for (const item of itemRows) {
      const items = itemsByOrder.get(item.order_id) || [];
      items.push({
        productId: item.product_id,
        sku: item.sku,
        productName: item.product_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      });
      itemsByOrder.set(item.order_id, items);
    }

    const stepsByCase = new Map();

    for (const step of stepRows) {
      const steps = stepsByCase.get(step.crm_case_id) || [];
      steps.push({
        id: step.id,
        stepNumber: Number(step.step_number),
        stepStatus: step.step_status,
        customerFeedback: step.customer_feedback,
        crmResponse: step.crm_response,
        followUpAt: step.follow_up_at,
        startedAt: step.started_at,
        completedAt: step.completed_at,
        handledBy: step.handled_by_id
          ? {
              id: step.handled_by_id,
              fullName: step.handled_by_name || 'Former user',
            }
          : null,
      });
      stepsByCase.set(step.crm_case_id, steps);
    }

    const orders = orderRows.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      totalAmount: Number(order.total_amount),
      orderStatus: order.order_status,
      dateEncoded: order.date_encoded,
      submittedAt: order.submitted_at,
      confirmedAt: order.order_confirmed_at,
      rejectedAt: order.order_rejected_at,
      cancelledAt: order.cancelled_at,
      items: itemsByOrder.get(order.id) || [],
      cdm: order.confirmation_status
        ? {
            confirmationStatus: order.confirmation_status,
            waybillNumber: order.waybill_number,
            waybillLink: order.waybill_link,
            confirmedAt: order.cdm_confirmed_at,
            rejectedAt: order.cdm_rejected_at,
            waybillGeneratedAt: order.waybill_generated_at,
            sentToCustomerAt: order.sent_to_customer_at,
          }
        : null,
      fulfillment: order.fulfillment_status
        ? {
            status: order.fulfillment_status,
            thirdPartyLogistics: order.third_party_logistics,
            trackingNumber: order.tracking_number,
            returnReason: order.return_reason,
            packingStartedAt: order.packing_started_at,
            packedAt: order.packed_at,
            readyForShipmentAt: order.ready_for_shipment_at,
            shippedOutAt: order.shipped_out_at,
            deliveredAt: order.delivered_at,
            returnedAt: order.returned_at,
          }
        : null,
    }));

    const crmCases = caseRows.map((crmCase) => ({
      id: crmCase.id,
      orderId: crmCase.order_id,
      orderNumber: crmCase.order_number,
      caseStatus: crmCase.case_status,
      currentStep: Number(crmCase.current_step),
      deliveryConfirmation: crmCase.delivery_confirmation,
      concernCategory: crmCase.concern_category,
      concernDetails: crmCase.concern_details,
      nextFollowUpAt: crmCase.next_follow_up_at,
      firstContactedAt: crmCase.first_contacted_at,
      resolutionNotes: crmCase.resolution_notes,
      resolvedAt: crmCase.resolved_at,
      closedAt: crmCase.closed_at,
      createdAt: crmCase.created_at,
      assignedUser: crmCase.assigned_user_id
        ? {
            id: crmCase.assigned_user_id,
            fullName: crmCase.assigned_user_name || 'Former user',
          }
        : null,
      satisfactionRating:
        crmCase.satisfaction_rating === null
          ? null
          : Number(crmCase.satisfaction_rating),
      finalFeedback: crmCase.feedback,
      wouldRepurchase: crmCase.would_repurchase,
      feedbackSubmittedAt: crmCase.feedback_submitted_at,
      followUpStatus: crmCase.follow_up_status,
      overdueDays: Number(crmCase.overdue_days || 0),
      steps: stepsByCase.get(crmCase.id) || [],
    }));

    const confirmedOrders = orders.filter(
      (order) => order.orderStatus === 'confirmed'
    );
    const ratings = crmCases
      .map((crmCase) => crmCase.satisfactionRating)
      .filter((rating) => rating !== null);

    return res.json({
      success: true,
      customer: mapCustomer(customerRows[0]),
      summary: {
        totalOrders: orders.length,
        confirmedOrders: confirmedOrders.length,
        totalConfirmedAmount: confirmedOrders.reduce(
          (total, order) => total + order.totalAmount,
          0
        ),
        deliveredOrders: orders.filter(
          (order) => order.fulfillment?.status === 'delivered'
        ).length,
        returnedOrders: orders.filter(
          (order) =>
            order.fulfillment?.status === 'returned_to_sender'
        ).length,
        crmCases: crmCases.length,
        latestOrderAt: orders[0]?.dateEncoded || null,
        averageRating:
          ratings.length > 0
            ? ratings.reduce((total, rating) => total + rating, 0) /
              ratings.length
            : null,
      },
      orders,
      crmCases,
    });
  } catch (error) {
    console.error('Get Customer 360 error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve Customer 360.',
    });
  }
};
