import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, reactive, ref } from 'vue';
import {
  clearDraftRecord,
  loadDraft,
  saveDraftRecord,
  useDraftPersistence,
} from '@/composables/useDraftPersistence';

describe('draft 存取纯函数', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('save/load/clear 往返一致', () => {
    saveDraftRecord('item1', { version: 3, savedAt: 123, data: { a: 1 } });
    expect(loadDraft('item1')).toEqual({ version: 3, savedAt: 123, data: { a: 1 } });
    clearDraftRecord('item1');
    expect(loadDraft('item1')).toBeNull();
  });

  it('损坏的 JSON 与缺字段记录返回 null', () => {
    localStorage.setItem('labelhub:draft:bad', '{not json');
    expect(loadDraft('bad')).toBeNull();
    localStorage.setItem('labelhub:draft:partial', JSON.stringify({ data: {} }));
    expect(loadDraft('partial')).toBeNull();
  });
});

describe('useDraftPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const key = ref<string | null>(null);
    const version = ref<number>(1);
    const state = reactive<Record<string, unknown>>({});
    const restoredRecords: unknown[] = [];

    const draft = useDraftPersistence({
      key: () => key.value,
      version: () => version.value,
      snapshot: () => ({ ...state }),
      restore: (data) => Object.assign(state, data),
      onRestored: (record) => restoredRecords.push(record),
      debounceMs: 500,
    });

    return { key, version, state, restoredRecords, draft };
  }

  it('切换 key 时恢复版本匹配的草稿', async () => {
    saveDraftRecord('item1', { version: 1, savedAt: 1, data: { label: '草稿内容' } });
    const { key, state, restoredRecords } = setup();

    key.value = 'item1';
    await nextTick();

    expect(state.label).toBe('草稿内容');
    expect(restoredRecords).toHaveLength(1);
  });

  it('版本不匹配的过期草稿被清理且不恢复', async () => {
    saveDraftRecord('item2', { version: 99, savedAt: 1, data: { label: '过期草稿' } });
    const { key, state } = setup();

    key.value = 'item2';
    await nextTick();

    expect(state.label).toBeUndefined();
    expect(loadDraft('item2')).toBeNull();
  });

  it('表单变化防抖写入本地草稿', async () => {
    const { key, state } = setup();
    key.value = 'item3';
    await nextTick();

    state.label = '输入中';
    await nextTick();
    expect(loadDraft('item3')).toBeNull();

    vi.advanceTimersByTime(500);
    expect(loadDraft<{ label: string }>('item3')?.data.label).toBe('输入中');
  });

  it('clear 清理当前草稿并取消未落盘的定时器', async () => {
    const { key, state, draft } = setup();
    key.value = 'item4';
    await nextTick();

    state.label = 'x';
    await nextTick();
    draft.clear();
    vi.advanceTimersByTime(1000);

    expect(loadDraft('item4')).toBeNull();
  });
});
