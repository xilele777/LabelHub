<template>
  <section class="template-manage-page app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="4" class="page-title">模板列表</a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">维护可复用的标注字段和任务 Schema。</a-typography-text>
      </div>
      <div class="app-toolbar">
        <a-input-search
          v-model:value="keyword"
          allow-clear
          placeholder="搜索模板名称"
          class="search-input"
          @search="current = 1"
          @change="current = 1"
        />
        <a-button type="primary" @click="router.push('/templates/builder?mode=create')">
          <template #icon><PlusOutlined /></template>
          新建模板
        </a-button>
      </div>
    </header>

    <a-alert
      v-if="templateStore.error"
      type="error"
      :message="templateStore.error"
      show-icon
      closable
      class="page-alert"
      @close="templateStore.$patch({ error: null })"
    />

    <a-card class="app-table-card" :body-style="{ padding: 0 }">
      <template #title>
        <a-space>
          <span>模板数据</span>
          <a-tag color="blue">共 {{ filteredTemplates.length }} 条</a-tag>
        </a-space>
      </template>
      <a-table
        row-key="id"
        :columns="columns"
        :data-source="filteredTemplates"
        :loading="templateStore.loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="getTaskTypeMeta(record.type).color">{{ getTaskTypeMeta(record.type).label }}</a-tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a-button type="link" size="small" :loading="previewLoadingId === record.id" @click="openPreview(record)">
                <template #icon><EyeOutlined /></template>
                预览
              </a-button>
              <a-button type="link" size="small" @click="router.push(`/templates/builder?id=${record.id}`)">
                <template #icon><EditOutlined /></template>
                编辑
              </a-button>
              <a-popconfirm title="确认删除该模板？删除后无法恢复。" @confirm="handleDelete(record.id)">
                <a-button type="link" size="small" danger>
                  <template #icon><DeleteOutlined /></template>
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="previewOpen" title="模板 Schema 预览" width="680px" :footer="null">
      <div class="lh-modal-detail">
      <a-descriptions v-if="previewData" :column="1" bordered size="small">
        <a-descriptions-item label="模板ID">{{ previewData.id }}</a-descriptions-item>
        <a-descriptions-item label="模板名称">{{ previewData.name }}</a-descriptions-item>
        <a-descriptions-item label="任务类型">
          <a-tag :color="getTaskTypeMeta(previewData.type).color">{{ getTaskTypeMeta(previewData.type).label }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="版本">v{{ previewData.version }}</a-descriptions-item>
        <a-descriptions-item label="字段数量">{{ previewData.fields.length }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatDate(previewData.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="更新时间">{{ formatDate(previewData.updatedAt) }}</a-descriptions-item>
        <a-descriptions-item label="字段列表">
          <a-space wrap>
            <a-tag v-for="field in previewData.fields" :key="field.id">{{ field.label }}（{{ field.type }}）</a-tag>
          </a-space>
        </a-descriptions-item>
        <a-descriptions-item label="完整 Schema">
          <pre class="schema-preview">{{ JSON.stringify(previewData, null, 2) }}</pre>
        </a-descriptions-item>
      </a-descriptions>
      </div>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message, type TableColumnsType, type TablePaginationConfig } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { TaskType, type AnnotationTemplate, type TemplateItem } from '../../types';
import { useTemplateStore } from '../../store/useTemplateStore';
import { getTemplateSchemaAsync } from '../../utils/templateSchemaHelper';

const PAGE_SIZE = 5;

const router = useRouter();
const templateStore = useTemplateStore();

const keyword = ref('');
const current = ref(1);
const previewOpen = ref(false);
const previewData = ref<AnnotationTemplate | null>(null);
const previewLoadingId = ref<string | null>(null);

const columns: TableColumnsType<TemplateItem> = [
  { title: '模板名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '模板描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 112 },
  { title: '字段', dataIndex: 'fieldCount', key: 'fieldCount', width: 72, align: 'center' },
  { title: '创建人', dataIndex: 'creator', key: 'creator', width: 90, responsive: ['xl'] },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 148, responsive: ['xxl'] },
  { title: '操作', key: 'action', width: 156 },
];

const filteredTemplates = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  return templateStore.templates.filter((template) => !normalizedKeyword || template.name.toLowerCase().includes(normalizedKeyword));
});

const pagination = computed<TablePaginationConfig>(() => ({
  current: current.value,
  pageSize: PAGE_SIZE,
  total: filteredTemplates.value.length,
  showSizeChanger: false,
  showTotal: (total) => `共 ${total} 条`,
}));

onMounted(() => {
  void templateStore.fetchTemplates();
});

function handleTableChange(nextPagination: TablePaginationConfig) {
  current.value = Number(nextPagination.current || 1);
}

async function handleDelete(id: string) {
  try {
    await templateStore.deleteTemplate(id);
    message.success('模板已删除');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除模板失败');
  }
}

async function openPreview(record: TemplateItem) {
  previewLoadingId.value = record.id;
  try {
    const schema = await getTemplateSchemaAsync(record.id);
    previewData.value = schema ?? {
      id: record.id,
      name: record.name,
      type: record.type,
      fields: [],
      version: 1,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    };
    previewOpen.value = true;
  } catch {
    message.warning('获取模板 Schema 失败');
  } finally {
    previewLoadingId.value = null;
  }
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
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

.schema-preview {
  max-height: 300px;
  margin: 0;
  padding: 8px;
  overflow: auto;
  background: #f8fafd;
  border-radius: 6px;
  font-size: 12px;
}
@media (max-width: 576px) {
  .search-input {
    width: 100%;
  }
}
</style>
