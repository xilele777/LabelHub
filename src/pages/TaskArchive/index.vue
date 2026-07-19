<template>
  <section class="archive-page app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="4" class="page-title">
          <InboxOutlined />
          任务归档
        </a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">
          查看历史任务和已归档标注项。
        </a-typography-text>
      </div>
      <div class="app-page-tools">
        <a-tag v-if="isManager" color="blue">归档任务 {{ taskStore.archivedTasks.length }}</a-tag>
        <a-tag color="cyan">归档标注项 {{ annotationStore.archivedItems.length }}</a-tag>
      </div>
    </header>

    <a-card class="archive-card">
      <a-tabs v-if="isManager" v-model:active-key="activeTab">
        <a-tab-pane key="tasks" :tab="`归档任务 (${taskStore.archivedTasks.length})`">
          <ArchivedTaskTable />
        </a-tab-pane>
        <a-tab-pane key="items" :tab="`归档标注项 (${annotationStore.archivedItems.length})`">
          <ArchivedItemTable />
        </a-tab-pane>
      </a-tabs>

      <ArchivedItemTable v-else />
    </a-card>

    <a-modal v-model:open="taskDetailOpen" title="归档任务详情" width="680px" :footer="null">
      <div class="lh-modal-detail">
        <a-descriptions v-if="currentTask" bordered size="small" :column="{ xs: 1, sm: 1, md: 2 }">
          <a-descriptions-item label="任务名称">{{ currentTask.name }}</a-descriptions-item>
          <a-descriptions-item label="类型">
            <a-tag :color="getTaskTypeMeta(currentTask.type).color">
              {{ getTaskTypeMeta(currentTask.type).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="原状态">
            <a-tag :color="getTaskStatusMeta(currentTask.status).color">
              {{ getTaskStatusMeta(currentTask.status).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="负责人">{{ currentTask.owner || '-' }}</a-descriptions-item>
          <a-descriptions-item label="绑定模板">
            {{ currentTask.templateName || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="归档时间">
            {{ formatDate(currentTask.archivedAt) }}
          </a-descriptions-item>
          <a-descriptions-item label="任务描述" :span="2">
            {{ currentTask.description || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="任务说明" :span="2">
            <div class="pre-wrap">{{ currentTask.instructions || '-' }}</div>
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-modal>

    <a-modal v-model:open="itemDetailOpen" title="标注项详情" width="860px" :footer="null">
      <a-space
        v-if="currentItem"
        direction="vertical"
        size="middle"
        class="detail-body lh-modal-detail"
      >
        <a-descriptions bordered size="small" :column="{ xs: 1, sm: 1, md: 2 }">
          <a-descriptions-item label="标注项ID">{{ currentItem.id }}</a-descriptions-item>
          <a-descriptions-item label="所属任务">{{ currentItem.taskId }}</a-descriptions-item>
          <a-descriptions-item label="标注员">
            {{ currentItem.annotator || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="审核员">
            {{ currentItem.reviewer || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="getDataStatusMeta(currentItem.status).color">
              {{ getDataStatusMeta(currentItem.status).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="归档时间">
            {{ formatDate(currentItem.archivedAt) }}
          </a-descriptions-item>
        </a-descriptions>

        <a-card size="small" title="原始数据">
          <pre class="json-block">{{ stringify(currentItem.rawData) }}</pre>
        </a-card>
        <a-card size="small" title="标注结果">
          <pre class="json-block">{{ stringify(currentItem.annotationData) }}</pre>
        </a-card>
      </a-space>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import {
  Button,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
  type TableColumnsType,
} from 'ant-design-vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import { Role, type DataItem, type TaskItem } from '../../types';
import { getDataStatusMeta, getTaskStatusMeta, getTaskTypeMeta } from '../../utils/statusMeta';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';

const authStore = useAuthStore();
const taskStore = useTaskStore();
const annotationStore = useAnnotationStore();

const activeTab = ref('tasks');
const taskDetailOpen = ref(false);
const itemDetailOpen = ref(false);
const currentTask = ref<TaskItem | null>(null);
const currentItem = ref<DataItem | null>(null);

const isManager = computed(
  () => authStore.user?.role === Role.ADMIN || authStore.user?.role === Role.OWNER,
);

const taskColumns: TableColumnsType<TaskItem> = [
  { title: '任务名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 112 },
  { title: '原状态', dataIndex: 'status', key: 'status', width: 96 },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 88, responsive: ['xl'] },
  { title: '归档时间', dataIndex: 'archivedAt', key: 'archivedAt', width: 148, responsive: ['lg'] },
  { title: '操作', key: 'action', width: 160 },
];

const itemColumns: TableColumnsType<DataItem> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
  { title: '所属任务', dataIndex: 'taskId', key: 'taskId', ellipsis: true },
  { title: '标注员', dataIndex: 'annotator', key: 'annotator', width: 92, responsive: ['md'] },
  { title: '审核员', dataIndex: 'reviewer', key: 'reviewer', width: 92, responsive: ['xl'] },
  { title: '状态', dataIndex: 'status', key: 'status', width: 104 },
  {
    title: '归档时间',
    dataIndex: 'archivedAt',
    key: 'archivedAt',
    width: 148,
    responsive: ['xxl'],
  },
  { title: '操作', key: 'action', width: 160 },
];

onMounted(() => {
  if (isManager.value) void taskStore.fetchArchivedTasks();
  void annotationStore.fetchArchivedItems();
});

const ArchivedTaskTable = defineComponent({
  name: 'ArchivedTaskTable',
  setup() {
    return () =>
      taskStore.archivedTasks.length === 0
        ? h(Empty, { description: '暂无归档任务' })
        : h(
            Table<TaskItem>,
            {
              rowKey: 'id',
              columns: taskColumns,
              dataSource: taskStore.archivedTasks,
              pagination: { pageSize: 10, showSizeChanger: false },
              scroll: { x: 640 },
            },
            {
              bodyCell: ({ column, record }: { column: { key?: string }; record: TaskItem }) => {
                if (column.key === 'type') {
                  const meta = getTaskTypeMeta(record.type);
                  return h(Tag, { color: meta.color }, () => meta.label);
                }
                if (column.key === 'status') {
                  const meta = getTaskStatusMeta(record.status);
                  return h(Tag, { color: meta.color }, () => meta.label);
                }
                if (column.key === 'archivedAt') return formatDate(record.archivedAt);
                if (column.key === 'action') {
                  return h(Space, { size: 'small' }, () => [
                    h(
                      Button,
                      { type: 'link', size: 'small', onClick: () => openTaskDetail(record) },
                      () => '查看',
                    ),
                    isManager.value
                      ? h(
                          Popconfirm,
                          {
                            title: '确认取消归档？任务将恢复到任务列表。',
                            onConfirm: () => handleUnarchiveTask(record.id),
                          },
                          {
                            default: () =>
                              h(Button, { type: 'link', size: 'small' }, () => '取消归档'),
                          },
                        )
                      : null,
                  ]);
                }
                return undefined;
              },
            },
          );
  },
});

const ArchivedItemTable = defineComponent({
  name: 'ArchivedItemTable',
  setup() {
    return () =>
      annotationStore.archivedItems.length === 0
        ? h(Empty, { description: '暂无归档标注项' })
        : h(
            Table<DataItem>,
            {
              rowKey: 'id',
              columns: itemColumns,
              dataSource: annotationStore.archivedItems,
              pagination: { pageSize: 10, showSizeChanger: false },
              scroll: { x: 660 },
            },
            {
              bodyCell: ({ column, record }: { column: { key?: string }; record: DataItem }) => {
                if (column.key === 'status') {
                  const meta = getDataStatusMeta(record.status);
                  return h(Tag, { color: meta.color }, () => meta.label);
                }
                if (column.key === 'annotator') return record.annotator || '-';
                if (column.key === 'reviewer') return record.reviewer || '-';
                if (column.key === 'archivedAt') return formatDate(record.archivedAt);
                if (column.key === 'action') {
                  return h(Space, { size: 'small' }, () => [
                    h(
                      Button,
                      { type: 'link', size: 'small', onClick: () => openItemDetail(record) },
                      () => '查看',
                    ),
                    isManager.value
                      ? h(
                          Popconfirm,
                          {
                            title: '确认取消归档？标注项将恢复到标注列表。',
                            onConfirm: () => handleUnarchiveItem(record.id),
                          },
                          {
                            default: () =>
                              h(Button, { type: 'link', size: 'small' }, () => '取消归档'),
                          },
                        )
                      : null,
                  ]);
                }
                return undefined;
              },
            },
          );
  },
});

function openTaskDetail(record: TaskItem) {
  currentTask.value = record;
  taskDetailOpen.value = true;
}

function openItemDetail(record: DataItem) {
  currentItem.value = record;
  itemDetailOpen.value = true;
}

async function handleUnarchiveTask(id: string) {
  await taskStore.unarchiveTask(id);
  message.success('已取消归档');
}

async function handleUnarchiveItem(id: string) {
  await annotationStore.unarchiveItem(id);
  message.success('已取消归档');
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function stringify(value: unknown) {
  return value === null || value === undefined ? '-' : JSON.stringify(value, null, 2);
}
</script>

<style scoped>
.archive-card {
  background: #fff;
  border-color: var(--lh-border);
  box-shadow: none;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.detail-body {
  width: 100%;
}

.pre-wrap {
  white-space: pre-wrap;
}

.json-block {
  max-height: 260px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
