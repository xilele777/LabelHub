<template>
  <a-spin :spinning="loading">
    <section class="statistics-page">
      <a-alert v-if="error" type="error" :message="error" show-icon closable />

      <a-card class="hero-card">
        <a-row :gutter="[16, 12]" align="middle" justify="space-between">
          <a-col :xs="24" :lg="12">
            <a-typography-title :level="4" class="page-title">统计看板</a-typography-title>
            <a-typography-text type="secondary">
              汇总任务、标注、审核和 AI 预审风险。
            </a-typography-text>
          </a-col>
          <a-col :xs="24" :lg="12" class="hero-tags">
            <a-space wrap>
              <a-tag color="blue">
                进行中任务 {{ stats.inProgressTasks }} / {{ stats.totalTasks }}
              </a-tag>
              <a-tag color="cyan">数据总量 {{ stats.totalDataItems }}</a-tag>
              <a-tag
                :color="passRatePercent >= 80 ? 'green' : passRatePercent >= 50 ? 'orange' : 'red'"
              >
                审核通过率 {{ passRatePercent }}%
              </a-tag>
            </a-space>
          </a-col>
        </a-row>
      </a-card>

      <a-row :gutter="[16, 16]">
        <a-col v-for="card in statCards" :key="card.title" :xs="24" :sm="12" :xl="8" :xxl="4">
          <a-card size="small" class="metric-card" :class="`metric-card--${card.tone}`">
            <a-statistic :title="card.title" :value="card.value" :suffix="card.suffix" />
            <a-typography-text type="secondary" class="card-desc">
              {{ card.description }}
            </a-typography-text>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :xl="12">
          <a-card title="标注员提交排行" size="small" class="panel-card">
            <a-empty v-if="stats.annotatorRank.length === 0" description="暂无提交数据" />
            <a-list v-else :data-source="stats.annotatorRank.slice(0, 8)">
              <template #renderItem="{ item, index }">
                <a-list-item>
                  <div class="rank-row">
                    <a-tag color="blue">#{{ index + 1 }}</a-tag>
                    <a-typography-text>{{ item.displayName }}</a-typography-text>
                    <a-progress
                      :percent="getRankPercent(item.submitCount)"
                      size="small"
                      class="rank-progress"
                    />
                    <a-typography-text strong>{{ item.submitCount }}</a-typography-text>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="12">
          <a-card title="审核通过率" size="small" class="panel-card pass-rate-card">
            <a-progress type="dashboard" :percent="passRatePercent" />
            <div class="pass-rate-detail">
              <a-tag color="green">通过 {{ stats.reviewPassRate.passed }}</a-tag>
              <a-tag color="red">驳回 {{ stats.reviewPassRate.rejected }}</a-tag>
              <a-tag>总计 {{ stats.reviewPassRate.total }}</a-tag>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :xl="12">
          <a-card title="数据状态分布" size="small" class="panel-card">
            <a-list :data-source="stats.statusDistribution" :locale="{ emptyText: '暂无数据' }">
              <template #renderItem="{ item }">
                <a-list-item>
                  <div class="distribution-row">
                    <a-tag :color="item.color">{{ item.label }}</a-tag>
                    <a-progress
                      :percent="getStatusPercent(item.count)"
                      size="small"
                      class="rank-progress"
                    />
                    <a-typography-text strong>{{ item.count }}</a-typography-text>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="12">
          <a-card title="AI 风险分布" size="small" class="panel-card">
            <a-list
              :data-source="stats.aiRiskDistribution"
              :locale="{ emptyText: '暂无 AI 预审数据' }"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <div class="distribution-row">
                    <a-tag :color="item.color">{{ item.label }}</a-tag>
                    <a-progress
                      :percent="getAIRiskPercent(item.count)"
                      size="small"
                      class="rank-progress"
                    />
                    <a-typography-text strong>{{ item.count }}</a-typography-text>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
      </a-row>
    </section>
  </a-spin>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { computeStatistics } from './utils/computeStatistics';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useTaskStore } from '../../store/useTaskStore';

const taskStore = useTaskStore();
const annotationStore = useAnnotationStore();

const loading = computed(() => taskStore.loading || annotationStore.loading);
const error = computed(() => taskStore.error || annotationStore.error);

const allDataItems = computed(() => {
  const itemMap = new Map(annotationStore.dataItems.map((item) => [item.id, item]));
  annotationStore.archivedItems.forEach((item) => itemMap.set(item.id, item));
  return Array.from(itemMap.values());
});

const stats = computed(() => {
  const visibleItemIds = new Set(allDataItems.value.map((item) => item.id));
  const visibleAIReviews = annotationStore.aiReviewResults.filter((review) =>
    visibleItemIds.has(review.dataItemId),
  );
  return computeStatistics(taskStore.tasks, allDataItems.value, visibleAIReviews);
});

const passRatePercent = computed(() => Math.round(stats.value.reviewPassRate.rate * 100));
const maxSubmitCount = computed(() =>
  Math.max(...stats.value.annotatorRank.map((item) => item.submitCount), 1),
);
const statCards = computed(() => [
  {
    title: '任务总数',
    value: stats.value.totalTasks,
    description: `${stats.value.inProgressTasks} 个进行中`,
    tone: 'blue',
  },
  {
    title: '数据总量',
    value: stats.value.totalDataItems,
    description: `${stats.value.archivedDataItems} 条已归档`,
    tone: 'purple',
  },
  {
    title: '待人工审核',
    value: stats.value.reviewPendingCount,
    description: 'AI 预审后等待处理',
    tone: 'orange',
  },
  {
    title: '审核通过',
    value: stats.value.passedDataCount,
    description: `${stats.value.reviewPassRate.passed} / ${stats.value.reviewPassRate.total || 0} 条`,
    tone: 'green',
  },
  {
    title: '审核驳回',
    value: stats.value.rejectedDataCount,
    description: '需要返工或重新提交',
    tone: 'red',
  },
  {
    title: '审核通过率',
    value: passRatePercent.value,
    suffix: '%',
    description: `AI 命中 ${stats.value.aiRiskHitCount} 条风险规则`,
    tone: 'blue',
  },
]);

onMounted(() => {
  void taskStore.fetchTasks();
  void annotationStore.fetchDataItems();
  void annotationStore.fetchArchivedItems();
  void annotationStore.fetchAIReviews();
});

function getRankPercent(count: number) {
  return Math.round((count / maxSubmitCount.value) * 100);
}

function getStatusPercent(count: number) {
  return stats.value.totalDataItems > 0
    ? Math.round((count / stats.value.totalDataItems) * 100)
    : 0;
}

function getAIRiskPercent(count: number) {
  const total = stats.value.aiRiskDistribution.reduce((sum, item) => sum + item.count, 0);
  return total > 0 ? Math.round((count / total) * 100) : 0;
}
</script>

<style scoped>
.statistics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.hero-card {
  border-color: transparent;
}

.page-title {
  margin: 0 0 4px;
}

.hero-tags {
  text-align: right;
}

.card-desc {
  display: block;
  margin-top: 8px;
  font-size: 12px;
}

.rank-row,
.distribution-row {
  display: grid;
  grid-template-columns: max-content minmax(90px, 1fr) minmax(120px, 220px) max-content;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.rank-progress {
  min-width: 0;
  width: 100%;
}

.panel-card {
  height: 100%;
}

.pass-rate-card :deep(.ant-card-body) {
  display: grid;
  justify-items: center;
}

.pass-rate-detail {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

@media (max-width: 900px) {
  .hero-tags {
    text-align: left;
  }

  .rank-row,
  .distribution-row {
    grid-template-columns: max-content minmax(0, 1fr) max-content;
  }

  .rank-row .rank-progress,
  .distribution-row .rank-progress {
    grid-column: 1 / -1;
  }
}
</style>
