<template>
  <a-card title="审核分配" size="small">
    <a-alert
      type="info"
      show-icon
      message="为已提交的数据项分配审核员。标注员不能审核自己标注的数据。"
      class="mode-hint"
    />

    <a-typography-text type="secondary" class="count-text">
      待分配审核数据（共 {{ items.length }} 条）
    </a-typography-text>

    <a-table
      row-key="id"
      size="small"
      class="items-table"
      :columns="columns"
      :data-source="items"
      :loading="itemsLoading"
      :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag>{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'reviewer'">
          <a-select
            v-model:value="reviewAssignments[record.id]"
            placeholder="选择审核员"
            style="width: 140px"
            allow-clear
            :options="reviewerOptions"
          />
        </template>
        <template v-else-if="column.key === 'rawDataPreview'">
          <a-tooltip :title="record.rawDataPreview">
            <span class="ellipsis-cell">{{ record.rawDataPreview }}</span>
          </a-tooltip>
        </template>
      </template>
    </a-table>

    <a-space class="actions">
      <a-button type="primary" :loading="assigning" :disabled="!canAssign" @click="handleAssign">
        执行审核分配
      </a-button>
    </a-space>
  </a-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import {
  getReviewers,
  getReviewAssignableItems,
  executeReviewAssignment,
} from '../../../api/assignment';
import type { AnnotatorInfo } from '../../../types';

const props = defineProps<{ taskId: string }>();

const reviewers = ref<AnnotatorInfo[]>([]);
const itemsLoading = ref(false);
const assigning = ref(false);

interface ReviewAssignableItem {
  id: string;
  taskId: string;
  status: string;
  annotator: string | null;
  reviewer: string | null;
  submittedAt: string | null;
  rawDataPreview: string;
}

const items = ref<ReviewAssignableItem[]>([]);
const reviewAssignments = reactive<Record<string, string>>({});

const reviewerOptions = computed(() =>
  reviewers.value.map((r) => ({ label: r.username, value: r.username })),
);

const canAssign = computed(() => Object.values(reviewAssignments).some((v) => v));

const columns: TableColumnsType<ReviewAssignableItem> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 130, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '标注员', dataIndex: 'annotator', key: 'annotator', width: 110 },
  { title: '审核员', dataIndex: 'reviewer', key: 'reviewer', width: 160 },
  {
    title: '提交时间',
    dataIndex: 'submittedAt',
    key: 'submittedAt',
    width: 150,
  },
  { title: '原始数据', dataIndex: 'rawDataPreview', key: 'rawDataPreview', ellipsis: true },
];

async function loadReviewers() {
  try {
    const res = await getReviewers();
    reviewers.value = res.data;
  } catch {
    message.error('获取审核员列表失败');
  }
}

async function loadItems() {
  itemsLoading.value = true;
  try {
    const res = await getReviewAssignableItems(props.taskId);
    items.value = res.data.items;
    items.value.forEach((item) => {
      if (!(item.id in reviewAssignments)) {
        reviewAssignments[item.id] = item.reviewer || '';
      }
    });
  } catch {
    message.error('获取待分配审核数据失败');
  } finally {
    itemsLoading.value = false;
  }
}

async function handleAssign() {
  const list = Object.entries(reviewAssignments)
    .filter(([, reviewer]) => reviewer)
    .map(([itemId, reviewer]) => ({ itemId, reviewer }));

  if (list.length === 0) {
    message.warning('请至少为一条数据指定审核员');
    return;
  }

  assigning.value = true;
  try {
    const res = await executeReviewAssignment(props.taskId, list);
    message.success(`审核分配成功，共分配 ${res.data.assigned} 条数据`);
    await loadItems();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '审核分配失败');
  } finally {
    assigning.value = false;
  }
}

onMounted(() => {
  loadReviewers();
  loadItems();
});

watch(
  () => props.taskId,
  () => loadItems(),
);
</script>

<style scoped>
.mode-hint {
  margin-bottom: 16px;
}
.count-text {
  display: block;
  margin-bottom: 8px;
}
.items-table {
  margin-top: 8px;
}
.actions {
  margin-top: 16px;
}
.ellipsis-cell {
  display: inline-block;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
