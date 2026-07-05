<template>
  <section class="task-list-page app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="4" class="page-title">任务列表</a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">
          管理任务生命周期、时效和归档动作。
        </a-typography-text>
      </div>
      <div class="app-toolbar">
        <a-input-search
          v-model:value="keyword"
          allow-clear
          placeholder="搜索任务名称"
          class="search-input"
        />
        <a-select
          v-model:value="statusFilter"
          allow-clear
          placeholder="按状态筛选"
          class="status-select"
          :options="statusOptions"
        />
        <a-button v-if="canCreateTask" type="primary" @click="router.push('/tasks/create')">
          <template #icon><PlusOutlined /></template>
          创建任务
        </a-button>
      </div>
    </header>

    <a-alert
      v-if="error"
      type="error"
      :message="error"
      show-icon
      closable
      class="page-alert"
      @close="error = null"
    />

    <a-card class="app-table-card" :body-style="{ padding: 0 }">
      <template #title>
        <a-space>
          <span>任务数据</span>
          <a-tag color="blue">共 {{ total }} 条</a-tag>
        </a-space>
      </template>
      <a-table
        row-key="id"
        :columns="columns"
        :data-source="tasks"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="getTaskTypeMeta(record.type).color">
              {{ getTaskTypeMeta(record.type).label }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="getTaskStatusMeta(record.status).color">
              {{ getTaskStatusMeta(record.status).label }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'timeliness'">
            <a-space direction="vertical" :size="2">
              <a-space :size="4" wrap>
                <a-tag :color="getTaskTimeliness(record).color">
                  标注 {{ getTaskTimeliness(record).label }}
                </a-tag>
                <a-tag :color="getReviewTimeliness(record).color">
                  审核 {{ getReviewTimeliness(record).label }}
                </a-tag>
              </a-space>
              <a-typography-text type="secondary" class="timeliness-desc">
                标注：{{ getTaskTimeliness(record).description }}
              </a-typography-text>
              <a-typography-text type="secondary" class="timeliness-desc">
                审核：{{ getReviewTimeliness(record).description }}
              </a-typography-text>
            </a-space>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space size="small" wrap>
              <a-button
                type="link"
                size="small"
                @click="router.push(`/tasks/detail?id=${record.id}`)"
              >
                <template #icon><EyeOutlined /></template>
                详情
              </a-button>
              <a-button
                v-if="canEdit(record.status)"
                type="link"
                size="small"
                @click="router.push(`/tasks/edit?id=${record.id}`)"
              >
                <template #icon><EditOutlined /></template>
                编辑
              </a-button>
              <a-popconfirm
                v-if="canPublish(record.status)"
                title="确认发布该任务？"
                @confirm="handlePublish(record.id)"
              >
                <a-button type="link" size="small">
                  <template #icon><RocketOutlined /></template>
                  发布
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="canEnd(record.status)"
                title="确认结束该任务？结束后无法恢复。"
                @confirm="handleEnd(record.id)"
              >
                <a-button type="link" size="small" danger>
                  <template #icon><StopOutlined /></template>
                  结束
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="record.status === TaskStatus.COMPLETED || record.status === TaskStatus.ENDED"
                title="确认归档该任务？归档后可到任务归档中查看。"
                @confirm="handleArchive(record.id)"
              >
                <a-button type="link" size="small">
                  <template #icon><InboxOutlined /></template>
                  归档
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { message, type TableColumnsType, type TablePaginationConfig } from 'ant-design-vue';
import {
  EditOutlined,
  EyeOutlined,
  InboxOutlined,
  PlusOutlined,
  RocketOutlined,
  StopOutlined,
} from '@ant-design/icons-vue';
import { Role, TaskStatus, TaskType, type TaskItem } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';
import { getTaskList } from '../../api/task';
import { getReviewTimeliness, getTaskTimeliness } from '../../utils/taskTimeliness';
import { useDebounced } from '../../composables/useDebounced';

// keep-alive 白名单按组件名匹配（script setup 从文件名推断为 index，需显式声明）
defineOptions({ name: 'TaskListPage' });

const PAGE_SIZE = 5;

const router = useRouter();
const authStore = useAuthStore();
const taskStore = useTaskStore();

const keyword = ref('');
const debouncedKeyword = useDebounced(keyword);
const statusFilter = ref<TaskStatus | undefined>();
const current = ref(1);

// 服务端分页：列表数据与总数来自后端，筛选/翻页都发起请求
const tasks = ref<TaskItem[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

async function fetchPage() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getTaskList({
      _page: current.value,
      _limit: PAGE_SIZE,
      _sort: 'createdAt',
      _order: 'desc',
      keyword: debouncedKeyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
    });
    tasks.value = res.data.items;
    total.value = res.data.total;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载任务列表失败';
  } finally {
    loading.value = false;
  }
}

// 筛选条件变化回到第一页；已在第一页时直接请求（避免和下方 current watch 重复请求）
watch([debouncedKeyword, statusFilter], () => {
  if (current.value !== 1) {
    current.value = 1;
  } else {
    void fetchPage();
  }
});

watch(current, () => {
  void fetchPage();
});

const canCreateTask = computed(
  () => authStore.user?.role === Role.ADMIN || authStore.user?.role === Role.OWNER,
);

const statusOptions = Object.values(TaskStatus).map((value) => ({
  value,
  label: getTaskStatusMeta(value).label,
}));

const columns: TableColumnsType<TaskItem> = [
  { title: '任务名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 112 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 96 },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 88, responsive: ['xl'] },
  {
    title: '模板',
    dataIndex: 'templateName',
    key: 'templateName',
    ellipsis: true,
    width: 132,
    responsive: ['lg'],
  },
  { title: '时效', key: 'timeliness', width: 148, responsive: ['xl'] },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 148, responsive: ['xxl'] },
  { title: '操作', key: 'action', width: 172 },
];

const pagination = computed<TablePaginationConfig>(() => ({
  current: current.value,
  pageSize: PAGE_SIZE,
  total: total.value,
  showSizeChanger: false,
  showTotal: (count) => `共 ${count} 条`,
}));

// keep-alive 缓存下 onMounted 仅首次触发，改用 onActivated 保证每次回到页面都刷新数据
onActivated(() => {
  void fetchPage();
});

function handleTableChange(nextPagination: TablePaginationConfig) {
  current.value = Number(nextPagination.current || 1);
}

async function handlePublish(id: string) {
  try {
    await taskStore.publishTask(id);
    message.success('任务已发布');
    void fetchPage();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '发布任务失败');
  }
}

async function handleEnd(id: string) {
  try {
    await taskStore.endTask(id);
    message.success('任务已结束');
    void fetchPage();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '结束任务失败');
  }
}

async function handleArchive(id: string) {
  try {
    await taskStore.archiveTask(id);
    message.success('任务已归档');
    void fetchPage();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '归档任务失败');
  }
}

function canEdit(status: TaskStatus) {
  return status === TaskStatus.DRAFT || status === TaskStatus.PENDING;
}

function canPublish(status: TaskStatus) {
  return status === TaskStatus.DRAFT || status === TaskStatus.PENDING;
}

function canEnd(status: TaskStatus) {
  return status === TaskStatus.IN_PROGRESS;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
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
</script>

<style scoped>
.page-alert {
  margin-bottom: 0;
}

.search-input {
  width: min(280px, 100%);
}

.status-select {
  width: 160px;
}

.timeliness-desc {
  display: block;
  font-size: 12px;
  white-space: nowrap;
}
@media (max-width: 576px) {
  .search-input,
  .status-select {
    width: 100%;
  }
}
</style>
