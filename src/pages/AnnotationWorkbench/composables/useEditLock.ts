import { onBeforeUnmount, ref, watch } from 'vue';

export interface UseEditLockOptions {
  itemId: () => string | null | undefined;
  /** 仅在条目可编辑（且当前角色允许加锁）时持锁 */
  enabled: () => boolean;
  /** 加锁；他人持锁（HTTP 423）时应返回 false 并由调用方呈现锁信息 */
  claim: (id: string) => Promise<boolean>;
  release: (id: string) => Promise<void>;
}

/**
 * 悲观编辑锁生命周期管理：
 * - 进入可编辑条目自动 claim；
 * - 切换条目 / 条目转为只读（提交后）自动 release；
 * - 组件卸载时释放持有的锁；
 * - claim 失败可通过 retry 重试。
 *
 * 所有锁操作经由 Promise 链串行化，避免快速切换条目时 claim/release 乱序，
 * 与服务端 30 分钟锁超时兜底（异常关闭浏览器场景）配合构成完整闭环。
 */
export function useEditLock(options: UseEditLockOptions) {
  const lockedId = ref<string | null>(null);
  const acquiring = ref(false);

  let chain: Promise<void> = Promise.resolve();
  function enqueue(operation: () => Promise<void>) {
    chain = chain.then(operation).catch(() => undefined);
    return chain;
  }

  async function syncLock(id: string | null, enabled: boolean) {
    // 释放：持有的锁不再对应当前可编辑条目
    if (lockedId.value && (lockedId.value !== id || !enabled)) {
      const previous = lockedId.value;
      lockedId.value = null;
      await options.release(previous);
    }
    // 加锁：进入新的可编辑条目
    if (id && enabled && lockedId.value !== id) {
      acquiring.value = true;
      try {
        const acquired = await options.claim(id);
        if (acquired) lockedId.value = id;
      } finally {
        acquiring.value = false;
      }
    }
  }

  watch(
    () => [options.itemId() ?? null, options.enabled()] as const,
    ([id, enabled]) => {
      void enqueue(() => syncLock(id, enabled));
    },
    { immediate: true },
  );

  /** 他人持锁时手动重试加锁 */
  function retry() {
    return enqueue(() => syncLock(options.itemId() ?? null, options.enabled()));
  }

  onBeforeUnmount(() => {
    void enqueue(() => syncLock(null, false));
  });

  return { lockedId, acquiring, retry };
}
