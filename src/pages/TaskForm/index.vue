<template>
  <section class="task-form-page app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="4" class="page-title">
          {{ isEdit ? '编辑任务' : '创建任务' }}
        </a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">
          配置任务基础信息、模板绑定和处理时效。
        </a-typography-text>
      </div>
    </header>

    <a-alert
      v-if="errorText"
      type="error"
      :message="errorText"
      show-icon
      closable
      @close="errorText = ''"
    />

    <a-spin :spinning="loading">
      <a-card class="form-card">
        <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
          autocomplete="off"
          @finish="handleSubmit"
        >
          <a-form-item name="name" label="任务名称">
            <a-input
              v-model:value="formState.name"
              :maxlength="50"
              show-count
              placeholder="请输入任务名称"
            />
          </a-form-item>

          <a-form-item name="description" label="任务描述">
            <a-textarea
              v-model:value="formState.description"
              :maxlength="200"
              show-count
              :rows="3"
              placeholder="请输入任务描述"
            />
          </a-form-item>

          <a-form-item name="type" label="任务类型">
            <a-select
              v-model:value="formState.type"
              :options="taskTypeOptions"
              placeholder="请选择任务类型"
              @change="formState.templateId = undefined"
            />
          </a-form-item>

          <a-form-item name="owner" label="负责人">
            <a-select
              v-model:value="formState.owner"
              :options="ownerOptions"
              :loading="optionsLoading"
              placeholder="请选择负责人"
            />
          </a-form-item>

          <a-form-item name="templateId" label="绑定模板">
            <a-select
              v-model:value="formState.templateId"
              :options="templateOptions"
              :loading="templateStore.loading"
              :disabled="!formState.type"
              :placeholder="formState.type ? '请选择模板' : '请先选择任务类型'"
            />
          </a-form-item>

          <a-form-item name="instructions" label="任务说明">
            <a-textarea
              v-model:value="formState.instructions"
              :maxlength="500"
              show-count
              :rows="4"
              placeholder="请输入任务说明，如标注规范、注意事项等"
            />
          </a-form-item>

          <a-card size="small" title="任务时效" class="time-card">
            <a-row :gutter="[16, 12]">
              <a-col :xs="24" :md="12">
                <label class="field-label">任务开始</label>
                <input v-model="formState.startsAt" class="native-input" type="datetime-local" />
              </a-col>
              <a-col :xs="24" :md="12">
                <label class="field-label">任务期限</label>
                <input v-model="formState.dueAt" class="native-input" type="datetime-local" />
              </a-col>
              <a-col :xs="24" :md="12">
                <label class="field-label">标注项时限（小时）</label>
                <a-input-number
                  v-model:value="formState.annotationTimeoutHours"
                  :min="0"
                  :max="720"
                  class="full-control"
                />
              </a-col>
              <a-col :xs="24" :md="12">
                <label class="field-label">审核项时限（小时）</label>
                <a-input-number
                  v-model:value="formState.reviewTimeoutHours"
                  :min="0"
                  :max="720"
                  class="full-control"
                />
              </a-col>
            </a-row>
          </a-card>

          <a-form-item class="form-actions">
            <a-space>
              <a-button type="primary" html-type="submit" :loading="taskStore.loading">
                {{ isEdit ? '保存修改' : '创建任务' }}
              </a-button>
              <a-button @click="router.push('/tasks')">
                <template #icon><ArrowLeftOutlined /></template>
                返回列表
              </a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>
    </a-spin>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message, type FormInstance, type FormProps } from 'ant-design-vue';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import { AssignmentStrategy, TaskStatus, TaskType, type TaskItem } from '../../types';
import { getUserList } from '../../api/template';
import { useTaskStore } from '../../store/useTaskStore';
import { useTemplateStore } from '../../store/useTemplateStore';

const route = useRoute();
const router = useRouter();
const taskStore = useTaskStore();
const templateStore = useTemplateStore();
const formRef = ref<FormInstance>();

const optionsLoading = ref(false);
const errorText = ref('');
const ownerOptions = ref<Array<{ label: string; value: string }>>([]);

const editId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isEdit = computed(() => Boolean(editId.value));
const loading = computed(() => taskStore.loading || templateStore.loading || optionsLoading.value);
const editingTask = computed(() => taskStore.tasks.find((task) => task.id === editId.value));

const formState = reactive<{
  name: string;
  description: string;
  type: TaskType | undefined;
  owner: string | undefined;
  templateId: string | undefined;
  instructions: string;
  startsAt: string;
  dueAt: string;
  annotationTimeoutHours: number;
  reviewTimeoutHours: number;
}>({
  name: '',
  description: '',
  type: undefined,
  owner: undefined,
  templateId: undefined,
  instructions: '',
  startsAt: '',
  dueAt: '',
  annotationTimeoutHours: 24,
  reviewTimeoutHours: 24,
});

const rules: FormProps['rules'] = {
  name: [{ required: true, message: '请输入任务名称' }],
  description: [{ required: true, message: '请输入任务描述' }],
  type: [{ required: true, message: '请选择任务类型' }],
  owner: [{ required: true, message: '请选择负责人' }],
  templateId: [{ required: true, message: '请选择绑定模板' }],
  instructions: [{ required: true, message: '请输入任务说明' }],
};

const taskTypeOptions = [
  { label: '图像分类', value: TaskType.IMAGE_CLASSIFICATION },
  { label: '目标检测', value: TaskType.OBJECT_DETECTION },
  { label: '语义分割', value: TaskType.SEMANTIC_SEGMENTATION },
  { label: '文本 NER', value: TaskType.TEXT_NER },
];

const templateOptions = computed(() =>
  templateStore.templates
    .filter((template) => !formState.type || template.type === formState.type)
    .map((template) => ({ label: template.name, value: template.id })),
);

onMounted(async () => {
  await Promise.all([taskStore.fetchTasks(), templateStore.fetchTemplates(), loadOwners()]);
  fillFormFromTask();
});

watch(editingTask, () => fillFormFromTask());

async function loadOwners() {
  optionsLoading.value = true;
  try {
    const res = await getUserList();
    ownerOptions.value = (res.data.items || [])
      .filter((user) => user.role === 'owner' || user.role === 'admin')
      .map((user) => ({ label: user.username, value: user.username }));
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载负责人失败';
  } finally {
    optionsLoading.value = false;
  }
}

function fillFormFromTask() {
  const task = editingTask.value;
  if (!task) return;
  formState.name = task.name;
  formState.description = task.description;
  formState.type = task.type;
  formState.owner = task.owner;
  formState.templateId = task.templateId;
  formState.instructions = task.instructions;
  formState.startsAt = toLocalInputValue(task.startsAt);
  formState.dueAt = toLocalInputValue(task.dueAt);
  formState.annotationTimeoutHours = task.annotationTimeoutHours ?? 24;
  formState.reviewTimeoutHours = task.reviewTimeoutHours ?? 24;
}

async function handleSubmit() {
  await formRef.value?.validate();
  if (
    formState.startsAt &&
    formState.dueAt &&
    new Date(formState.dueAt) <= new Date(formState.startsAt)
  ) {
    message.warning('任务期限必须晚于任务开始');
    return;
  }

  const selectedTemplate = templateStore.templates.find(
    (template) => template.id === formState.templateId,
  );
  const payload: Partial<TaskItem> = {
    name: formState.name,
    description: formState.description,
    type: formState.type,
    owner: formState.owner,
    templateId: formState.templateId,
    templateName: selectedTemplate?.name ?? '',
    instructions: formState.instructions,
    startsAt: fromLocalInputValue(formState.startsAt),
    dueAt: fromLocalInputValue(formState.dueAt),
    annotationTimeoutHours: formState.annotationTimeoutHours,
    reviewTimeoutHours: formState.reviewTimeoutHours,
  };

  try {
    if (isEdit.value && editId.value) {
      await taskStore.updateTask(editId.value, payload);
      message.success('任务已更新');
    } else {
      await taskStore.addTask({
        ...payload,
        status: TaskStatus.DRAFT,
        assignmentConfig: { strategy: AssignmentStrategy.EVEN_SPLIT, annotators: [], options: {} },
        archived: false,
        archivedAt: null,
      } as Partial<TaskItem>);
      message.success('任务创建成功');
    }
    await router.push('/tasks');
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : taskStore.error || '保存任务失败';
  }
}

function toLocalInputValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}
</script>

<style scoped>
.page-title {
  margin: 0;
}

.form-card {
  max-width: 860px;
}

.time-card {
  margin-bottom: 24px;
  background: #fff;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}

.native-input {
  width: 100%;
  height: 32px;
  padding: 4px 11px;
  color: #202124;
  background: #fff;
  border: 1px solid var(--lh-border-strong);
  border-radius: 6px;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.native-input:focus {
  border-color: var(--lh-primary);
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.14);
}

.full-control {
  width: 100%;
}

.form-actions {
  padding-top: 4px;
  margin-bottom: 0;
}
</style>
