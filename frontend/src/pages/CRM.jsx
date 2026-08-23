import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import api from '../api/axiosInstance';
import Customer360Modal from '../components/Customer360Modal';
import {
  colors,
  font,
} from '../styles/tokens';

const caseStatusLabels = {
  pending_follow_up: 'Pending Follow-up',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  awaiting_customer: 'Awaiting Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const stepStatusLabels = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

const deliveryLabels = {
  pending: 'Pending Confirmation',
  received: 'Received',
  not_received: 'Not Received',
  returned: 'Returned',
};

const concernLabels = {
  none: 'No Concern',
  product_issue: 'Product Issue',
  delivery_issue: 'Delivery Issue',
  wrong_item: 'Wrong Item',
  damaged_item: 'Damaged Item',
  missing_item: 'Missing Item',
  payment_issue: 'Payment Issue',
  other: 'Other',
};

const satisfactionLabels = {
  very_dissatisfied: 'Very Dissatisfied',
  dissatisfied: 'Dissatisfied',
  neutral: 'Neutral',
  satisfied: 'Satisfied',
  very_satisfied: 'Very Satisfied',
};

const initialSummary = {
  totalCases: 0,
  unassigned: 0,
  assigned: 0,
  inProgress: 0,
  resolved: 0,
  closed: 0,
  received: 0,
  returned: 0,
  activeSteps: 0,
  completedSteps: 0,
  overdueSteps: 0,
  feedbackCount: 0,
  averageRating: null,
};

const initialConcernForm = {
  deliveryConfirmation: 'pending',
  concernCategory: 'none',
  concernDetails: '',
};

const initialSatisfactionForm = {
  satisfactionRating: '',
  finalFeedback: '',
  wouldRepurchase: 'undecided',
};

function createEmptyStepForm() {
  return {
    customerFeedback: '',
    crmResponse: '',
    followUpAt: '',
    nextFollowUpAt: '',
  };
}

function createInitialStepForms() {
  return {
    1: createEmptyStepForm(),
    2: createEmptyStepForm(),
    3: createEmptyStepForm(),
    4: createEmptyStepForm(),
  };
}

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

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toDateTimeLocal(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset =
    date.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 16);
}

function isStepFinished(step) {
  return [
    'completed',
    'skipped',
  ].includes(step?.stepStatus);
}

function isStepOverdue(step) {
  if (
    !step?.followUpAt ||
    isStepFinished(step)
  ) {
    return false;
  }

  const date = new Date(
    step.followUpAt
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() <= Date.now()
  );
}

function getFollowUpReminder(crmCase) {
  const status =
    crmCase?.followUpStatus ||
    'unscheduled';

  if (status === 'unassigned') {
    return {
      label: 'Awaiting CRM assignment',
      tone: 'warning',
    };
  }

  if (status === 'follow_up_complete') {
    return {
      label: 'All four follow-ups complete',
      tone: 'success',
    };
  }

  if (status === 'complete') {
    return {
      label: 'Follow-up processing complete',
      tone: 'success',
    };
  }

  if (status === 'due_today') {
    return {
      label: `Due today · ${formatDate(
        crmCase.nextFollowUpAt
      )}`,
      tone: 'warning',
    };
  }

  if (status === 'overdue') {
    const days = Number(
      crmCase.overdueDays || 0
    );

    return {
      label:
        days > 0
          ? `Overdue by ${days} day${
              days === 1 ? '' : 's'
            }`
          : 'Follow-up overdue',
      tone: 'danger',
    };
  }

  if (status === 'upcoming') {
    return {
      label: `Next follow-up: ${formatDate(
        crmCase.nextFollowUpAt
      )}`,
      tone: 'normal',
    };
  }

  return {
    label: 'No follow-up scheduled',
    tone: 'muted',
  };
}

function getCurrentUserId(user) {
  return Number(
    user?.id ||
    user?.userId ||
    0
  );
}

export default function CRM() {
  const currentUser =
    getStoredUser();

  const currentUserId =
    getCurrentUserId(currentUser);

  const canWrite =
    currentUser.role ===
      'specialist' &&
    currentUser.departmentCode ===
      'crm';

  const [cases, setCases] =
    useState([]);

  const [crmUsers, setCrmUsers] =
    useState([]);

  const [summary, setSummary] =
    useState(initialSummary);

  const [
    selectedCase,
    setSelectedCase,
  ] = useState(null);
  const [customer360Id, setCustomer360Id] = useState(null);

  const [
    assignedUserId,
    setAssignedUserId,
  ] = useState('');

  const [
    concernForm,
    setConcernForm,
  ] = useState(
    initialConcernForm
  );

  const [
    stepForms,
    setStepForms,
  ] = useState(
    createInitialStepForms
  );

  const [
    satisfactionForm,
    setSatisfactionForm,
  ] = useState(
    initialSatisfactionForm
  );

  const [
    resolutionNotes,
    setResolutionNotes,
  ] = useState('');

  const [search, setSearch] =
    useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('');

  const [
    assignmentFilter,
    setAssignmentFilter,
  ] = useState('');

  const [
    currentStepFilter,
    setCurrentStepFilter,
  ] = useState('');

  const [dueOnly, setDueOnly] =
    useState(false);

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
        caseResponse,
        summaryResponse,
        userResponse,
      ] = await Promise.all([
        api.get('/crm/cases'),
        api.get('/crm/summary'),
        api.get('/crm/users'),
      ]);

      setCases(
        caseResponse.data.cases || []
      );

      setSummary({
        ...initialSummary,
        ...(summaryResponse.data
          .summary || {}),
      });

      setCrmUsers(
        userResponse.data.users || []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve CRM records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial remote-data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const filteredCases =
    useMemo(() => {
      const keyword = search
        .trim()
        .toLowerCase();

      return cases.filter(
        (crmCase) => {
          const searchableValues = [
            crmCase.orderNumber,
            crmCase.customer?.fullName,
            crmCase.customer
              ?.contactNumber,
            crmCase.assignedUser
              ?.fullName,
            crmCase.concernDetails,
            crmCase.trackingNumber,
            caseStatusLabels[
              crmCase.caseStatus
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

          const matchesStatus =
            !statusFilter ||
            crmCase.caseStatus ===
              statusFilter;

          const matchesAssignment =
            !assignmentFilter ||
            (assignmentFilter ===
              'assigned' &&
              crmCase.assignedUser) ||
            (assignmentFilter ===
              'unassigned' &&
              !crmCase.assignedUser) ||
            (assignmentFilter ===
              'mine' &&
              Number(
                crmCase.assignedUser?.id
              ) === currentUserId);

          const matchesStep =
            !currentStepFilter ||
            Number(
              crmCase.currentStep
            ) ===
              Number(
                currentStepFilter
              );

          const matchesDue =
            !dueOnly ||
            crmCase.followUpStatus ===
              'overdue';

          return (
            matchesSearch &&
            matchesStatus &&
            matchesAssignment &&
            matchesStep &&
            matchesDue
          );
        }
      );
    }, [
      cases,
      search,
      statusFilter,
      assignmentFilter,
      currentStepFilter,
      dueOnly,
      currentUserId,
    ]);

  const hydrateForms = (
    crmCase
  ) => {
    setAssignedUserId(
      crmCase.assignedUser?.id
        ? String(
            crmCase.assignedUser.id
          )
        : ''
    );

    setConcernForm({
      deliveryConfirmation:
        crmCase.deliveryConfirmation ||
        'pending',

      concernCategory:
        crmCase.concernCategory ||
        'none',

      concernDetails:
        crmCase.concernDetails || '',
    });

    const nextStepForms =
      createInitialStepForms();

    for (
      let stepNumber = 1;
      stepNumber <= 4;
      stepNumber += 1
    ) {
      const step =
        crmCase.steps?.find(
          (record) =>
            Number(
              record.stepNumber
            ) === stepNumber
        );

      nextStepForms[stepNumber] = {
        customerFeedback:
          step?.customerFeedback ||
          '',

        crmResponse:
          step?.crmResponse || '',

        followUpAt:
          toDateTimeLocal(
            step?.followUpAt
          ),

        nextFollowUpAt:
          toDateTimeLocal(
            crmCase.steps?.find(
              (record) =>
                Number(
                  record.stepNumber
                ) === stepNumber + 1
            )?.followUpAt
          ),
      };
    }

    setStepForms(nextStepForms);

    setSatisfactionForm({
      satisfactionRating:
        crmCase.satisfactionRating
          ? String(
              crmCase.satisfactionRating
            )
          : '',

      finalFeedback:
        crmCase.finalFeedback || '',

      wouldRepurchase:
        crmCase.wouldRepurchase ||
        'undecided',
    });

    setResolutionNotes(
      crmCase.resolutionNotes || ''
    );
  };

  const openCase = async (
    caseId
  ) => {
    setDetailsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.get(
        `/crm/cases/${caseId}`
      );

      const crmCase =
        response.data.case;

      setSelectedCase(crmCase);
      hydrateForms(crmCase);
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve CRM case details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshSelectedCase =
    async (caseId) => {
      const response = await api.get(
        `/crm/cases/${caseId}`
      );

      const crmCase =
        response.data.case;

      setSelectedCase(crmCase);
      hydrateForms(crmCase);
    };

  const refreshAfterAction =
    async (caseId) => {
      await loadData();
      await refreshSelectedCase(caseId);
    };

  const handleAssignCase =
    async () => {
      if (!selectedCase) {
        return;
      }

      const numericUserId =
        Number(assignedUserId);

      if (
        !Number.isInteger(
          numericUserId
        ) ||
        numericUserId <= 0
      ) {
        setError(
          'Select a CRM user to assign.'
        );
        return;
      }

      const selectedUser =
        crmUsers.find(
          (user) =>
            Number(user.id) ===
            numericUserId
        );

      const confirmed =
        window.confirm(
          `Assign this case to ${
            selectedUser?.fullName ||
            'the selected CRM user'
          }?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('assign');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/crm/cases/${selectedCase.id}/assign`,
            {
              assignedUserId:
                numericUserId,
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedCase.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to assign the CRM case.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleConcernChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setConcernForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  };

  const handleSaveConcern =
    async (event) => {
      event.preventDefault();

      if (!selectedCase) {
        return;
      }

      if (
        concernForm.concernCategory !==
          'none' &&
        !concernForm.concernDetails.trim()
      ) {
        setError(
          'Enter the concern details.'
        );
        return;
      }

      setActionLoading('concern');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/crm/cases/${selectedCase.id}/concern`,
            {
              deliveryConfirmation:
                concernForm
                  .deliveryConfirmation,

              concernCategory:
                concernForm
                  .concernCategory,

              concernDetails:
                concernForm
                  .concernDetails
                  .trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedCase.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to update the customer concern.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleStepFieldChange = (
    stepNumber,
    field,
    value
  ) => {
    setStepForms(
      (current) => ({
        ...current,

        [stepNumber]: {
          ...current[stepNumber],
          [field]: value,
        },
      })
    );
  };

  const handleStepAction =
    async (
      stepNumber,
      stepStatus
    ) => {
      if (!selectedCase) {
        return;
      }

      const form =
        stepForms[stepNumber];

      if (
        stepStatus ===
          'completed' &&
        (
          !form.customerFeedback.trim() ||
          !form.crmResponse.trim()
        )
      ) {
        setError(
          `Customer feedback and CRM response are required to complete Step ${stepNumber}.`
        );
        return;
      }

      if (
        stepStatus === 'skipped' &&
        !form.crmResponse.trim()
      ) {
        setError(
          `Enter the reason for skipping Step ${stepNumber} in the CRM response.`
        );
        return;
      }

      if (
        ['completed', 'skipped'].includes(
          stepStatus
        ) &&
        stepNumber < 4 &&
        !form.nextFollowUpAt
      ) {
        setError(
          `Schedule the Step ${stepNumber + 1} follow-up before finishing Step ${stepNumber}.`
        );
        return;
      }

      const actionLabel =
        stepStatus === 'completed'
          ? 'complete'
          : stepStatus === 'skipped'
          ? 'skip'
          : 'start';

      const confirmed =
        window.confirm(
          `${actionLabel
            .charAt(0)
            .toUpperCase()}${actionLabel.slice(
            1
          )} After-Sales Step ${stepNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        `step-${stepNumber}-${stepStatus}`
      );

      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/crm/cases/${selectedCase.id}/steps/${stepNumber}`,
            {
              stepStatus,

              customerFeedback:
                form.customerFeedback
                  .trim(),

              crmResponse:
                form.crmResponse.trim(),

              followUpAt:
                form.followUpAt ||
                null,

              nextFollowUpAt:
                form.nextFollowUpAt ||
                null,
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedCase.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            `Unable to update After-Sales Step ${stepNumber}.`
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleScheduleFollowUp =
    async (stepNumber) => {
      if (!selectedCase) {
        return;
      }

      const followUpAt =
        stepForms[stepNumber]
          ?.followUpAt;

      if (!followUpAt) {
        setError(
          `Select the Step ${stepNumber} follow-up date and time.`
        );
        return;
      }

      setActionLoading(
        `schedule-${stepNumber}`
      );
      setError('');
      setSuccess('');

      try {
        const response = await api.patch(
          `/crm/cases/${selectedCase.id}/schedule`,
          { followUpAt }
        );

        setSuccess(response.data.message);
        await refreshAfterAction(
          selectedCase.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to schedule the follow-up.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleSatisfactionChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setSatisfactionForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  };

  const handleSaveSatisfaction =
    async (event) => {
      event.preventDefault();

      if (!selectedCase) {
        return;
      }

      const rating = Number(
        satisfactionForm
          .satisfactionRating
      );

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        setError(
          'Select a satisfaction rating from 1 to 5.'
        );
        return;
      }

      setActionLoading(
        'satisfaction'
      );

      setError('');
      setSuccess('');

      try {
        const response =
          await api.put(
            `/crm/cases/${selectedCase.id}/satisfaction`,
            {
              satisfactionRating:
                rating,

              finalFeedback:
                satisfactionForm
                  .finalFeedback
                  .trim(),

              wouldRepurchase:
                satisfactionForm
                  .wouldRepurchase,
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedCase.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to save the customer satisfaction result.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleResolveCase =
    async () => {
      if (!selectedCase) {
        return;
      }

      if (
        !resolutionNotes.trim()
      ) {
        setError(
          'Enter the resolution notes.'
        );
        return;
      }

      const confirmed =
        window.confirm(
          `Resolve CRM case ${selectedCase.orderNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('resolve');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/crm/cases/${selectedCase.id}/resolve`,
            {
              resolutionNotes:
                resolutionNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedCase.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to resolve the CRM case.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleCloseCase =
    async () => {
      if (!selectedCase) {
        return;
      }

      const confirmed =
        window.confirm(
          `Close CRM case ${selectedCase.orderNumber}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('close');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/crm/cases/${selectedCase.id}/close`
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterAction(
          selectedCase.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to close the CRM case.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const closeDetails = () => {
    if (actionLoading) {
      return;
    }

    setSelectedCase(null);
    setAssignedUserId('');
    setConcernForm(
      initialConcernForm
    );
    setStepForms(
      createInitialStepForms()
    );
    setSatisfactionForm(
      initialSatisfactionForm
    );
    setResolutionNotes('');
    setError('');
    setSuccess('');
  };

  const assignedToCurrentUser =
    Number(
      selectedCase
        ?.assignedUser?.id
    ) === currentUserId;

  const canProcessSelectedCase =
    canWrite &&
    assignedToCurrentUser;

  const selectedSteps =
    selectedCase?.steps || [];

  const allStepsFinished =
    selectedSteps.length === 4 &&
    selectedSteps.every(
      isStepFinished
    );

  return (
    <div>
      <section
        style={styles.pageHeader}
      >
        <div>
          <p style={styles.eyebrow}>
            CUSTOMER RELATIONSHIP
            MANAGEMENT
          </p>

          <h1
            style={styles.pageTitle}
          >
            Four-Step After-Sales
            Monitoring
          </h1>

          <p
            style={
              styles.pageDescription
            }
          >
            Assign CRM cases, monitor
            four after-sales steps,
            record customer feedback,
            CRM responses, follow-up
            dates, satisfaction results,
            and complete case records.
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
          label="TOTAL CASES"
          value={summary.totalCases}
        />

        <SummaryCard
          label="UNASSIGNED"
          value={summary.unassigned}
          danger={
            summary.unassigned > 0
          }
        />

        <SummaryCard
          label="ASSIGNED"
          value={summary.assigned}
        />

        <SummaryCard
          label="IN PROGRESS"
          value={summary.inProgress}
        />

        <SummaryCard
          label="ACTIVE STEPS"
          value={summary.activeSteps}
        />

        <SummaryCard
          label="COMPLETED STEPS"
          value={
            summary.completedSteps
          }
        />

        <SummaryCard
          label="OVERDUE STEPS"
          value={summary.overdueSteps}
          danger={
            summary.overdueSteps > 0
          }
        />

        <SummaryCard
          label="RESOLVED"
          value={summary.resolved}
        />

        <SummaryCard
          label="CLOSED"
          value={summary.closed}
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

      {crmUsers.length !== 4 &&
        canWrite && (
          <div
            style={
              styles.warningMessage
            }
          >
            The system currently has{' '}
            <strong>
              {crmUsers.length}
            </strong>{' '}
            active CRM Specialist
            account
            {crmUsers.length === 1
              ? ''
              : 's'}
            .
          </div>
        )}

      {error &&
        !selectedCase && (
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
              CRM cases
            </h2>

            <p
              style={
                styles.sectionDescription
              }
            >
              {filteredCases.length}{' '}
              case
              {filteredCases.length ===
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
              placeholder="Search case..."
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
                caseStatusLabels
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
              value={
                assignmentFilter
              }
              onChange={(event) =>
                setAssignmentFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All assignments
              </option>

              <option value="assigned">
                Assigned
              </option>

              <option value="unassigned">
                Unassigned
              </option>

              {canWrite && (
                <option value="mine">
                  Assigned to Me
                </option>
              )}
            </select>

            <select
              value={
                currentStepFilter
              }
              onChange={(event) =>
                setCurrentStepFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All steps
              </option>

              <option value="1">
                Step 1
              </option>

              <option value="2">
                Step 2
              </option>

              <option value="3">
                Step 3
              </option>

              <option value="4">
                Step 4
              </option>
            </select>

            <label
              style={
                styles.checkboxLabel
              }
            >
              <input
                type="checkbox"
                checked={dueOnly}
                onChange={(event) =>
                  setDueOnly(
                    event.target.checked
                  )
                }
              />

              Overdue only
            </label>
          </div>
        </div>

        {loading ? (
          <div
            style={styles.emptyState}
          >
            Loading CRM cases...
          </div>
        ) : filteredCases.length ===
          0 ? (
          <div
            style={styles.emptyState}
          >
            No CRM cases found.
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
                    Next Follow-up
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
                    Assigned CRM User
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Current Step
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Progress
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Concern
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Case Status
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Rating
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
                {filteredCases.map(
                  (crmCase) => (
                    <tr key={crmCase.id}>
                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <strong>
                          {
                            crmCase.orderNumber
                          }
                        </strong>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <span
                          style={{
                            ...styles.reminderBadge,
                            ...(getFollowUpReminder(
                              crmCase
                            ).tone === 'danger'
                              ? styles.reminderDanger
                              : getFollowUpReminder(
                                  crmCase
                                ).tone === 'warning'
                              ? styles.reminderWarning
                              : getFollowUpReminder(
                                  crmCase
                                ).tone === 'success'
                              ? styles.reminderSuccess
                              : {}),
                          }}
                        >
                          {
                            getFollowUpReminder(
                              crmCase
                            ).label
                          }
                        </span>
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
                            crmCase.customer
                              ?.fullName
                          }
                        </p>

                        <p
                          style={
                            styles.secondaryText
                          }
                        >
                          {
                            crmCase.customer
                              ?.contactNumber
                          }
                        </p>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {crmCase.assignedUser ? (
                          <>
                            <strong>
                              {
                                crmCase
                                  .assignedUser
                                  .fullName
                              }
                            </strong>

                            <p
                              style={
                                styles.secondaryText
                              }
                            >
                              {formatDate(
                                crmCase.assignedAt
                              )}
                            </p>
                          </>
                        ) : (
                          <span
                            style={
                              styles.unassignedText
                            }
                          >
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        Step{' '}
                        {
                          crmCase.currentStep
                        }{' '}
                        of 4

                        {crmCase.workflow && (
                          <p
                            style={
                              styles.secondaryText
                            }
                          >
                            {
                              crmCase.workflow
                                .nextAction
                            }
                          </p>
                        )}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <strong>
                          {
                            crmCase.completedSteps
                          }
                          /4
                        </strong>{' '}
                        completed
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          concernLabels[
                            crmCase
                              .concernCategory
                          ]
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <CaseStatusBadge
                          status={
                            crmCase.caseStatus
                          }
                        />
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {crmCase.satisfactionRating
                          ? `${crmCase.satisfactionRating}/5`
                          : '—'}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openCase(
                              crmCase.id
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
                            ? 'Manage'
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

      {selectedCase && (
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
                  CRM AFTER-SALES CASE
                </p>

                <h2
                  style={
                    styles.modalTitle
                  }
                >
                  {
                    selectedCase.orderNumber
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
              <div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  }}
>
  <span>Overall case status</span>

  <strong>
    Step {selectedCase.currentStep} of 4
  </strong>

  {selectedCase.workflow && (
    <span style={styles.secondaryText}>
      Next: {selectedCase.workflow.nextAction}
      {' · '}
      {selectedCase.workflow.nextResponsibleModule ||
        'No module action'}
    </span>
  )}
</div>

              <CaseStatusBadge
                status={
                  selectedCase.caseStatus
                }
              />
            </div>

            <div
              style={{
                ...styles.followUpBanner,
                ...(getFollowUpReminder(
                  selectedCase
                ).tone === 'danger'
                  ? styles.reminderDanger
                  : getFollowUpReminder(
                      selectedCase
                    ).tone === 'warning'
                  ? styles.reminderWarning
                  : getFollowUpReminder(
                      selectedCase
                    ).tone === 'success'
                  ? styles.reminderSuccess
                  : {}),
              }}
            >
              <strong>
                Step {selectedCase.currentStep} of 4
              </strong>
              <span>
                {
                  getFollowUpReminder(
                    selectedCase
                  ).label
                }
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => setCustomer360Id(selectedCase.customer?.id)}
                style={styles.secondaryButton}
              >
                View Customer 360
              </button>
            </div>

            <div
              style={
                styles.detailGrid
              }
            >
              <Detail
                label="Customer"
                value={
                  selectedCase.customer
                    ?.fullName
                }
              />

              <Detail
                label="Contact number"
                value={
                  selectedCase.customer
                    ?.contactNumber
                }
              />

              <Detail
                label="Order amount"
                value={formatCurrency(
                  selectedCase.totalAmount
                )}
              />

              <Detail
                label="Courier"
                value={
                  selectedCase.thirdPartyLogistics ||
                  'Not available'
                }
              />

              <Detail
                label="Tracking number"
                value={
                  selectedCase.trackingNumber ||
                  'Not available'
                }
              />

              <Detail
                label="Fulfillment status"
                value={
                  selectedCase.fulfillmentStatus
                    ?.replaceAll(
                      '_',
                      ' '
                    )
                }
              />

              <Detail
                label="Delivery address"
                value={
                  selectedCase.customer
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
                      Quantity
                    </th>

                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Unit Price
                    </th>

                    <th
                      style={
                        styles.tableHeading
                      }
                    >
                      Line Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {selectedCase.items?.map(
                    (item) => (
                      <tr key={item.id}>
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

            <section
              style={
                styles.assignmentSection
              }
            >
              <div>
                <h3
                  style={
                    styles.actionSectionTitle
                  }
                >
                  CRM User Assignment
                </h3>

                <p
                  style={
                    styles.actionDescription
                  }
                >
                  Assign this customer case
                  to one of the active CRM
                  Specialist accounts.
                </p>
              </div>

              <div
                style={
                  styles.assignmentControls
                }
              >
                <select
                  value={assignedUserId}
                  onChange={(event) =>
                    setAssignedUserId(
                      event.target.value
                    )
                  }
                  disabled={
                    !canWrite ||
                    selectedCase.caseStatus ===
                      'closed'
                  }
                  style={
                    styles.input
                  }
                >
                  <option value="">
                    Select CRM user
                  </option>

                  {crmUsers.map(
                    (user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.fullName}
                        {Number(user.id) ===
                        currentUserId
                          ? ' — You'
                          : ''}
                      </option>
                    )
                  )}
                </select>

                {canWrite &&
                  selectedCase.caseStatus !==
                    'closed' && (
                    <button
                      type="button"
                      onClick={
                        handleAssignCase
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'assign'
                        ? 'Assigning...'
                        : selectedCase
                            .assignedUser
                        ? 'Update assignment'
                        : 'Assign case'}
                    </button>
                  )}
              </div>

              {selectedCase.assignedUser && (
                <div
                  style={
                    styles.assignmentInfo
                  }
                >
                  <span>
                    Assigned to
                  </span>

                  <strong>
                    {
                      selectedCase
                        .assignedUser
                        .fullName
                    }
                  </strong>

                  <span>
                    Assigned at:{' '}
                    {formatDate(
                      selectedCase.assignedAt
                    )}
                  </span>
                </div>
              )}
            </section>

            {canWrite &&
              selectedCase.assignedUser &&
              !assignedToCurrentUser &&
              selectedCase.caseStatus !==
                'closed' && (
                <div
                  style={
                    styles.warningMessage
                  }
                >
                  This case is assigned to{' '}
                  <strong>
                    {
                      selectedCase
                        .assignedUser
                        .fullName
                    }
                  </strong>
                  . Only the assigned CRM
                  user can process the
                  concern and after-sales
                  steps.
                </div>
              )}

            <form
              onSubmit={
                handleSaveConcern
              }
              style={
                styles.actionSection
              }
            >
              <h3
                style={
                  styles.actionSectionTitle
                }
              >
                Customer Concern
              </h3>

              <p
                style={
                  styles.actionDescription
                }
              >
                Record the delivery result
                and the overall concern
                reported by the customer.
              </p>

              <div
                style={
                  styles.formGrid
                }
              >
                <Field label="Delivery confirmation">
                  <select
                    name="deliveryConfirmation"
                    value={
                      concernForm
                        .deliveryConfirmation
                    }
                    onChange={
                      handleConcernChange
                    }
                    disabled={
                      !canProcessSelectedCase ||
                      [
                        'resolved',
                        'closed',
                      ].includes(
                        selectedCase.caseStatus
                      )
                    }
                    style={
                      styles.input
                    }
                  >
                    {Object.entries(
                      deliveryLabels
                    ).map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="Concern category">
                  <select
                    name="concernCategory"
                    value={
                      concernForm
                        .concernCategory
                    }
                    onChange={
                      handleConcernChange
                    }
                    disabled={
                      !canProcessSelectedCase ||
                      [
                        'resolved',
                        'closed',
                      ].includes(
                        selectedCase.caseStatus
                      )
                    }
                    style={
                      styles.input
                    }
                  >
                    {Object.entries(
                      concernLabels
                    ).map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>

              <Field label="Concern details">
                <textarea
                  name="concernDetails"
                  value={
                    concernForm
                      .concernDetails
                  }
                  onChange={
                    handleConcernChange
                  }
                  disabled={
                    !canProcessSelectedCase ||
                    [
                      'resolved',
                      'closed',
                    ].includes(
                      selectedCase.caseStatus
                    )
                  }
                  placeholder="Describe the customer's concern"
                  style={
                    styles.textarea
                  }
                />
              </Field>

              {canProcessSelectedCase &&
                ![
                  'resolved',
                  'closed',
                ].includes(
                  selectedCase.caseStatus
                ) && (
                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="submit"
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'concern'
                        ? 'Saving...'
                        : 'Save concern details'}
                    </button>
                  </div>
                )}
            </form>

            <h3
              style={
                styles.stepsHeading
              }
            >
              Four-Step After-Sales
              Monitoring
            </h3>

            <p
              style={
                styles.stepsDescription
              }
            >
              Each step contains its own
              customer feedback, CRM
              response, follow-up date,
              handler, status, and
              timestamps.
            </p>

            <div
              style={
                styles.stepTracker
              }
            >
              {[1, 2, 3, 4].map(
                (stepNumber) => {
                  const step =
                    selectedSteps.find(
                      (record) =>
                        Number(
                          record.stepNumber
                        ) ===
                        stepNumber
                    );

                  return (
                    <div
                      key={stepNumber}
                      style={{
                        ...styles.trackerItem,

                        ...(isStepFinished(
                          step
                        )
                          ? styles.trackerFinished
                          : {}),

                        ...(step
                          ?.stepStatus ===
                        'in_progress'
                          ? styles.trackerActive
                          : {}),
                      }}
                    >
                      <span>
                        Step {stepNumber}
                      </span>

                      <strong>
                        {
                          stepStatusLabels[
                            step
                              ?.stepStatus ||
                              'not_started'
                          ]
                        }
                      </strong>
                    </div>
                  );
                }
              )}
            </div>

            <div
              style={
                styles.stepsList
              }
            >
              {[1, 2, 3, 4].map(
                (stepNumber) => {
                  const step =
                    selectedSteps.find(
                      (record) =>
                        Number(
                          record.stepNumber
                        ) ===
                        stepNumber
                    ) || {
                      stepNumber,
                      stepStatus:
                        'not_started',
                    };

                  const previousSteps =
                    selectedSteps.filter(
                      (record) =>
                        Number(
                          record.stepNumber
                        ) <
                        stepNumber
                    );

                  const previousCompleted =
                    previousSteps.every(
                      isStepFinished
                    );

                  const locked =
                    stepNumber > 1 &&
                    !previousCompleted;

                  const terminal =
                    isStepFinished(step);

                  const overdue =
                    isStepOverdue(step);

                  return (
                    <section
                      key={stepNumber}
                      style={{
                        ...styles.stepCard,

                        ...(overdue
                          ? styles.overdueStepCard
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.stepHeader
                        }
                      >
                        <div>
                          <p
                            style={
                              styles.stepNumber
                            }
                          >
                            AFTER-SALES STEP{' '}
                            {stepNumber}
                          </p>

                          <h4
                            style={
                              styles.stepTitle
                            }
                          >
                            Customer Follow-up
                            Step {stepNumber}
                          </h4>
                        </div>

                        <StepStatusBadge
                          status={
                            step.stepStatus
                          }
                        />
                      </div>

                      {locked && (
                        <div
                          style={
                            styles.lockedMessage
                          }
                        >
                          Complete or skip
                          the previous step
                          before processing
                          Step {stepNumber}.
                        </div>
                      )}

                      {overdue && (
                        <div
                          style={
                            styles.overdueMessage
                          }
                        >
                          Follow-up is
                          overdue.
                        </div>
                      )}

                      <div
                        style={
                          styles.formGrid
                        }
                      >
                        <Field label={`Step ${stepNumber} Customer Feedback`}>
                          <textarea
                            value={
                              stepForms[
                                stepNumber
                              ]
                                ?.customerFeedback ||
                              ''
                            }
                            onChange={(
                              event
                            ) =>
                              handleStepFieldChange(
                                stepNumber,
                                'customerFeedback',
                                event.target
                                  .value
                              )
                            }
                            disabled={
                              !canProcessSelectedCase ||
                              locked ||
                              terminal ||
                              [
                                'resolved',
                                'closed',
                              ].includes(
                                selectedCase.caseStatus
                              )
                            }
                            placeholder="Record what the customer said"
                            style={
                              styles.textarea
                            }
                          />
                        </Field>

                        <Field label={`Step ${stepNumber} CRM Response`}>
                          <textarea
                            value={
                              stepForms[
                                stepNumber
                              ]
                                ?.crmResponse ||
                              ''
                            }
                            onChange={(
                              event
                            ) =>
                              handleStepFieldChange(
                                stepNumber,
                                'crmResponse',
                                event.target
                                  .value
                              )
                            }
                            disabled={
                              !canProcessSelectedCase ||
                              locked ||
                              terminal ||
                              [
                                'resolved',
                                'closed',
                              ].includes(
                                selectedCase.caseStatus
                              )
                            }
                            placeholder="Record the CRM response or action"
                            style={
                              styles.textarea
                            }
                          />
                        </Field>
                      </div>

                      <Field label={`Scheduled Follow-up for Step ${stepNumber}`}>
                        <input
                          type="datetime-local"
                          value={
                            stepForms[
                              stepNumber
                            ]?.followUpAt ||
                            ''
                          }
                          onChange={(
                            event
                          ) =>
                            handleStepFieldChange(
                              stepNumber,
                              'followUpAt',
                              event.target
                                .value
                            )
                          }
                          disabled={
                            !canProcessSelectedCase ||
                            locked ||
                            terminal ||
                            [
                              'resolved',
                              'closed',
                            ].includes(
                              selectedCase.caseStatus
                            )
                          }
                          style={
                            styles.input
                          }
                        />
                      </Field>

                      {canProcessSelectedCase &&
                        stepNumber ===
                          Number(
                            selectedCase.currentStep
                          ) &&
                        !terminal &&
                        ![
                          'resolved',
                          'closed',
                        ].includes(
                          selectedCase.caseStatus
                        ) && (
                          <div style={styles.scheduleRow}>
                            <button
                              type="button"
                              onClick={() =>
                                handleScheduleFollowUp(
                                  stepNumber
                                )
                              }
                              disabled={Boolean(
                                actionLoading
                              )}
                              style={
                                styles.secondaryButton
                              }
                            >
                              {actionLoading ===
                              `schedule-${stepNumber}`
                                ? 'Scheduling...'
                                : `Save Step ${stepNumber} Schedule`}
                            </button>
                          </div>
                        )}

                      {stepNumber ===
                        Number(
                          selectedCase.currentStep
                        ) &&
                        stepNumber < 4 &&
                        !terminal && (
                          <Field
                            label={`Next Follow-up Date (Step ${stepNumber + 1})`}
                          >
                            <input
                              type="datetime-local"
                              value={
                                stepForms[
                                  stepNumber
                                ]
                                  ?.nextFollowUpAt ||
                                ''
                              }
                              onChange={(event) =>
                                handleStepFieldChange(
                                  stepNumber,
                                  'nextFollowUpAt',
                                  event.target.value
                                )
                              }
                              disabled={
                                !canProcessSelectedCase ||
                                [
                                  'resolved',
                                  'closed',
                                ].includes(
                                  selectedCase.caseStatus
                                )
                              }
                              style={styles.input}
                            />
                            <span style={styles.fieldHelp}>
                              Required when completing or skipping this step. No interval is selected automatically.
                            </span>
                          </Field>
                        )}

                      <div
                        style={
                          styles.timestampGrid
                        }
                      >
                        <Timestamp
                          label="Handled By"
                          value={
                            step.handledBy
                              ?.fullName ||
                            'Not yet assigned'
                          }
                        />

                        <Timestamp
                          label="Started At"
                          value={formatDate(
                            step.startedAt
                          )}
                        />

                        <Timestamp
                          label="Completed At"
                          value={formatDate(
                            step.completedAt
                          )}
                        />

                        <Timestamp
                          label="Last Updated"
                          value={formatDate(
                            step.updatedAt
                          )}
                        />
                      </div>

                      {canProcessSelectedCase &&
                        !locked &&
                        !terminal &&
                        ![
                          'resolved',
                          'closed',
                        ].includes(
                          selectedCase.caseStatus
                        ) && (
                          <div
                            style={
                              styles.stepActions
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleStepAction(
                                  stepNumber,
                                  'skipped'
                                )
                              }
                              disabled={Boolean(
                                actionLoading
                              )}
                              style={
                                styles.skipButton
                              }
                            >
                              {actionLoading ===
                              `step-${stepNumber}-skipped`
                                ? 'Skipping...'
                                : 'Skip step'}
                            </button>

                            {step.stepStatus ===
                              'not_started' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStepAction(
                                    stepNumber,
                                    'in_progress'
                                  )
                                }
                                disabled={Boolean(
                                  actionLoading
                                )}
                                style={
                                  styles.secondaryButton
                                }
                              >
                                {actionLoading ===
                                `step-${stepNumber}-in_progress`
                                  ? 'Starting...'
                                  : 'Start step'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleStepAction(
                                  stepNumber,
                                  'completed'
                                )
                              }
                              disabled={Boolean(
                                actionLoading
                              )}
                              style={
                                styles.completeButton
                              }
                            >
                              {actionLoading ===
                              `step-${stepNumber}-completed`
                                ? 'Completing...'
                                : 'Complete step'}
                            </button>
                          </div>
                        )}
                    </section>
                  );
                }
              )}
            </div>

            <form
              onSubmit={
                handleSaveSatisfaction
              }
              style={
                styles.actionSection
              }
            >
              <h3
                style={
                  styles.actionSectionTitle
                }
              >
                Customer Satisfaction
                Result
              </h3>

              <p
                style={
                  styles.actionDescription
                }
              >
                Available after all four
                after-sales steps have
                been completed or skipped.
              </p>

              {!allStepsFinished && (
                <div
                  style={
                    styles.lockedMessage
                  }
                >
                  Complete or skip all four
                  steps before recording
                  customer satisfaction.
                </div>
              )}

              <div
                style={
                  styles.formGrid
                }
              >
                <Field label="Satisfaction rating">
                  <select
                    name="satisfactionRating"
                    value={
                      satisfactionForm
                        .satisfactionRating
                    }
                    onChange={
                      handleSatisfactionChange
                    }
                    disabled={
                      !canProcessSelectedCase ||
                      !allStepsFinished ||
                      selectedCase.caseStatus ===
                        'closed'
                    }
                    style={
                      styles.input
                    }
                  >
                    <option value="">
                      Select rating
                    </option>

                    <option value="1">
                      1 — Very Dissatisfied
                    </option>

                    <option value="2">
                      2 — Dissatisfied
                    </option>

                    <option value="3">
                      3 — Neutral
                    </option>

                    <option value="4">
                      4 — Satisfied
                    </option>

                    <option value="5">
                      5 — Very Satisfied
                    </option>
                  </select>
                </Field>

                <Field label="Would repurchase">
                  <select
                    name="wouldRepurchase"
                    value={
                      satisfactionForm
                        .wouldRepurchase
                    }
                    onChange={
                      handleSatisfactionChange
                    }
                    disabled={
                      !canProcessSelectedCase ||
                      !allStepsFinished ||
                      selectedCase.caseStatus ===
                        'closed'
                    }
                    style={
                      styles.input
                    }
                  >
                    <option value="yes">
                      Yes
                    </option>

                    <option value="no">
                      No
                    </option>

                    <option value="undecided">
                      Undecided
                    </option>
                  </select>
                </Field>
              </div>

              <Field label="Final customer feedback">
                <textarea
                  name="finalFeedback"
                  value={
                    satisfactionForm
                      .finalFeedback
                  }
                  onChange={
                    handleSatisfactionChange
                  }
                  disabled={
                    !canProcessSelectedCase ||
                    !allStepsFinished ||
                    selectedCase.caseStatus ===
                      'closed'
                  }
                  placeholder="Record the customer's final feedback"
                  style={
                    styles.textarea
                  }
                />
              </Field>

              {selectedCase.feedbackRecord && (
                <div
                  style={
                    styles.satisfactionResult
                  }
                >
                  <div>
                    <span>
                      Satisfaction Result
                    </span>

                    <strong>
                      {
                        satisfactionLabels[
                          selectedCase
                            .feedbackRecord
                            .satisfactionResult
                        ]
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Recorded At
                    </span>

                    <strong>
                      {formatDate(
                        selectedCase
                          .feedbackRecord
                          .submittedAt
                      )}
                    </strong>
                  </div>
                </div>
              )}

              {canProcessSelectedCase &&
                allStepsFinished &&
                selectedCase.caseStatus !==
                  'closed' && (
                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="submit"
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'satisfaction'
                        ? 'Saving...'
                        : 'Save satisfaction result'}
                    </button>
                  </div>
                )}
            </form>

            <section
              style={
                styles.actionSection
              }
            >
              <h3
                style={
                  styles.actionSectionTitle
                }
              >
                Resolution and Closing
              </h3>

              <p
                style={
                  styles.actionDescription
                }
              >
                Resolve the case after all
                steps and customer
                satisfaction have been
                recorded.
              </p>

              <Field label="Resolution notes">
                <textarea
                  value={resolutionNotes}
                  onChange={(event) =>
                    setResolutionNotes(
                      event.target.value
                    )
                  }
                  disabled={
                    !canProcessSelectedCase ||
                    [
                      'resolved',
                      'closed',
                    ].includes(
                      selectedCase.caseStatus
                    )
                  }
                  placeholder="Describe the final resolution"
                  style={
                    styles.textarea
                  }
                />
              </Field>

              <div
                style={
                  styles.timestampGrid
                }
              >
                <Timestamp
                  label="Assigned At"
                  value={formatDate(
                    selectedCase.assignedAt
                  )}
                />

                <Timestamp
                  label="Resolved At"
                  value={formatDate(
                    selectedCase.resolvedAt
                  )}
                />

                <Timestamp
                  label="Closed At"
                  value={formatDate(
                    selectedCase.closedAt
                  )}
                />

                <Timestamp
                  label="Case Updated"
                  value={formatDate(
                    selectedCase.updatedAt
                  )}
                />
              </div>

              {canProcessSelectedCase &&
                ![
                  'resolved',
                  'closed',
                ].includes(
                  selectedCase.caseStatus
                ) && (
                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleResolveCase
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.completeButton
                      }
                    >
                      {actionLoading ===
                      'resolve'
                        ? 'Resolving...'
                        : 'Mark as resolved'}
                    </button>
                  </div>
                )}

              {canProcessSelectedCase &&
                selectedCase.caseStatus ===
                  'resolved' && (
                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleCloseCase
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.closeCaseButton
                      }
                    >
                      {actionLoading ===
                      'close'
                        ? 'Closing...'
                        : 'Close CRM case'}
                    </button>
                  </div>
                )}

              {selectedCase.caseStatus ===
                'closed' && (
                <div
                  style={
                    styles.closedMessage
                  }
                >
                  CRM case closed on{' '}
                  {formatDate(
                    selectedCase.closedAt
                  )}
                </div>
              )}
            </section>

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

      {customer360Id && (
        <Customer360Modal
          customerId={customer360Id}
          onClose={() => setCustomer360Id(null)}
        />
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

function Timestamp({
  label,
  value,
}) {
  return (
    <div
      style={styles.timestampItem}
    >
      <span>{label}</span>
      <strong>
        {value || 'Not available'}
      </strong>
    </div>
  );
}

function CaseStatusBadge({
  status,
}) {
  const statusStyles = {
    pending_follow_up:
      styles.pendingBadge,

    assigned:
      styles.assignedBadge,

    in_progress:
      styles.progressBadge,

    awaiting_customer:
      styles.awaitingBadge,

    resolved:
      styles.resolvedBadge,

    closed:
      styles.closedBadge,
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(statusStyles[status] ||
          {}),
      }}
    >
      {caseStatusLabels[status] ||
        status}
    </span>
  );
}

function StepStatusBadge({
  status,
}) {
  const statusStyles = {
    not_started:
      styles.notStartedBadge,

    in_progress:
      styles.progressBadge,

    completed:
      styles.resolvedBadge,

    skipped:
      styles.skippedBadge,
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(statusStyles[status] ||
          {}),
      }}
    >
      {stepStatusLabels[status] ||
        status}
    </span>
  );
}

const styles = {
  reminderBadge: {
    display: 'inline-flex',
    maxWidth: '190px',
    padding: '6px 8px',
    borderRadius: '8px',
    background: colors.cream,
    color: colors.mutedInk,
    fontSize: '10px',
    fontWeight: 700,
    lineHeight: 1.4,
  },

  reminderDanger: {
    background: '#fff0f2',
    color: '#a33b51',
    borderColor: '#e7aebb',
  },

  reminderWarning: {
    background: '#fff8e8',
    color: '#8a6417',
    borderColor: '#ecd493',
  },

  reminderSuccess: {
    background: '#e9f7ee',
    color: '#287447',
    borderColor: '#abd7ba',
  },

  followUpBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '14px',
    padding: '11px 13px',
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    background: colors.cream,
    color: colors.ink,
    fontSize: '12px',
  },

  scheduleRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '-2px',
  },

  fieldHelp: {
    display: 'block',
    marginTop: '5px',
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.5,
  },

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
    alignItems: 'center',
    gap: '9px',
    flexWrap: 'wrap',
  },

  searchInput: {
    width: '205px',
    padding: '10px 12px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
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

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 10px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    color: colors.ink,
    fontSize: '10px',
  },

  tableWrapper: {
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    minWidth: '1250px',
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

  unassignedText: {
    color: '#a33b51',
    fontWeight: 600,
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
    maxWidth: '1050px',
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
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
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
    textTransform: 'capitalize',
  },

  subsectionTitle: {
    margin: '24px 0 10px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  assignmentSection: {
    display: 'grid',
    gap: '14px',
    marginTop: '22px',
    padding: '18px',
    borderRadius: '12px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  assignmentControls: {
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: '10px',
    alignItems: 'end',
  },

  assignmentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '11px 13px',
    borderRadius: '8px',
    background: colors.blush,
    color: colors.ink,
    fontSize: '10px',
  },

  actionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '13px',
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
    margin: '-7px 0 0',
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.6,
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '14px',
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
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '11px',
  },

  textarea: {
    width: '100%',
    minHeight: '80px',
    padding: '11px 12px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    resize: 'vertical',
    background: '#ffffff',
    fontFamily: font.body,
    fontSize: '11px',
  },

  actionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
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

  secondaryButton: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  completeButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: '8px',
    background: '#40825c',
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  skipButton: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #e4b9c1',
    background: '#fff0f2',
    color: '#a33b51',
    fontFamily: font.body,
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  closeCaseButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: 'none',
    background: colors.ink,
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  stepsHeading: {
    margin: '26px 0 4px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '22px',
    fontWeight: 500,
  },

  stepsDescription: {
    margin: 0,
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.6,
  },

  stepTracker: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(4, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '16px',
  },

  trackerItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '12px',
    borderRadius: '9px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '9px',
  },

  trackerActive: {
    background: '#eaf0ff',
    border: '1px solid #b9c8ef',
    color: '#355ca8',
  },

  trackerFinished: {
    background: '#e9f7ee',
    border: '1px solid #b9dfc8',
    color: '#287447',
  },

  stepsList: {
    display: 'grid',
    gap: '16px',
    marginTop: '16px',
  },

  stepCard: {
    padding: '18px',
    borderRadius: '12px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  overdueStepCard: {
    border: '1px solid #e2a7b3',
    background: '#fffafb',
  },

  stepHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '15px',
  },

  stepNumber: {
    margin: 0,
    color: colors.roseDeep,
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1px',
  },

  stepTitle: {
    margin: '5px 0 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  stepActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '9px',
    marginTop: '15px',
    flexWrap: 'wrap',
  },

  timestampGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(4, minmax(0, 1fr))',
    gap: '9px',
    marginTop: '14px',
  },

  timestampItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '10px',
    borderRadius: '8px',
    background: colors.cream,
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '8px',
    textTransform: 'uppercase',
  },

  satisfactionResult: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    padding: '13px',
    borderRadius: '9px',
    background: '#e9f7ee',
    color: '#287447',
    fontSize: '10px',
  },

  lockedMessage: {
    padding: '10px 12px',
    borderRadius: '8px',
    background: '#f2efed',
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.5,
  },

  overdueMessage: {
    marginBottom: '12px',
    padding: '9px 11px',
    borderRadius: '7px',
    background: '#fff0f2',
    color: '#a33b51',
    fontSize: '10px',
    fontWeight: 600,
  },

  warningMessage: {
    marginTop: '14px',
    padding: '11px 13px',
    borderRadius: '8px',
    background: '#fff5d9',
    border: '1px solid #ead6a2',
    color: '#725b1e',
    fontSize: '11px',
    lineHeight: 1.55,
  },

  closedMessage: {
    padding: '12px 14px',
    borderRadius: '8px',
    background: '#e9f7ee',
    color: '#287447',
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

  assignedBadge: {
    background: '#edf2ff',
    color: '#4863a8',
  },

  progressBadge: {
    background: '#eaf0ff',
    color: '#355ca8',
  },

  awaitingBadge: {
    background: '#f4ecff',
    color: '#7044a0',
  },

  resolvedBadge: {
    background: '#e9f7ee',
    color: '#287447',
  },

  closedBadge: {
    background: '#eeeeee',
    color: '#5f5f5f',
  },

  notStartedBadge: {
    background: '#eeeeee',
    color: '#666666',
  },

  skippedBadge: {
    background: '#fff5d9',
    color: '#725b1e',
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
