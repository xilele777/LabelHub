<template>
  <section class="review-workbench">
    <header class="review-header">
      <a-space>
        <a-typography-title :level="4" class="page-title">审核工作台</a-typography-title>
        <a-tag color="blue">{{ filteredItems.length }} / {{ reviewableItems.length }} 条</a-tag>
        <a-tag :color="socketConnected ? 'green' : 'default'">
          {{ socketConnected ? '实时已连接' : '实时未连接' }}
        </a-tag>
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
            <a-typography-text type="secondary">
              可点击“领取审核”从任务池领取待审数据。
            </a-typography-text>
            <a-button type="primary" @click="openClaimModal">
              <template #icon><InboxOutlined /></template>
              领取审核
            </a-button>
          </a-space>
        </a-empty>
      </a-card>

      <div v-else class="review-main">
        <a-card title="审核列表" size="small" class="review-list-card" :body-style="{ padding: 0 }">
          <a-empty
            v-if="filteredItems.length === 0"
            description="没有匹配筛选条件的数据"
            class="list-empty"
          />
          <div
            v-else
            ref="listContainerRef"
            class="review-list"
            role="listbox"
            aria-label="审核数据列表"
            tabindex="0"
            @scroll.passive="onListScroll"
            @keydown="onListKeydown"
          >
            <!-- 虚拟滚动：phantom 层撑起总高度，仅渲染视口内（含 overscan）的行 -->
            <div class="review-list-phantom" :style="{ height: `${listTotalHeight}px` }">
              <div
                v-for="row in visibleListRows"
                :key="row.data.key"
                class="review-list-row"
                :style="{ transform: `translateY(${row.offset}px)`, height: `${row.height}px` }"
              >
                <div v-if="row.data.type === 'group'" class="group-title">
                  任务：{{ taskName(row.data.taskId) }}
                </div>
                <button
                  v-else
                  type="button"
                  class="review-list-item"
                  :class="{ 'review-list-item--selected': row.data.item.id === selectedId }"
                  role="option"
                  :aria-selected="row.data.item.id === selectedId"
                  :aria-label="`数据 ${String(row.data.item.rawData.fileName ?? row.data.item.id)}`"
                  @click="selectAndFocus(row.data.item.id)"
                >
                  <div class="item-title-row">
                    <a-typography-text strong ellipsis class="item-title">
                      {{ String(row.data.item.rawData.fileName ?? row.data.item.id) }}
                    </a-typography-text>
                    <a-tag :color="itemStatusTag(row.data.item).color" class="item-tag">
                      {{ itemStatusTag(row.data.item).label }}
                    </a-tag>
                  </div>
                  <a-typography-paragraph
                    type="secondary"
                    :ellipsis="{ rows: 1 }"
                    class="item-desc"
                  >
                    {{ String(row.data.item.rawData.description ?? '') }}
                  </a-typography-paragraph>
                  <div class="item-meta">
                    {{ row.data.item.annotator ?? '未分配标注员' }} ·
                    {{ formatShortTime(row.data.item.submittedAt) }}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </a-card>

        <a-card title="审核内容" size="small" class="content-card">
          <a-empty v-if="!selectedItem" description="请选择待审核数据" />
          <template v-else>
            <a-descriptions
              title="原始数据"
              size="small"
              bordered
              :column="1"
              class="content-section"
            >
              <a-descriptions-item
                v-for="[key, value] in Object.entries(selectedItem.rawData)"
                :key="key"
                :label="key"
              >
                <a
                  v-if="key === 'imageUrl'"
                  :href="String(value)"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ String(value) }}</a
                >
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

            <a-space
              v-if="selectedAIReview?.fieldWarnings?.length"
              direction="vertical"
              class="warning-stack"
            >
              <a-alert
                v-for="(warning, index) in selectedAIReview.fieldWarnings"
                :key="`${warning.fieldKey}-${index}`"
                :type="
                  warning.severity === 'error'
                    ? 'error'
                    : warning.severity === 'warning'
                      ? 'warning'
                      : 'info'
                "
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

    <ClaimReviewModal
      v-model:open="claimModalOpen"
      v-model:continuous="continuousClaimEnabled"
      :loading="reviewPoolLoading"
      :items="reviewPoolItems"
      :claiming-id="claimingId"
      :batch-claiming="batchClaiming"
      :selected-ids="selectedClaimIds"
      :task-names="taskNameMap"
      @refresh="loadReviewPool"
      @claim="claimReview"
      @batch-claim="batchClaimReviews()"
      @selection-change="onClaimSelectionChange"
    />

    <AuditFlowModal v-model:open="flowModalOpen" :records="selectedItem?.auditHistory ?? []" />

    <RejectModal v-model:open="rejectModalOpen" :loading="rejecting" @confirm="rejectSelected" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  FilterOutlined,
  HistoryOutlined,
  InboxOutlined,
} from '@ant-design/icons-vue';
import {
  DataItemStatus,
  TaskStatus,
  type DataItem,
  type TaskItem,
  type TemplateField,
} from '../../types';
import type { AIReviewResult } from '../../types/aiReview';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getTemplateSchemaAsync } from '../../utils/templateSchemaHelper';
import * as taskApi from '../../api/task';
import {
  connectNotificationWS,
  getSocket,
  joinTaskRoom,
  leaveTaskRoom,
  type Notification,
} from '../../services/notificationWebSocket';
import { useVirtualList } from '../../composables/useVirtualList';
import { useReviewFilters } from './composables/useReviewFilters';
import { useReviewClaimPool } from './composables/useReviewClaimPool';
import ClaimReviewModal from './components/ClaimReviewModal.vue';
import AuditFlowModal from './components/AuditFlowModal.vue';
import RejectModal from './components/RejectModal.vue';
import {
  REVIEW_ACTIONABLE_STATUSES,
  aiReviewFilterOptions,
  aiStatusMeta,
  formatShortTime,
  formatTime,
  statusFilterOptions,
  statusLabel,
} from './reviewDisplay';

const route = useRoute();
const annotationStore = useAnnotationStore();
const authStore = useAuthStore();

const tasks = ref<TaskItem[]>([]);
const selectedId = ref<string | null>(null);

// ── 键盘导航：↑↓ 切换审核列表条目 ─────────────────────────
function getFlatVisibleItemIds(): string[] {
  return filteredItems.value.map((item) => item.id);
}

function onListKeydown(event: KeyboardEvent) {
  const ids = getFlatVisibleItemIds();
  if (ids.length === 0) return;

  const currentIdx = selectedId.value ? ids.indexOf(selectedId.value) : -1;

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    let nextIdx: number;
    if (event.key === 'ArrowDown') {
      nextIdx = currentIdx < ids.length - 1 ? currentIdx + 1 : 0;
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : ids.length - 1;
    }
    selectedId.value = ids[nextIdx]!;
    // 选中项移出视口时自动滚动到可见位置 (scrollListRowIntoView 由 useVirtualList 提供)
    const rowIndex = listRows.value.findIndex(
      (row) => row.type === 'item' && row.item.id === ids[nextIdx],
    );
    if (rowIndex >= 0) scrollListRowIntoView(rowIndex);
  } else if (event.key === 'Enter' && selectedId.value) {
    event.preventDefault();
    // Enter 可将焦点移至审核操作区
    const approveBtn = document.querySelector<HTMLElement>('.action-card .ant-btn-primary');
    approveBtn?.focus();
  }
}

function selectAndFocus(id: string) {
  selectedId.value = id;
}

const flowModalOpen = ref(false);
const rejectModalOpen = ref(false);
const approving = ref(false);
const rejecting = ref(false);
const socketConnected = ref(false);
const templateMap = ref<Record<string, TemplateField[]>>({});
const joinedTaskIds = new Set<string>();

const queryTaskId = computed(() =>
  typeof route.query.taskId === 'string' ? route.query.taskId : undefined,
);
const queryDataItemId = computed(() =>
  typeof route.query.dataItemId === 'string' ? route.query.dataItemId : undefined,
);

const reviewableItems = computed(() =>
  annotationStore.dataItems.filter(
    (item) =>
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

const taskNameMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  tasks.value.forEach((task) => {
    map[task.id] = task.name;
  });
  return map;
});

// ── 筛选逻辑（composable）──────────────────────────────
const { filters, filteredItems, groupedItems, hasActiveFilters, annotatorOptions, clearFilters } =
  useReviewFilters(reviewableItems, aiResultMap);
const selectedItem = computed(() =>
  selectedId.value
    ? (annotationStore.dataItems.find((item) => item.id === selectedId.value) ?? null)
    : null,
);
const selectedAIReview = computed(() =>
  selectedItem.value ? aiResultMap.value.get(selectedItem.value.id) : undefined,
);
const canReviewSelected = computed(() => {
  const status = selectedItem.value?.status;
  return status ? REVIEW_ACTIONABLE_STATUSES.has(status) : false;
});

// ── 领取审核池（composable）────────────────────────────
const {
  claimModalOpen,
  reviewPoolItems,
  reviewPoolLoading,
  claimingId,
  batchClaiming,
  selectedClaimIds,
  continuousClaimEnabled,
  openClaimModal,
  loadReviewPool,
  onClaimSelectionChange,
  claimReview,
  batchClaimReviews,
  tryContinuousClaim,
} = useReviewClaimPool({
  taskIdFilter: () => filters.taskId,
  async onClaimed(firstClaimedId) {
    await refreshData();
    selectedId.value = firstClaimedId;
  },
});

// ── 虚拟滚动列表：分组头 + 条目拍平成变高行 ─────────────
type ReviewListRow =
  { type: 'group'; key: string; taskId: string } | { type: 'item'; key: string; item: DataItem };

const GROUP_ROW_HEIGHT = 38;
const ITEM_ROW_HEIGHT = 92;

const listRows = computed<ReviewListRow[]>(() => {
  const rows: ReviewListRow[] = [];
  groupedItems.value.forEach((group) => {
    rows.push({ type: 'group', key: `group:${group.taskId}`, taskId: group.taskId });
    group.items.forEach((item) => rows.push({ type: 'item', key: item.id, item }));
  });
  return rows;
});

const {
  containerRef: listContainerRef,
  onScroll: onListScroll,
  totalHeight: listTotalHeight,
  visibleRows: visibleListRows,
  scrollIntoView: scrollListRowIntoView,
} = useVirtualList(listRows, {
  itemHeight: (row) => (row.type === 'group' ? GROUP_ROW_HEIGHT : ITEM_ROW_HEIGHT),
  overscan: 6,
});

// 选中项变化（含筛选后的自动选中）时滚动到可见位置
watch(selectedId, (id) => {
  if (!id) return;
  const index = listRows.value.findIndex((row) => row.type === 'item' && row.item.id === id);
  if (index >= 0) scrollListRowIntoView(index);
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
    const preferredId =
      filteredItems.value.find((item) => REVIEW_ACTIONABLE_STATUSES.has(item.status))?.id ??
      ids[0] ??
      null;
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

async function preloadTemplates() {
  const next: Record<string, TemplateField[]> = {};
  await Promise.all(
    tasks.value.map(async (task) => {
      const schema = await getTemplateSchemaAsync(task.templateId);
      if (schema) next[task.templateId] = schema.fields;
    }),
  );
  templateMap.value = next;
}

function fieldLabel(fieldKey: string) {
  const task = selectedItem.value
    ? tasks.value.find((item) => item.id === selectedItem.value?.taskId)
    : undefined;
  const field = task
    ? templateMap.value[task.templateId]?.find((item) => item.fieldKey === fieldKey)
    : undefined;
  return field?.label || fieldKey;
}

function taskName(taskId: string) {
  return tasks.value.find((task) => task.id === taskId)?.name || taskId;
}

function itemStatusTag(item: DataItem) {
  if (item.status === DataItemStatus.PENDING_REVIEW) {
    const ai = aiResultMap.value.get(item.id);
    return ai
      ? {
          color: aiStatusMeta(ai.reviewStatus).tagColor,
          label: `${aiStatusMeta(ai.reviewStatus).label} · ${ai.score}分`,
        }
      : { color: 'processing', label: '待审核' };
  }
  if (
    [DataItemStatus.SUBMITTED, DataItemStatus.AI_REVIEWING, DataItemStatus.AI_REVIEWED].includes(
      item.status,
    )
  ) {
    return { color: 'purple', label: '预审中' };
  }
  if (item.status === DataItemStatus.REVIEWED) return { color: 'success', label: '已通过' };
  if (item.status === DataItemStatus.REJECTED) return { color: 'error', label: '已驳回' };
  return { color: 'default', label: statusLabel(item.status) };
}

async function approveSelected() {
  if (!selectedItem.value) return;
  approving.value = true;
  try {
    await annotationStore.approveItem(selectedItem.value.id, authStore.user?.username ?? '');
    message.success('审核通过');
    await refreshData();
    await tryContinuousClaim();
  } catch (error) {
    Modal.warning({
      title: '审核失败',
      content: error instanceof Error ? error.message : '审核通过失败',
    });
  } finally {
    approving.value = false;
  }
}

function openRejectModal() {
  rejectModalOpen.value = true;
}

async function rejectSelected(reason: string) {
  if (!selectedItem.value) return;
  rejecting.value = true;
  try {
    await annotationStore.rejectItem(selectedItem.value.id, authStore.user?.username ?? '', reason);
    message.success('已驳回');
    rejectModalOpen.value = false;
    await refreshData();
    await tryContinuousClaim();
  } catch (error) {
    Modal.warning({
      title: '审核失败',
      content: error instanceof Error ? error.message : '驳回失败',
    });
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

/* a-spin 会在插槽外包两层 div（nested-loading/container），flex 高度链需穿透传递，
   否则 .review-main 的 flex:1 失效，列表被内容撑高后溢出被裁，页面与列表均无法滚动 */
.review-workbench > :deep(.ant-spin-nested-loading) {
  flex: 1;
  min-height: 0;
}

.review-workbench :deep(.ant-spin-nested-loading > .ant-spin-container) {
  display: flex;
  flex-direction: column;
  height: 100%;
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

.review-list-card :deep(.ant-card-body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
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

/* 虚拟滚动：phantom 撑高 + 行绝对定位（translateY 避免重排） */
.review-list-phantom {
  position: relative;
}

.review-list-row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  overflow: hidden;
}

.review-list-row .group-title,
.review-list-row .review-list-item {
  height: 100%;
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
.warning-stack {
  margin-bottom: 12px;
}

.warning-stack {
  width: 100%;
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

  /* 小屏下页面整体滚动，高度链失效；虚拟列表容器需有界高度才能内部滚动 */
  .review-list {
    height: 480px;
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
