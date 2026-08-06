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

const campaignStatusLabels = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const taskStatusLabels = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  for_revision: 'For Revision',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const contentTypeLabels = {
  poster: 'Poster',
  video: 'Video',
  caption: 'Caption',
  product_photo: 'Product Photo',
  social_media_post: 'Social Media Post',
  product_promotion: 'Product Promotion',
  other: 'Other',
};

const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const reviewStatusLabels = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  for_revision: 'For Revision',
};

const initialSummary = {
  totalCampaigns: 0,
  totalTasks: 0,
  assigned: 0,
  inProgress: 0,
  submitted: 0,
  forRevision: 0,
  approved: 0,
  completed: 0,
  overdue: 0,
};

const initialCampaignForm = {
  campaignName: '',
  description: '',
  productId: '',
  startDate: '',
  endDate: '',
  campaignStatus: 'planning',
};

const initialTaskForm = {
  campaignId: '',
  taskTitle: '',
  taskDescription: '',
  contentType: 'social_media_post',
  assignedUserId: '',
  priority: 'medium',
  dueDate: '',
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

function formatDateOnly(value) {
  if (!value) {
    return 'Not specified';
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return String(value);
  }

  return date.toLocaleDateString(
    'en-PH',
    {
      dateStyle: 'medium',
    }
  );
}

function toDateInput(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function toDateTimeLocal(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
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

export default function Marketing() {
  const currentUser =
    getStoredUser();

  const isHead =
    currentUser.role === 'head';

  const isMarketingSpecialist =
    currentUser.role ===
      'specialist' &&
    getDepartmentCode(
      currentUser
    ) === 'marketing';

  const [summary, setSummary] =
    useState(initialSummary);

  const [
    campaigns,
    setCampaigns,
  ] = useState([]);

  const [tasks, setTasks] =
    useState([]);

  const [
    marketingUsers,
    setMarketingUsers,
  ] = useState([]);

  const [products, setProducts] =
    useState([]);

  const [
    selectedTask,
    setSelectedTask,
  ] = useState(null);

  const [
    campaignModalOpen,
    setCampaignModalOpen,
  ] = useState(false);

  const [
    editingCampaign,
    setEditingCampaign,
  ] = useState(null);

  const [
    campaignForm,
    setCampaignForm,
  ] = useState(
    initialCampaignForm
  );

  const [
    taskModalOpen,
    setTaskModalOpen,
  ] = useState(false);

  const [taskForm, setTaskForm] =
    useState(initialTaskForm);

  const [
    selectedAssignedUserId,
    setSelectedAssignedUserId,
  ] = useState('');

  const [
    outputLink,
    setOutputLink,
  ] = useState('');

  const [
    submissionNotes,
    setSubmissionNotes,
  ] = useState('');

  const [
    reviewNotes,
    setReviewNotes,
  ] = useState('');

  const [
    cancellationNotes,
    setCancellationNotes,
  ] = useState('');

  const [search, setSearch] =
    useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('');

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState('');

  const [
    campaignFilter,
    setCampaignFilter,
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
        summaryResponse,
        campaignResponse,
        taskResponse,
        userResponse,
        productResponse,
      ] = await Promise.all([
        api.get(
          '/marketing/summary'
        ),

        api.get(
          '/marketing/campaigns'
        ),

        api.get(
          '/marketing/tasks'
        ),

        api.get(
          '/marketing/users'
        ),

        api.get(
          '/marketing/products'
        ),
      ]);

      setSummary({
        ...initialSummary,
        ...(summaryResponse.data
          .summary || {}),
      });

      setCampaigns(
        campaignResponse.data
          .campaigns || []
      );

      setTasks(
        taskResponse.data.tasks || []
      );

      setMarketingUsers(
        userResponse.data.users || []
      );

      setProducts(
        productResponse.data
          .products || []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve Marketing records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTasks =
    useMemo(() => {
      const keyword = search
        .trim()
        .toLowerCase();

      return tasks.filter(
        (task) => {
          const matchesSearch =
            !keyword ||
            [
              task.taskTitle,
              task.taskDescription,
              task.campaignName,
              task.assignedUser
                ?.fullName,
              contentTypeLabels[
                task.contentType
              ],
              taskStatusLabels[
                task.taskStatus
              ],
            ].some((value) =>
              String(value || '')
                .toLowerCase()
                .includes(keyword)
            );

          const matchesStatus =
            !statusFilter ||
            task.taskStatus ===
              statusFilter;

          const matchesPriority =
            !priorityFilter ||
            task.priority ===
              priorityFilter;

          const matchesCampaign =
            !campaignFilter ||
            Number(
              task.campaignId
            ) ===
              Number(
                campaignFilter
              );

          return (
            matchesSearch &&
            matchesStatus &&
            matchesPriority &&
            matchesCampaign
          );
        }
      );
    }, [
      tasks,
      search,
      statusFilter,
      priorityFilter,
      campaignFilter,
    ]);

  const openCreateCampaign =
    () => {
      setEditingCampaign(null);

      setCampaignForm(
        initialCampaignForm
      );

      setError('');
      setSuccess('');
      setCampaignModalOpen(true);
    };

  const openEditCampaign = (
    campaign
  ) => {
    setEditingCampaign(campaign);

    setCampaignForm({
      campaignName:
        campaign.campaignName ||
        '',

      description:
        campaign.description || '',

      productId:
        campaign.productId
          ? String(
              campaign.productId
            )
          : '',

      startDate:
        toDateInput(
          campaign.startDate
        ),

      endDate:
        toDateInput(
          campaign.endDate
        ),

      campaignStatus:
        campaign.campaignStatus ||
        'planning',
    });

    setError('');
    setSuccess('');
    setCampaignModalOpen(true);
  };

  const closeCampaignModal =
    () => {
      if (actionLoading) {
        return;
      }

      setCampaignModalOpen(false);
      setEditingCampaign(null);
      setCampaignForm(
        initialCampaignForm
      );
      setError('');
    };

  const handleCampaignChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setCampaignForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  };

  const handleSaveCampaign =
    async (event) => {
      event.preventDefault();

      if (
        !campaignForm.campaignName.trim()
      ) {
        setError(
          'Enter the campaign name.'
        );
        return;
      }

      if (
        campaignForm.startDate &&
        campaignForm.endDate &&
        campaignForm.endDate <
          campaignForm.startDate
      ) {
        setError(
          'Campaign end date cannot be earlier than the start date.'
        );
        return;
      }

      setActionLoading(
        'campaign'
      );

      setError('');
      setSuccess('');

      const payload = {
        campaignName:
          campaignForm
            .campaignName
            .trim(),

        description:
          campaignForm.description.trim(),

        productId:
          campaignForm.productId
            ? Number(
                campaignForm.productId
              )
            : null,

        startDate:
          campaignForm.startDate ||
          null,

        endDate:
          campaignForm.endDate ||
          null,

        campaignStatus:
          campaignForm.campaignStatus,
      };

      try {
        const response =
          editingCampaign
            ? await api.patch(
                `/marketing/campaigns/${editingCampaign.id}`,
                payload
              )
            : await api.post(
                '/marketing/campaigns',
                payload
              );

        setSuccess(
          response.data.message
        );

        setCampaignModalOpen(false);
        setEditingCampaign(null);
        setCampaignForm(
          initialCampaignForm
        );

        await loadData();
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to save the Marketing campaign.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const openCreateTask = (
    campaignId = ''
  ) => {
    setTaskForm({
      ...initialTaskForm,

      campaignId:
        campaignId
          ? String(campaignId)
          : '',
    });

    setError('');
    setSuccess('');
    setTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    if (actionLoading) {
      return;
    }

    setTaskModalOpen(false);
    setTaskForm(
      initialTaskForm
    );
    setError('');
  };

  const handleTaskFormChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setTaskForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCreateTask =
    async (event) => {
      event.preventDefault();

      if (!taskForm.campaignId) {
        setError(
          'Select a Marketing campaign.'
        );
        return;
      }

      if (
        !taskForm.taskTitle.trim()
      ) {
        setError(
          'Enter the task title.'
        );
        return;
      }

      setActionLoading(
        'create-task'
      );

      setError('');
      setSuccess('');

      try {
        const response =
          await api.post(
            '/marketing/tasks',
            {
              campaignId: Number(
                taskForm.campaignId
              ),

              taskTitle:
                taskForm.taskTitle.trim(),

              taskDescription:
                taskForm
                  .taskDescription
                  .trim(),

              contentType:
                taskForm.contentType,

              assignedUserId:
                taskForm.assignedUserId
                  ? Number(
                      taskForm
                        .assignedUserId
                    )
                  : null,

              priority:
                taskForm.priority,

              dueDate:
                taskForm.dueDate ||
                null,
            }
          );

        setSuccess(
          response.data.message
        );

        setTaskModalOpen(false);
        setTaskForm(
          initialTaskForm
        );

        await loadData();
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to create the Marketing task.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const hydrateTaskActions = (
    task
  ) => {
    setSelectedAssignedUserId(
      task.assignedUser?.id
        ? String(
            task.assignedUser.id
          )
        : ''
    );

    setOutputLink('');
    setSubmissionNotes('');
    setReviewNotes('');
    setCancellationNotes('');
  };

  const openTask = async (
    taskId
  ) => {
    setDetailsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.get(
        `/marketing/tasks/${taskId}`
      );

      const task =
        response.data.task;

      setSelectedTask(task);
      hydrateTaskActions(task);
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          'Unable to retrieve the Marketing task details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshSelectedTask =
    async (taskId) => {
      const response = await api.get(
        `/marketing/tasks/${taskId}`
      );

      const task =
        response.data.task;

      setSelectedTask(task);
      hydrateTaskActions(task);
    };

  const refreshAfterTaskAction =
    async (taskId) => {
      await loadData();

      await refreshSelectedTask(
        taskId
      );
    };

  const closeTaskDetails = () => {
    if (actionLoading) {
      return;
    }

    setSelectedTask(null);
    setSelectedAssignedUserId('');
    setOutputLink('');
    setSubmissionNotes('');
    setReviewNotes('');
    setCancellationNotes('');
    setError('');
    setSuccess('');
  };

  const handleAssignTask =
    async () => {
      if (!selectedTask) {
        return;
      }

      const assignedUserId =
        Number(
          selectedAssignedUserId
        );

      if (
        !Number.isInteger(
          assignedUserId
        ) ||
        assignedUserId <= 0
      ) {
        setError(
          'Select a Marketing Specialist.'
        );
        return;
      }

      const selectedUser =
        marketingUsers.find(
          (user) =>
            Number(user.id) ===
            assignedUserId
        );

      const confirmed =
        window.confirm(
          `Assign this task to ${
            selectedUser?.fullName ||
            'the selected user'
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
            `/marketing/tasks/${selectedTask.id}/assign`,
            {
              assignedUserId,
            }
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterTaskAction(
          selectedTask.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to assign the Marketing task.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleStartTask =
    async () => {
      if (!selectedTask) {
        return;
      }

      const confirmed =
        window.confirm(
          `Start task "${selectedTask.taskTitle}"?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('start');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/marketing/tasks/${selectedTask.id}/start`
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterTaskAction(
          selectedTask.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to start the Marketing task.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleSubmitOutput =
    async (event) => {
      event.preventDefault();

      if (!selectedTask) {
        return;
      }

      if (!outputLink.trim()) {
        setError(
          'Enter the output link.'
        );
        return;
      }

      setActionLoading('submit');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.post(
            `/marketing/tasks/${selectedTask.id}/submissions`,
            {
              outputLink:
                outputLink.trim(),

              submissionNotes:
                submissionNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        setOutputLink('');
        setSubmissionNotes('');

        await refreshAfterTaskAction(
          selectedTask.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to submit the Marketing output.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleReviewSubmission =
    async (
      submissionId,
      decision
    ) => {
      if (!selectedTask) {
        return;
      }

      if (
        decision ===
          'for_revision' &&
        !reviewNotes.trim()
      ) {
        setError(
          'Enter the revision notes.'
        );
        return;
      }

      const confirmed =
        window.confirm(
          decision === 'approved'
            ? 'Approve this Marketing submission?'
            : 'Request a revision for this submission?'
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(
        `review-${decision}`
      );

      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/marketing/submissions/${submissionId}/review`,
            {
              decision,

              reviewNotes:
                reviewNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        setReviewNotes('');

        await refreshAfterTaskAction(
          selectedTask.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to review the Marketing submission.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleCompleteTask =
    async () => {
      if (!selectedTask) {
        return;
      }

      const confirmed =
        window.confirm(
          `Mark "${selectedTask.taskTitle}" as completed?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('complete');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/marketing/tasks/${selectedTask.id}/complete`
          );

        setSuccess(
          response.data.message
        );

        await refreshAfterTaskAction(
          selectedTask.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to complete the Marketing task.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const handleCancelTask =
    async () => {
      if (!selectedTask) {
        return;
      }

      if (
        !cancellationNotes.trim()
      ) {
        setError(
          'Enter the task cancellation reason.'
        );
        return;
      }

      const confirmed =
        window.confirm(
          `Cancel "${selectedTask.taskTitle}"?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading('cancel');
      setError('');
      setSuccess('');

      try {
        const response =
          await api.patch(
            `/marketing/tasks/${selectedTask.id}/cancel`,
            {
              notes:
                cancellationNotes.trim(),
            }
          );

        setSuccess(
          response.data.message
        );

        setCancellationNotes('');

        await refreshAfterTaskAction(
          selectedTask.id
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'Unable to cancel the Marketing task.'
        );
      } finally {
        setActionLoading('');
      }
    };

  const latestPendingSubmission =
    selectedTask?.submissions?.find(
      (submission) =>
        submission.reviewStatus ===
        'pending_review'
    );

  return (
    <div>
      <section
        style={styles.pageHeader}
      >
        <div>
          <p style={styles.eyebrow}>
            MARKETING AND WORKFLOW
            MANAGEMENT
          </p>

          <h1
            style={styles.pageTitle}
          >
            Marketing Workflow
          </h1>

          <p
            style={
              styles.pageDescription
            }
          >
            Manage campaigns, creative
            tasks, assignments, draft
            submissions, revisions,
            approvals, deadlines, and
            completed Marketing outputs.
          </p>
        </div>

        {isHead && (
          <div
            style={styles.headerActions}
          >
            <button
              type="button"
              onClick={
                openCreateCampaign
              }
              style={
                styles.secondaryButton
              }
            >
              New Campaign
            </button>

            <button
              type="button"
              onClick={() =>
                openCreateTask()
              }
              style={
                styles.primaryButton
              }
            >
              New Marketing Task
            </button>
          </div>
        )}
      </section>

      <section
        style={styles.summaryGrid}
      >
        <SummaryCard
          label="CAMPAIGNS"
          value={
            summary.totalCampaigns
          }
        />

        <SummaryCard
          label="TOTAL TASKS"
          value={summary.totalTasks}
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
          label="SUBMITTED"
          value={summary.submitted}
        />

        <SummaryCard
          label="FOR REVISION"
          value={summary.forRevision}
          warning={
            summary.forRevision > 0
          }
        />

        <SummaryCard
          label="APPROVED"
          value={summary.approved}
        />

        <SummaryCard
          label="COMPLETED"
          value={summary.completed}
        />

        <SummaryCard
          label="OVERDUE"
          value={summary.overdue}
          danger={
            summary.overdue > 0
          }
        />
      </section>

      {success &&
        !selectedTask &&
        !campaignModalOpen &&
        !taskModalOpen && (
          <div
            style={
              styles.successMessage
            }
          >
            {success}
          </div>
        )}

      {error &&
        !selectedTask &&
        !campaignModalOpen &&
        !taskModalOpen && (
          <div
            style={
              styles.errorMessage
            }
          >
            {error}
          </div>
        )}

      <section
        style={
          styles.campaignSection
        }
      >
        <div
          style={styles.sectionHeader}
        >
          <div>
            <h2
              style={
                styles.sectionTitle
              }
            >
              Marketing Campaigns
            </h2>

            <p
              style={
                styles.sectionDescription
              }
            >
              {campaigns.length}{' '}
              campaign
              {campaigns.length === 1
                ? ''
                : 's'}{' '}
              available
            </p>
          </div>
        </div>

        {loading ? (
          <div
            style={styles.emptyState}
          >
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div
            style={styles.emptyState}
          >
            No Marketing campaigns
            found.
          </div>
        ) : (
          <div
            style={
              styles.campaignGrid
            }
          >
            {campaigns.map(
              (campaign) => (
                <article
                  key={campaign.id}
                  style={
                    styles.campaignCard
                  }
                >
                  <div
                    style={
                      styles.campaignCardHeader
                    }
                  >
                    <div>
                      <p
                        style={
                          styles.campaignCode
                        }
                      >
                        {
                          campaign.campaignCode
                        }
                      </p>

                      <h3
                        style={
                          styles.campaignName
                        }
                      >
                        {
                          campaign.campaignName
                        }
                      </h3>
                    </div>

                    <CampaignStatusBadge
                      status={
                        campaign.campaignStatus
                      }
                    />
                  </div>

                  <p
                    style={
                      styles.campaignDescription
                    }
                  >
                    {campaign.description ||
                      'No campaign description.'}
                  </p>

                  <div
                    style={
                      styles.campaignDetails
                    }
                  >
                    <DetailLine
                      label="Product"
                      value={
                        campaign.productName ||
                        'General campaign'
                      }
                    />

                    <DetailLine
                      label="Schedule"
                      value={`${formatDateOnly(
                        campaign.startDate
                      )} – ${formatDateOnly(
                        campaign.endDate
                      )}`}
                    />

                    <DetailLine
                      label="Task Progress"
                      value={`${campaign.completedTaskCount}/${campaign.taskCount} completed`}
                    />
                  </div>

                  {isHead && (
                    <div
                      style={
                        styles.cardActions
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openCreateTask(
                            campaign.id
                          )
                        }
                        style={
                          styles.smallPrimaryButton
                        }
                      >
                        Add Task
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEditCampaign(
                            campaign
                          )
                        }
                        style={
                          styles.smallSecondaryButton
                        }
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </article>
              )
            )}
          </div>
        )}
      </section>

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
              Creative Tasks
            </h2>

            <p
              style={
                styles.sectionDescription
              }
            >
              {filteredTasks.length}{' '}
              task
              {filteredTasks.length ===
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
              placeholder="Search task..."
              style={
                styles.searchInput
              }
            />

            <select
              value={campaignFilter}
              onChange={(event) =>
                setCampaignFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All campaigns
              </option>

              {campaigns.map(
                (campaign) => (
                  <option
                    key={campaign.id}
                    value={campaign.id}
                  >
                    {
                      campaign.campaignName
                    }
                  </option>
                )
              )}
            </select>

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
                taskStatusLabels
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
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option value="">
                All priorities
              </option>

              {Object.entries(
                priorityLabels
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
            Loading Marketing
            tasks...
          </div>
        ) : filteredTasks.length ===
          0 ? (
          <div
            style={styles.emptyState}
          >
            No Marketing tasks found.
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
                    Task
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Campaign
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Content Type
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Assigned To
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Priority
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Due Date
                  </th>

                  <th
                    style={
                      styles.tableHeading
                    }
                  >
                    Submissions
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
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredTasks.map(
                  (task) => (
                    <tr key={task.id}>
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
                          {task.taskTitle}
                        </p>

                        <p
                          style={
                            styles.secondaryText
                          }
                        >
                          {task.taskDescription ||
                            'No description'}
                        </p>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {task.campaignName ||
                          'No campaign'}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          contentTypeLabels[
                            task.contentType
                          ]
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {task.assignedUser
                          ?.fullName || (
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
                        <PriorityBadge
                          priority={
                            task.priority
                          }
                        />
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <span
                          style={
                            task.isOverdue
                              ? styles.overdueText
                              : undefined
                          }
                        >
                          {formatDate(
                            task.dueDate
                          )}

                          {task.isOverdue &&
                            ' — Overdue'}
                        </span>
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {
                          task.submissionCount
                        }
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <TaskStatusBadge
                          status={
                            task.taskStatus
                          }
                        />
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openTask(
                              task.id
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
                            : isHead
                            ? 'Manage'
                            : 'Process'}
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

      {campaignModalOpen && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCampaignModal();
            }
          }}
        >
          <section
            style={styles.smallModal}
          >
            <ModalHeader
              eyebrow="MARKETING CAMPAIGN"
              title={
                editingCampaign
                  ? 'Edit Campaign'
                  : 'New Campaign'
              }
              onClose={
                closeCampaignModal
              }
              disabled={Boolean(
                actionLoading
              )}
            />

            <form
              onSubmit={
                handleSaveCampaign
              }
              style={styles.form}
            >
              <Field label="Campaign name">
                <input
                  name="campaignName"
                  value={
                    campaignForm.campaignName
                  }
                  onChange={
                    handleCampaignChange
                  }
                  placeholder="Enter campaign name"
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Description">
                <textarea
                  name="description"
                  value={
                    campaignForm.description
                  }
                  onChange={
                    handleCampaignChange
                  }
                  placeholder="Describe the campaign objectives"
                  style={
                    styles.textarea
                  }
                />
              </Field>

              <Field label="Product">
                <select
                  name="productId"
                  value={
                    campaignForm.productId
                  }
                  onChange={
                    handleCampaignChange
                  }
                  style={styles.input}
                >
                  <option value="">
                    General campaign
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {
                          product.productName
                        }
                      </option>
                    )
                  )}
                </select>
              </Field>

              <div
                style={
                  styles.formGrid
                }
              >
                <Field label="Start date">
                  <input
                    type="date"
                    name="startDate"
                    value={
                      campaignForm.startDate
                    }
                    onChange={
                      handleCampaignChange
                    }
                    style={styles.input}
                  />
                </Field>

                <Field label="End date">
                  <input
                    type="date"
                    name="endDate"
                    value={
                      campaignForm.endDate
                    }
                    onChange={
                      handleCampaignChange
                    }
                    style={styles.input}
                  />
                </Field>
              </div>

              <Field label="Campaign status">
                <select
                  name="campaignStatus"
                  value={
                    campaignForm.campaignStatus
                  }
                  onChange={
                    handleCampaignChange
                  }
                  style={styles.input}
                >
                  {Object.entries(
                    campaignStatusLabels
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
                    closeCampaignModal
                  }
                  disabled={Boolean(
                    actionLoading
                  )}
                  style={
                    styles.secondaryButton
                  }
                >
                  Cancel
                </button>

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
                  'campaign'
                    ? 'Saving...'
                    : editingCampaign
                    ? 'Save Changes'
                    : 'Create Campaign'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {taskModalOpen && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeTaskModal();
            }
          }}
        >
          <section
            style={styles.smallModal}
          >
            <ModalHeader
              eyebrow="CREATIVE TASK"
              title="New Marketing Task"
              onClose={
                closeTaskModal
              }
              disabled={Boolean(
                actionLoading
              )}
            />

            <form
              onSubmit={
                handleCreateTask
              }
              style={styles.form}
            >
              <Field label="Campaign">
                <select
                  name="campaignId"
                  value={
                    taskForm.campaignId
                  }
                  onChange={
                    handleTaskFormChange
                  }
                  style={styles.input}
                  required
                >
                  <option value="">
                    Select campaign
                  </option>

                  {campaigns
                    .filter(
                      (campaign) =>
                        campaign.campaignStatus !==
                        'cancelled'
                    )
                    .map(
                      (campaign) => (
                        <option
                          key={
                            campaign.id
                          }
                          value={
                            campaign.id
                          }
                        >
                          {
                            campaign.campaignName
                          }
                        </option>
                      )
                    )}
                </select>
              </Field>

              <Field label="Task title">
                <input
                  name="taskTitle"
                  value={
                    taskForm.taskTitle
                  }
                  onChange={
                    handleTaskFormChange
                  }
                  placeholder="Enter creative task title"
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Task description">
                <textarea
                  name="taskDescription"
                  value={
                    taskForm.taskDescription
                  }
                  onChange={
                    handleTaskFormChange
                  }
                  placeholder="Describe the required output"
                  style={
                    styles.textarea
                  }
                />
              </Field>

              <div
                style={
                  styles.formGrid
                }
              >
                <Field label="Content type">
                  <select
                    name="contentType"
                    value={
                      taskForm.contentType
                    }
                    onChange={
                      handleTaskFormChange
                    }
                    style={styles.input}
                  >
                    {Object.entries(
                      contentTypeLabels
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

                <Field label="Priority">
                  <select
                    name="priority"
                    value={
                      taskForm.priority
                    }
                    onChange={
                      handleTaskFormChange
                    }
                    style={styles.input}
                  >
                    {Object.entries(
                      priorityLabels
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

              <Field label="Assign to Marketing Specialist">
                <select
                  name="assignedUserId"
                  value={
                    taskForm.assignedUserId
                  }
                  onChange={
                    handleTaskFormChange
                  }
                  style={styles.input}
                >
                  <option value="">
                    Leave unassigned
                  </option>

                  {marketingUsers.map(
                    (user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.fullName}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Due date and time">
                <input
                  type="datetime-local"
                  name="dueDate"
                  value={
                    taskForm.dueDate
                  }
                  onChange={
                    handleTaskFormChange
                  }
                  style={styles.input}
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
                    closeTaskModal
                  }
                  disabled={Boolean(
                    actionLoading
                  )}
                  style={
                    styles.secondaryButton
                  }
                >
                  Cancel
                </button>

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
                  'create-task'
                    ? 'Creating...'
                    : 'Create Task'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedTask && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeTaskDetails();
            }
          }}
        >
          <section
            style={styles.detailsModal}
          >
            <ModalHeader
              eyebrow="MARKETING TASK"
              title={
                selectedTask.taskTitle
              }
              onClose={
                closeTaskDetails
              }
              disabled={Boolean(
                actionLoading
              )}
            />

            <div
              style={
                styles.statusBanner
              }
            >
              <div>
                <span>
                  Current task status
                </span>

                <strong>
                  {
                    selectedTask.campaignName
                  }
                </strong>
              </div>

              <TaskStatusBadge
                status={
                  selectedTask.taskStatus
                }
              />
            </div>

            <div
              style={
                styles.detailGrid
              }
            >
              <Detail
                label="Content Type"
                value={
                  contentTypeLabels[
                    selectedTask.contentType
                  ]
                }
              />

              <Detail
                label="Priority"
                value={
                  priorityLabels[
                    selectedTask.priority
                  ]
                }
              />

              <Detail
                label="Due Date"
                value={formatDate(
                  selectedTask.dueDate
                )}
              />

              <Detail
                label="Assigned To"
                value={
                  selectedTask.assignedUser
                    ?.fullName ||
                  'Unassigned'
                }
              />

              <Detail
                label="Created By"
                value={
                  selectedTask.createdBy
                    ?.fullName ||
                  'Not available'
                }
              />

              <Detail
                label="Submission Count"
                value={
                  selectedTask.submissionCount
                }
              />

              <Detail
                label="Description"
                value={
                  selectedTask.taskDescription ||
                  'No description'
                }
                fullWidth
              />

              {selectedTask.revisionNotes && (
                <Detail
                  label="Current Revision Notes"
                  value={
                    selectedTask.revisionNotes
                  }
                  fullWidth
                />
              )}
            </div>

            {isHead &&
              [
                'pending',
                'assigned',
              ].includes(
                selectedTask.taskStatus
              ) && (
                <ActionSection
                  title="Task Assignment"
                  description="Assign or reassign this task to an active Marketing Specialist."
                >
                  <div
                    style={
                      styles.assignmentRow
                    }
                  >
                    <select
                      value={
                        selectedAssignedUserId
                      }
                      onChange={(event) =>
                        setSelectedAssignedUserId(
                          event.target.value
                        )
                      }
                      style={styles.input}
                    >
                      <option value="">
                        Select Marketing Specialist
                      </option>

                      {marketingUsers.map(
                        (user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {user.fullName}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={
                        handleAssignTask
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
                        : 'Assign Task'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {isMarketingSpecialist &&
              [
                'assigned',
                'for_revision',
              ].includes(
                selectedTask.taskStatus
              ) && (
                <ActionSection
                  title={
                    selectedTask.taskStatus ===
                    'for_revision'
                      ? 'Start Revision'
                      : 'Start Task'
                  }
                  description={
                    selectedTask.taskStatus ===
                    'for_revision'
                      ? 'Begin working on the requested revisions.'
                      : 'Begin working on the assigned creative task.'
                  }
                >
                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleStartTask
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.primaryButton
                      }
                    >
                      {actionLoading ===
                      'start'
                        ? 'Starting...'
                        : selectedTask.taskStatus ===
                          'for_revision'
                        ? 'Start Revision'
                        : 'Start Task'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {isMarketingSpecialist &&
              selectedTask.taskStatus ===
                'in_progress' && (
                <form
                  onSubmit={
                    handleSubmitOutput
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
                    Submit Marketing
                    Output
                  </h3>

                  <p
                    style={
                      styles.actionDescription
                    }
                  >
                    Submit the Google
                    Drive, Canva, social
                    media draft, or other
                    accessible output
                    link.
                  </p>

                  <Field label="Output link">
                    <input
                      type="url"
                      value={outputLink}
                      onChange={(event) =>
                        setOutputLink(
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                      style={styles.input}
                      required
                    />
                  </Field>

                  <Field label="Submission notes">
                    <textarea
                      value={
                        submissionNotes
                      }
                      onChange={(event) =>
                        setSubmissionNotes(
                          event.target.value
                        )
                      }
                      placeholder="Describe the submitted output"
                      style={
                        styles.textarea
                      }
                    />
                  </Field>

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
                      'submit'
                        ? 'Submitting...'
                        : 'Submit for Review'}
                    </button>
                  </div>
                </form>
              )}

            {isHead &&
              selectedTask.taskStatus ===
                'submitted' &&
              latestPendingSubmission && (
                <ActionSection
                  title="Review Latest Submission"
                  description={`Review Submission #${latestPendingSubmission.submissionNumber}.`}
                >
                  <div
                    style={
                      styles.submissionPreview
                    }
                  >
                    <div>
                      <span>
                        Submitted By
                      </span>

                      <strong>
                        {
                          latestPendingSubmission
                            .submittedBy
                            ?.fullName
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Submitted At
                      </span>

                      <strong>
                        {formatDate(
                          latestPendingSubmission.submittedAt
                        )}
                      </strong>
                    </div>

                    <a
                      href={
                        latestPendingSubmission.outputLink
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={
                        styles.outputLink
                      }
                    >
                      Open Submitted Output
                    </a>
                  </div>

                  <Field label="Review or revision notes">
                    <textarea
                      value={reviewNotes}
                      onChange={(event) =>
                        setReviewNotes(
                          event.target.value
                        )
                      }
                      placeholder="Required when requesting a revision"
                      style={
                        styles.textarea
                      }
                    />
                  </Field>

                  <div
                    style={
                      styles.reviewActions
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleReviewSubmission(
                          latestPendingSubmission.id,
                          'for_revision'
                        )
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.revisionButton
                      }
                    >
                      {actionLoading ===
                      'review-for_revision'
                        ? 'Requesting...'
                        : 'Request Revision'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleReviewSubmission(
                          latestPendingSubmission.id,
                          'approved'
                        )
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.approveButton
                      }
                    >
                      {actionLoading ===
                      'review-approved'
                        ? 'Approving...'
                        : 'Approve Submission'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {isMarketingSpecialist &&
              selectedTask.taskStatus ===
                'approved' && (
                <ActionSection
                  title="Complete Approved Task"
                  description="The submitted Marketing output was approved. Mark the task as completed after final publication or delivery."
                >
                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleCompleteTask
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.approveButton
                      }
                    >
                      {actionLoading ===
                      'complete'
                        ? 'Completing...'
                        : 'Mark as Completed'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {selectedTask.submissions
              ?.length > 0 && (
              <>
                <h3
                  style={
                    styles.subsectionTitle
                  }
                >
                  Submission History
                </h3>

                <div
                  style={
                    styles.submissionList
                  }
                >
                  {selectedTask.submissions.map(
                    (submission) => (
                      <article
                        key={
                          submission.id
                        }
                        style={
                          styles.submissionCard
                        }
                      >
                        <div
                          style={
                            styles.submissionHeader
                          }
                        >
                          <div>
                            <strong>
                              Submission #
                              {
                                submission.submissionNumber
                              }
                            </strong>

                            <p
                              style={
                                styles.secondaryText
                              }
                            >
                              Submitted by{' '}
                              {
                                submission
                                  .submittedBy
                                  ?.fullName
                              }
                              {' · '}
                              {formatDate(
                                submission.submittedAt
                              )}
                            </p>
                          </div>

                          <ReviewStatusBadge
                            status={
                              submission.reviewStatus
                            }
                          />
                        </div>

                        <a
                          href={
                            submission.outputLink
                          }
                          target="_blank"
                          rel="noreferrer"
                          style={
                            styles.outputLink
                          }
                        >
                          Open Output Link
                        </a>

                        {submission.submissionNotes && (
                          <DetailBlock
                            label="Submission Notes"
                            value={
                              submission.submissionNotes
                            }
                          />
                        )}

                        {submission.reviewNotes && (
                          <DetailBlock
                            label="Review Notes"
                            value={
                              submission.reviewNotes
                            }
                          />
                        )}

                        {submission.reviewedBy && (
                          <p
                            style={
                              styles.reviewMetadata
                            }
                          >
                            Reviewed by{' '}
                            {
                              submission
                                .reviewedBy
                                .fullName
                            }
                            {' · '}
                            {formatDate(
                              submission.reviewedAt
                            )}
                          </p>
                        )}
                      </article>
                    )
                  )}
                </div>
              </>
            )}

            <h3
              style={
                styles.subsectionTitle
              }
            >
              Status History
            </h3>

            {!selectedTask.statusHistory ||
            selectedTask.statusHistory
              .length === 0 ? (
              <div
                style={
                  styles.emptyHistory
                }
              >
                No task history found.
              </div>
            ) : (
              <div
                style={
                  styles.historyList
                }
              >
                {selectedTask.statusHistory.map(
                  (history) => (
                    <article
                      key={history.id}
                      style={
                        styles.historyItem
                      }
                    >
                      <div>
                        <strong>
                          {
                            taskStatusLabels[
                              history.newStatus
                            ]
                          }
                        </strong>

                        <p
                          style={
                            styles.secondaryText
                          }
                        >
                          Changed by{' '}
                          {history.changedBy
                            ?.fullName ||
                            'System'}
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
                            {history.notes}
                          </p>
                        )}
                      </div>
                    </article>
                  )
                )}
              </div>
            )}

            {isHead &&
              ![
                'completed',
                'cancelled',
              ].includes(
                selectedTask.taskStatus
              ) && (
                <ActionSection
                  title="Cancel Marketing Task"
                  description="A cancellation reason is required and will be recorded in the task history."
                >
                  <Field label="Cancellation reason">
                    <textarea
                      value={
                        cancellationNotes
                      }
                      onChange={(event) =>
                        setCancellationNotes(
                          event.target.value
                        )
                      }
                      placeholder="Enter cancellation reason"
                      style={
                        styles.textarea
                      }
                    />
                  </Field>

                  <div
                    style={
                      styles.actionRow
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        handleCancelTask
                      }
                      disabled={Boolean(
                        actionLoading
                      )}
                      style={
                        styles.cancelButton
                      }
                    >
                      {actionLoading ===
                      'cancel'
                        ? 'Cancelling...'
                        : 'Cancel Task'}
                    </button>
                  </div>
                </ActionSection>
              )}

            {selectedTask.taskStatus ===
              'completed' && (
              <div
                style={
                  styles.completedMessage
                }
              >
                <strong>
                  Marketing task completed
                </strong>

                <span>
                  {formatDate(
                    selectedTask.completedAt
                  )}
                </span>
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
        {value ?? 'Not available'}
      </strong>
    </div>
  );
}

function DetailLine({
  label,
  value,
}) {
  return (
    <div
      style={styles.detailLine}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailBlock({
  label,
  value,
}) {
  return (
    <div
      style={styles.detailBlock}
    >
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function CampaignStatusBadge({
  status,
}) {
  const statusStyles = {
    planning:
      styles.planningBadge,

    active:
      styles.activeBadge,

    completed:
      styles.completedBadge,

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
      {campaignStatusLabels[status] ||
        status}
    </span>
  );
}

function TaskStatusBadge({
  status,
}) {
  const statusStyles = {
    pending:
      styles.pendingBadge,

    assigned:
      styles.assignedBadge,

    in_progress:
      styles.progressBadge,

    submitted:
      styles.submittedBadge,

    for_revision:
      styles.revisionBadge,

    approved:
      styles.approvedBadge,

    completed:
      styles.completedBadge,

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
      {taskStatusLabels[status] ||
        status}
    </span>
  );
}

function ReviewStatusBadge({
  status,
}) {
  const statusStyles = {
    pending_review:
      styles.pendingBadge,

    approved:
      styles.approvedBadge,

    for_revision:
      styles.revisionBadge,
  };

  return (
    <span
      style={{
        ...styles.statusBadge,

        ...(statusStyles[status] ||
          {}),
      }}
    >
      {reviewStatusLabels[status] ||
        status}
    </span>
  );
}

function PriorityBadge({
  priority,
}) {
  const priorityStyles = {
    low: styles.lowPriority,
    medium:
      styles.mediumPriority,
    high: styles.highPriority,
    urgent:
      styles.urgentPriority,
  };

  return (
    <span
      style={{
        ...styles.priorityBadge,

        ...(priorityStyles[
          priority
        ] || {}),
      }}
    >
      {priorityLabels[priority] ||
        priority}
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

  headerActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
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

  campaignSection: {
    marginTop: '18px',
    padding: '20px',
    borderRadius: '15px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  sectionHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: '16px',
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

  campaignGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '14px',
  },

  campaignCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '13px',
    padding: '17px',
    borderRadius: '12px',
    background: colors.cream,
    border: `1px solid ${colors.border}`,
  },

  campaignCardHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },

  campaignCode: {
    margin: 0,
    color: colors.roseDeep,
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1px',
  },

  campaignName: {
    margin: '5px 0 0',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  campaignDescription: {
    margin: 0,
    minHeight: '34px',
    color: colors.mutedInk,
    fontSize: '10px',
    lineHeight: 1.6,
  },

  campaignDetails: {
    display: 'grid',
    gap: '7px',
  },

  detailLine: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: '12px',
    color: colors.mutedInk,
    fontSize: '9px',
  },

  cardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '7px',
    marginTop: 'auto',
  },

  smallPrimaryButton: {
    padding: '7px 10px',
    border: 'none',
    borderRadius: '7px',
    background: colors.rose,
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '9px',
    cursor: 'pointer',
  },

  smallSecondaryButton: {
    padding: '7px 10px',
    borderRadius: '7px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '9px',
    cursor: 'pointer',
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

  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    flexWrap: 'wrap',
  },

  searchInput: {
    width: '200px',
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
    maxWidth: '270px',
    color: colors.mutedInk,
    fontSize: '9px',
    lineHeight: 1.5,
  },

  unassignedText: {
    color: '#a33b51',
    fontWeight: 600,
  },

  overdueText: {
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
    padding: '35px',
    textAlign: 'center',
    color: colors.mutedInk,
    fontSize: '11px',
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

  smallModal: {
    width: '100%',
    maxWidth: '620px',
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
    gap: '16px',
    marginTop: '18px',
    padding: '14px',
    borderRadius: '10px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '10px',
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
    fontSize: '8px',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  },

  detailValue: {
    color: colors.ink,
    fontSize: '11px',
    lineHeight: 1.5,
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

  assignmentRow: {
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: '10px',
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
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '11px',
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
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
    padding: '11px 16px',
    borderRadius: '9px',
    border: `1px solid ${colors.border}`,
    background: '#ffffff',
    color: colors.ink,
    fontFamily: font.body,
    fontSize: '11px',
    cursor: 'pointer',
  },

  approveButton: {
    padding: '11px 16px',
    border: 'none',
    borderRadius: '9px',
    background: '#40825c',
    color: '#ffffff',
    fontFamily: font.body,
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  revisionButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: '1px solid #e4bd90',
    background: '#fff5d9',
    color: '#725b1e',
    fontFamily: font.body,
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  cancelButton: {
    padding: '11px 16px',
    borderRadius: '9px',
    border: '1px solid #e3aeb9',
    background: '#fff0f2',
    color: '#a33b51',
    fontFamily: font.body,
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  reviewActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },

  submissionPreview: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    padding: '13px',
    borderRadius: '9px',
    background: colors.cream,
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '9px',
  },

  outputLink: {
    gridColumn: '1 / -1',
    display: 'inline-block',
    width: 'fit-content',
    color: colors.roseDeep,
    fontSize: '10px',
    fontWeight: 600,
    textDecoration: 'none',
  },

  subsectionTitle: {
    margin: '24px 0 10px',
    color: colors.ink,
    fontFamily: font.display,
    fontSize: '18px',
    fontWeight: 500,
  },

  submissionList: {
    display: 'grid',
    gap: '10px',
  },

  submissionCard: {
    padding: '14px',
    borderRadius: '10px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
  },

  submissionHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'flex-start',
    gap: '14px',
    marginBottom: '11px',
    color: colors.ink,
    fontSize: '11px',
  },

  detailBlock: {
    marginTop: '11px',
    paddingTop: '10px',
    borderTop: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    fontSize: '9px',
    lineHeight: 1.6,
  },

  reviewMetadata: {
    margin: '10px 0 0',
    color: colors.mutedInk,
    fontSize: '9px',
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
    maxWidth: '50%',
    color: colors.mutedInk,
    fontSize: '9px',
    textAlign: 'right',
  },

  emptyHistory: {
    padding: '24px',
    borderRadius: '9px',
    background: '#ffffff',
    border: `1px solid ${colors.border}`,
    color: colors.mutedInk,
    textAlign: 'center',
    fontSize: '10px',
  },

  completedMessage: {
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

  statusBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '9px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  priorityBadge: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '9px',
    fontWeight: 600,
  },

  planningBadge: {
    background: '#fff5d9',
    color: '#725b1e',
  },

  activeBadge: {
    background: '#eaf0ff',
    color: '#355ca8',
  },

  pendingBadge: {
    background: '#eeeeee',
    color: '#666666',
  },

  assignedBadge: {
    background: '#edf2ff',
    color: '#4863a8',
  },

  progressBadge: {
    background: '#eaf0ff',
    color: '#355ca8',
  },

  submittedBadge: {
    background: '#f4ecff',
    color: '#7044a0',
  },

  revisionBadge: {
    background: '#fff5d9',
    color: '#725b1e',
  },

  approvedBadge: {
    background: '#e6f5f7',
    color: '#26727a',
  },

  completedBadge: {
    background: '#e9f7ee',
    color: '#287447',
  },

  cancelledBadge: {
    background: '#fff0f2',
    color: '#a33b51',
  },

  lowPriority: {
    background: '#eeeeee',
    color: '#666666',
  },

  mediumPriority: {
    background: '#edf2ff',
    color: '#4863a8',
  },

  highPriority: {
    background: '#fff5d9',
    color: '#725b1e',
  },

  urgentPriority: {
    background: '#fff0f2',
    color: '#a33b51',
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