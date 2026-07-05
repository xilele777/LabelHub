import { computed, reactive, type Ref } from 'vue';
import { DataItemStatus, type DataItem } from '../../../types';
import type { AIReviewResult } from '../../../types/aiReview';
import { useDebounced } from '../../../composables/useDebounced';

export interface ReviewFilterState {
  status?: string;
  taskId?: string;
  annotator?: string;
  aiReviewResult?: string;
  keyword?: string;
}

export interface GroupedItems {
  taskId: string;
  items: DataItem[];
}

/**
 * 审核工作台筛选逻辑：筛选状态、派生选项、过滤与分组结果。
 * 关键词过滤使用防抖镜像，避免每次按键触发全量过滤重算。
 */
export function useReviewFilters(
  reviewableItems: Ref<DataItem[]>,
  aiResultMap: Ref<Map<string, AIReviewResult>>,
) {
  const filters = reactive<ReviewFilterState>({});
  const debouncedKeyword = useDebounced(() => filters.keyword);

  const annotatorOptions = computed(() => {
    const annotators = new Set<string>();
    reviewableItems.value.forEach((item) => {
      if (item.annotator) annotators.add(item.annotator);
    });
    return Array.from(annotators)
      .sort()
      .map((annotator) => ({ label: annotator, value: annotator }));
  });

  const filteredItems = computed(() => {
    let result = reviewableItems.value;
    if (filters.status) {
      if (filters.status === 'ai_reviewing_group') {
        result = result.filter((item) =>
          [
            DataItemStatus.SUBMITTED,
            DataItemStatus.AI_REVIEWING,
            DataItemStatus.AI_REVIEWED,
          ].includes(item.status),
        );
      } else {
        result = result.filter((item) => item.status === filters.status);
      }
    }
    if (filters.taskId) result = result.filter((item) => item.taskId === filters.taskId);
    if (filters.annotator) result = result.filter((item) => item.annotator === filters.annotator);
    if (filters.aiReviewResult) {
      result = result.filter(
        (item) => aiResultMap.value.get(item.id)?.reviewStatus === filters.aiReviewResult,
      );
    }
    if (filters.keyword) {
      const keyword = debouncedKeyword.value?.toLowerCase() ?? '';
      if (keyword) {
        result = result.filter((item) => {
          const fileName = String(item.rawData.fileName ?? '').toLowerCase();
          const description = String(item.rawData.description ?? '').toLowerCase();
          return (
            fileName.includes(keyword) ||
            description.includes(keyword) ||
            item.id.toLowerCase().includes(keyword)
          );
        });
      }
    }
    return result;
  });

  const groupedItems = computed<GroupedItems[]>(() => {
    const groups = new Map<string, DataItem[]>();
    filteredItems.value.forEach((item) => {
      const list = groups.get(item.taskId) ?? [];
      list.push(item);
      groups.set(item.taskId, list);
    });
    return Array.from(groups.entries()).map(([taskId, items]) => ({ taskId, items }));
  });

  const hasActiveFilters = computed(() =>
    Boolean(
      filters.status ||
      filters.taskId ||
      filters.annotator ||
      filters.aiReviewResult ||
      filters.keyword,
    ),
  );

  function clearFilters() {
    filters.status = undefined;
    filters.taskId = undefined;
    filters.annotator = undefined;
    filters.aiReviewResult = undefined;
    filters.keyword = undefined;
  }

  return {
    filters,
    filteredItems,
    groupedItems,
    hasActiveFilters,
    annotatorOptions,
    clearFilters,
  };
}
