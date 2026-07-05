import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  onScopeDispose,
  ref,
  type Ref,
} from 'vue';

export interface VirtualRow<T> {
  /** 行在源数组中的索引 */
  index: number;
  /** 行顶部相对列表起点的偏移（px） */
  offset: number;
  height: number;
  data: T;
}

export interface UseVirtualListOptions<T> {
  /** 行高（px）：定值，或按行计算（支持分组头等变高行） */
  itemHeight: number | ((item: T, index: number) => number);
  /** 视口外上下各多渲染几行，滚动更平滑，默认 5 */
  overscan?: number;
}

/**
 * 虚拟滚动：只渲染视口内（含 overscan）的行，支持变高行。
 *
 * 实现要点：
 * - 前缀和数组缓存每行偏移，行高变化只在源数据变化时重算一次；
 * - 滚动时用二分查找定位首个可见行，复杂度 O(log n)；
 * - 渲染层用 absolute + translateY 定位，避免大量 DOM 重排。
 *
 * 模板接法：外层容器绑定 ref=containerRef 与 @scroll=onScroll（容器需 overflow:auto 且有确定高度），
 * 内层撑高层高度绑定 totalHeight，行元素遍历 visibleRows 以 offset 绝对定位。
 */
export function useVirtualList<T>(
  source: Ref<T[]> | (() => T[]),
  options: UseVirtualListOptions<T>,
) {
  const { itemHeight, overscan = 5 } = options;

  const containerRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(0);

  const items = computed(() => (typeof source === 'function' ? source() : source.value));

  // 前缀和：offsets[i] 为第 i 行顶部偏移，offsets[n] 为列表总高
  const offsets = computed<number[]>(() => {
    const list = items.value;
    const result = new Array<number>(list.length + 1);
    result[0] = 0;
    let acc = 0;
    for (let i = 0; i < list.length; i++) {
      const height = typeof itemHeight === 'function' ? itemHeight(list[i] as T, i) : itemHeight;
      acc += height;
      result[i + 1] = acc;
    }
    return result;
  });

  const totalHeight = computed(() => offsets.value[items.value.length] ?? 0);

  /** 二分查找：返回覆盖 top 位置的行索引（首个满足 offsets[i+1] > top 的 i） */
  function findRowIndex(top: number): number {
    const arr = offsets.value;
    const lastIndex = arr.length - 2;
    if (lastIndex < 0) return 0;
    let lo = 0;
    let hi = lastIndex;
    let answer = lastIndex;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((arr[mid + 1] ?? Infinity) > top) {
        answer = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return answer;
  }

  const visibleRows = computed<VirtualRow<T>[]>(() => {
    const list = items.value;
    if (list.length === 0) return [];

    const startRaw = findRowIndex(scrollTop.value);
    const endRaw = findRowIndex(scrollTop.value + Math.max(viewportHeight.value, 1));
    const start = Math.max(0, startRaw - overscan);
    const end = Math.min(list.length - 1, endRaw + overscan);

    const rows: VirtualRow<T>[] = [];
    for (let i = start; i <= end; i++) {
      const offset = offsets.value[i] ?? 0;
      const next = offsets.value[i + 1] ?? offset;
      rows.push({
        index: i,
        offset,
        height: next - offset,
        data: list[i] as T,
      });
    }
    return rows;
  });

  function onScroll(event: Event) {
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return;
    scrollTop.value = el.scrollTop;
    viewportHeight.value = el.clientHeight;
  }

  /** 滚动到指定行顶部 */
  function scrollToIndex(index: number) {
    const el = containerRef.value;
    if (!el) return;
    const top = offsets.value[Math.max(0, Math.min(index, items.value.length - 1))] ?? 0;
    el.scrollTop = top;
    scrollTop.value = top;
  }

  /** 仅当目标行在视口外时滚动到可见位置（选中项定位用） */
  function scrollIntoView(index: number) {
    const el = containerRef.value;
    if (!el || index < 0 || index >= items.value.length) return;
    const top = offsets.value[index] ?? 0;
    const bottom = offsets.value[index + 1] ?? top;
    if (top < el.scrollTop) {
      el.scrollTop = top;
      scrollTop.value = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      const next = bottom - el.clientHeight;
      el.scrollTop = next;
      scrollTop.value = next;
    }
  }

  // 组件上下文中自动测量视口高度并跟随容器尺寸变化
  if (getCurrentInstance()) {
    let observer: ResizeObserver | undefined;
    onMounted(() => {
      const el = containerRef.value;
      if (!el) return;
      viewportHeight.value = el.clientHeight;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          viewportHeight.value = el.clientHeight;
        });
        observer.observe(el);
      }
    });
    if (getCurrentScope()) {
      onScopeDispose(() => observer?.disconnect());
    }
  }

  return {
    containerRef,
    scrollTop,
    viewportHeight,
    totalHeight,
    visibleRows,
    onScroll,
    scrollToIndex,
    scrollIntoView,
  };
}
