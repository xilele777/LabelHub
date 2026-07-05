import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue';

/**
 * 返回 source 的防抖镜像值。
 *
 * 输入框继续绑定原始 ref 保证即时回显，过滤 / 请求侧改为依赖防抖后的镜像值，
 * 避免每次按键都触发全量重算。
 *
 * @param source 原始 ref 或 getter（可用于 reactive 对象的某个属性）
 * @param delay  防抖延迟，默认 300ms
 */
export function useDebounced<T>(source: Ref<T> | (() => T), delay = 300): Readonly<Ref<T>> {
  const initial = typeof source === 'function' ? source() : source.value;
  const debounced = ref(initial) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(source, (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.value = value;
    }, delay);
  });

  if (getCurrentScope()) {
    onScopeDispose(() => clearTimeout(timer));
  }

  return debounced;
}
