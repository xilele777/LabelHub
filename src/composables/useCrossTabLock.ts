import { ref, onMounted, onBeforeUnmount } from 'vue';
import { logger } from '../utils/logger';

export interface LockMessage {
  type: 'lock' | 'release';
  itemId: string;
  userId: string;
  timestamp: number;
}

export interface UseCrossTabLockReturn {
  /** 当前条目是否被其他标签页持有 */
  lockedByOtherTab: ReturnType<typeof ref<boolean>>;
  /** 锁持有者（用户 ID） */
  otherTabUserId: ReturnType<typeof ref<string | null>>;
  /** 广播加锁消息到其他标签页 */
  broadcastLock: (itemId: string, userId: string) => void;
  /** 广播释放消息到其他标签页 */
  broadcastRelease: (itemId: string) => void;
}

/**
 * BroadcastChannel 跨标签页编辑锁检测。
 *
 * 同一浏览器的多个标签页编辑同一条数据时，服务端悲观锁无法感知——
 * 两个标签页各自持锁，实际上在互相覆盖。
 *
 * 通过 BroadcastChannel 广播锁状态，标签页 B 收到标签页 A 的锁消息后
 * 提示用户「此数据正在另一标签页编辑中」。
 *
 * Channel 名称按 userId 隔离，不同用户互不干扰。
 */
export function useCrossTabLock(userId: string): UseCrossTabLockReturn {
  const lockedByOtherTab = ref(false);
  const otherTabUserId = ref<string | null>(null);
  let channel: BroadcastChannel | null = null;
  let heldItemId: string | null = null;
  let heldUserId: string | null = null;

  function getChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!channel && userId) {
      // Channel 名称按用户隔离，避免跨用户干扰
      channel = new BroadcastChannel(`labelhub-lock-${userId}`);
      channel.addEventListener('message', (event: MessageEvent<LockMessage>) => {
        handleMessage(event.data);
      });
    }
    return channel;
  }

  function handleMessage(msg: LockMessage) {
    if (!msg || msg.userId === userId) return; // 忽略自己的消息

    if (msg.type === 'lock') {
      logger.log('[CrossTab] 其他标签页加锁:', msg.itemId);
      lockedByOtherTab.value = true;
      otherTabUserId.value = msg.userId;
    } else if (msg.type === 'release') {
      logger.log('[CrossTab] 其他标签页释放锁:', msg.itemId);
      lockedByOtherTab.value = false;
      otherTabUserId.value = null;
    }
  }

  function broadcastLock(itemId: string, uid: string) {
    heldItemId = itemId;
    heldUserId = uid;
    const ch = getChannel();
    if (ch) {
      ch.postMessage({
        type: 'lock',
        itemId,
        userId: uid,
        timestamp: Date.now(),
      } satisfies LockMessage);
    }
  }

  function broadcastRelease(itemId: string) {
    heldItemId = null;
    const ch = getChannel();
    if (ch) {
      ch.postMessage({
        type: 'release',
        itemId,
        userId: userId,
        timestamp: Date.now(),
      } satisfies LockMessage);
    }
  }

  // 页面关闭/刷新时广播释放当前持有的锁
  function onBeforeUnload() {
    if (heldItemId && heldUserId) {
      const ch = getChannel();
      if (ch) {
        ch.postMessage({
          type: 'release',
          itemId: heldItemId,
          userId: heldUserId,
          timestamp: Date.now(),
        } satisfies LockMessage);
      }
    }
  }

  onMounted(() => {
    getChannel();
    window.addEventListener('beforeunload', onBeforeUnload);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (heldItemId && heldUserId) {
      broadcastRelease(heldItemId);
    }
    channel?.close();
    channel = null;
  });

  return {
    lockedByOtherTab,
    otherTabUserId,
    broadcastLock,
    broadcastRelease,
  };
}
