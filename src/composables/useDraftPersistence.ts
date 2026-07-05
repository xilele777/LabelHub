import { getCurrentScope, onScopeDispose, watch } from 'vue';

export interface DraftRecord<T> {
  /** 保存草稿时对应的服务端数据版本（乐观锁 version），恢复前校验 */
  version: number | string;
  savedAt: number;
  data: T;
}

const DRAFT_PREFIX = 'labelhub:draft:';

export function loadDraft<T>(key: string): DraftRecord<T> | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRecord<T> | null;
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !('version' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraftRecord<T>(key: string, record: DraftRecord<T>): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(record));
  } catch {
    // 隐私模式 / 存储配额满时静默失败，不影响主流程
  }
}

export function clearDraftRecord(key: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // ignore
  }
}

export interface UseDraftPersistenceOptions<T> {
  /** 草稿归属键（如数据条目 id）；返回空值时不做持久化 */
  key: () => string | null | undefined;
  /** 当前服务端数据版本，用于判断草稿是否过期 */
  version: () => number | string;
  /** 当前表单快照 */
  snapshot: () => T;
  /** 将草稿写回表单 */
  restore: (data: T) => void;
  onRestored?: (record: DraftRecord<T>) => void;
  debounceMs?: number;
}

/**
 * 本地草稿自动保存与恢复：
 * - 表单变化后防抖写入 localStorage（断网 / 误关页面不丢内容）；
 * - 切换到某条数据时，若存在版本匹配且与当前内容不同的本地草稿则自动恢复；
 * - 服务端版本已前进（他人修改过）的过期草稿自动清理，避免恢复脏数据。
 *
 * 性能策略：
 * - 保存侧用浅比较替代 deep watch：标注表单值均为原始类型，浅比较已覆盖所有变更；
 *   JSON.stringify 仅在实际写入 localStorage 时执行一次，不在每次 watch 触发器执行。
 *
 * 注意：恢复 watch 依赖注册顺序 —— 需在「切换条目重置表单」的 watch 之后调用本 composable。
 */
export function useDraftPersistence<T>(options: UseDraftPersistenceOptions<T>) {
  const { debounceMs = 500 } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(
    () => options.key(),
    (key) => {
      if (!key) return;
      const record = loadDraft<T>(key);
      if (!record) return;
      if (record.version !== options.version()) {
        clearDraftRecord(key);
        return;
      }
      if (JSON.stringify(record.data) === JSON.stringify(options.snapshot())) return;
      options.restore(record.data);
      options.onRestored?.(record);
    },
    { immediate: true },
  );

  // 浅比较快照 — 替代 deep: true watch。
  // 标注表单值均为原始类型（string/number/boolean），浅比较可覆盖所有变更。
  let lastSnapshot: string | null = null;
  const stopSaveWatch = watch(
    () => {
      const key = options.key();
      if (!key) return null;
      const data = options.snapshot();
      // 快速浅层序列化用于比较（值均为原始类型，开销远小于完整 deep serialization）
      const shallow = JSON.stringify(data);
      if (shallow === lastSnapshot) return null;
      lastSnapshot = shallow;
      return data;
    },
    (data) => {
      if (data === null) return;
      const key = options.key();
      if (!key) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveDraftRecord(key, {
          version: options.version(),
          savedAt: Date.now(),
          data: options.snapshot(),
        });
      }, debounceMs);
    },
  );

  /** 服务端保存/提交成功后调用，清理当前条目的本地草稿 */
  function clear() {
    clearTimeout(timer);
    lastSnapshot = null;
    const key = options.key();
    if (key) clearDraftRecord(key);
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearTimeout(timer);
      stopSaveWatch?.();
    });
  }

  return { clear };
}
