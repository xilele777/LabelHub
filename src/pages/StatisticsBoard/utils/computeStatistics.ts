/**
 * Statistics board aggregation helpers.
 */
import {
  DataItemStatus,
  ReviewStatus,
  STATUS_DISPLAY_CONFIG,
  TaskStatus,
  type DataItem,
  type TaskItem,
} from '../../../types';
import type { AIReviewResult } from '../../../types/aiReview';

const STATUS_CHART_COLOR_MAP: Record<DataItemStatus, string> = {
  [DataItemStatus.PENDING]: '#8c8c8c',
  [DataItemStatus.DRAFT]: '#faad14',
  [DataItemStatus.SUBMITTED]: '#1a73e8',
  [DataItemStatus.AI_REVIEWING]: '#597ef7',
  [DataItemStatus.AI_REVIEWED]: '#13c2c2',
  [DataItemStatus.PENDING_REVIEW]: '#fa8c16',
  [DataItemStatus.REVIEWED]: '#52c41a',
  [DataItemStatus.REJECTED]: '#ff4d4f',
};

const AI_RISK_MAP: Record<ReviewStatus, { label: string; color: string }> = {
  [ReviewStatus.PASS]: { label: '通过', color: '#52c41a' },
  [ReviewStatus.RISK]: { label: '风险', color: '#faad14' },
  [ReviewStatus.FAIL]: { label: '不通过', color: '#ff4d4f' },
};

export interface StatCard {
  title: string;
  value: number;
  icon: string;
  color: string;
  suffix?: string;
  description?: string;
}

export interface AnnotatorRankItem {
  annotator: string;
  displayName: string;
  submitCount: number;
}

export interface ReviewPassRate {
  total: number;
  passed: number;
  rejected: number;
  rate: number;
}

export interface StatusDistributionItem {
  status: DataItemStatus;
  label: string;
  count: number;
  color: string;
}

export interface AIRiskDistributionItem {
  status: ReviewStatus;
  label: string;
  count: number;
  color: string;
}

export interface StatisticsResult {
  totalTasks: number;
  inProgressTasks: number;
  passedDataCount: number;
  rejectedDataCount: number;
  aiRiskHitCount: number;
  totalDataItems: number;
  archivedDataItems: number;
  reviewPendingCount: number;
  annotatorRank: AnnotatorRankItem[];
  reviewPassRate: ReviewPassRate;
  statusDistribution: StatusDistributionItem[];
  aiRiskDistribution: AIRiskDistributionItem[];
  statCards: StatCard[];
}

const REVIEWED_STATUSES = new Set<DataItemStatus>([
  DataItemStatus.REVIEWED,
  DataItemStatus.REJECTED,
]);

function getDisplayName(annotator: string): string {
  return annotator;
}

function countUniqueRiskRules(aiResults: AIReviewResult[]): number {
  return aiResults
    .filter(
      (result) =>
        result.reviewStatus === ReviewStatus.RISK ||
        result.reviewStatus === ReviewStatus.FAIL,
    )
    .reduce((sum, result) => sum + result.matchedRules.length, 0);
}

export function computeStatistics(
  tasks: TaskItem[],
  dataItems: DataItem[],
  aiResults: AIReviewResult[],
): StatisticsResult {
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length;
  const totalDataItems = dataItems.length;
  const archivedDataItems = dataItems.filter((item) => item.archived).length;

  const passedDataCount = dataItems.filter((item) => item.status === DataItemStatus.REVIEWED).length;
  const rejectedDataCount = dataItems.filter((item) => item.status === DataItemStatus.REJECTED).length;
  const reviewPendingCount = dataItems.filter((item) => item.status === DataItemStatus.PENDING_REVIEW).length;
  const aiRiskHitCount = countUniqueRiskRules(aiResults);

  const annotatorSubmitMap = new Map<string, number>();
  dataItems.forEach((item) => {
    const isSubmitted = Boolean(item.submittedAt) || REVIEWED_STATUSES.has(item.status);
    if (item.annotator && isSubmitted) {
      annotatorSubmitMap.set(item.annotator, (annotatorSubmitMap.get(item.annotator) ?? 0) + 1);
    }
  });

  const annotatorRank = Array.from(annotatorSubmitMap.entries())
    .map(([annotator, submitCount]) => ({
      annotator,
      displayName: getDisplayName(annotator),
      submitCount,
    }))
    .sort((a, b) => b.submitCount - a.submitCount);

  const reviewedItems = dataItems.filter((item) => REVIEWED_STATUSES.has(item.status));
  const passed = reviewedItems.filter((item) => item.status === DataItemStatus.REVIEWED).length;
  const rejected = reviewedItems.filter((item) => item.status === DataItemStatus.REJECTED).length;
  const total = passed + rejected;
  const reviewPassRate: ReviewPassRate = {
    total,
    passed,
    rejected,
    rate: total > 0 ? passed / total : 0,
  };

  const statusCountMap = new Map<DataItemStatus, number>();
  dataItems.forEach((item) => {
    statusCountMap.set(item.status, (statusCountMap.get(item.status) ?? 0) + 1);
  });

  const statusDistribution = Object.values(DataItemStatus)
    .map((status) => ({
      status,
      label: STATUS_DISPLAY_CONFIG[status].label,
      count: statusCountMap.get(status) ?? 0,
      color: STATUS_CHART_COLOR_MAP[status],
    }))
    .filter((item) => item.count > 0);

  const aiRiskCountMap = new Map<ReviewStatus, number>();
  aiResults.forEach((result) => {
    aiRiskCountMap.set(result.reviewStatus, (aiRiskCountMap.get(result.reviewStatus) ?? 0) + 1);
  });

  const aiRiskDistribution = Object.values(ReviewStatus)
    .map((status) => ({
      status,
      label: AI_RISK_MAP[status].label,
      count: aiRiskCountMap.get(status) ?? 0,
      color: AI_RISK_MAP[status].color,
    }))
    .filter((item) => item.count > 0);

  const statCards: StatCard[] = [
    {
      title: '任务总数',
      value: totalTasks,
      icon: 'UnorderedListOutlined',
      color: '#1a73e8',
      description: `${inProgressTasks} 个进行中`,
    },
    {
      title: '数据总量',
      value: totalDataItems,
      icon: 'DatabaseOutlined',
      color: '#13c2c2',
      description: `${archivedDataItems} 条已归档`,
    },
    {
      title: '待人工审核',
      value: reviewPendingCount,
      icon: 'AuditOutlined',
      color: '#fa8c16',
      description: 'AI 预审后等待处理',
    },
    {
      title: '审核通过',
      value: passedDataCount,
      icon: 'CheckCircleOutlined',
      color: '#52c41a',
      description: `${reviewPassRate.passed} / ${reviewPassRate.total || 0} 条`,
    },
    {
      title: '审核驳回',
      value: rejectedDataCount,
      icon: 'CloseCircleOutlined',
      color: '#ff4d4f',
      description: '需返工或重新提交',
    },
    {
      title: '审核通过率',
      value: Math.round(reviewPassRate.rate * 100),
      icon: 'SafetyCertificateOutlined',
      color: '#2f54eb',
      suffix: '%',
      description: aiRiskHitCount > 0 ? `AI 命中 ${aiRiskHitCount} 条风险规则` : '暂无 AI 风险命中',
    },
  ];

  return {
    totalTasks,
    inProgressTasks,
    passedDataCount,
    rejectedDataCount,
    aiRiskHitCount,
    totalDataItems,
    archivedDataItems,
    reviewPendingCount,
    annotatorRank,
    reviewPassRate,
    statusDistribution,
    aiRiskDistribution,
    statCards,
  };
}
