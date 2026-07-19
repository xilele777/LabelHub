<template>
  <section class="monitoring-board app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="4" class="page-title">性能监控</a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">
          生产环境真实用户的 Core Web Vitals（sendBeacon 上报，按 p75 聚合）。
        </a-typography-text>
      </div>
      <div class="app-toolbar">
        <a-radio-group v-model:value="days" button-style="solid" size="small">
          <a-radio-button :value="7">近 7 天</a-radio-button>
          <a-radio-button :value="14">近 14 天</a-radio-button>
          <a-radio-button :value="30">近 30 天</a-radio-button>
        </a-radio-group>
        <a-button size="small" :loading="loading" @click="fetchSummary">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </div>
    </header>

    <a-alert
      v-if="error"
      type="error"
      show-icon
      closable
      :message="error"
      class="page-alert"
      @close="error = null"
    />

    <a-card v-if="!loading && total === 0" class="empty-card">
      <a-empty description="暂无性能上报数据">
        <a-typography-text type="secondary">
          web-vitals 仅在生产构建（npm run build + preview/部署）中采集上报，开发模式不上报。
        </a-typography-text>
      </a-empty>
    </a-card>

    <template v-else>
      <!-- 指标统计卡：数值用文本色，rating 用色点 + 文字（不依赖颜色单独传达） -->
      <div class="stat-row">
        <a-card v-for="tile in statTiles" :key="tile.name" size="small" class="stat-tile">
          <div class="stat-name">
            {{ tile.name }}
            <a-tooltip :title="tile.description">
              <QuestionCircleOutlined class="stat-help" />
            </a-tooltip>
          </div>
          <div class="stat-value">{{ tile.display }}</div>
          <div class="stat-meta">
            <span class="rating-dot" :style="{ background: tile.ratingColor }" />
            <span>{{ tile.ratingLabel }}</span>
            <span class="stat-count">{{ tile.count }} 次采样</span>
          </div>
        </a-card>
      </div>

      <div class="chart-grid">
        <a-card size="small" class="chart-card">
          <template #title>
            <a-space>
              <span>p75 按天趋势</span>
              <a-segmented v-model:value="trendMetric" :options="metricOptions" size="small" />
            </a-space>
          </template>
          <div ref="trendChartRef" class="chart-box" />
        </a-card>

        <a-card
          size="small"
          title="Rating 分布（good / needs-improvement / poor）"
          class="chart-card"
        >
          <div ref="ratingChartRef" class="chart-box" />
        </a-card>
      </div>

      <!-- 表格视图：图表的无障碍兜底 -->
      <a-card size="small" title="汇总明细" class="app-table-card" :body-style="{ padding: 0 }">
        <a-table
          row-key="name"
          size="small"
          :columns="tableColumns"
          :data-source="tableRows"
          :pagination="false"
        />
      </a-card>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { message, type TableColumnsType } from 'ant-design-vue';
import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { get } from '../../api/request';

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

interface MetricSummary {
  count: number;
  p75: number | null;
  ratings: Record<'good' | 'needs-improvement' | 'poor', number>;
}

interface WebVitalsSummary {
  days: number;
  total: number;
  metrics: Record<string, MetricSummary>;
  trend: Array<Record<string, number | string | null>>;
  updatedAt: string;
}

// 指标固定顺序（分类色按实体固定分配，不随数据变化重排）
const METRIC_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;
type MetricName = (typeof METRIC_ORDER)[number];

const METRIC_INFO: Record<MetricName, { description: string; thresholds: [number, number] }> = {
  LCP: { description: '最大内容绘制（加载性能）', thresholds: [2500, 4000] },
  INP: { description: '交互到下一次绘制（响应性能）', thresholds: [200, 500] },
  CLS: { description: '累积布局偏移（视觉稳定性，存储值 ×1000）', thresholds: [100, 250] },
  FCP: { description: '首次内容绘制', thresholds: [1800, 3000] },
  TTFB: { description: '首字节时间', thresholds: [800, 1800] },
};

// 已通过 dataviz 六项校验（浅色底）：主色 + 三档状态色
const PRIMARY_COLOR = '#1a73e8';
const STATUS_COLORS = {
  good: '#188038',
  'needs-improvement': '#e37400',
  poor: '#a50e0e',
} as const;
const STATUS_LABELS = {
  good: '良好',
  'needs-improvement': '待改进',
  poor: '较差',
} as const;

const INK_SECONDARY = '#5f6368';
const GRID_LINE = '#f0f0f0';
const AXIS_LINE = '#e0e3eb';

const days = ref(7);
const loading = ref(false);
const error = ref<string | null>(null);
const summary = ref<WebVitalsSummary | null>(null);
const trendMetric = ref<MetricName>('LCP');

const total = computed(() => summary.value?.total ?? 0);
const metricOptions = METRIC_ORDER.map((name) => ({ label: name, value: name }));

const presentMetrics = computed(() =>
  METRIC_ORDER.filter((name) => (summary.value?.metrics[name]?.count ?? 0) > 0),
);

function formatMetricValue(name: string, value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  if (name === 'CLS') return (value / 1000).toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function ratingOf(name: MetricName, p75: number | null): keyof typeof STATUS_COLORS | null {
  if (p75 === null) return null;
  const [good, poor] = METRIC_INFO[name].thresholds;
  if (p75 <= good) return 'good';
  if (p75 <= poor) return 'needs-improvement';
  return 'poor';
}

const statTiles = computed(() =>
  METRIC_ORDER.map((name) => {
    const metric = summary.value?.metrics[name];
    const rating = ratingOf(name, metric?.p75 ?? null);
    return {
      name,
      description: METRIC_INFO[name].description,
      display: formatMetricValue(name, metric?.p75 ?? null),
      count: metric?.count ?? 0,
      ratingColor: rating ? STATUS_COLORS[rating] : '#dadce0',
      ratingLabel: rating ? STATUS_LABELS[rating] : '无数据',
    };
  }),
);

const tableColumns: TableColumnsType = [
  { title: '指标', dataIndex: 'name', key: 'name', width: 88 },
  { title: 'p75', dataIndex: 'p75', key: 'p75', width: 108 },
  { title: '采样数', dataIndex: 'count', key: 'count', width: 88 },
  { title: '良好', dataIndex: 'good', key: 'good' },
  { title: '待改进', dataIndex: 'ni', key: 'ni' },
  { title: '较差', dataIndex: 'poor', key: 'poor' },
];

const tableRows = computed(() =>
  presentMetrics.value.map((name) => {
    const metric = summary.value!.metrics[name]!;
    const sum = Math.max(
      1,
      metric.ratings.good + metric.ratings['needs-improvement'] + metric.ratings.poor,
    );
    const pct = (n: number) => `${Math.round((n / sum) * 100)}%（${n}）`;
    return {
      name,
      p75: formatMetricValue(name, metric.p75),
      count: metric.count,
      good: pct(metric.ratings.good),
      ni: pct(metric.ratings['needs-improvement']),
      poor: pct(metric.ratings.poor),
    };
  }),
);

async function fetchSummary() {
  loading.value = true;
  error.value = null;
  try {
    const res = await get<WebVitalsSummary>('/web-vitals/summary', { days: days.value });
    summary.value = res.data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载监控数据失败';
  } finally {
    loading.value = false;
  }
}

// ── ECharts：实例不可进入响应式系统，用普通变量持有 ──
const trendChartRef = ref<HTMLElement | null>(null);
const ratingChartRef = ref<HTMLElement | null>(null);
let trendChart: echarts.ECharts | null = null;
let ratingChart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

function ensureResizeObserver() {
  if (resizeObserver) return;
  resizeObserver = new ResizeObserver(() => {
    trendChart?.resize();
    ratingChart?.resize();
  });
}

function renderTrendChart() {
  if (!trendChartRef.value) return;
  if (!trendChart) trendChart = echarts.init(trendChartRef.value);
  ensureResizeObserver();
  resizeObserver?.observe(trendChartRef.value);

  const metric = trendMetric.value;
  const trend = summary.value?.trend ?? [];
  const dates = trend.map((point) => String(point.date));
  const values = trend.map((point) => {
    const raw = point[metric];
    if (typeof raw !== 'number') return null;
    return metric === 'CLS' ? Number((raw / 1000).toFixed(3)) : Math.round(raw);
  });

  trendChart.setOption(
    {
      grid: { left: 12, right: 20, top: 32, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: AXIS_LINE } },
        valueFormatter: (value: unknown) =>
          typeof value === 'number' ? (metric === 'CLS' ? value.toFixed(3) : `${value} ms`) : '—',
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisTick: { show: false },
        axisLabel: { color: INK_SECONDARY },
      },
      yAxis: {
        type: 'value',
        name: metric === 'CLS' ? 'CLS' : 'ms',
        nameTextStyle: { color: INK_SECONDARY },
        splitLine: { lineStyle: { color: GRID_LINE } },
        axisLabel: { color: INK_SECONDARY },
      },
      series: [
        {
          name: `${metric} p75`,
          type: 'line',
          data: values,
          connectNulls: true,
          lineStyle: { width: 2, color: PRIMARY_COLOR },
          itemStyle: { color: PRIMARY_COLOR },
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: dates.length <= 14,
        },
      ],
    },
    true,
  );
}

function renderRatingChart() {
  if (!ratingChartRef.value) return;
  if (!ratingChart) ratingChart = echarts.init(ratingChartRef.value);
  ensureResizeObserver();
  resizeObserver?.observe(ratingChartRef.value);

  const names = presentMetrics.value;
  const ratingKeys = ['good', 'needs-improvement', 'poor'] as const;
  const series = ratingKeys.map((key) => ({
    name: STATUS_LABELS[key],
    type: 'bar' as const,
    stack: 'rating',
    barWidth: 18,
    // 2px 表面色间隔：堆叠段之间的白色描边
    itemStyle: { color: STATUS_COLORS[key], borderColor: '#ffffff', borderWidth: 1 },
    label: {
      show: true,
      color: '#ffffff',
      fontSize: 12,
      formatter: (params: { value?: unknown }) =>
        typeof params.value === 'number' && params.value >= 10 ? `${params.value}%` : '',
    },
    data: names.map((name) => {
      const ratings = summary.value!.metrics[name]!.ratings;
      const sum = Math.max(1, ratings.good + ratings['needs-improvement'] + ratings.poor);
      return Math.round((ratings[key] / sum) * 100);
    }),
  }));

  ratingChart.setOption(
    {
      grid: { left: 12, right: 24, top: 36, bottom: 8, containLabel: true },
      legend: {
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: INK_SECONDARY },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: unknown) => (typeof value === 'number' ? `${value}%` : '—'),
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: INK_SECONDARY, formatter: '{value}%' },
        splitLine: { lineStyle: { color: GRID_LINE } },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisTick: { show: false },
        axisLabel: { color: INK_SECONDARY },
      },
      series,
    },
    true,
  );
}

function renderCharts() {
  if (!summary.value || summary.value.total === 0) return;
  renderTrendChart();
  renderRatingChart();
}

watch([summary, trendMetric], () => {
  // 等待 v-if 分支挂载后再渲染
  requestAnimationFrame(renderCharts);
});

watch(days, () => {
  void fetchSummary();
});

onMounted(() => {
  void fetchSummary().then(() => {
    if (error.value) message.warning('监控数据加载失败，可稍后重试');
  });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  trendChart?.dispose();
  ratingChart?.dispose();
  trendChart = null;
  ratingChart = null;
});
</script>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.stat-name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #5f6368;
  font-size: 13px;
  font-weight: 600;
}

.stat-help {
  color: #9aa0a6;
  font-size: 12px;
}

.stat-value {
  margin: 6px 0 4px;
  color: #202124;
  font-size: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #5f6368;
  font-size: 12px;
}

.rating-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.stat-count {
  margin-left: auto;
  color: #9aa0a6;
}

.chart-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 12px;
}

.chart-box {
  width: 100%;
  height: 300px;
}

@media (max-width: 1100px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
