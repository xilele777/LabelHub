import { ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import * as annotationApi from '../../../api/annotation';
import type { AvailableItem } from '../../../api/annotation';

export interface UseReviewClaimPoolOptions {
  /** 领取池按任务过滤（跟随页面筛选） */
  taskIdFilter: () => string | undefined;
  /** 领取成功后的回调：刷新数据并选中该条 */
  onClaimed: (firstClaimedId: string) => Promise<void> | void;
}

/**
 * 审核领取池：弹窗状态、池数据加载、单条/批量/连续领取。
 * 状态放在页面层共享，「连续领取」在审核动作完成后也能继续从池中取数。
 */
export function useReviewClaimPool(options: UseReviewClaimPoolOptions) {
  const claimModalOpen = ref(false);
  const reviewPoolItems = ref<AvailableItem[]>([]);
  const reviewPoolLoading = ref(false);
  const claimingId = ref<string | null>(null);
  const batchClaiming = ref(false);
  const selectedClaimIds = ref<string[]>([]);
  const continuousClaimEnabled = ref(false);

  async function openClaimModal() {
    claimModalOpen.value = true;
    selectedClaimIds.value = [];
    await loadReviewPool();
  }

  async function loadReviewPool() {
    reviewPoolLoading.value = true;
    try {
      const taskId = options.taskIdFilter();
      const res = await annotationApi.getReviewAvailableItems(taskId ? { taskId } : undefined);
      reviewPoolItems.value = res.data.items || [];
      return reviewPoolItems.value;
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载审核任务池失败');
      return [];
    } finally {
      reviewPoolLoading.value = false;
    }
  }

  function onClaimSelectionChange(keys: Array<string | number>) {
    selectedClaimIds.value = keys.map(String);
  }

  async function claimReview(id: string) {
    claimingId.value = id;
    try {
      await annotationApi.claimReview(id);
      message.success('审核项领取成功');
      await options.onClaimed(id);
      await loadReviewPool();
      claimModalOpen.value = false;
    } catch (error) {
      Modal.warning({
        title: '领取失败',
        content: error instanceof Error ? error.message : '领取审核项失败',
      });
    } finally {
      claimingId.value = null;
    }
  }

  async function batchClaimReviews(ids = selectedClaimIds.value) {
    if (ids.length === 0) {
      message.warning('请先选择要领取的审核任务');
      return;
    }

    batchClaiming.value = true;
    try {
      const res = await annotationApi.batchClaimReviews(ids);
      const result = res.data;
      selectedClaimIds.value = selectedClaimIds.value.filter(
        (id) => !result.claimed.some((item) => item.id === id),
      );
      const first = result.claimed[0];
      if (first) {
        message.success(`已领取 ${result.claimedCount} 条审核任务`);
        await options.onClaimed(first.id);
        await loadReviewPool();
        claimModalOpen.value = false;
      }
      if (result.failedCount > 0) {
        message.warning(`${result.failedCount} 条领取失败，可能已被分配或不在可领取状态`);
      }
    } catch (error) {
      Modal.warning({
        title: '批量领取失败',
        content: error instanceof Error ? error.message : '批量领取审核项失败',
      });
    } finally {
      batchClaiming.value = false;
    }
  }

  /** 连续领取：审核完成后自动从池中领取下一条 */
  async function tryContinuousClaim() {
    if (!continuousClaimEnabled.value) return;
    const pool = await loadReviewPool();
    const next = pool[0];
    if (!next) {
      message.info('当前任务暂无可连续领取的审核数据');
      return;
    }
    await batchClaimReviews([next.id]);
  }

  return {
    claimModalOpen,
    reviewPoolItems,
    reviewPoolLoading,
    claimingId,
    batchClaiming,
    selectedClaimIds,
    continuousClaimEnabled,
    openClaimModal,
    loadReviewPool,
    onClaimSelectionChange,
    claimReview,
    batchClaimReviews,
    tryContinuousClaim,
  };
}
