<template>
  <section class="review-workbench">
    <header class="review-header">
      <a-space>
        <a-typography-title :level="4" class="page-title">审核工作台</a-typography-title>
        <a-tag color="blue">{{ filteredItems.length }} / {{ reviewableItems.length }} 条</a-tag>
        <a-tag :color="socketConnected ? 'green' : 'default'">{{ socketConnected ? '实时已连接' : '实时未连接' }}</a-tag>
      </a-space>
      <a-space wrap>
        <a-button size="small" @click="openClaimModal">
          <template #icon><InboxOutlined /></template>
          领取审核
        </a-button>
        <a-checkbox v-model:checked="continuousClaimEnabled">连续领取</a-checkbox>
        <a-button size="small" :disabled="!selectedItem" @click="flowModalOpen = true">
          <template #icon><HistoryOutlined /></template>
          流转记录
        </a-button>
        <a-spin v-if="annotationStore.loading" size="small" />
      </a-space>
    </header>

    <a-alert
      v-if="annotationStore.error"
      type="error"
      show-icon
      closable
      :message="annotationStore.error"
      class="page-alert"
      @close="annotationStore.error = null"
    />

    <a-card size="small" class="filter-card" :class="{ 'filter-card--active': hasActiveFilters }">
      <div class="filter-card-content">
        <a-space wrap class="filter-controls">
          <a-space size="small" :class="{ 'filter-label--active': hasActiveFilters }">
            <FilterOutlined />
            <span>筛选</span>
          </a-space>
          <a-select
            v-model:value="filters.status"
            allow-clear
            placeholder="审核状态"
            size="small"
            class="filter-select"
            :options="statusFilterOptions"
          />
          <a-select
            v-model:value="filters.taskId"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="所属任务"
            size="small"
            class="filter-select filter-select--wide"
            :options="taskOptions"
          />
          <a-select
            v-model:value="filters.annotator"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="标注员"
            size="small"
            class="filter-select"
            :options="annotatorOptions"
          />
          <a-select
            v-model:value="filters.aiReviewResult"
            allow-clear
            placeholder="AI 结论"
            size="small"
            class="filter-select"
            :options="aiReviewFilterOptions"
          />
          <a-input
            v-model:value="filters.keyword"
            allow-clear
            placeholder="搜索文件名/描述/ID"
            size="small"
            class="keyword-input"
          />
          <a-button v-if="hasActiveFilters" type="link" size="small" danger @click="clearFilters">
            <template #icon><ClearOutlined /></template>
            清除
          </a-button>
        </a-space>

        <a-space v-if="canReviewSelected" class="filter-review-actions">
          <a-button type="primary" :loading="approving" @click="approveSelected">
            <template #icon><CheckCircleOutlined /></template>
            审核通过
          </a-button>
          <a-button danger @click="openRejectModal">
            <template #icon><CloseCircleOutlined /></template>
            驳回
          </a-button>
        </a-space>
      </div>
    </a-card>

    <a-spin :spinning="annotationStore.loading && reviewableItems.length === 0">
      <a-card v-if="reviewableItems.length === 0" class="empty-card">
        <a-empty description="暂无已领取的审核数据">
          <a-space direction="vertical" align="center">
            <a-typography-text type="secondary">可点击“领取审核”从任务池领取待审数据。</a-typography-text>
            <a-button type="primary" @click="openClaimModal">
              <template #icon><InboxOutlined /></template>
              领取审核
            </a-button>
          </a-space>
        </a-empty>
      </a-card>

      <div v-else class="review-main">
        <a-card title="审核列表" size="small" class="review-list-card" :body-style="{ padding: 0 }">
          <a-empty v-if="filteredItems.length === 0" description="没有匹配筛选条件的数据" class="list-empty" />
          <div v-else class="review-list">
            <template v-for="group in groupedItems" :key="group.taskId">
              <div class="group-title">任务：{{ taskName(group.taskId) }}</div>
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                class="review-list-item"
                :class="{ 'review-list-item--selected': item.id === selectedId }"
                @click="selectedId = item.id"
              >
                <div class="item-title-row">
                  <a-typography-text strong ellipsis class="item-title">
                    {{ String(item.rawData.fileName ?? item.id) }}
                  </a-typography-text>
                  <a-tag :color="itemStatusTag(item).color" class="item-tag">{{ itemStatusTag(item).label }}</a-tag>
                </div>
                <a-typography-paragraph type="secondary" :ellipsis="{ rows: 1 }" class="item-desc">
                  {{ String(item.rawData.description ?? '') }}
                </a-typography-paragraph>
                <div class="item-meta">
                  {{ item.annotator ?? '未分配标注员' }} · {{ formatShortTime(item.submittedAt) }}
                </div>
              </button>
            </template>
          </div>
        </a-card>

        <a-card title="审核内容" size="small" class="content-card">
          <a-empty v-if="!selectedItem" description="请选择待审核数据" />
          <template v-else>
            <a-descriptions title="原始数据" size="small" bordered :column="1" class="content-section">
              <a-descriptions-item v-for="[key, value] in Object.entries(selectedItem.rawData)" :key="key" :label="key">
                <a v-if="key === 'imageUrl'" :href="String(value)" target="_blank" rel="noopener noreferrer">{{ String(value) }}</a>
                <span v-else>{{ String(value) }}</span>
              </a-descriptions-item>
            </a-descriptions>

            <a-divider />

            <a-descriptions title="标注结果" size="small" bordered :column="1">
              <a-descriptions-item v-if="!selectedItem.annotationData" label="标注数据">
                暂无标注数据
              </a-descriptions-item>
              <a-descriptions-item
                v-for="[key, value] in Object.entries(selectedItem.annotationData ?? {})"
                v-else
                :key="key"
                :label="fieldLabel(key)"
              >
                <span v-if="Array.isArray(value)">{{ value.join(', ') }}</span>
                <span v-else>{{ String(value) }}</span>
              </a-descriptions-item>
            </a-descriptions>
          </template>
        </a-card>

        <a-card title="审核操作" size="small" class="action-card">
          <a-empty v-if="!selectedItem" description="请选择待审核数据">
            <a-space direction="vertical" align="center">
              <a-typography-text type="secondary">若列表为空，请先领取待审数据。</a-typography-text>
              <a-button type="primary" @click="openClaimModal">
                <template #icon><InboxOutlined /></template>
                领取审核
              </a-button>
            </a-space>
          </a-empty>
          <template v-else>
            <a-alert
              v-if="selectedAIReview"
              :type="aiStatusMeta(selectedAIReview.reviewStatus).alertType"
              show-icon
              class="ai-alert"
              :message="`${aiStatusMeta(selectedAIReview.reviewStatus).label} · ${selectedAIReview.score} 分`"
              :description="selectedAIReview.summary"
            />

            <a-space v-if="selectedAIReview?.fieldWarnings?.length" direction="vertical" class="warning-stack">
              <a-alert
                v-for="(warning, index) in selectedAIReview.fieldWarnings"
                :key="`${warning.fieldKey}-${index}`"
                :type="warning.severity === 'error' ? 'error' : warning.severity === 'warning' ? 'warning' : 'info'"
                show-icon
                :message="warning.fieldLabel"
                :description="warning.message"
              />
            </a-space>

            <a-divider />

            <a-alert
              v-if="selectedItem.status === DataItemStatus.REVIEWED"
              type="success"
              show-icon
              message="该数据已审核通过"
              :description="`审核员：${selectedItem.reviewer ?? '未知'}；审核时间：${formatTime(selectedItem.reviewedAt)}`"
            />
            <a-alert
              v-else-if="selectedItem.status === DataItemStatus.REJECTED"
              type="error"
              show-icon
              message="该数据已被驳回"
              :description="selectedItem.rejectReason || '未填写驳回原因'"
            />
          </template>
        </a-card>
      </div>
    </a-spin>

    <a-modal v-model:open="claimModalOpen" title="领取审核任务" width="780px" :footer="null" destroy-on-close>
      <div class="lh-modal-stack">
      <a-space wrap class="claim-toolbar lh-modal-toolbar">
        <a-button size="small" :loading="reviewPoolLoading" @click="loadReviewPool">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button
          size="small"
          type="primary"
          :loading="batchClaiming"
          :disabled="selectedClaimIds.length === 0"
          @click="batchClaimReviews"
        >
          批量领取 {{ selectedClaimIds.length || '' }}
        </a-button>
        <a-checkbox v-model:checked="continuousClaimEnabled">连续领取</a-checkbox>
        <a-typography-text type="secondary">仅展示尚未分配审核员的待审数据。</a-typography-text>
      </a-space>
      <a-table
        row-key="id"
        size="small"
        class="lh-modal-table"
        :loading="reviewPoolLoading"
        :data-source="reviewPoolItems"
        :columns="claimColumns"
        :pagination="{ pageSize: 8 }"
        :row-selection="{ selectedRowKeys: selectedClaimIds, onChange: onClaimSelectionChange }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'taskId'">{{ taskName(record.taskId) }}</template>
          <template v-else-if="column.key === 'annotator'">{{ record.annotator || '未分配' }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" :loading="claimingId === record.id" @click="claimReview(record.id)">
              领取
            </a-button>
          </template>
        </template>
      </a-table>
      </div>
    </a-modal>

    <a-modal v-model:open="flowModalOpen" title="流转记录" width="760px" :footer="null">
      <div class="lh-modal-detail">
      <a-empty v-if="!selectedItem || selectedItem.auditHistory.length === 0" description="暂无审核记录" />
      <a-timeline v-else mode="left" class="audit-timeline">
        <a-timeline-item
          v-for="record in selectedItem.auditHistory"
          :key="record.id"
          :color="actionMeta(record.actionType).color"
        >
          <div class="timeline-row">
            <a-space wrap>
              <a-tag :color="actionMeta(record.actionType).tagColor">{{ actionMeta(record.actionType).label }}</a-tag>
              <a-tag>{{ statusLabel(record.fromStatus) }}</a-tag>
              <span class="timeline-arrow">→</span>
              <a-tag>{{ statusLabel(record.toStatus) }}</a-tag>
            </a-space>
            <div class="timeline-meta">
              {{ record.operator }} · {{ formatTime(record.timestamp) }}
            </div>
            <a-typography-paragraph v-if="record.reason" class="timeline-reason">
              {{ record.reason }}
            </a-typography-paragraph>
          </div>
        </a-timeline-item>
      </a-timeline>
      </div>
    </a-modal>

    <a-modal
      v-model:open="rejectModalOpen"
      title="驳回标注"
      ok-text="确认驳回"
      cancel-text="取消"
      :confirm-loading="rejecting"
      :ok-button-props="{ danger: true }"
      @ok="rejectSelected"
    >
      <div class="lh-modal-stack">
      <a-alert
        type="warning"
        show-icon
        message="驳回后数据会返回给标注员重新修改，请填写清晰的原因。"
        class="reject-alert"
      />
      <a-textarea v-model:value="rejectReason" :rows="5" :maxlength="500" show-count placeholder="请输入驳回原因" />
      </div>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { message, Modal, type TableColumnsType } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  FilterOutlined,
  HistoryOutlined,
  InboxOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import {
  AuditActionType,
  DataItemStatus,
  STATUS_DISPLAY_CONFIG,
  TaskStatus,
  type AuditHistoryRecord,
  type DataItem,
  type TaskItem,
  type TemplateField,
} from '../../types';
import { ReviewStatus, type AIReviewResult } from '../../types/aiReview';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getTemplateSchemaAsync } from '../../utils/templateSchemaHelper';
import * as taskApi from '../../api/task';
import * as annotationApi from '../../api/annotation';
import type { AvailableItem } from '../../api/annotation';
import {
  connectNotificationWS,
  getSocket,
  joinTaskRoom,
  leaveTaskRoom,
  type Notification,
} from '../../services/notificationWebSocket';

interface FilterState {
  status?: string;
  taskId?: string;
  annotator?: string;
  aiReviewResult?: string;
  keyword?: string;
}

interface GroupedItems {
  taskId: string;
  items: DataItem[];
}

const route = useRoute();
const annotationStore = useAnnotationStore();
const authStore = useAuthStore();

const filters = reactive<FilterState>({});
const tasks = ref<TaskItem[]>([]);
const selectedId = ref<string | null>(null);
const claimModalOpen = ref(false);
const flowModalOpen = ref(false);
const rejectModalOpen = ref(false);
const rejectReason = ref('');
const reviewPoolItems = ref<AvailableItem[]>([]);
const reviewPoolLoading = ref(false);
const claimingId = ref<string | null>(null);
const batchClaiming = ref(false);
const selectedClaimIds = ref<string[]>([]);
const continuousClaimEnabled = ref(false);
const approving = ref(false);
const rejecting = ref(false);
const socketConnected = ref(false);
const templateMap = ref<Record<string, TemplateField[]>>({});
const joinedTaskIds = new Set<string>();

const queryTaskId = computed(() => (typeof route.query.taskId === 'string' ? route.query.taskId : undefined));
const queryDataItemId = computed(() => (typeof route.query.dataItemId === 'string' ? route.query.dataItemId : undefined));

const statusFilterOptions = [
  { label: 'AI 预审中', value: 'ai_reviewing_group' },
  { label: '待人工审核', value: DataItemStatus.PENDING_REVIEW },
  { label: '审核通过', value: DataItemStatus.REVIEWED },
  { label: '审核驳回', value: DataItemStatus.REJECTED },
];
const aiReviewFilterOptions = [
  { label: 'AI 通过', value: ReviewStatus.PASS },
  { label: 'AI 风险', value: ReviewStatus.RISK },
  { label: 'AI 不通过', value: ReviewStatus.FAIL },
];
const claimColumns: TableColumnsType<AvailableItem> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 112, ellipsis: true },
  { title: '任务', dataIndex: 'taskId', key: 'taskId', width: 128, ellipsis: true, responsive: ['md'] },
  { title: '状态', dataIndex: 'status', key: 'status', width: 96 },
  { title: '标注员', dataIndex: 'annotator', key: 'annotator', width: 96, responsive: ['lg'] },
  { title: '数据摘要', dataIndex: 'rawDataPreview', key: 'rawDataPreview', ellipsis: true },
  { title: '操作', key: 'action', width: 72 },
];
const REVIEW_ACTIONABLE_STATUSES = new Set<DataItemStatus>([
  DataItemStatus.SUBMITTED,
  DataItemStatus.AI_REVIEWING,
  DataItemStatus.AI_REVIEWED,
  DataItemStatus.PENDING_REVIEW,
]);

const reviewableItems = computed(() =>
  annotationStore.dataItems.filter((item) =>
    !item.archived &&
    [
      DataItemStatus.SUBMITTED,
      DataItemStatus.AI_REVIEWING,
      DataItemStatus.AI_REVIEWED,
      DataItemStatus.PENDING_REVIEW,
      DataItemStatus.REVIEWED,
      DataItemStatus.REJECTED,
    ].includes(item.status),
  ),
);

const aiResultMap = computed(() => {
  const map = new Map<string, AIReviewResult>();
  annotationStore.aiReviewResults.forEach((result) => map.set(result.dataItemId, result));
  return map;
});

const taskOptions = computed(() =>
  tasks.value
    .filter((task) => task.status === TaskStatus.IN_PROGRESS)
    .map((task) => ({ label: task.name, value: task.id })),
);

const annotatorOptions = computed(() => {
  const annotators = new Set<string>();
  reviewableItems.value.forEach((item) => {
    if (item.annotator) annotators.add(item.annotator);
  });
  return Array.from(annotators).sort().map((annotator) => ({ label: annotator, value: annotator }));
});

const filteredItems = computed(() => {
  let result = reviewableItems.value;
  if (filters.status) {
    if (filters.status === 'ai_reviewing_group') {
      result = result.filter((item) =>
        [DataItemStatus.SUBMITTED, DataItemStatus.AI_REVIEWING, DataItemStatus.AI_REVIEWED].includes(item.status),
      );
    } else {
      result = result.filter((item) => item.status === filters.status);
    }
  }
  if (filters.taskId) result = result.filter((item) => item.taskId === filters.taskId);
  if (filters.annotator) result = result.filter((item) => item.annotator === filters.annotator);
  if (filters.aiReviewResult) {
    result = result.filter((item) => aiResultMap.value.get(item.id)?.reviewStatus === filters.aiReviewResult);
  }
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    result = result.filter((item) => {
      const fileName = String(item.rawData.fileName ?? '').toLowerCase();
      const description = String(item.rawData.description ?? '').toLowerCase();
      return fileName.includes(keyword) || description.includes(keyword) || item.id.toLowerCase().includes(keyword);
    });
  }
  return result;
});

const groupedItems = computed<GroupedItems[]>(() => {
  const groups = new Map<string, DataItem[]>();
  filteredItems.value.forEach((item) => {
    const list = groups.get(item.taskId) ?? [];
    list.push(item);
    groups.set(item.taskId, list);
  });
  return Array.from(groups.entries()).map(([taskId, items]) => ({ taskId, items }));
});

const hasActiveFilters = computed(() => Boolean(filters.status || filters.taskId || filters.annotator || filters.aiReviewResult || filters.keyword));
const selectedItem = computed(() => (selectedId.value ? annotationStore.dataItems.find((item) => item.id === selectedId.value) ?? null : null));
const selectedAIReview = computed(() => (selectedItem.value ? aiResultMap.value.get(selectedItem.value.id) : undefined));
const canReviewSelected = computed(() => {
  const status = selectedItem.value?.status;
  return status ? REVIEW_ACTIONABLE_STATUSES.has(status) : false;
});

onMounted(() => {
  if (queryTaskId.value) filters.taskId = queryTaskId.value;
  void loadInitialData();
  setupSocketLifecycle();
});

onBeforeUnmount(() => {
  const socket = getSocket();
  socket?.off('connect', handleSocketConnect);
  socket?.off('disconnect', handleSocketDisconnect);
  socket?.off('notification', handleSocketNotification);
  joinedTaskIds.forEach((taskId) => leaveTaskRoom(taskId));
  joinedTaskIds.clear();
});

watch(
  () => queryTaskId.value,
  (taskId) => {
    if (taskId) filters.taskId = taskId;
    void refreshData();
  },
);

watch(
  () => queryDataItemId.value,
  (id) => {
    if (id && annotationStore.dataItems.some((item) => item.id === id)) {
      selectedId.value = id;
    }
  },
  { immediate: true },
);

watch(
  () => annotationStore.dataItems.map((item) => item.taskId),
  (taskIds) => {
    Array.from(new Set(taskIds)).forEach((taskId) => {
      if (!joinedTaskIds.has(taskId)) {
        joinTaskRoom(taskId);
        joinedTaskIds.add(taskId);
      }
    });
  },
  { deep: true },
);

watch(
  () => filteredItems.value.map((item) => item.id),
  (ids) => {
    const preferredId = filteredItems.value.find((item) => REVIEW_ACTIONABLE_STATUSES.has(item.status))?.id ?? ids[0] ?? null;
    if (selectedId.value && !ids.includes(selectedId.value)) {
      selectedId.value = preferredId;
    } else if (!selectedId.value && ids.length > 0) {
      selectedId.value = preferredId;
    }
  },
  { immediate: true },
);

watch(
  () => tasks.value.map((task) => `${task.id}:${task.templateId}`),
  () => {
    void preloadTemplates();
  },
  { deep: true },
);

async function loadInitialData() {
  await Promise.all([refreshData(), loadTasks()]);
}

async function refreshData() {
  await Promise.all([
    annotationStore.fetchDataItems(queryTaskId.value),
    annotationStore.fetchAIReviews(queryTaskId.value),
  ]);
}

async function loadTasks() {
  try {
    const res = await taskApi.getTaskList();
    tasks.value = res.data.items || [];
  } catch {
    tasks.value = [];
  }
}

function setupSocketLifecycle() {
  const token = authStore.token || localStorage.getItem('token');
  if (token) connectNotificationWS(token);

  const socket = getSocket();
  if (!socket) return;
  socketConnected.value = socket.connected;
  socket.on('connect', handleSocketConnect);
  socket.on('disconnect', handleSocketDisconnect);
  socket.on('notification', handleSocketNotification);
}

function handleSocketConnect() {
  socketConnected.value = true;
  joinedTaskIds.forEach((taskId) => joinTaskRoom(taskId));
}

function handleSocketDisconnect() {
  socketConnected.value = false;
}

function handleSocketNotification(notification: Notification) {
  const type = notification.type;
  if (
    type === 'task_submitted' ||
    type === 'task_resubmitted' ||
    type === 'ai_review_complete' ||
    type === 'review_approved' ||
    type === 'review_rejected'
  ) {
    void refreshData();
    if (claimModalOpen.value) void loadReviewPool();
  }
}

function clearFilters() {
  filters.status = undefined;
  filters.taskId = undefined;
  filters.annotator = undefined;
  filters.aiReviewResult = undefined;
  filters.keyword = undefined;
}

async function preloadTemplates() {
  const next: Record<string, TemplateField[]> = {};
  await Promise.all(tasks.value.map(async (task) => {
    const schema = await getTemplateSchemaAsync(task.templateId);
    if (schema) next[task.templateId] = schema.fields;
  }));
  templateMap.value = next;
}

function fieldLabel(fieldKey: string) {
  const task = selectedItem.value ? tasks.value.find((item) => item.id === selectedItem.value?.taskId) : undefined;
  const field = task ? templateMap.value[task.templateId]?.find((item) => item.fieldKey === fieldKey) : undefined;
  return field?.label || fieldKey;
}

function taskName(taskId: string) {
  return tasks.value.find((task) => task.id === taskId)?.name || taskId;
}

function itemStatusTag(item: DataItem) {
  if (item.status === DataItemStatus.PENDING_REVIEW) {
    const ai = aiResultMap.value.get(item.id);
    return ai ? { color: aiStatusMeta(ai.reviewStatus).tagColor, label: `${ai.score} 分` } : { color: 'processing', label: '待审核' };
  }
  if ([DataItemStatus.SUBMITTED, DataItemStatus.AI_REVIEWING, DataItemStatus.AI_REVIEWED].includes(item.status)) {
    return { color: 'purple', label: '预审中' };
  }
  if (item.status === DataItemStatus.REVIEWED) return { color: 'success', label: '已通过' };
  if (item.status === DataItemStatus.REJECTED) return { color: 'error', label: '已驳回' };
  return { color: 'default', label: statusLabel(item.status) };
}

function aiStatusMeta(status: ReviewStatus) {
  if (status === ReviewStatus.PASS) return { label: 'AI 通过', tagColor: 'success', alertType: 'success' as const };
  if (status === ReviewStatus.RISK) return { label: 'AI 风险', tagColor: 'warning', alertType: 'warning' as const };
  return { label: 'AI 不通过', tagColor: 'error', alertType: 'error' as const };
}

function statusLabel(status: DataItemStatus) {
  return STATUS_DISPLAY_CONFIG[status]?.label || status;
}

function actionMeta(actionType: AuditHistoryRecord['actionType']) {
  const fallback = { label: actionType, color: '#8c8c8c', tagColor: 'default' };
  return actionDisplay[actionType as AuditActionType] ?? fallback;
}

const actionDisplay: Record<AuditActionType, { label: string; color: string; tagColor: string }> = {
  [AuditActionType.SUBMIT]: { label: '提交标注', color: '#1890ff', tagColor: 'processing' },
  [AuditActionType.SAVE_DRAFT]: { label: '保存草稿', color: '#faad14', tagColor: 'warning' },
  [AuditActionType.CLAIM_ASSIGNMENT]: { label: '领取标注', color: '#2f54eb', tagColor: 'blue' },
  [AuditActionType.AI_REVIEW_START]: { label: 'AI预审开始', color: '#722ed1', tagColor: 'purple' },
  [AuditActionType.AI_REVIEW_COMPLETE]: { label: 'AI预审完成', color: '#13c2c2', tagColor: 'cyan' },
  [AuditActionType.ASSIGN_REVIEWER]: { label: '分配审核员', color: '#fa8c16', tagColor: 'orange' },
  [AuditActionType.CLAIM_REVIEW]: { label: '领取审核', color: '#1677ff', tagColor: 'processing' },
  [AuditActionType.APPROVE]: { label: '审核通过', color: '#52c41a', tagColor: 'success' },
  [AuditActionType.REJECT]: { label: '审核驳回', color: '#ff4d4f', tagColor: 'error' },
  [AuditActionType.RESUBMIT]: { label: '重新提交', color: '#1890ff', tagColor: 'processing' },
  [AuditActionType.RELEASE_ANNOTATION_DUE_OVERDUE]: { label: '标注逾期释放', color: '#fa8c16', tagColor: 'warning' },
  [AuditActionType.RELEASE_REVIEW_DUE_OVERDUE]: { label: '审核逾期释放', color: '#fa8c16', tagColor: 'warning' },
  [AuditActionType.ARCHIVE]: { label: '归档', color: '#52c41a', tagColor: 'success' },
  [AuditActionType.UNARCHIVE]: { label: '取消归档', color: '#faad14', tagColor: 'warning' },
};

function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN') : '未知';
}

function formatShortTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未提交';
}

async function openClaimModal() {
  claimModalOpen.value = true;
  selectedClaimIds.value = [];
  await loadReviewPool();
}

async function loadReviewPool() {
  reviewPoolLoading.value = true;
  try {
    const res = await annotationApi.getReviewAvailableItems(filters.taskId ? { taskId: filters.taskId } : undefined);
    reviewPoolItems.value = res.data.items || [];
    return reviewPoolItems.value;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载审核任务池失败');
    return [];
  } finally {
    reviewPoolLoading.value = false;
  }
}

function onClaimSelectionChange(keys: Array<string | number>) {
  selectedClaimIds.value = keys.map(String);
}

async function claimReview(id: string) {
  claimingId.value = id;
  try {
    await annotationApi.claimReview(id);
    message.success('审核项领取成功');
    await refreshData();
    await loadReviewPool();
    selectedId.value = id;
    claimModalOpen.value = false;
  } catch (error) {
    Modal.warning({ title: '领取失败', content: error instanceof Error ? error.message : '领取审核项失败' });
  } finally {
    claimingId.value = null;
  }
}

async function batchClaimReviews(ids = selectedClaimIds.value) {
  if (ids.length === 0) {
    message.warning('请先选择要领取的审核任务');
    return;
  }

  batchClaiming.value = true;
  try {
    const res = await annotationApi.batchClaimReviews(ids);
    const result = res.data;
    selectedClaimIds.value = selectedClaimIds.value.filter((id) => !result.claimed.some((item) => item.id === id));
    const first = result.claimed[0];
    if (first) {
      message.success(`已领取 ${result.claimedCount} 条审核任务`);
      await refreshData();
      await loadReviewPool();
      selectedId.value = first.id;
      claimModalOpen.value = false;
    }
    if (result.failedCount > 0) {
      message.warning(`${result.failedCount} 条领取失败，可能已被分配或不在可领取状态`);
    }
  } catch (error) {
    Modal.warning({ title: '批量领取失败', content: error instanceof Error ? error.message : '批量领取审核项失败' });
  } finally {
    batchClaiming.value = false;
  }
}

async function tryContinuousClaim() {
  if (!continuousClaimEnabled.value) return;
  const pool = await loadReviewPool();
  const next = pool[0];
  if (!next) {
    message.info('当前任务暂无可连续领取的审核数据');
    return;
  }
  await batchClaimReviews([next.id]);
}

async function approveSelected() {
  if (!selectedItem.value) return;
  approving.value = true;
  try {
    await annotationApi.approveAnnotation(selectedItem.value.id);
    message.success('审核通过');
    await refreshData();
    await tryContinuousClaim();
  } catch (error) {
    Modal.warning({ title: '审核失败', content: error instanceof Error ? error.message : '审核通过失败' });
  } finally {
    approving.value = false;
  }
}

function openRejectModal() {
  rejectReason.value = '';
  rejectModalOpen.value = true;
}

async function rejectSelected() {
  if (!selectedItem.value) return;
  if (!rejectReason.value.trim()) {
    message.warning('请填写驳回原因');
    return;
  }
  rejecting.value = true;
  try {
    await annotationApi.rejectAnnotation(selectedItem.value.id, rejectReason.value.trim());
    message.success('已驳回');
    rejectModalOpen.value = false;
    await refreshData();
    await tryContinuousClaim();
  } catch (error) {
    Modal.warning({ title: '审核失败', content: error instanceof Error ? error.message : '驳回失败' });
  } finally {
    rejecting.value = false;
  }
}
</script>

<style scoped>
.review-workbench {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 92px);
  min-height: 640px;
  overflow: hidden;
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  padding: 0 2px 10px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--lh-divider);
  border-radius: 0;
  box-shadow: none;
}

.page-title {
  margin: 0;
}

.page-alert,
.filter-card {
  margin-bottom: 8px;
}

.filter-card--active {
  border-color: transparent !important;
  box-shadow: none !important;
}

.filter-card {
  transition:
    background-color var(--lh-motion-base) var(--lh-ease-standard),
    border-color var(--lh-motion-base) var(--lh-ease-standard);
}

.filter-card:hover {
  background: #fbfdff !important;
}

.filter-card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-controls {
  flex: 1;
  min-width: 0;
}

.filter-label--active {
  color: var(--lh-primary);
  font-weight: 600;
}

.filter-select {
  width: 120px;
}

.filter-select--wide {
  width: 160px;
}

.keyword-input {
  width: 200px;
}

.empty-card {
  flex: 1;
  min-height: 0;
}

.review-main {
  display: grid;
  grid-template-columns: minmax(270px, 320px) minmax(420px, 1fr) minmax(320px, 360px);
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--lh-border);
  border-radius: 8px;
  animation: lh-review-enter var(--lh-motion-slow) var(--lh-ease-emphasized);
  transition:
    border-color var(--lh-motion-base) var(--lh-ease-standard),
    box-shadow var(--lh-motion-base) var(--lh-ease-standard);
}

.review-main:hover {
  border-color: var(--lh-border-strong);
  box-shadow: 0 10px 22px rgba(60, 64, 67, 0.06);
}

.review-list-card,
.content-card,
.action-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  transition: background-color var(--lh-motion-base) var(--lh-ease-standard);
}

.review-list-card:hover,
.content-card:hover,
.action-card:hover {
  background: #fbfdff;
}

.review-list-card,
.content-card {
  border-right: 1px solid var(--lh-divider);
}

.review-list-card :deep(.ant-card-body),
.content-card :deep(.ant-card-body),
.action-card :deep(.ant-card-body) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.list-empty {
  padding: 48px 16px;
}

.review-list {
  height: 100%;
  overflow: auto;
}

.group-title {
  padding: 8px 14px;
  color: #5f6368;
  background: #f7f9fc;
  border-bottom: 1px solid var(--lh-divider);
  font-size: 13px;
  font-weight: 600;
}

.review-list-item {
  display: block;
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--lh-divider);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition:
    background-color var(--lh-motion-base) var(--lh-ease-standard),
    border-color var(--lh-motion-base) var(--lh-ease-standard),
    transform var(--lh-motion-base) var(--lh-ease-standard);
}

.review-list-item:hover {
  background: #f8fbff;
  transform: translateX(2px);
}

.review-list-item--selected {
  background: #eaf2ff;
  border-left-color: var(--lh-primary);
  transform: translateX(2px);
}

.item-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.item-title {
  flex: 1;
  min-width: 0;
}

.item-tag {
  margin: 0;
}

.item-desc {
  margin-bottom: 0;
  font-size: 12px;
}

.item-meta {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 11px;
}

.content-section {
  margin-bottom: 8px;
}

.ai-alert,
.warning-stack,
.claim-toolbar,
.reject-alert {
  margin-bottom: 12px;
}

.warning-stack {
  width: 100%;
}

.audit-timeline {
  margin-top: 12px;
}

.timeline-row {
  padding-bottom: 8px;
}

.timeline-meta {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 12px;
}

.timeline-arrow {
  color: #8c8c8c;
}

.timeline-reason {
  margin: 6px 0 0;
  padding: 6px 8px;
  background: #f8fafc;
  border-left: 3px solid #d7dde7;
  border-radius: 4px;
}

@keyframes lh-review-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1280px) {
  .review-workbench {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .review-main {
    grid-template-columns: minmax(270px, 320px) minmax(420px, 1fr);
  }

  .action-card {
    grid-column: 1 / -1;
    min-height: 420px;
  }
}

@media (max-width: 880px) {
  .review-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-card-content {
    align-items: flex-start;
    flex-direction: column;
  }

  .review-main {
    grid-template-columns: 1fr;
  }
}
</style>
