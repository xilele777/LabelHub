import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';
import { getSocket } from '../services/notificationWebSocket';
import { logger } from '../utils/logger';

export type NetworkState = 'online' | 'offline' | 'reconnecting';

export interface UseNetworkStatusReturn {
  state: Ref<NetworkState>;
  /** 从断线到恢复的瞬间为 true，3 秒后自动复位 */
  justRecovered: Ref<boolean>;
  wasOffline: Ref<boolean>;
}

/**
 * 全局网络状态检测 — 三路信号汇总：
 * 1. Navigator.onLine + online/offline 事件（浏览器级）
 * 2. Socket.IO connect/disconnect（WebSocket 级）
 * 3. 页面可见性变化时主动探测（切回后台期间断网的场景）
 *
 * 统一收敛为三个状态：online | reconnecting | offline
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const state = ref<NetworkState>(navigator.onLine ? 'online' : 'offline');
  const justRecovered = ref(false);
  const wasOffline = ref(false);
  let recoverTimer: ReturnType<typeof setTimeout> | undefined;

  function setOnline() {
    if (state.value === 'offline' || state.value === 'reconnecting') {
      wasOffline.value = true;
      justRecovered.value = true;
      clearTimeout(recoverTimer);
      recoverTimer = setTimeout(() => {
        justRecovered.value = false;
      }, 3000);
    }
    state.value = 'online';
    logger.log('[Network] 网络已恢复');
  }

  function setOffline() {
    state.value = 'offline';
    logger.warn('[Network] 网络已断开');
  }

  function setReconnecting() {
    if (state.value === 'online') return; // 在线时不触发重连状态
    state.value = 'reconnecting';
  }

  // ── 1. Navigator 级检测 ──
  function onBrowserOnline() {
    setOnline();
  }

  function onBrowserOffline() {
    setOffline();
  }

  onMounted(() => {
    window.addEventListener('online', onBrowserOnline);
    window.addEventListener('offline', onBrowserOffline);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('online', onBrowserOnline);
    window.removeEventListener('offline', onBrowserOffline);
    clearTimeout(recoverTimer);
  });

  // ── 2. Socket.IO 级检测（异步监听，不阻塞 setup） ──
  let socketCheckTimer: ReturnType<typeof setInterval> | undefined;

  function attachSocketListeners() {
    const socket = getSocket();
    if (!socket) {
      // Socket 尚未初始化，轮询等待
      socketCheckTimer = setInterval(() => {
        const s = getSocket();
        if (s) {
          clearInterval(socketCheckTimer);
          bindSocket(s);
        }
      }, 500);
      return;
    }
    bindSocket(socket);
  }

  function bindSocket(socket: ReturnType<typeof getSocket>) {
    if (!socket) return;
    socket.on('disconnect', () => setReconnecting());
    socket.on('connect', () => setOnline());
  }

  onMounted(() => {
    // 延迟绑定，确保 Socket 已初始化
    setTimeout(attachSocketListeners, 1000);
  });

  onBeforeUnmount(() => {
    clearInterval(socketCheckTimer);
  });

  // ── 3. 页面可见性变化时探测（切回后台断网的场景） ──
  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && !navigator.onLine) {
      setOffline();
    } else if (document.visibilityState === 'visible' && navigator.onLine) {
      setOnline();
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  return { state, justRecovered, wasOffline };
}
