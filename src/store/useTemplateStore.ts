import { create } from 'zustand';
import { type TemplateItem } from '../types';
import * as templateApi from '../api/template';

interface TemplateState {
  templates: TemplateItem[];
  loading: boolean;
  error: string | null;
  fetchTemplates: () => Promise<void>;
  addTemplate: (template: TemplateItem) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<TemplateItem>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

let nextId = 100;

export const useTemplateStore = create<TemplateState>()((set) => ({
  templates: [],
  loading: false,
  error: null,

  async fetchTemplates() {
    set({ loading: true, error: null });
    try {
      const res = await templateApi.getTemplateList();
      set({ templates: res.data.items, loading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取模板列表失败', loading: false });
    }
  },

  async addTemplate(template) {
    set({ loading: true, error: null });
    try {
      const res = await templateApi.createTemplate(template);
      set((state) => ({ templates: [res.data, ...state.templates], loading: false }));
    } catch (err: any) {
      set({ error: err?.message || '创建模板失败', loading: false });
      throw err;
    }
  },

  async updateTemplate(id, updates) {
    set({ error: null });
    try {
      const res = await templateApi.updateTemplate(id, updates);
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? res.data : t)),
      }));
    } catch (err: any) {
      set({ error: err?.message || '更新模板失败' });
      throw err;
    }
  },

  async deleteTemplate(id) {
    set({ error: null });
    try {
      await templateApi.deleteTemplate(id);
      set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
    } catch (err: any) {
      set({ error: err?.message || '删除模板失败' });
      throw err;
    }
  },
}));

export function generateTemplateId(): string {
  return 'tpl' + String(nextId++).padStart(3, '0');
}
