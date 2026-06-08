<template>
  <section class="task-detail-page">
    <a-typography-title :level="4" class="page-title">任务详情</a-typography-title>

    <a-empty v-if="!task" description="未找到该任务">
      <a-button @click="router.push('/tasks')">返回列表</a-button>
    </a-empty>

    <template v-else>
      <a-card>
        <a-descriptions bordered :column="2">
          <a-descriptions-item label="任务名称">{{ task.name }}</a-descriptions-item>
          <a-descriptions-item label="任务类型">
            <a-tag :color="getTaskTypeMeta(task.type).color">{{ getTaskTypeMeta(task.type).label }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="负责人">{{ task.owner }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="getTaskStatusMeta(task.status).color">{{ getTaskStatusMeta(task.status).label }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="绑定模板">{{ task.templateName }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDate(task.createdAt) }}</a-descriptions-item>
          <a-descriptions-item label="任务时间窗口">{{ formatRange(task.startsAt, task.dueAt) }}</a-descriptions-item>
          <a-descriptions-item label="单项时限">
            标注 {{ task.annotationTimeoutHours ?? 24 }} 小时 / 审核 {{ task.reviewTimeoutHours ?? 24 }} 小时
          </a-descriptions-item>
          <a-descriptions-item label="任务描述" :span="2">{{ task.description || '-' }}</a-descriptions-item>
          <a-descriptions-item label="任务说明" :span="2">
            <div class="pre-wrap">{{ task.instructions || '-' }}</div>
          </a-descriptions-item>
        </a-descriptions>

        <a-space class="actions" wrap>
          <a-button @click="router.push(isArchived ? '/archive' : '/tasks')">
            <template #icon><ArrowLeftOutlined /></template>
            {{ isArchived ? '返回归档' : '返回列表' }}
          </a-button>
          <a-button v-if="canEditTask" type="primary" @click="router.push(`/tasks/edit?id=${task.id}`)">
            <template #icon><EditOutlined /></template>
            编辑任务
          </a-button>
          <a-button v-if="!isArchived" @click="importOpen = true">
            <template #icon><ImportOutlined /></template>
            导入数据
          </a-button>
          <a-button v-if="canPublishTask" type="primary" @click="publishTask">
            <template #icon><RocketOutlined /></template>
            发布任务
          </a-button>
          <a-popconfirm v-if="canArchiveTask" title="确认归档该任务？" @confirm="archiveCurrentTask">
            <a-button>
              <template #icon><InboxOutlined /></template>
              归档
            </a-button>
          </a-popconfirm>
          <a-popconfirm v-if="isArchived && isManager" title="确认取消归档？" @confirm="unarchiveCurrentTask">
            <a-button>
              <template #icon><UndoOutlined /></template>
              取消归档
            </a-button>
          </a-popconfirm>
        </a-space>
      </a-card>

      <a-card title="任务数据" size="small">
        <a-table
          row-key="id"
          size="small"
          :columns="itemColumns"
          :data-source="annotationStore.dataItems"
          :loading="annotationStore.loading"
          :pagination="{ pageSize: 10, showSizeChanger: false }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="getDataStatusMeta(record.status).color">{{ getDataStatusMeta(record.status).label }}</a-tag>
            </template>
            <template v-else-if="column.key === 'rawData'">
              <a-tooltip :title="stringify(record.rawData)">
                <span class="ellipsis-text">{{ stringify(record.rawData) }}</span>
              </a-tooltip>
            </template>
            <template v-else-if="column.key === 'submittedAt'">
              {{ formatDate(record.submittedAt) }}
            </template>
          </template>
        </a-table>
      </a-card>
    </template>

    <a-modal
      v-model:open="importOpen"
      title="导入标注数据"
      width="720px"
      :ok-text="`确认导入（${previewData.length} 条）`"
      :ok-button-props="{ disabled: previewData.length === 0 }"
      :confirm-loading="importLoading"
      @ok="handleImport"
      @cancel="previewData = []"
    >
      <div class="lh-modal-stack">
      <a-alert
        type="info"
        show-icon
        message="请上传 JSON 文件，支持数组或 { items: [...] } 格式。每个元素会作为 rawData 导入。"
        class="import-alert"
      />
      <input type="file" accept=".json,application/json" @change="handleFileChange" />

      <a-table
        v-if="previewData.length > 0"
        row-key="key"
        size="small"
        class="preview-table lh-modal-table"
        :columns="previewColumns"
        :data-source="previewRows"
        :pagination="{ pageSize: 5, showSizeChanger: false }"
      />
      </div>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message, type TableColumnsType } from 'ant-design-vue';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ImportOutlined,
  InboxOutlined,
  RocketOutlined,
  UndoOutlined,
} from '@ant-design/icons-vue';
import { batchImportItems } from '../../api/annotation';
import {
  DataItemStatus,
  Role,
  STATUS_DISPLAY_CONFIG,
  TaskStatus,
  TaskType,
  type DataItem,
} from '../../types';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const taskStore = useTaskStore();
const annotationStore = useAnnotationStore();

const importOpen = ref(false);
const importLoading = ref(false);
const previewData = ref<Array<{ rawData: Record<string, unknown> }>>([]);

const taskId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const task = computed(() => taskStore.tasks.find((item) => item.id === taskId.value) ?? taskStore.archivedTasks.find((item) => item.id === taskId.value));
const isArchived = computed(() => taskStore.archivedTasks.some((item) => item.id === taskId.value));
const isManager = computed(() => authStore.user?.role === Role.ADMIN || authStore.user?.role === Role.OWNER);
const canEditTask = computed(() => Boolean(task.value && !isArchived.value && [TaskStatus.DRAFT, TaskStatus.PENDING].includes(task.value.status)));
const canPublishTask = computed(() => Boolean(task.value && !isArchived.value && [TaskStatus.DRAFT, TaskStatus.PENDING].includes(task.value.status)));
const canArchiveTask = computed(() => Boolean(task.value && isManager.value && !isArchived.value && [TaskStatus.COMPLETED, TaskStatus.ENDED].includes(task.value.status)));

const itemColumns: TableColumnsType<DataItem> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 104 },
  { title: '标注员', dataIndex: 'annotator', key: 'annotator', width: 104, responsive: ['md'] },
  { title: '审核员', dataIndex: 'reviewer', key: 'reviewer', width: 104, responsive: ['xl'] },
  { title: '原始数据', dataIndex: 'rawData', key: 'rawData', ellipsis: true },
  { title: '提交时间', dataIndex: 'submittedAt', key: 'submittedAt', width: 148, responsive: ['lg'] },
];

const previewColumns = [
  { title: '序号', dataIndex: 'key', key: 'key', width: 80 },
  { title: 'rawData 摘要', dataIndex: 'summary', key: 'summary', ellipsis: true },
];

const previewRows = computed(() =>
  previewData.value.map((item, index) => ({
    key: index + 1,
    summary: stringify(item.rawData),
  })),
);

onMounted(() => {
  void taskStore.fetchTasks();
  void taskStore.fetchArchivedTasks();
  loadItems();
});

watch(taskId, () => loadItems());

function loadItems() {
  if (taskId.value) void annotationStore.fetchDataItems(taskId.value);
}

async function publishTask() {
  if (!task.value) return;
  await taskStore.updateTask(task.value.id, { status: TaskStatus.IN_PROGRESS });
  message.success('任务已发布');
}

async function archiveCurrentTask() {
  if (!task.value) return;
  await taskStore.archiveTask(task.value.id);
  message.success('任务已归档');
  await router.push('/archive');
}

async function unarchiveCurrentTask() {
  if (!task.value) return;
  await taskStore.unarchiveTask(task.value.id);
  message.success('已取消归档');
  await router.push('/archive');
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result ?? ''));
      const items: unknown[] = Array.isArray(parsed) ? parsed : parsed?.items;
      if (!Array.isArray(items) || items.length === 0) {
        message.error('JSON 文件格式错误：需要数组或 { items: [...] } 格式');
        return;
      }
      previewData.value = items.map((item) => ({
        rawData: item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item },
      }));
      message.success(`已解析 ${previewData.value.length} 条数据`);
    } catch {
      message.error('JSON 解析失败，请检查文件格式');
    }
  };
  reader.readAsText(file);
}

async function handleImport() {
  if (!taskId.value || previewData.value.length === 0) return;
  importLoading.value = true;
  try {
    const res = await batchImportItems(taskId.value, previewData.value);
    message.success(`成功导入 ${res.data.imported} 条数据`);
    importOpen.value = false;
    previewData.value = [];
    loadItems();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入失败');
  } finally {
    importLoading.value = false;
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function formatRange(start: string | null, end: string | null) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function stringify(value: unknown) {
  return value === null || value === undefined ? '-' : JSON.stringify(value);
}

function getTaskStatusMeta(status: TaskStatus) {
  const map: Record<TaskStatus, { label: string; color: string }> = {
    [TaskStatus.DRAFT]: { label: '草稿', color: 'default' },
    [TaskStatus.PENDING]: { label: '待发布', color: 'processing' },
    [TaskStatus.IN_PROGRESS]: { label: '进行中', color: 'blue' },
    [TaskStatus.COMPLETED]: { label: '已完成', color: 'success' },
    [TaskStatus.ENDED]: { label: '已结束', color: 'warning' },
  };
  return map[status];
}

function getTaskTypeMeta(type: TaskType) {
  const map: Record<TaskType, { label: string; color: string }> = {
    [TaskType.IMAGE_CLASSIFICATION]: { label: '图像分类', color: 'blue' },
    [TaskType.OBJECT_DETECTION]: { label: '目标检测', color: 'green' },
    [TaskType.SEMANTIC_SEGMENTATION]: { label: '语义分割', color: 'purple' },
    [TaskType.TEXT_NER]: { label: '文本 NER', color: 'orange' },
  };
  return map[type];
}

function getDataStatusMeta(status: DataItemStatus) {
  return STATUS_DISPLAY_CONFIG[status] ?? { label: status, color: 'default' };
}
</script>

<style scoped>
.task-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-title {
  margin: 0;
}

.actions {
  margin-top: 24px;
}

.pre-wrap {
  white-space: pre-wrap;
}

.ellipsis-text {
  display: inline-block;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.import-alert,
.preview-table {
  margin-top: 16px;
}
</style>
