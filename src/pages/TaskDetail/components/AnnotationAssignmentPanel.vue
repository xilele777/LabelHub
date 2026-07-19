<template>
  <a-card title="标注分配" size="small">
    <!-- 分配统计 -->
    <a-row v-if="stats" :gutter="16" class="stats-row">
      <a-col :span="6">
        <a-statistic title="总数" :value="stats.total" />
      </a-col>
      <a-col :span="6">
        <a-statistic
          title="已分配"
          :value="stats.assigned"
          :value-style="{ color: SEMANTIC_COLORS.success }"
        />
      </a-col>
      <a-col :span="6">
        <a-statistic
          title="未分配"
          :value="stats.unassigned"
          :value-style="{ color: SEMANTIC_COLORS.warning }"
        />
      </a-col>
      <a-col :span="6">
        <a-statistic title="标注员" :value="Object.keys(stats.byAnnotator).length" />
      </a-col>
    </a-row>

    <a-divider />

    <!-- 分配策略 -->
    <a-form layout="vertical">
      <a-form-item label="分配策略">
        <a-radio-group v-model:value="strategy" button-style="solid">
          <a-radio-button value="even_split">按量均分</a-radio-button>
          <a-radio-button value="manual">手动指定</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- 按量均分模式 -->
      <template v-if="strategy === 'even_split'">
        <a-form-item label="选择标注员">
          <a-checkbox-group v-model:value="selectedAnnotators">
            <a-row :gutter="[16, 8]">
              <a-col v-for="a in annotators" :key="a.username" :span="8">
                <a-checkbox :value="a.username">{{ a.username }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
          <a-empty
            v-if="annotators.length === 0 && !annotatorsLoading"
            description="暂无可用的标注员"
            :image="false"
          />
        </a-form-item>

        <a-form-item label="每人分配数量（0 = 全部分配）">
          <a-input-number v-model:value="perPerson" :min="0" :max="stats?.unassigned ?? 0" />
        </a-form-item>
      </template>

      <!-- 手动指定模式 -->
      <template v-else>
        <a-alert
          type="info"
          show-icon
          message="在下方表格中为每条数据选择标注员"
          class="mode-hint"
        />
      </template>

      <a-space>
        <a-button type="primary" :loading="assigning" :disabled="!canAssign" @click="handleAssign">
          执行分配
        </a-button>
        <a-popconfirm title="确认清除所有未开始标注的分配？" @confirm="handleClear">
          <a-button :loading="clearing" danger>清除分配</a-button>
        </a-popconfirm>
      </a-space>
    </a-form>

    <a-divider />

    <!-- 数据表格 -->
    <a-typography-text type="secondary"> 待分配数据（共 {{ items.length }} 条） </a-typography-text>

    <a-table
      row-key="id"
      size="small"
      class="items-table"
      :columns="columns"
      :data-source="items"
      :loading="itemsLoading"
      :scroll="{ x: 640 }"
      :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag>{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'annotator'">
          <template v-if="strategy === 'manual'">
            <a-select
              v-model:value="manualAssignments[record.id]"
              placeholder="选择标注员"
              style="width: 140px"
              allow-clear
              :options="annotatorOptions"
            />
          </template>
          <template v-else>
            {{ record.annotator || '-' }}
          </template>
        </template>
        <template v-else-if="column.key === 'rawDataPreview'">
          <a-tooltip :title="record.rawDataPreview">
            <span class="ellipsis-cell">{{ record.rawDataPreview }}</span>
          </a-tooltip>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import {
  getAnnotators,
  getAssignmentStats,
  getAssignableItems,
  executeAssignment,
  clearAssignment,
  type ExecuteAssignParams,
} from '../../../api/assignment';
import type { AnnotatorInfo, AssignmentStats } from '../../../types';
import { SEMANTIC_COLORS } from '../../../utils/statusMeta';

const props = defineProps<{ taskId: string }>();

const annotators = ref<AnnotatorInfo[]>([]);
const annotatorsLoading = ref(false);
const itemsLoading = ref(false);
const assigning = ref(false);
const clearing = ref(false);
const strategy = ref<'even_split' | 'manual'>('even_split');
const selectedAnnotators = ref<string[]>([]);
const perPerson = ref(0);
const stats = ref<AssignmentStats | null>(null);

interface AssignableItem {
  id: string;
  taskId: string;
  status: string;
  annotator: string | null;
  rawDataPreview: string;
}

const items = ref<AssignableItem[]>([]);
const manualAssignments = reactive<Record<string, string>>({});

const annotatorOptions = computed(() =>
  annotators.value.map((a) => ({ label: a.username, value: a.username })),
);

const canAssign = computed(() => {
  if (strategy.value === 'even_split') {
    return selectedAnnotators.value.length > 0;
  }
  return Object.values(manualAssignments).some((v) => v);
});

const columns = computed<TableColumnsType<AssignableItem>>(() => [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 130, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  {
    title: strategy.value === 'manual' ? '分配标注员' : '已分配标注员',
    dataIndex: 'annotator',
    key: 'annotator',
    width: 160,
  },
  { title: '原始数据', dataIndex: 'rawDataPreview', key: 'rawDataPreview', ellipsis: true },
]);

async function loadAnnotators() {
  annotatorsLoading.value = true;
  try {
    const res = await getAnnotators();
    annotators.value = res.data;
  } catch {
    message.error('获取标注员列表失败');
  } finally {
    annotatorsLoading.value = false;
  }
}

async function loadStats() {
  try {
    const res = await getAssignmentStats(props.taskId);
    stats.value = res.data;
  } catch {
    // stats 加载失败不阻塞
  }
}

async function loadItems() {
  itemsLoading.value = true;
  try {
    const res = await getAssignableItems(props.taskId);
    items.value = res.data.items;
    // 初始化手动分配映射
    items.value.forEach((item) => {
      if (!(item.id in manualAssignments)) {
        manualAssignments[item.id] = item.annotator || '';
      }
    });
  } catch {
    message.error('获取待分配数据失败');
  } finally {
    itemsLoading.value = false;
  }
}

async function handleAssign() {
  assigning.value = true;
  try {
    const params: ExecuteAssignParams = {
      strategy: strategy.value,
    };

    if (strategy.value === 'even_split') {
      params.annotators = selectedAnnotators.value;
      params.options = { perPerson: perPerson.value };
    } else {
      params.strategy = 'manual';
      const list = Object.entries(manualAssignments)
        .filter(([, annotator]) => annotator)
        .map(([itemId, annotator]) => ({ itemId, annotator }));
      if (list.length === 0) {
        message.warning('请至少为一条数据指定标注员');
        return;
      }
      params.options = { assignments: list };
    }

    const res = await executeAssignment(props.taskId, params);
    message.success(`分配成功，共分配 ${res.data.assigned} 条数据`);
    await refreshData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '分配失败');
  } finally {
    assigning.value = false;
  }
}

async function handleClear() {
  clearing.value = true;
  try {
    const res = await clearAssignment(props.taskId);
    message.success(`已清除 ${res.data.cleared} 条分配`);
    selectedAnnotators.value = [];
    await refreshData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '清除失败');
  } finally {
    clearing.value = false;
  }
}

async function refreshData() {
  await Promise.all([loadStats(), loadItems()]);
}

onMounted(() => {
  loadAnnotators();
  refreshData();
});

watch(
  () => props.taskId,
  () => refreshData(),
);
</script>

<style scoped>
.stats-row {
  margin-bottom: 8px;
}
.mode-hint {
  margin-bottom: 12px;
}
.items-table {
  margin-top: 12px;
}
.ellipsis-cell {
  display: inline-block;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
