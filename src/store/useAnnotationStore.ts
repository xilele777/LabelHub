import { create } from 'zustand';
import { type DataItem, type ConflictData } from '../types';
import { type AIReviewResult } from '../types/aiReview';
import * as annotationApi from '../api/annotation';
import type { SubmitWithAIReviewResponse, AvailableItem, BatchClaimResult } from '../api/annotation';
import * as reviewApi from '../api/review';

function normalizeSubmitResponse(payload: SubmitWithAIReviewResponse | DataItem): {
  item: DataItem;
  review?: AIReviewResult;
} {
  if ('item' in payload && payload.item) {
    return {
      item: payload.item,
      review: payload.review as unknown as AIReviewResult | undefined,
    };
  }

  return { item: payload as DataItem };
}

interface AnnotationState {
  dataItems: DataItem[];
  archivedItems: DataItem[];     // 归档的标注项
  aiReviewResults: AIReviewResult[];
  currentIndex: number;
  loading: boolean;
  error: string | null;
  /** 乐观锁冲突信息（HTTP 409） */
  conflictInfo: ConflictData | null;
  /** 悲观锁冲突信息（HTTP 423），lockedBy 表示谁正在编辑 */
  lockInfo: { lockedBy: string; lockedAt: string } | null;
  /** 从 API 加载标注项 */
  fetchDataItems: (taskId?: string) => Promise<void>;
  /** 从 API 加载 AI 审核结果 */
  fetchAIReviews: (taskId?: string) => Promise<void>;
  setCurrentIndex: (index: number) => void;
  /** 保存草稿（含乐观锁 version） */
  saveDraft: (id: string, data: Record<string, unknown>, annotator: string) => Promise<void>;
  /** 提交标注（含乐观锁 version）→ 后端自动触发 AI 预审 → 推进状态 */
  submitAnnotation: (id: string, data: Record<string, unknown>, annotator: string) => Promise<void>;
  /** 审核通过 */
  approveItem: (id: string, reviewer: string) => Promise<void>;
  /** 审核驳回 */
  rejectItem: (id: string, reviewer: string, reason: string) => Promise<void>;
  /** 驳回后重新提交（含乐观锁 version） */
  resubmitItem: (id: string, data: Record<string, unknown>, annotator: string) => Promise<void>;
  /** 认领（悲观锁）标注项 */
  claimItem: (id: string) => Promise<boolean>;
  /** 释放（解锁）标注项 */
  releaseItem: (id: string) => Promise<void>;
  /** 释放当前用户持有的所有锁（登出时调用） */
  releaseAllMyItems: () => Promise<void>;
  /** 用服务端最新数据覆盖本地（冲突后"放弃自己的修改"） */
  resolveConflictWithServer: (id: string) => void;
  /** 清除冲突/锁定提示 */
  clearConflict: () => void;
  /** 按 dataItemId 查询 AI 预审结果 */
  getAIReviewByDataItemId: (dataItemId: string) => AIReviewResult | undefined;
  /** 获取归档的标注项列表 */
  fetchArchivedItems: (taskId?: string) => Promise<void>;
  /** 归档标注项（仅审核通过的项可归档） */
  archiveItem: (id: string) => Promise<void>;
  /** 取消归档标注项（仅 Owner 可操作） */
  unarchiveItem: (id: string) => Promise<void>;
  /** 可领取的未分配标注项列表 */
  availableItems: AvailableItem[];
  /** 可领取列表加载中 */
  availableLoading: boolean;
  /** 获取可领取的未分配标注项 */
  fetchAvailableItems: (taskId?: string) => Promise<void>;
  /** 手动领取（认领分配）一个未分配的标注项 */
  claimAssignment: (id: string) => Promise<boolean>;
  /** 批量领取未分配标注项 */
  batchClaimAssignments: (ids: string[]) => Promise<BatchClaimResult | null>;
}

export const useAnnotationStore = create<AnnotationState>()((set, get) => ({
  dataItems: [],
  archivedItems: [],
  aiReviewResults: [],
  currentIndex: 0,
  loading: false,
  error: null,
  conflictInfo: null,
  lockInfo: null,
  availableItems: [],
  availableLoading: false,

  async fetchDataItems(taskId) {
    set({ loading: true, error: null });
    try {
      const params: Record<string, unknown> = {};
      if (taskId) params.taskId = taskId;
      const res = await annotationApi.getAnnotationItemList(params);
      set({ dataItems: res.data.items, loading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取标注数据失败', loading: false });
    }
  },

  async fetchAIReviews(taskId) {
    set({ error: null });
    try {
      const res = taskId
        ? await reviewApi.getReviewsByTaskId(taskId)
        : await reviewApi.getReviewList();
      set({ aiReviewResults: res.data.items });
    } catch (err: any) {
      set({ error: err?.message || '获取审核数据失败' });
    }
  },

  setCurrentIndex(index) {
    set({ currentIndex: index, conflictInfo: null, lockInfo: null });
  },

  /**
   * 保存草稿：调用后端 PUT /annotation-items/:id/save-draft
   * 包含乐观锁 version 检查
   */
  async saveDraft(id, data, _annotator) {
    set({ error: null, conflictInfo: null });
    try {
      // 从 dataItems 中查找当前版本号
      const currentItem = get().dataItems.find((d) => d.id === id);
      const version = currentItem?.version ?? 1;

      const res = await annotationApi.saveDraft(id, data, version);
      const updatedItem = res.data as DataItem;

      set((state) => ({
        dataItems: state.dataItems.map((d) => (d.id === id ? updatedItem : d)),
      }));
    } catch (err: any) {
      // 处理乐观锁冲突 (HTTP 409)
      if (err?.code === 409 && err?.data) {
        set({
          conflictInfo: err.data as ConflictData,
          error: null,
        });
        throw err;
      }
      set({ error: err?.message || '保存草稿失败' });
      throw err;
    }
  },

  /**
   * 提交标注 — AI 预审由后端自动触发，前端只接收结果
   * 包含乐观锁 version 检查
   */
  async submitAnnotation(id, data, _annotator) {
    set({ error: null, conflictInfo: null });
    try {
      const currentItem = get().dataItems.find((d) => d.id === id);
      const version = currentItem?.version ?? 1;

      const res = await annotationApi.submitAnnotation(id, data, version);

      // 后端返回 { item, review } （AI 预审已在服务端完成）
      const { item: updatedItem, review: reviewResult } = normalizeSubmitResponse(res.data);

      set((state) => ({
        dataItems: state.dataItems.map((d) => (d.id === id ? updatedItem : d)),
        aiReviewResults: reviewResult
          ? [
              ...state.aiReviewResults.filter((r) => r.dataItemId !== id),
              reviewResult,
            ]
          : state.aiReviewResults,
      }));
    } catch (err: any) {
      // 处理乐观锁冲突 (HTTP 409)
      if (err?.code === 409 && err?.data) {
        set({
          conflictInfo: err.data as ConflictData,
          error: null,
        });
        throw err;
      }
      set({ error: err?.message || '提交标注失败' });
      throw err;
    }
  },

  /**
   * 审核通过：调用后端 PUT /annotation-items/:id/approve
   * 后端会自动归档审核通过的项，前端需将项从 dataItems 移到 archivedItems
   */
  async approveItem(id, _reviewer) {
    set({ error: null });
    try {
      const res = await annotationApi.approveAnnotation(id);
      const updatedItem = res.data as DataItem;

      if (updatedItem.archived) {
        // 后端自动归档了，从 dataItems 移除，加入 archivedItems
        set((state) => ({
          dataItems: state.dataItems.filter((d) => d.id !== id),
          archivedItems: [updatedItem, ...state.archivedItems],
        }));
      } else {
        // 未自动归档，仅更新状态
        set((state) => ({
          dataItems: state.dataItems.map((d) => (d.id === id ? updatedItem : d)),
        }));
      }
    } catch (err: any) {
      set({ error: err?.message || '审核通过失败' });
    }
  },

  /**
   * 审核驳回：调用后端 PUT /annotation-items/:id/reject
   */
  async rejectItem(id, _reviewer, reason) {
    set({ error: null });
    try {
      const res = await annotationApi.rejectAnnotation(id, reason);
      const updatedItem = res.data as DataItem;

      set((state) => ({
        dataItems: state.dataItems.map((d) => (d.id === id ? updatedItem : d)),
      }));
    } catch (err: any) {
      set({ error: err?.message || '审核驳回失败' });
    }
  },

  /**
   * 驳回后重新提交 — AI 预审由后端自动触发
   * 包含乐观锁 version 检查
   */
  async resubmitItem(id, data, _annotator) {
    set({ error: null, conflictInfo: null });
    try {
      const currentItem = get().dataItems.find((d) => d.id === id);
      const version = currentItem?.version ?? 1;

      const res = await annotationApi.resubmitAnnotation(id, data, version);

      const { item: updatedItem, review: reviewResult } = normalizeSubmitResponse(res.data);

      set((state) => ({
        dataItems: state.dataItems.map((d) => (d.id === id ? updatedItem : d)),
        aiReviewResults: reviewResult
          ? [
              ...state.aiReviewResults.filter((r) => r.dataItemId !== id),
              reviewResult,
            ]
          : state.aiReviewResults,
      }));
    } catch (err: any) {
      // 处理乐观锁冲突 (HTTP 409)
      if (err?.code === 409 && err?.data) {
        set({
          conflictInfo: err.data as ConflictData,
          error: null,
        });
        throw err;
      }
      set({ error: err?.message || '重新提交失败' });
      throw err;
    }
  },

  /**
   * 认领（悲观锁）标注项
   * 返回 true 表示认领成功，false 表示被他人锁定
   */
  async claimItem(id) {
    set({ lockInfo: null, error: null });
    try {
      const res = await annotationApi.claimItem(id);
      const updatedItem = res.data as DataItem;

      set((state) => ({
        dataItems: state.dataItems.map((d) => (d.id === id ? updatedItem : d)),
      }));
      return true;
    } catch (err: any) {
      // 处理悲观锁冲突 (HTTP 423)
      if (err?.code === 423 && err?.data) {
        set({
          lockInfo: err.data as { lockedBy: string; lockedAt: string },
          error: err?.message || '该数据正在被他人编辑',
        });
        return false;
      }
      set({ error: err?.message || '认领失败' });
      return false;
    }
  },

  /**
   * 释放（解锁）标注项
   */
  async releaseItem(id) {
    set({ error: null });
    try {
      const res = await annotationApi.releaseItem(id);
      const updatedItem = res.data as DataItem;

      set((state) => ({
        dataItems: state.dataItems.map((d) => (d.id === id ? updatedItem : d)),
      }));
    } catch (err: any) {
      // 静默失败，释放锁不应阻塞用户操作
      console.warn('释放锁失败:', err?.message);
    }
  },

  /**
   * 释放当前用户持有的所有锁（登出时调用）
   */
  async releaseAllMyItems() {
    try {
      await annotationApi.releaseAllItems();
    } catch (err: any) {
      console.warn('释放所有锁失败:', err?.message);
    }
  },

  /**
   * 用服务端最新数据覆盖本地（冲突后"放弃自己的修改"）
   */
  resolveConflictWithServer(id) {
    const conflict = get().conflictInfo;
    if (conflict?.serverItem) {
      set((state) => ({
        dataItems: state.dataItems.map((d) => (d.id === id ? conflict.serverItem : d)),
        conflictInfo: null,
        error: null,
      }));
    } else {
      // 如果没有 serverItem，重新拉取
      set({ conflictInfo: null, error: null });
      get().fetchDataItems();
    }
  },

  /**
   * 清除冲突/锁定提示
   */
  clearConflict() {
    set({ conflictInfo: null, lockInfo: null, error: null });
  },

  /** 按 dataItemId 查询 AI 预审结果 */
  getAIReviewByDataItemId(dataItemId) {
    return get().aiReviewResults.find((r) => r.dataItemId === dataItemId);
  },

  /**
   * 获取归档的标注项列表
   */
  async fetchArchivedItems(taskId) {
    set({ loading: true, error: null });
    try {
      const params: Record<string, unknown> = { archived: 'true' };
      if (taskId) params.taskId = taskId;
      const res = await annotationApi.getAnnotationItemList(params);
      set({ archivedItems: res.data.items, loading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取归档数据失败', loading: false });
    }
  },

  /**
   * 归档标注项（仅审核通过的项可归档）
   */
  async archiveItem(id) {
    set({ error: null });
    try {
      const res = await annotationApi.archiveAnnotationItem(id);
      const updatedItem = res.data as DataItem;

      set((state) => ({
        // 从 dataItems 中移除
        dataItems: state.dataItems.filter((d) => d.id !== id),
        // 添加到 archivedItems
        archivedItems: [updatedItem, ...state.archivedItems],
      }));
    } catch (err: any) {
      set({ error: err?.message || '归档失败' });
    }
  },

  /**
   * 取消归档标注项（仅 Owner 可操作）
   */
  async unarchiveItem(id) {
    set({ error: null });
    try {
      const res = await annotationApi.unarchiveAnnotationItem(id);
      const updatedItem = res.data as DataItem;

      set((state) => ({
        // 从 archivedItems 中移除
        archivedItems: state.archivedItems.filter((d) => d.id !== id),
        // 添加回 dataItems
        dataItems: [updatedItem, ...state.dataItems],
      }));
    } catch (err: any) {
      set({ error: err?.message || '取消归档失败' });
    }
  },

  /**
   * 获取可领取的未分配标注项列表
   */
  async fetchAvailableItems(taskId) {
    set({ availableLoading: true, error: null });
    try {
      const params: { taskId?: string } = {};
      if (taskId) params.taskId = taskId;
      const res = await annotationApi.getAvailableItems(params);
      set({ availableItems: res.data.items, availableLoading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取可领取列表失败', availableLoading: false });
    }
  },

  /**
   * 手动领取（认领分配）一个未分配的标注项
   * 成功后将其加入 dataItems，并从 availableItems 中移除
   * 返回 true 表示领取成功
   */
  async claimAssignment(id) {
    set({ error: null });
    try {
      const res = await annotationApi.claimAssignment(id);
      const claimedItem = res.data as DataItem;

      set((state) => ({
        // 加入已分配列表
        dataItems: [claimedItem, ...state.dataItems],
        // 从可领取列表移除
        availableItems: state.availableItems.filter((a) => a.id !== id),
      }));
      return true;
    } catch (err: any) {
      set({ error: err?.message || '领取失败' });
      return false;
    }
  },

  async batchClaimAssignments(ids) {
    set({ error: null });
    try {
      const res = await annotationApi.batchClaimAssignments(ids);
      const result = res.data as BatchClaimResult;
      const claimedIds = new Set(result.claimed.map((item) => item.id));

      set((state) => ({
        dataItems: [
          ...result.claimed,
          ...state.dataItems.filter((item) => !claimedIds.has(item.id)),
        ],
        availableItems: state.availableItems.filter((item) => !claimedIds.has(item.id)),
      }));

      return result;
    } catch (err: any) {
      set({ error: err?.message || '批量领取失败' });
      return null;
    }
  },
}));
