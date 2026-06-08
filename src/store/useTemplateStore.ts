import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { TemplateItem } from '../types';
import * as templateApi from '../api/template';

export type { TemplateItem };

export interface TemplateState {
  templates: TemplateItem[];
  loading: boolean;
  error: string | null;
}

let nextId = 100;

const useTemplatePiniaStore = defineStore('template', () => {
  const templates = ref<TemplateItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const templateCount = computed(() => templates.value.length);
  const templateMap = computed(() => new Map(templates.value.map((template) => [template.id, template])));

  async function fetchTemplates(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await templateApi.getTemplateList();
      templates.value = res.data.items;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '获取模板列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function addTemplate(template: TemplateItem): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await templateApi.createTemplate(template);
      templates.value = [res.data, ...templates.value];
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '创建模板失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateTemplate(id: string, updates: Partial<TemplateItem>): Promise<void> {
    error.value = null;
    try {
      const res = await templateApi.updateTemplate(id, updates);
      templates.value = templates.value.map((template) => (template.id === id ? res.data : template));
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '更新模板失败';
      throw err;
    }
  }

  async function deleteTemplate(id: string): Promise<void> {
    error.value = null;
    try {
      await templateApi.deleteTemplate(id);
      templates.value = templates.value.filter((template) => template.id !== id);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '删除模板失败';
      throw err;
    }
  }

  return {
    templates,
    loading,
    error,
    templateCount,
    templateMap,
    fetchTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  };
});

export type TemplateStore = ReturnType<typeof useTemplatePiniaStore>;

interface UseTemplateStore {
  (): TemplateStore;
  <T>(selector: (store: TemplateStore) => T): T;
  getState: () => TemplateStore;
  setState: (patch: Partial<TemplateState>) => void;
}

export const useTemplateStore = ((selector?: (store: TemplateStore) => unknown) => {
  const store = useTemplatePiniaStore();
  return selector ? selector(store) : store;
}) as UseTemplateStore;

useTemplateStore.getState = () => useTemplatePiniaStore();
useTemplateStore.setState = (patch) => {
  useTemplatePiniaStore().$patch(patch as never);
};

export function generateTemplateId(): string {
  return 'tpl' + String(nextId++).padStart(3, '0');
}
