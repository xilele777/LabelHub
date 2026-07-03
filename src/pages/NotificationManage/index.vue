<template>
  <section class="notification-manage-page">
    <div class="page-header">
      <a-space>
        <NotificationOutlined class="page-icon" />
        <a-typography-title :level="4" class="page-title">通知管理</a-typography-title>
      </a-space>
      <a-space>
        <a-input-search
          v-model:value="keyword"
          allow-clear
          placeholder="搜索标题、内容或接收人"
          class="search-input"
        />
        <a-button :loading="loading" @click="fetchList">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </a-space>
    </div>

    <a-card size="small" :body-style="{ padding: 0 }">
      <a-table
        row-key="id"
        :columns="columns"
        :data-source="filteredItems"
        :loading="loading"
        :pagination="{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total: number) => `共 ${total} 条`,
        }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.revokedAt ? 'default' : 'green'">
              {{ record.revokedAt ? '已撤回' : '已发布' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'priority'">
            <a-tag :color="getPriorityMeta(record.priority).color">
              {{ getPriorityMeta(record.priority).label }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'targets'">
            <a-space :size="4" wrap>
              <a-tag v-for="target in getTargetLabels(record).slice(0, 4)" :key="target">
                {{ target }}
              </a-tag>
              <a-tag v-if="getTargetLabels(record).length > 4">
                +{{ getTargetLabels(record).length - 4 }}
              </a-tag>
              <a-typography-text v-if="getTargetLabels(record).length === 0" type="secondary">
                未记录
              </a-typography-text>
            </a-space>
          </template>
          <template v-else-if="column.key === 'readRate'">
            <a-progress :percent="getReadPercent(record)" size="small" />
            <a-typography-text type="secondary" class="read-rate">
              {{ record.readCount }}/{{ record.totalRecipients }} 已读
            </a-typography-text>
          </template>
          <template v-else-if="column.key === 'timestamp'">
            {{ formatDate(record.timestamp) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space size="small">
              <a-button type="link" size="small" @click="openDetail(record.id)">
                <template #icon><EyeOutlined /></template>
                详情
              </a-button>
              <a-button type="link" size="small" @click="copyPublish(record)">
                <template #icon><CopyOutlined /></template>
                复制再发
              </a-button>
              <a-popconfirm
                v-if="!record.revokedAt"
                title="确认撤回该通知？"
                @confirm="handleRevoke(record.id)"
              >
                <a-button type="link" size="small" danger :loading="revokingId === record.id">
                  <template #icon><StopOutlined /></template>
                  撤回
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="detailOpen" title="通知详情" width="860px" :footer="null">
      <a-spin :spinning="detailLoading">
        <a-space
          v-if="selected"
          direction="vertical"
          size="middle"
          class="detail-body lh-modal-detail"
        >
          <a-descriptions bordered size="small" :column="{ xs: 1, sm: 1, md: 2 }">
            <a-descriptions-item label="标题" :span="2">{{ selected.title }}</a-descriptions-item>
            <a-descriptions-item label="内容" :span="2">
              <div class="message-content">{{ selected.message }}</div>
            </a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-tag :color="selected.revokedAt ? 'default' : 'green'">
                {{ selected.revokedAt ? '已撤回' : '已发布' }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="优先级">
              <a-tag :color="getPriorityMeta(selected.priority).color">
                {{ getPriorityMeta(selected.priority).label }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="发布时间">
              {{ formatDate(selected.timestamp) }}
            </a-descriptions-item>
            <a-descriptions-item label="接收人数">
              {{ selected.totalRecipients }}
            </a-descriptions-item>
            <a-descriptions-item label="已读">{{ selected.readCount }}</a-descriptions-item>
            <a-descriptions-item label="未读">{{ selected.unreadCount }}</a-descriptions-item>
          </a-descriptions>

          <a-table
            row-key="id"
            size="small"
            class="lh-modal-table"
            :columns="recipientColumns"
            :data-source="selected.recipients"
            :pagination="{ pageSize: 8, showSizeChanger: false }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag v-if="record.deleted" color="default">已撤回</a-tag>
                <a-tag v-else-if="record.read" color="green">已读</a-tag>
                <a-tag v-else color="orange">未读</a-tag>
              </template>
              <template v-else-if="column.key === 'readAt'">
                {{ record.readAt ? formatDate(record.readAt) : '-' }}
              </template>
            </template>
          </a-table>
        </a-space>
      </a-spin>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message, type TableColumnsType } from 'ant-design-vue';
import {
  CopyOutlined,
  EyeOutlined,
  NotificationOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons-vue';
import {
  getPublishedNotification,
  getPublishedNotifications,
  revokePublishedNotification,
  type PublishedNotificationItem,
  type PublishedNotificationRecipient,
} from '../../api/notification';
import { Role } from '../../types';

const router = useRouter();
const items = ref<PublishedNotificationItem[]>([]);
const loading = ref(false);
const keyword = ref('');
const selected = ref<PublishedNotificationItem | null>(null);
const detailOpen = ref(false);
const detailLoading = ref(false);
const revokingId = ref<string | null>(null);

const columns: TableColumnsType<PublishedNotificationItem> = [
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '状态', key: 'status', width: 88 },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 92, responsive: ['xl'] },
  { title: '目标范围', key: 'targets', width: 168, responsive: ['xxl'] },
  { title: '阅读', key: 'readRate', width: 136 },
  { title: '发布时间', dataIndex: 'timestamp', key: 'timestamp', width: 148, responsive: ['xl'] },
  { title: '操作', key: 'actions', width: 166 },
];

const recipientColumns: TableColumnsType<PublishedNotificationRecipient> = [
  { title: '接收人', dataIndex: 'username', key: 'username', ellipsis: true },
  { title: '状态', key: 'status', width: 88 },
  { title: '阅读时间', dataIndex: 'readAt', key: 'readAt', width: 148, responsive: ['lg'] },
];

const filteredItems = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return items.value;
  return items.value.filter(
    (item) =>
      item.title.toLowerCase().includes(value) ||
      item.message.toLowerCase().includes(value) ||
      item.recipients.some((recipient) => recipient.username.toLowerCase().includes(value)),
  );
});

onMounted(() => {
  void fetchList();
});

async function fetchList() {
  loading.value = true;
  try {
    const res = await getPublishedNotifications({ limit: 500 });
    items.value = res.data.items || [];
  } catch (error) {
    message.error(error instanceof Error ? error.message : '获取发布记录失败');
  } finally {
    loading.value = false;
  }
}

async function openDetail(id: string) {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const res = await getPublishedNotification(id);
    selected.value = res.data;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '获取通知详情失败');
    detailOpen.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function handleRevoke(id: string) {
  revokingId.value = id;
  try {
    await revokePublishedNotification(id);
    message.success('通知已撤回');
    await fetchList();
    if (selected.value?.id === id) {
      const res = await getPublishedNotification(id);
      selected.value = res.data;
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '撤回通知失败');
  } finally {
    revokingId.value = null;
  }
}

function copyPublish(record: PublishedNotificationItem) {
  void router.push({
    path: '/notifications/publish',
    query: {
      title: record.title,
      message: record.message,
    },
  });
}

function getTargetLabels(record: PublishedNotificationItem) {
  const roleLabelMap: Record<string, string> = {
    [Role.OWNER]: '负责人',
    [Role.ANNOTATOR]: '标注员',
    [Role.REVIEWER]: '审核员',
  };
  return [
    ...record.targetRoles.map((role) => roleLabelMap[role] || role),
    ...record.targetUsernames,
  ];
}

function getPriorityMeta(priority: PublishedNotificationItem['priority']) {
  const map: Record<PublishedNotificationItem['priority'], { label: string; color: string }> = {
    high: { label: '重要', color: 'red' },
    medium: { label: '普通', color: 'blue' },
    low: { label: '低优先级', color: 'default' },
  };
  return map[priority];
}

function getReadPercent(record: PublishedNotificationItem) {
  return record.totalRecipients > 0
    ? Math.round((record.readCount / record.totalRecipients) * 100)
    : 0;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}
</script>

<style scoped>
.notification-manage-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  margin: 0;
}

.page-icon {
  color: var(--lh-primary);
}

.search-input {
  width: 260px;
}

.read-rate {
  display: block;
  font-size: 12px;
}

.detail-body {
  width: 100%;
}

.message-content {
  white-space: pre-wrap;
}
</style>
