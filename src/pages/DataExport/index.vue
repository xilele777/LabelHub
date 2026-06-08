<template>
  <section class="data-export-page app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="4" class="page-title">数据导出</a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">选择任务、范围和格式后导出标注数据。</a-typography-text>
      </div>
      <div class="app-page-tools">
        <a-tag color="blue">总数据 {{ stats.total }}</a-tag>
        <a-tag color="green">通过 {{ stats.approved }}</a-tag>
        <a-tag color="red">驳回 {{ stats.rejected }}</a-tag>
      </div>
    </header>

    <a-card title="导出配置" class="panel-card export-config-card">
      <a-row :gutter="[16, 16]" align="middle">
        <a-col :xs="24" :md="8">
          <div class="field-label">选择任务</div>
          <a-select
            v-model:value="selectedTaskId"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="留空导出全部任务"
            class="full-control"
            :options="taskOptions"
          />
        </a-col>
        <a-col :xs="24" :md="8">
          <div class="field-label">导出范围</div>
          <a-radio-group v-model:value="exportRange" option-type="button" button-style="solid" :options="rangeOptions" class="segmented-group" />
        </a-col>
        <a-col :xs="24" :md="8">
          <div class="field-label">导出格式</div>
          <a-radio-group v-model:value="exportFormat" option-type="button" button-style="solid" :options="formatOptions" class="segmented-group" />
        </a-col>
      </a-row>
    </a-card>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :md="6">
        <a-card class="metric-card metric-card--blue"><a-statistic title="总数据" :value="stats.total" /></a-card>
      </a-col>
      <a-col :xs="24" :md="6">
        <a-card class="metric-card metric-card--green"><a-statistic title="审核通过" :value="stats.approved" /></a-card>
      </a-col>
      <a-col :xs="24" :md="6">
        <a-card class="metric-card metric-card--red"><a-statistic title="已驳回" :value="stats.rejected" /></a-card>
      </a-col>
      <a-col :xs="24" :md="6">
        <a-card class="export-card">
          <a-button type="primary" block :disabled="exportRecords.length === 0" @click="handleExport">
            <template #icon><DownloadOutlined /></template>
            导出 {{ exportFormat.toUpperCase() }}
          </a-button>
        </a-card>
      </a-col>
    </a-row>

    <a-card class="app-table-card" :body-style="{ padding: 0 }">
      <template #title>
        <a-space>
          <span>数据预览</span>
          <a-tag color="blue">{{ exportRecords.length }} 条</a-tag>
        </a-space>
      </template>
      <a-empty v-if="exportRecords.length === 0" description="暂无符合条件的数据" />
      <a-table
        v-else
        row-key="id"
        size="small"
        :columns="columns"
        :data-source="exportRecords"
        :pagination="{ pageSize: 10, showSizeChanger: false }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getDataStatusMeta(record.status).color">{{ getDataStatusMeta(record.status).label }}</a-tag>
          </template>
          <template v-else-if="column.key === 'rawData'">
            <a-tooltip :title="stringify(record.rawData)">
              <span class="preview-text">{{ stringify(record.rawData) }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'annotationResult'">
            <a-tooltip :title="stringify(record.annotationResult)">
              <span class="preview-text">{{ stringify(record.annotationResult) }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'aiReview'">
            <a-tag v-if="record.aiReviewResult">{{ record.aiReviewResult.reviewStatus }}</a-tag>
            <a-tag v-else>无</a-tag>
          </template>
          <template v-else-if="column.key === 'humanReview'">
            <a-tag v-if="record.humanReviewResult?.result" :color="record.humanReviewResult.result === 'approved' ? 'success' : 'error'">
              {{ record.humanReviewResult.result === 'approved' ? '通过' : '驳回' }}
            </a-tag>
            <a-tag v-else>无</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message, type TableColumnsType } from 'ant-design-vue';
import { DownloadOutlined } from '@ant-design/icons-vue';
import { DataItemStatus, STATUS_DISPLAY_CONFIG, type DataItem } from '../../types';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useTaskStore } from '../../store/useTaskStore';
import {
  ExportFormat,
  ExportRange,
  buildExportRecords,
  filterByRange,
  performExport,
  type ExportRecord,
} from '../../utils/exportUtils';

const taskStore = useTaskStore();
const annotationStore = useAnnotationStore();

const selectedTaskId = ref<string | undefined>();
const exportRange = ref<ExportRange>(ExportRange.ALL);
const exportFormat = ref<ExportFormat>(ExportFormat.JSON);

const rangeOptions = [
  { label: '全部数据', value: ExportRange.ALL },
  { label: '仅审核通过', value: ExportRange.APPROVED },
  { label: '仅驳回数据', value: ExportRange.REJECTED },
];

const formatOptions = [
  { label: 'JSON', value: ExportFormat.JSON },
  { label: 'CSV', value: ExportFormat.CSV },
];

const columns: TableColumnsType<ExportRecord> = [
  { title: '数据ID', dataIndex: 'id', key: 'id', width: 112, ellipsis: true },
  { title: '任务ID', dataIndex: 'taskId', key: 'taskId', width: 112, ellipsis: true, responsive: ['xl'] },
  { title: '状态', dataIndex: 'status', key: 'status', width: 96 },
  { title: '原始数据', dataIndex: 'rawData', key: 'rawData', ellipsis: true },
  { title: '标注结果', dataIndex: 'annotationResult', key: 'annotationResult', ellipsis: true },
  { title: 'AI', key: 'aiReview', width: 84, responsive: ['lg'] },
  { title: '审核', key: 'humanReview', width: 84 },
];

const taskOptions = computed(() =>
  taskStore.tasks.map((task) => ({
    label: `${task.name} (${task.id})`,
    value: task.id,
  })),
);

const allExportRecords = computed(() => {
  const itemMap = new Map<string, DataItem>();
  annotationStore.dataItems.forEach((item) => itemMap.set(item.id, item));
  annotationStore.archivedItems.forEach((item) => itemMap.set(item.id, item));

  const items = Array.from(itemMap.values()).filter((item) => !selectedTaskId.value || item.taskId === selectedTaskId.value);
  return buildExportRecords(items, annotationStore.aiReviewResults);
});

const exportRecords = computed(() => filterByRange(allExportRecords.value, exportRange.value));

const stats = computed(() => ({
  total: allExportRecords.value.length,
  approved: allExportRecords.value.filter((record) => record.status === DataItemStatus.REVIEWED).length,
  rejected: allExportRecords.value.filter((record) => record.status === DataItemStatus.REJECTED).length,
}));

onMounted(() => {
  void taskStore.fetchTasks();
  void annotationStore.fetchDataItems();
  void annotationStore.fetchArchivedItems();
  void annotationStore.fetchAIReviews();
});

function handleExport() {
  if (exportRecords.value.length === 0) {
    message.warning('没有可导出的数据');
    return;
  }

  const task = taskStore.tasks.find((item) => item.id === selectedTaskId.value);
  const baseFilename = task ? `LabelHub_${task.name}` : 'LabelHub_全部任务';
  performExport(exportRecords.value, exportFormat.value, baseFilename);
  message.success(`已导出 ${exportRecords.value.length} 条数据`);
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return '无';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function getDataStatusMeta(status: DataItemStatus) {
  return STATUS_DISPLAY_CONFIG[status] ?? { label: status, color: 'default' };
}
</script>

<style scoped>
.panel-card,
.metric-card,
.export-card,
.app-table-card {
  height: 100%;
  box-shadow: none;
}

.export-card :deep(.ant-card-body) {
  display: flex;
  align-items: center;
  height: 100%;
}

.export-config-card :deep(.ant-card-body) {
  padding: 18px;
}

.field-label {
  margin-bottom: 6px;
  font-weight: 600;
}

.full-control {
  width: 100%;
}

.segmented-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.preview-text {
  display: inline-block;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
@media (max-width: 576px) {
  .segmented-group,
  .segmented-group :deep(.ant-radio-button-wrapper) {
    width: 100%;
  }

  .segmented-group :deep(.ant-radio-button-wrapper) {
    text-align: center;
  }
}
</style>
