import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { TaskStatus, type TaskItem } from '../types';
import * as taskApi from '../api/task';

export { TaskStatus };
export type { TaskItem };

export interface TaskState {
  tasks: TaskItem[];
  archivedTasks: TaskItem[];
  loading: boolean;
  error: string | null;
}

const useTaskPiniaStore = defineStore('task', () => {
  const tasks = ref<TaskItem[]>([]);
  const archivedTasks = ref<TaskItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const activeTasks = computed(() => tasks.value.filter((task) => !task.archived));
  const runningTasks = computed(() =>
    tasks.value.filter((task) => task.status === TaskStatus.IN_PROGRESS),
  );
  const taskTotal = computed(() => tasks.value.length);

  function replaceTask(nextTask: TaskItem) {
    tasks.value = tasks.value.map((task) => (task.id === nextTask.id ? nextTask : task));
  }

  async function fetchTasks(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.getTaskList();
      tasks.value = res.data.items;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '获取任务列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchArchivedTasks(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.getArchivedTaskList();
      archivedTasks.value = res.data.items;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '获取归档任务列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function addTask(task: Partial<TaskItem>): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.createTask(task);
      tasks.value = [res.data, ...tasks.value];
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '创建任务失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateTask(id: string, updates: Partial<TaskItem>): Promise<void> {
    error.value = null;
    try {
      const res = await taskApi.updateTask(id, updates);
      replaceTask(res.data);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '更新任务失败';
      throw err;
    }
  }

  async function deleteTask(id: string): Promise<void> {
    error.value = null;
    try {
      await taskApi.deleteTask(id);
      tasks.value = tasks.value.filter((task) => task.id !== id);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '删除任务失败';
    }
  }

  async function publishTask(id: string): Promise<void> {
    error.value = null;
    try {
      const res = await taskApi.updateTask(id, { status: TaskStatus.IN_PROGRESS });
      replaceTask(res.data);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '发布任务失败';
      throw err;
    }
  }

  async function endTask(id: string): Promise<void> {
    error.value = null;
    try {
      const res = await taskApi.updateTask(id, { status: TaskStatus.ENDED });
      replaceTask(res.data);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '结束任务失败';
      throw err;
    }
  }

  async function archiveTask(id: string): Promise<void> {
    error.value = null;
    try {
      const res = await taskApi.archiveTask(id);
      tasks.value = tasks.value.filter((task) => task.id !== id);
      archivedTasks.value = [res.data, ...archivedTasks.value];
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '归档任务失败';
      throw err;
    }
  }

  async function unarchiveTask(id: string): Promise<void> {
    error.value = null;
    try {
      const res = await taskApi.unarchiveTask(id);
      archivedTasks.value = archivedTasks.value.filter((task) => task.id !== id);
      tasks.value = [res.data, ...tasks.value];
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : '取消归档失败';
      throw err;
    }
  }

  return {
    tasks,
    archivedTasks,
    loading,
    error,
    activeTasks,
    runningTasks,
    taskTotal,
    fetchTasks,
    fetchArchivedTasks,
    addTask,
    updateTask,
    deleteTask,
    publishTask,
    endTask,
    archiveTask,
    unarchiveTask,
  };
});

export type TaskStore = ReturnType<typeof useTaskPiniaStore>;

interface UseTaskStore {
  (): TaskStore;
  <T>(selector: (store: TaskStore) => T): T;
  getState: () => TaskStore;
  setState: (patch: Partial<TaskState>) => void;
}

export const useTaskStore = ((selector?: (store: TaskStore) => unknown) => {
  const store = useTaskPiniaStore();
  return selector ? selector(store) : store;
}) as UseTaskStore;

useTaskStore.getState = () => useTaskPiniaStore();
useTaskStore.setState = (patch) => {
  useTaskPiniaStore().$patch(patch as never);
};
