/**
 * ECharts option builders for the statistics board.
 */
import type {
  AIRiskDistributionItem,
  AnnotatorRankItem,
  ReviewPassRate,
  StatusDistributionItem,
} from './computeStatistics';

type ChartOption = Record<string, unknown>;

const textColor = '#202124';
const mutedTextColor = '#5f6368';
const splitLineColor = '#eef2f7';
const axisLineColor = '#d9e2ec';

const titleStyle = {
  fontSize: 15,
  fontWeight: 600,
  color: textColor,
} as const;

const tooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.96)',
  borderColor: '#e5e7eb',
  borderWidth: 1,
  textStyle: {
    color: textColor,
  },
  extraCssText:
    'box-shadow: 0 2px 6px rgba(60, 64, 67, 0.14), 0 6px 18px rgba(60, 64, 67, 0.08); border-radius: 8px;',
} as const;

function buildEmptyOption(title: string, description = '暂无数据'): ChartOption {
  return {
    title: {
      text: title,
      left: 8,
      top: 0,
      textStyle: titleStyle,
    },
    graphic: {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: description,
        fill: mutedTextColor,
        fontSize: 14,
        fontWeight: 500,
      },
    },
  };
}

export function buildAnnotatorRankOption(data: AnnotatorRankItem[]): ChartOption {
  const sorted = [...data].slice(0, 10).reverse();

  if (sorted.length === 0) {
    return buildEmptyOption('标注员提交量排行', '暂无提交记录');
  }

  const maxValue = Math.max(...sorted.map((item) => item.submitCount), 1);

  return {
    title: {
      text: '标注员提交量排行',
      subtext: 'Top 10',
      left: 8,
      top: 0,
      textStyle: titleStyle,
      subtextStyle: { color: mutedTextColor, fontSize: 12 },
    },
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(26, 115, 232, 0.08)' } },
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] : params;
        if (!item || typeof item !== 'object') {
          return '';
        }
        const { name, value } = item as { name?: string; value?: unknown };
        return `${name ?? '-'}<br />提交量：<strong>${value ?? 0}</strong>`;
      },
    },
    grid: {
      left: 88,
      right: 46,
      top: 64,
      bottom: 28,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      max: maxValue,
      minInterval: 1,
      axisLabel: { color: mutedTextColor },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: splitLineColor } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((item) => item.displayName),
      axisLabel: {
        color: textColor,
        width: 76,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: axisLineColor } },
    },
    series: [
      {
        type: 'bar',
        data: sorted.map((item) => item.submitCount),
        barMaxWidth: 18,
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#1a73e8' },
              { offset: 1, color: '#13c2c2' },
            ],
          },
        },
        label: {
          show: true,
          position: 'right',
          color: textColor,
          fontSize: 12,
          fontWeight: 600,
        },
      },
    ],
  };
}

export function buildStatusDistributionOption(data: StatusDistributionItem[]): ChartOption {
  if (data.length === 0) {
    return buildEmptyOption('数据状态分布');
  }

  return {
    title: {
      text: '数据状态分布',
      left: 8,
      top: 0,
      textStyle: titleStyle,
    },
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter: '{b}<br />数量：<strong>{c}</strong><br />占比：{d}%',
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 4,
      top: 56,
      bottom: 16,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: mutedTextColor, fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['44%', '68%'],
        center: ['40%', '56%'],
        avoidLabelOverlap: true,
        minAngle: 6,
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 3,
          borderRadius: 4,
        },
        label: {
          show: true,
          formatter: '{b}\n{c}',
          color: textColor,
          fontSize: 12,
        },
        labelLine: {
          length: 12,
          length2: 8,
          lineStyle: { color: '#cbd5e1' },
        },
        emphasis: {
          scaleSize: 6,
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
        },
        data: data.map((item) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: item.color },
        })),
      },
    ],
  };
}

export function buildAIRiskDistributionOption(data: AIRiskDistributionItem[]): ChartOption {
  if (data.length === 0) {
    return buildEmptyOption('AI 预审风险分布', '暂无 AI 预审结果');
  }

  return {
    title: {
      text: 'AI 预审风险分布',
      left: 8,
      top: 0,
      textStyle: titleStyle,
    },
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter: '{b}<br />数量：<strong>{c}</strong><br />占比：{d}%',
    },
    legend: {
      bottom: 4,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: mutedTextColor, fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '48%'],
        avoidLabelOverlap: true,
        minAngle: 8,
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 3,
          borderRadius: 4,
        },
        label: {
          show: true,
          formatter: '{b}\n{c}',
          color: textColor,
          fontSize: 12,
        },
        labelLine: {
          length: 12,
          length2: 8,
          lineStyle: { color: '#cbd5e1' },
        },
        emphasis: {
          scaleSize: 6,
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
        },
        data: data.map((item) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: item.color },
        })),
      },
    ],
  };
}

export function buildReviewPassRateGaugeOption(rate: ReviewPassRate): ChartOption {
  const percent = Math.round(rate.rate * 100);
  const hasData = rate.total > 0;

  return {
    title: {
      text: '审核通过率',
      left: 8,
      top: 0,
      textStyle: titleStyle,
    },
    tooltip: {
      ...tooltipStyle,
      formatter: () =>
        hasData
          ? `通过：<strong>${rate.passed}</strong><br />驳回：<strong>${rate.rejected}</strong><br />总计：${rate.total}`
          : '暂无审核数据',
    },
    series: [
      {
        type: 'gauge',
        startAngle: 205,
        endAngle: -25,
        center: ['50%', '58%'],
        radius: '88%',
        min: 0,
        max: 100,
        splitNumber: 5,
        progress: {
          show: hasData,
          roundCap: true,
          width: 16,
          itemStyle: { color: '#1a73e8' },
        },
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: 16,
            color: [[1, '#edf2f7']],
          },
        },
        pointer: {
          show: hasData,
          icon: 'roundRect',
          itemStyle: { color: '#334155' },
          length: '56%',
          width: 5,
        },
        axisTick: { show: false },
        splitLine: {
          distance: 0,
          length: 10,
          lineStyle: { color: '#cbd5e1', width: 1 },
        },
        axisLabel: {
          distance: 24,
          color: mutedTextColor,
          fontSize: 11,
        },
        detail: {
          valueAnimation: true,
          formatter: hasData ? '{value}%' : '暂无审核',
          fontSize: hasData ? 30 : 20,
          fontWeight: 'bold',
          color: textColor,
          offsetCenter: [0, '36%'],
        },
        title: {
          offsetCenter: [0, '62%'],
          fontSize: 12,
          color: mutedTextColor,
        },
        data: [
          {
            value: percent,
            name: hasData ? `通过 ${rate.passed} / 总计 ${rate.total}` : '暂无通过率数据',
          },
        ],
      },
    ],
  };
}
