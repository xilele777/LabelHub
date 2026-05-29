import { create } from 'zustand';
import { TaskStatus, type TaskItem } from '../types';
import * as taskApi from '../api/task';

interface TaskState {
  tasks: TaskItem[];
  archivedTasks: TaskItem[];
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  fetchArchivedTasks: () => Promise<void>;
  addTask: (task: Partial<TaskItem>) => Promise<void>;
  updateTask: (id: string, updates: Partial<TaskItem>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  publishTask: (id: string) => Promise<void>;
  endTask: (id: string) => Promise<void>;
  archiveTask: (id: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>()((set, _get) => ({
  tasks: [],
  archivedTasks: [],
  loading: false,
  error: null,

  async fetchTasks() {
    set({ loading: true, error: null });
    try {
      const res = await taskApi.getTaskList();
      set({ tasks: res.data.items, loading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取任务列表失败', loading: false });
    }
  },

  async fetchArchivedTasks() {
    set({ loading: true, error: null });
    try {
      const res = await taskApi.getArchivedTaskList();
      set({ archivedTasks: res.data.items, loading: false });
    } catch (err: any) {
      set({ error: err?.message || '获取归档任务列表失败', loading: false });
    }
  },

  async addTask(task) {
    set({ loading: true, error: null });
    try {
      const res = await taskApi.createTask(task);
      set((state) => ({ tasks: [res.data, ...state.tasks], loading: false }));
    } catch (err: any) {
      const msg = err?.message || '创建任务失败';
      set({ error: msg, loading: false });
      throw err; // Re-throw so caller knows it failed
    }
  },

  async updateTask(id, updates) {
    set({ error: null });
    try {
      const res = await taskApi.updateTask(id, updates);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? res.data : t)),
      }));
    } catch (err: any) {
      const msg = err?.message || '更新任务失败';
      set({ error: msg });
      throw err; // Re-throw so caller knows it failed
    }
  },

  async deleteTask(id) {
    set({ error: null });
    try {
      await taskApi.deleteTask(id);
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    } catch (err: any) {
      set({ error: err?.message || '删除任务失败' });
    }
  },

  async publishTask(id) {
    set({ error: null });
    try {
      const res = await taskApi.updateTask(id, { status: TaskStatus.IN_PROGRESS });
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? res.data : t)),
      }));
    } catch (err: any) {
      set({ error: err?.message || '发布任务失败' });
      throw err;
    }
  },

  async endTask(id) {
    set({ error: null });
    try {
      const res = await taskApi.updateTask(id, { status: TaskStatus.ENDED });
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? res.data : t)),
      }));
    } catch (err: any) {
      set({ error: err?.message || '结束任务失败' });
      throw err;
    }
  },

  async archiveTask(id) {
    set({ error: null });
    try {
      const res = await taskApi.archiveTask(id);
      // Remove from tasks list, add to archivedTasks
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        archivedTasks: [res.data, ...state.archivedTasks],
      }));
    } catch (err: any) {
      set({ error: err?.message || '归档任务失败' });
      throw err;
    }
  },

  async unarchiveTask(id) {
    set({ error: null });
    try {
      const res = await taskApi.unarchiveTask(id);
      // Remove from archivedTasks, add back to tasks
      set((state) => ({
        archivedTasks: state.archivedTasks.filter((t) => t.id !== id),
        tasks: [res.data, ...state.tasks],
      }));
    } catch (err: any) {
      set({ error: err?.message || '取消归档失败' });
      throw err;
    }
  },
}));
