<template>
  <section class="dashboard-page app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="4" class="page-title">仪表盘</a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">
          欢迎回来，<a-typography-text strong>
            {{ authStore.user?.username ?? '-' }}
          </a-typography-text>
          <a-tag :color="roleColor" class="role-tag">{{ roleLabel }}</a-tag>
        </a-typography-text>
      </div>
      <div class="app-page-tools">
        <a-tag color="blue">任务 {{ taskStore.tasks.length }}</a-tag>
        <a-tag color="cyan">模板 {{ templateStore.templates.length }}</a-tag>
        <a-tag color="green">进行中 {{ runningTaskCount }}</a-tag>
        <a-button :loading="loading" @click="refresh">刷新</a-button>
      </div>
    </header>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-card--blue" hoverable>
          <a-statistic title="任务总数" :value="taskStore.tasks.length" />
          <a-typography-text type="secondary" class="metric-card__hint">
            平台任务总量
          </a-typography-text>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-card--green" hoverable>
          <a-statistic title="进行中任务" :value="runningTaskCount" />
          <a-typography-text type="secondary" class="metric-card__hint">
            当前需要跟进
          </a-typography-text>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-card--purple" hoverable>
          <a-statistic title="模板总数" :value="templateStore.templates.length" />
          <a-typography-text type="secondary" class="metric-card__hint">
            可复用标注配置
          </a-typography-text>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card class="metric-card metric-card--orange" hoverable>
          <a-statistic title="当前角色" :value="roleLabel" />
          <a-typography-text type="secondary" class="metric-card__hint">
            已按角色过滤菜单
          </a-typography-text>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" class="dashboard-page__content">
      <a-col :xs="24" :lg="14">
        <a-card title="最近任务" class="panel-card">
          <a-table
            row-key="id"
            :columns="taskColumns"
            :data-source="recentTasks"
            :pagination="false"
            :loading="taskStore.loading"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="getTaskStatusMeta(record.status).color">
                  {{ getTaskStatusMeta(record.status).label }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ formatDate(record.createdAt) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="10">
        <a-card title="模板类型分布" class="panel-card">
          <a-list :data-source="templateTypeStats" :locale="{ emptyText: '暂无模板' }">
            <template #renderItem="{ item }">
              <a-list-item>
                <div class="template-stat">
                  <a-tag :color="getTaskTypeMeta(item.type).color">
                    {{ getTaskTypeMeta(item.type).label }}
                  </a-tag>
                  <a-typography-text strong>{{ item.count }}</a-typography-text>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { TableColumnsType } from 'ant-design-vue';
import { Role, TaskStatus, TaskType, type TaskItem } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useTemplateStore } from '../../store/useTemplateStore';

const authStore = useAuthStore();
const taskStore = useTaskStore();
const templateStore = useTemplateStore();

const loading = computed(() => taskStore.loading || templateStore.loading);
const runningTaskCount = computed(
  () => taskStore.tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
);
const recentTasks = computed(() =>
  [...taskStore.tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6),
);
const roleLabel = computed(() => getRoleLabel(authStore.user?.role));
const roleColor = computed(() => getRoleColor(authStore.user?.role));

const taskColumns: TableColumnsType<TaskItem> = [
  { title: '任务名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 110, responsive: ['md'] },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, responsive: ['lg'] },
];

const templateTypeStats = computed(() => {
  const counts = new Map<TaskType, number>();
  templateStore.templates.forEach((template) => {
    counts.set(template.type, (counts.get(template.type) ?? 0) + 1);
  });
  return Array.from(counts, ([type, count]) => ({ type, count }));
});

onMounted(() => {
  void refresh();
});

async function refresh() {
  await Promise.all([taskStore.fetchTasks(), templateStore.fetchTemplates()]);
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function getRoleLabel(role: Role | null | undefined) {
  const map: Record<Role, string> = {
    [Role.ADMIN]: '管理员',
    [Role.OWNER]: '负责人',
    [Role.ANNOTATOR]: '标注员',
    [Role.REVIEWER]: '审核员',
  };
  return role ? map[role] : '-';
}

function getRoleColor(role: Role | null | undefined) {
  const map: Record<Role, string> = {
    [Role.ADMIN]: 'purple',
    [Role.OWNER]: 'blue',
    [Role.ANNOTATOR]: 'green',
    [Role.REVIEWER]: 'orange',
  };
  return role ? map[role] : 'default';
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
  return map[type] ?? { label: type, color: 'default' };
}
</script>

<style scoped>
.page-title {
  color: #202124;
}

.role-tag {
  margin-left: 8px;
}

.metric-card,
.panel-card {
  height: 100%;
}

.metric-card {
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.metric-card:hover {
  background: #fbfdff;
  transform: translateY(-2px);
}

.metric-card :deep(.ant-card-body) {
  padding: 18px;
}

.metric-card :deep(.ant-statistic-content-value) {
  font-weight: 700;
}

.metric-card__hint {
  display: block;
  margin-top: 8px;
  font-size: 12px;
}

.panel-card {
  overflow: hidden;
  background: #fff;
  border-color: var(--lh-border) !important;
}

.panel-card :deep(.ant-card-body) {
  min-height: 220px;
}

.panel-card :deep(.ant-table-wrapper) {
  margin: -4px 0;
}

.panel-card :deep(.ant-list-item) {
  padding-inline: 0;
}

.panel-card :deep(.ant-list-item:not(:last-child)) {
  border-bottom-color: #eef2f6;
}

.dashboard-page__content {
  margin-top: 0;
}

.template-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}
</style>
