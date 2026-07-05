<template>
  <a-modal
    :open="open"
    title="领取审核任务"
    width="780px"
    :footer="null"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <div class="lh-modal-stack">
      <a-space wrap class="claim-toolbar lh-modal-toolbar">
        <a-button size="small" :loading="loading" @click="emit('refresh')">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button
          size="small"
          type="primary"
          :loading="batchClaiming"
          :disabled="selectedIds.length === 0"
          @click="emit('batch-claim')"
        >
          批量领取 {{ selectedIds.length || '' }}
        </a-button>
        <a-checkbox :checked="continuous" @update:checked="emit('update:continuous', $event)">
          连续领取
        </a-checkbox>
        <a-typography-text type="secondary">仅展示尚未分配审核员的待审数据。</a-typography-text>
      </a-space>
      <a-table
        row-key="id"
        size="small"
        class="lh-modal-table"
        :loading="loading"
        :data-source="items"
        :columns="claimColumns"
        :pagination="{ pageSize: 8 }"
        :row-selection="{ selectedRowKeys: selectedIds, onChange: onSelectionChange }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'taskId'">
            {{ taskNames[record.taskId] || record.taskId }}
          </template>
          <template v-else-if="column.key === 'annotator'">
            {{ record.annotator || '未分配' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button
              type="link"
              size="small"
              :loading="claimingId === record.id"
              @click="emit('claim', record.id)"
            >
              领取
            </a-button>
          </template>
        </template>
      </a-table>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ReloadOutlined } from '@ant-design/icons-vue';
import type { TableColumnsType } from 'ant-design-vue';
import type { AvailableItem } from '../../../api/annotation';

defineProps<{
  open: boolean;
  loading: boolean;
  items: AvailableItem[];
  claimingId: string | null;
  batchClaiming: boolean;
  selectedIds: string[];
  continuous: boolean;
  /** taskId → 任务名 */
  taskNames: Record<string, string>;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:continuous': [value: boolean];
  refresh: [];
  claim: [id: string];
  'batch-claim': [];
  'selection-change': [keys: Array<string | number>];
}>();

const claimColumns: TableColumnsType<AvailableItem> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 112, ellipsis: true },
  {
    title: '任务',
    dataIndex: 'taskId',
    key: 'taskId',
    width: 128,
    ellipsis: true,
    responsive: ['md'],
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 96 },
  { title: '标注员', dataIndex: 'annotator', key: 'annotator', width: 96, responsive: ['lg'] },
  { title: '数据摘要', dataIndex: 'rawDataPreview', key: 'rawDataPreview', ellipsis: true },
  { title: '操作', key: 'action', width: 72 },
];

function onSelectionChange(keys: Array<string | number>) {
  emit('selection-change', keys);
}
</script>

<style scoped>
.claim-toolbar {
  margin-bottom: 12px;
}
</style>
