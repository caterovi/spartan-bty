function createWorkflow(
  currentStage,
  previousStage,
  nextAction,
  nextResponsibleModule,
  handoffAt,
  needsAttention,
  stateLabel
) {
  return {
    currentStage,
    previousStage,
    nextAction,
    nextResponsibleModule,
    handoffAt: handoffAt || null,
    needsAttention,
    stateLabel,
  };
}

function deriveOrderWorkflow(order) {
  if (order.crmCaseId) {
    if (order.crmCaseStatus === 'closed') {
      return createWorkflow(
        'CRM',
        'Fulfillment',
        'No further action',
        null,
        order.crmCreatedAt,
        false,
        'CRM Follow-up Complete'
      );
    }

    if (order.crmCaseStatus === 'resolved') {
      return createWorkflow(
        'CRM',
        'Fulfillment',
        'Close Case',
        'CRM',
        order.crmCreatedAt,
        true,
        'CRM Case Resolved'
      );
    }

    const isUnassigned =
      !order.crmHandledBy;

    return createWorkflow(
      'CRM',
      'Fulfillment',
      isUnassigned
        ? 'Assign CRM Case'
        : `Continue After-sales Step ${
            Number(order.crmCurrentStep) || 1
          }`,
      'CRM',
      order.crmCreatedAt,
      true,
      'CRM Follow-up Active'
    );
  }

  if (order.fulfillmentStatus) {
    const fulfillmentStates = {
      pending_packing: [
        'Start Packing',
        'Awaiting Packing',
        order.fulfillmentCreatedAt,
      ],
      packing: [
        'Complete Packing',
        'Packing in Progress',
        order.packingStartedAt,
      ],
      packed: [
        'Mark Ready for Shipment',
        'Packing Complete',
        order.packedAt,
      ],
      ready_for_shipment: [
        'Ship Order',
        'Ready for Shipment',
        order.readyForShipmentAt,
      ],
      shipped_out: [
        'Confirm Delivered or Returned',
        'Shipment in Transit',
        order.shippedOutAt,
      ],
      cancelled: [
        'No further action',
        'Fulfillment Cancelled',
        order.fulfillmentUpdatedAt,
      ],
    };

    if (
      [
        'delivered',
        'returned_to_sender',
      ].includes(order.fulfillmentStatus)
    ) {
      return createWorkflow(
        'Fulfillment',
        'CDM',
        'Verify CRM Handoff',
        'Fulfillment',
        order.fulfillmentStatus ===
          'delivered'
          ? order.deliveredAt
          : order.returnedAt,
        true,
        'CRM Handoff Pending'
      );
    }

    const state =
      fulfillmentStates[
        order.fulfillmentStatus
      ] || [
        'Review Order',
        'Fulfillment Review Needed',
        order.fulfillmentUpdatedAt,
      ];

    const isCancelled =
      order.fulfillmentStatus ===
      'cancelled';

    return createWorkflow(
      'Fulfillment',
      'CDM',
      state[0],
      isCancelled ? null : 'Fulfillment',
      state[2],
      !isCancelled,
      state[1]
    );
  }

  if (order.sentToCustomerAt) {
    return createWorkflow(
      'CDM',
      'Sales',
      'Verify Fulfillment Handoff',
      'CDM',
      order.sentToCustomerAt,
      true,
      'Fulfillment Handoff Pending'
    );
  }

  if (order.orderStatus === 'confirmed') {
    const hasWaybill = Boolean(
      order.waybillNumber ||
        order.waybillLink
    );

    return createWorkflow(
      'CDM',
      'Sales',
      hasWaybill
        ? 'Send to Customer and Fulfillment'
        : 'Record Waybill',
      'CDM',
      order.confirmedAt,
      true,
      hasWaybill
        ? 'Awaiting Fulfillment Handoff'
        : 'Awaiting Waybill'
    );
  }

  if (
    order.orderStatus ===
    'for_confirmation'
  ) {
    return createWorkflow(
      'CDM',
      'Sales',
      'Confirm Order',
      'CDM',
      order.submittedAt,
      true,
      'Awaiting CDM Confirmation'
    );
  }

  if (order.orderStatus === 'rejected') {
    return createWorkflow(
      'Sales',
      'CDM',
      'Review Rejection',
      'Sales',
      order.rejectedAt,
      true,
      'Rejected by CDM'
    );
  }

  if (order.orderStatus === 'cancelled') {
    return createWorkflow(
      'Sales',
      null,
      'No further action',
      null,
      order.cancelledAt,
      false,
      'Order Cancelled'
    );
  }

  return createWorkflow(
    'Sales',
    null,
    'Submit Order',
    'Sales',
    order.createdAt,
    true,
    'Draft Order'
  );
}

module.exports = {
  deriveOrderWorkflow,
};
