import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  DataItemStatus,
  STATUS_TRANSITIONS,
  type ConflictData,
  type DataItem,
  type LockData,
} from '../types';
import type { AIReviewResult } from '../types/aiReview';
import * as annotationApi from '../api/annotation';
import type { AvailableItem, BatchClaimResult, SubmitWithAIReviewResponse } from '../api/annotation';
import * as reviewApi from '../api/review';

export { DataItemStatus };
export type { AIReviewResult, AvailableItem, BatchClaimResult, ConflictData, DataItem, LockData };

export type DataItemStatusTransitionMap = {
  readonly [Status in DataItemStatus]: readonly DataItemStatus[];
};

export const DATA_ITEM_STATUS_TRANSITIONS: DataItemStatusTransitionMap = STATUS_TRANSITIONS;

export interface AnnotationState {
  dataItems: DataItem[];
  archivedItems: DataItem[];
  aiReviewResults: AIReviewResult[];
  currentIndex: number;
  loading: boolean;
  error: string | null;
  conflictInfo: ConflictData | null;
  lockInfo: LockData | null;
  availableItems: AvailableItem[];
  availableLoading: boolean;
}

function normalizeSubmitResponse(payload: SubmitWithAIReviewResponse | DataItem): {
  item: DataItem;
  review?: AIReviewResult;
} {
  if ('item' in payload && payload.item) {
    const review = payload.review as unknown as AIReviewResult | undefined;
    return review ? { item: payload.item, review } : { item: payload.item };
  }

  return { item: payload as DataItem };
}

export function canTransitDataItemStatus(from: DataItemStatus, to: DataItemStatus): boolean {
  return from === to || DATA_ITEM_STATUS_TRANSITIONS[from].includes(to);
}

function assertDataItemStatusTransition(from: DataItemStatus, to: DataItemStatus, action: string): void {
  if (canTransitDataItemStatus(from, to)) return;
  throw new Error(`Invalid data item status transition in ${action}: ${from} -> ${to}`);
}

function isApiErrorWithData<T>(error: unknown, code: number): error is { code: number; data: T; message?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === code &&
    'data' in error
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const useAnnotationPiniaStore = defineStore('annotation', () => {
  const dataItems = ref<DataItem[]>([]);
  const archivedItems = ref<DataItem[]>([]);
  const aiReviewResults = ref<AIReviewResult[]>([]);
  const currentIndex = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const conflictInfo = ref<ConflictData | null>(null);
  const lockInfo = ref<LockData | null>(null);
  const availableItems = ref<AvailableItem[]>([]);
  const availableLoading = ref(false);

  const currentItem = computed(() => dataItems.value[currentIndex.value] ?? null);
  const hasConflict = computed(() => Boolean(conflictInfo.value || lockInfo.value));
  const itemTotal = computed(() => dataItems.value.length);

  function replaceDataItem(updatedItem: DataItem, action: string): void {
    const current = dataItems.value.find((item) => item.id === updatedItem.id);
    if (current) {
      assertDataItemStatusTransition(current.status, updatedItem.status, action);
    }

    dataItems.value = dataItems.value.map((item) => (item.id === updatedItem.id ? updatedItem : item));
  }

  function upsertAIReview(dataItemId: string, review?: AIReviewResult): void {
    if (!review) return;
    aiReviewResults.value = [
      ...aiReviewResults.value.filter((item) => item.dataItemId !== dataItemId),
      review,
    ];
  }

  async function fetchDataItems(taskId?: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const params: Record<string, unknown> = {};
      if (taskId) params.taskId = taskId;
      const res = await annotationApi.getAnnotationItemList(params);
      dataItems.value = res.data.items;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '获取标注数据失败');
    } finally {
      loading.value = false;
    }
  }

  async function fetchAIReviews(taskId?: string): Promise<void> {
    error.value = null;
    try {
      const res = taskId ? await reviewApi.getReviewsByTaskId(taskId) : await reviewApi.getReviewList();
      aiReviewResults.value = res.data.items;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '获取审核数据失败');
    }
  }

  function setCurrentIndex(index: number): void {
    currentIndex.value = index;
    conflictInfo.value = null;
    lockInfo.value = null;
  }

  async function saveDraft(id: string, data: Record<string, unknown>, _annotator: string): Promise<void> {
    error.value = null;
    conflictInfo.value = null;
    try {
      const current = dataItems.value.find((item) => item.id === id);
      const version = current?.version ?? 1;
      const res = await annotationApi.saveDraft(id, data, version);
      replaceDataItem(res.data, 'saveDraft');
    } catch (err: unknown) {
      if (isApiErrorWithData<ConflictData>(err, 409)) {
        conflictInfo.value = err.data;
        error.value = null;
        throw err;
      }
      error.value = getErrorMessage(err, '保存草稿失败');
      throw err;
    }
  }

  async function submitAnnotation(id: string, data: Record<string, unknown>, _annotator: string): Promise<void> {
    error.value = null;
    conflictInfo.value = null;
    try {
      const current = dataItems.value.find((item) => item.id === id);
      const version = current?.version ?? 1;
      const res = await annotationApi.submitAnnotation(id, data, version);
      const { item, review } = normalizeSubmitResponse(res.data);
      replaceDataItem(item, 'submitAnnotation');
      upsertAIReview(id, review);
    } catch (err: unknown) {
      if (isApiErrorWithData<ConflictData>(err, 409)) {
        conflictInfo.value = err.data;
        error.value = null;
        throw err;
      }
      error.value = getErrorMessage(err, '提交标注失败');
      throw err;
    }
  }

  async function approveItem(id: string, _reviewer: string): Promise<void> {
    error.value = null;
    try {
      const res = await annotationApi.approveAnnotation(id);
      const updatedItem = res.data;

      if (updatedItem.archived) {
        const current = dataItems.value.find((item) => item.id === id);
        if (current) {
          assertDataItemStatusTransition(current.status, updatedItem.status, 'approveItem');
        }
        dataItems.value = dataItems.value.filter((item) => item.id !== id);
        archivedItems.value = [updatedItem, ...archivedItems.value];
      } else {
        replaceDataItem(updatedItem, 'approveItem');
      }
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '审核通过失败');
    }
  }

  async function rejectItem(id: string, _reviewer: string, reason: string): Promise<void> {
    error.value = null;
    try {
      const res = await annotationApi.rejectAnnotation(id, reason);
      replaceDataItem(res.data, 'rejectItem');
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '审核驳回失败');
    }
  }

  async function resubmitItem(id: string, data: Record<string, unknown>, _annotator: string): Promise<void> {
    error.value = null;
    conflictInfo.value = null;
    try {
      const current = dataItems.value.find((item) => item.id === id);
      const version = current?.version ?? 1;
      const res = await annotationApi.resubmitAnnotation(id, data, version);
      const { item, review } = normalizeSubmitResponse(res.data);
      replaceDataItem(item, 'resubmitItem');
      upsertAIReview(id, review);
    } catch (err: unknown) {
      if (isApiErrorWithData<ConflictData>(err, 409)) {
        conflictInfo.value = err.data;
        error.value = null;
        throw err;
      }
      error.value = getErrorMessage(err, '重新提交失败');
      throw err;
    }
  }

  async function claimItem(id: string): Promise<boolean> {
    lockInfo.value = null;
    error.value = null;
    try {
      const res = await annotationApi.claimItem(id);
      replaceDataItem(res.data, 'claimItem');
      return true;
    } catch (err: unknown) {
      if (isApiErrorWithData<LockData>(err, 423)) {
        lockInfo.value = err.data;
        error.value = err.message || '该数据正在被他人编辑';
        return false;
      }
      error.value = getErrorMessage(err, '认领失败');
      return false;
    }
  }

  async function releaseItem(id: string): Promise<void> {
    error.value = null;
    try {
      const res = await annotationApi.releaseItem(id);
      replaceDataItem(res.data, 'releaseItem');
    } catch (err: unknown) {
      console.warn('释放锁失败', getErrorMessage(err, 'unknown error'));
    }
  }

  async function releaseAllMyItems(): Promise<void> {
    try {
      await annotationApi.releaseAllItems();
    } catch (err: unknown) {
      console.warn('释放所有锁失败:', getErrorMessage(err, 'unknown error'));
    }
  }

  function resolveConflictWithServer(id: string): void {
    const conflict = conflictInfo.value;
    if (conflict?.serverItem) {
      replaceDataItem(conflict.serverItem, `resolveConflictWithServer:${id}`);
      conflictInfo.value = null;
      error.value = null;
      return;
    }

    conflictInfo.value = null;
    error.value = null;
    void fetchDataItems();
  }

  function clearConflict(): void {
    conflictInfo.value = null;
    lockInfo.value = null;
    error.value = null;
  }

  function getAIReviewByDataItemId(dataItemId: string): AIReviewResult | undefined {
    return aiReviewResults.value.find((item) => item.dataItemId === dataItemId);
  }

  async function fetchArchivedItems(taskId?: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const params: Record<string, unknown> = { archived: 'true' };
      if (taskId) params.taskId = taskId;
      const res = await annotationApi.getAnnotationItemList(params);
      archivedItems.value = res.data.items;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '获取归档数据失败');
    } finally {
      loading.value = false;
    }
  }

  async function archiveItem(id: string): Promise<void> {
    error.value = null;
    try {
      const res = await annotationApi.archiveAnnotationItem(id);
      dataItems.value = dataItems.value.filter((item) => item.id !== id);
      archivedItems.value = [res.data, ...archivedItems.value];
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '归档失败');
    }
  }

  async function unarchiveItem(id: string): Promise<void> {
    error.value = null;
    try {
      const res = await annotationApi.unarchiveAnnotationItem(id);
      archivedItems.value = archivedItems.value.filter((item) => item.id !== id);
      dataItems.value = [res.data, ...dataItems.value];
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '取消归档失败');
    }
  }

  async function fetchAvailableItems(taskId?: string): Promise<void> {
    availableLoading.value = true;
    error.value = null;
    try {
      const params: { taskId?: string } = {};
      if (taskId) params.taskId = taskId;
      const res = await annotationApi.getAvailableItems(params);
      availableItems.value = res.data.items;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '获取可领取列表失败');
    } finally {
      availableLoading.value = false;
    }
  }

  async function claimAssignment(id: string): Promise<boolean> {
    error.value = null;
    try {
      const res = await annotationApi.claimAssignment(id);
      dataItems.value = [res.data, ...dataItems.value];
      availableItems.value = availableItems.value.filter((item) => item.id !== id);
      return true;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '领取失败');
      return false;
    }
  }

  async function batchClaimAssignments(ids: string[]): Promise<BatchClaimResult | null> {
    error.value = null;
    try {
      const res = await annotationApi.batchClaimAssignments(ids);
      const result = res.data;
      const claimedIds = new Set(result.claimed.map((item) => item.id));

      dataItems.value = [
        ...result.claimed,
        ...dataItems.value.filter((item) => !claimedIds.has(item.id)),
      ];
      availableItems.value = availableItems.value.filter((item) => !claimedIds.has(item.id));

      return result;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '批量领取失败');
      return null;
    }
  }

  return {
    dataItems,
    archivedItems,
    aiReviewResults,
    currentIndex,
    loading,
    error,
    conflictInfo,
    lockInfo,
    availableItems,
    availableLoading,
    currentItem,
    hasConflict,
    itemTotal,
    fetchDataItems,
    fetchAIReviews,
    setCurrentIndex,
    saveDraft,
    submitAnnotation,
    approveItem,
    rejectItem,
    resubmitItem,
    claimItem,
    releaseItem,
    releaseAllMyItems,
    resolveConflictWithServer,
    clearConflict,
    getAIReviewByDataItemId,
    fetchArchivedItems,
    archiveItem,
    unarchiveItem,
    fetchAvailableItems,
    claimAssignment,
    batchClaimAssignments,
  };
});

export type AnnotationStore = ReturnType<typeof useAnnotationPiniaStore>;

interface UseAnnotationStore {
  (): AnnotationStore;
  <T>(selector: (store: AnnotationStore) => T): T;
  getState: () => AnnotationStore;
  setState: (patch: Partial<AnnotationState>) => void;
}

export const useAnnotationStore = ((selector?: (store: AnnotationStore) => unknown) => {
  const store = useAnnotationPiniaStore();
  return selector ? selector(store) : store;
}) as UseAnnotationStore;

useAnnotationStore.getState = () => useAnnotationPiniaStore();
useAnnotationStore.setState = (patch) => {
  useAnnotationPiniaStore().$patch(patch as never);
};
