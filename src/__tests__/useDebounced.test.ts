import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { useDebounced } from '@/composables/useDebounced';

describe('useDebounced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始值与 source 一致', () => {
    const source = ref('init');
    const debounced = useDebounced(source, 300);
    expect(debounced.value).toBe('init');
  });

  it('延迟到期前保持旧值，到期后更新', async () => {
    const source = ref('');
    const debounced = useDebounced(source, 300);

    source.value = 'a';
    await nextTick();
    expect(debounced.value).toBe('');

    vi.advanceTimersByTime(299);
    expect(debounced.value).toBe('');

    vi.advanceTimersByTime(1);
    expect(debounced.value).toBe('a');
  });

  it('延迟窗口内连续变更只保留最后一次', async () => {
    const source = ref('');
    const debounced = useDebounced(source, 300);

    source.value = 'a';
    await nextTick();
    vi.advanceTimersByTime(200);

    source.value = 'ab';
    await nextTick();
    vi.advanceTimersByTime(200);
    // 距离最后一次变更仅 200ms，尚未生效
    expect(debounced.value).toBe('');

    vi.advanceTimersByTime(100);
    expect(debounced.value).toBe('ab');
  });

  it('支持 getter 作为 source（用于 reactive 对象属性）', async () => {
    const filters = ref<{ keyword?: string }>({ keyword: 'x' });
    const debounced = useDebounced(() => filters.value.keyword, 100);
    expect(debounced.value).toBe('x');

    filters.value = { keyword: 'y' };
    await nextTick();
    vi.advanceTimersByTime(100);
    expect(debounced.value).toBe('y');
  });
});
