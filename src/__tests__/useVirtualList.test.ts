import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useVirtualList } from '@/composables/useVirtualList';

describe('useVirtualList', () => {
  it('固定行高：正确计算总高与可见窗口（含 overscan）', () => {
    const source = ref(Array.from({ length: 1000 }, (_, i) => i));
    const { totalHeight, visibleRows, scrollTop, viewportHeight } = useVirtualList(source, {
      itemHeight: 10,
      overscan: 2,
    });

    expect(totalHeight.value).toBe(10_000);

    viewportHeight.value = 100;
    scrollTop.value = 250;

    const rows = visibleRows.value;
    // 视口覆盖行 25-35，上下各扩 2 行
    expect(rows[0]!.index).toBe(23);
    expect(rows[rows.length - 1]!.index).toBe(37);
    expect(rows[0]!.offset).toBe(230);
  });

  it('变高行：前缀和偏移与行高正确', () => {
    const source = ref(['group', 'item', 'item', 'group', 'item']);
    const { totalHeight, visibleRows, viewportHeight } = useVirtualList(source, {
      itemHeight: (row) => (row === 'group' ? 30 : 90),
      overscan: 0,
    });

    expect(totalHeight.value).toBe(330);

    viewportHeight.value = 100;
    // 视口 [0,100)：行0（0-30）与行1（30-120）
    const rows = visibleRows.value;
    expect(rows.map((r) => r.index)).toEqual([0, 1]);
    expect(rows[1]!.offset).toBe(30);
    expect(rows[1]!.height).toBe(90);
  });

  it('滚动到中段只渲染窗口内的行', () => {
    const source = ref(Array.from({ length: 100 }, (_, i) => i));
    const list = useVirtualList(source, { itemHeight: 50, overscan: 1 });
    list.viewportHeight.value = 200;
    list.scrollTop.value = 1000;

    const indexes = list.visibleRows.value.map((r) => r.index);
    expect(indexes[0]).toBe(19);
    expect(indexes[indexes.length - 1]).toBe(25);
    expect(indexes).toHaveLength(7);
  });

  it('空列表返回空窗口', () => {
    const source = ref<number[]>([]);
    const { totalHeight, visibleRows } = useVirtualList(source, { itemHeight: 50 });
    expect(totalHeight.value).toBe(0);
    expect(visibleRows.value).toEqual([]);
  });

  it('数据变化后总高自动重算', () => {
    const source = ref([1, 2, 3]);
    const { totalHeight } = useVirtualList(source, { itemHeight: 10 });
    expect(totalHeight.value).toBe(30);
    source.value = [1, 2, 3, 4, 5];
    expect(totalHeight.value).toBe(50);
  });

  it('scrollIntoView 仅在目标行不可见时滚动', () => {
    const source = ref(Array.from({ length: 100 }, (_, i) => i));
    const list = useVirtualList(source, { itemHeight: 10 });
    const fakeEl = { scrollTop: 0, clientHeight: 100 } as HTMLElement;
    list.containerRef.value = fakeEl;
    list.viewportHeight.value = 100;

    // 行 5（50-60）在视口内，不滚动
    list.scrollIntoView(5);
    expect(fakeEl.scrollTop).toBe(0);

    // 行 50 底部 510 超出视口 → 滚到 510 - 100
    list.scrollIntoView(50);
    expect(fakeEl.scrollTop).toBe(410);

    // 行 3 顶部 30 在当前滚动位置上方 → 滚到 30
    list.scrollIntoView(3);
    expect(fakeEl.scrollTop).toBe(30);
  });
});
