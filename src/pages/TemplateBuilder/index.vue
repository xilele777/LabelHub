<template>
  <a-spin :spinning="store.loading">
    <section class="template-builder">
      <header class="builder-toolbar">
        <a-space align="center">
          <a-button @click="goBack">
            <template #icon><ArrowLeftOutlined /></template>
            返回
          </a-button>
          <a-typography-title :level="4" class="builder-title">
            {{ isCreateMode ? '新建模板' : '编辑模板' }}
          </a-typography-title>
        </a-space>

        <a-space wrap>
          <a-tooltip :title="isCreateMode ? '创建模板并保存到服务端' : '保存模板到服务端'">
            <a-button type="primary" :loading="store.saving" @click="handleSave">
              <template #icon><SaveOutlined /></template>
              {{ isCreateMode ? '创建并保存' : '保存' }}
            </a-button>
          </a-tooltip>
          <a-tooltip title="复制当前 Schema JSON">
            <a-button :disabled="store.fields.length === 0" @click="copySchema">
              <template #icon><CopyOutlined /></template>
              复制 JSON
            </a-button>
          </a-tooltip>
          <a-tooltip title="下载当前 Schema JSON 文件">
            <a-button :disabled="store.fields.length === 0" @click="exportSchema">
              <template #icon><ExportOutlined /></template>
              导出 JSON
            </a-button>
          </a-tooltip>
          <a-tooltip title="从 JSON 文件或文本导入 Schema">
            <a-button @click="importOpen = true">
              <template #icon><ImportOutlined /></template>
              导入 JSON
            </a-button>
          </a-tooltip>
        </a-space>
      </header>

      <a-card size="small" class="meta-card">
        <a-form layout="inline" class="meta-form">
          <a-form-item label="模板名称">
            <a-input
              :value="store.templateMeta.name"
              placeholder="请输入模板名称"
              class="meta-input"
              @update:value="(value: string) => store.setTemplateMeta({ name: value })"
            />
          </a-form-item>
          <a-form-item label="模板描述">
            <a-input
              :value="store.templateMeta.description"
              placeholder="请输入模板描述"
              class="meta-desc-input"
              @update:value="(value: string) => store.setTemplateMeta({ description: value })"
            />
          </a-form-item>
          <a-form-item label="任务类型">
            <a-select
              :value="store.templateMeta.type"
              :options="taskTypeOptions"
              class="meta-select"
              @update:value="(value: TaskType) => store.setTemplateMeta({ type: value })"
            />
          </a-form-item>
        </a-form>
      </a-card>

      <div class="builder-main">
        <a-card title="物料" size="small" class="palette-card" :body-style="{ padding: '8px 12px' }">
          <a-typography-text type="secondary" class="palette-hint">
            拖入画布，或点击快速添加
          </a-typography-text>

          <VueDraggable
            v-model="paletteItems"
            class="palette-list"
            :sort="false"
            :group="{ name: dragGroupName, pull: 'clone', put: false }"
            :clone="clonePaletteItem"
            :animation="160"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
          >
            <button
              v-for="item in paletteItems"
              :key="item.type"
              type="button"
              class="palette-item"
              @click="addField(item.type)"
            >
              <component :is="item.icon" class="palette-icon" />
              <span>{{ item.label }}</span>
            </button>
          </VueDraggable>
        </a-card>

        <a-card title="画布" size="small" class="canvas-card" :body-style="{ padding: '12px 16px' }">
          <VueDraggable
            v-model="canvasFields"
            class="canvas-list"
            :class="{ 'canvas-list--empty': store.fields.length === 0 }"
            :group="{ name: dragGroupName, pull: true, put: true }"
            :animation="180"
            handle=".field-drag-handle"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
            @add="handleCanvasAdd"
            @update="handleCanvasSort"
          >
            <article
              v-for="field in store.fields"
              :key="field.id"
              class="canvas-field"
              :class="{ 'canvas-field--selected': field.id === store.selectedFieldId }"
              @click="store.selectField(field.id)"
            >
              <HolderOutlined class="field-drag-handle" />
              <a-tag color="blue" class="field-type-tag">{{ fieldTypeLabelMap[field.type] }}</a-tag>

              <div class="field-content">
                <div class="field-title">
                  {{ field.label || fieldTypeLabelMap[field.type] }}
                  <a-tag v-if="field.required && field.type !== FieldType.TITLE" color="red" class="required-tag">
                    必填
                  </a-tag>
                </div>
                <div v-if="field.description" class="field-description">{{ field.description }}</div>
                <div class="field-preview">
                  <template v-if="field.type === FieldType.INPUT || field.type === FieldType.TEXTAREA">
                    {{ field.placeholder || '请输入' }}
                  </template>
                  <template v-else-if="hasOptions(field)">
                    <a-space :direction="getDirection(field) === 'horizontal' ? 'horizontal' : 'vertical'" wrap>
                      <a-tag v-for="option in field.options" :key="option.id">{{ option.label }}</a-tag>
                    </a-space>
                  </template>
                  <template v-else-if="field.type === FieldType.RATING">
                    最高 {{ getNumberField(field, 'maxScore', 5) }} 分
                  </template>
                  <template v-else-if="field.type === FieldType.SWITCH">
                    {{ getStringField(field, 'checkedChildren', '是') }} / {{ getStringField(field, 'unCheckedChildren', '否') }}
                  </template>
                  <template v-else-if="field.type === FieldType.TITLE">
                    {{ getStringField(field, 'content', '') || '说明内容' }}
                  </template>
                </div>
              </div>

              <a-button type="text" size="small" danger @click.stop="removeField(field.id)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </article>

            <div v-if="store.fields.length === 0" class="canvas-empty">
              <a-empty description="将左侧物料拖入画布开始搭建模板" />
            </div>
          </VueDraggable>
        </a-card>

        <a-card size="small" class="inspector-card" :body-style="{ padding: '0' }">
          <a-tabs v-model:activeKey="rightTab" class="inspector-tabs">
            <a-tab-pane key="config" tab="属性">
              <div class="inspector-pane">
                <template v-if="selectedField">
                  <div class="inspector-header">
                    <a-typography-title :level="5" class="inspector-title">
                      {{ fieldTypeLabelMap[selectedField.type] }}配置
                    </a-typography-title>
                    <a-button size="small" danger @click="removeSelectedField">
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </a-button>
                  </div>

                  <a-divider class="compact-divider" />

                  <div v-for="item in currentConfigItems" :key="item.key" class="config-item">
                    <template v-if="item.type === 'switch'">
                      <div class="config-switch-row">
                        <a-typography-text type="secondary">{{ item.label }}</a-typography-text>
                        <a-switch
                          size="small"
                          :checked="Boolean(getSelectedValue(item.key))"
                          @update:checked="(value: boolean) => updateSelectedField(item.key, value)"
                        />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'options'">
                      <a-divider class="compact-divider" />
                      <a-typography-text type="secondary">{{ item.label }}</a-typography-text>
                      <div class="options-editor">
                        <div v-for="(option, index) in selectedOptions" :key="option.id" class="option-row">
                          <a-input
                            size="small"
                            :value="option.label"
                            placeholder="标签"
                            @update:value="(value: string) => updateOption(index, 'label', value)"
                          />
                          <a-input
                            size="small"
                            :value="option.value"
                            placeholder="值"
                            @update:value="(value: string) => updateOption(index, 'value', value)"
                          />
                          <a-button type="text" size="small" danger @click="removeOption(index)">
                            <template #icon><DeleteOutlined /></template>
                          </a-button>
                        </div>
                        <a-button block size="small" type="dashed" @click="addOption">
                          <template #icon><PlusOutlined /></template>
                          添加选项
                        </a-button>
                      </div>
                    </template>

                    <template v-else>
                      <a-typography-text type="secondary">{{ item.label }}</a-typography-text>
                      <a-input
                        v-if="item.type === 'text'"
                        size="small"
                        :value="asString(getSelectedValue(item.key))"
                        :placeholder="item.placeholder"
                        @update:value="(value: string) => updateSelectedField(item.key, value)"
                      />
                      <a-textarea
                        v-else-if="item.type === 'textarea'"
                        size="small"
                        :value="asString(getSelectedValue(item.key))"
                        :placeholder="item.placeholder"
                        :auto-size="{ minRows: 1, maxRows: 3 }"
                        @update:value="(value: string) => updateSelectedField(item.key, value)"
                      />
                      <a-input-number
                        v-else-if="item.type === 'number'"
                        size="small"
                        class="number-input"
                        :value="asNumber(getSelectedValue(item.key))"
                        :min="item.min"
                        :max="item.max"
                        :placeholder="item.placeholder"
                        @update:value="(value: number | null) => updateSelectedField(item.key, value ?? undefined)"
                      />
                      <a-select
                        v-else-if="item.type === 'select'"
                        size="small"
                        class="select-input"
                        :value="getSelectedValue(item.key) as string | number | undefined"
                        :options="item.options"
                        @update:value="(value: string | number) => updateSelectedField(item.key, value)"
                      />
                    </template>
                  </div>
                </template>

                <div v-else class="inspector-empty">
                  <a-empty description="选择画布中的字段以配置属性" />
                </div>
              </div>
            </a-tab-pane>

            <a-tab-pane key="schema" tab="Schema">
              <div class="schema-pane">
                <div class="schema-summary">
                  <a-tag color="blue">共 {{ store.fields.length }} 个字段</a-tag>
                  <a-tag color="red">必填 {{ requiredCount }} 个</a-tag>
                  <a-tag color="orange">说明 {{ titleCount }} 个</a-tag>
                </div>
                <pre class="schema-preview">{{ schemaJson }}</pre>
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </div>
    </section>

    <a-modal
      v-model:open="importOpen"
      title="导入 Schema"
      width="640px"
      ok-text="导入"
      :ok-button-props="{ disabled: !importText.trim() }"
      destroy-on-close
      @ok="importSchemaFromText"
      @cancel="resetImportModal"
    >
      <div class="import-body lh-modal-stack">
        <a-typography-text type="secondary">
          粘贴 JSON 或上传文件导入 Schema，导入后会覆盖当前画布内容。
        </a-typography-text>
        <a-upload accept=".json" :show-upload-list="false" :before-upload="importSchemaFromFile">
          <a-button>
            <template #icon><UploadOutlined /></template>
            选择 JSON 文件
          </a-button>
        </a-upload>
        <a-textarea
          v-model:value="importText"
          :rows="12"
          placeholder='粘贴 JSON，例如 { "fields": [...] }'
          class="json-textarea"
        />
        <a-alert
          v-if="importErrors.length > 0"
          type="warning"
          show-icon
          message="校验警告"
          :description="importErrors.join('\n')"
        />
      </div>
    </a-modal>
  </a-spin>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import {
  AlignLeftOutlined,
  ArrowLeftOutlined,
  AudioOutlined,
  CheckSquareOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownCircleOutlined,
  ExportOutlined,
  FormOutlined,
  HolderOutlined,
  ImportOutlined,
  PlusOutlined,
  ReadOutlined,
  SaveOutlined,
  StarOutlined,
  SwapOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus';
import type { Component } from 'vue';
import {
  FieldType,
  TaskType,
  type FieldOption,
  type RadioField,
  type CheckboxField,
  type SelectField,
  type TemplateField,
} from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { createDefaultField, useTemplateBuilderStore } from './useTemplateBuilderStore';
import { validateImportSchema } from './utils/validateSchema';

type ConfigItemType = 'text' | 'textarea' | 'switch' | 'number' | 'select' | 'options';

interface BaseConfigItem {
  key: string;
  label: string;
  type: ConfigItemType;
  placeholder?: string;
}

interface SelectConfigItem extends BaseConfigItem {
  type: 'select';
  options: Array<{ label: string; value: string | number }>;
}

interface NumberConfigItem extends BaseConfigItem {
  type: 'number';
  min?: number;
  max?: number;
}

type ConfigItem =
  | BaseConfigItem
  | SelectConfigItem
  | NumberConfigItem;

interface PaletteItem {
  type: FieldType;
  label: string;
  icon: Component;
}

const route = useRoute();
const router = useRouter();
const store = useTemplateBuilderStore();
const authStore = useAuthStore();

const dragGroupName = 'template-fields';
const rightTab = ref('config');
const importOpen = ref(false);
const importText = ref('');
const importErrors = ref<string[]>([]);

const taskTypeOptions = [
  { value: TaskType.IMAGE_CLASSIFICATION, label: '图像分类' },
  { value: TaskType.OBJECT_DETECTION, label: '目标检测' },
  { value: TaskType.SEMANTIC_SEGMENTATION, label: '语义分割' },
  { value: TaskType.TEXT_NER, label: '文本 NER' },
];

const paletteItems = ref<PaletteItem[]>([
  { type: FieldType.INPUT, label: '单行输入', icon: FormOutlined },
  { type: FieldType.TEXTAREA, label: '多行文本', icon: AlignLeftOutlined },
  { type: FieldType.RADIO, label: '单选', icon: AudioOutlined },
  { type: FieldType.CHECKBOX, label: '多选', icon: CheckSquareOutlined },
  { type: FieldType.SELECT, label: '下拉选择', icon: DownCircleOutlined },
  { type: FieldType.RATING, label: '评分', icon: StarOutlined },
  { type: FieldType.SWITCH, label: '开关', icon: SwapOutlined },
  { type: FieldType.TITLE, label: '说明块', icon: ReadOutlined },
]);

const fieldTypeLabelMap: Record<FieldType, string> = {
  [FieldType.INPUT]: '单行输入',
  [FieldType.TEXTAREA]: '多行文本',
  [FieldType.RADIO]: '单选',
  [FieldType.CHECKBOX]: '多选',
  [FieldType.SELECT]: '下拉选择',
  [FieldType.RATING]: '评分',
  [FieldType.SWITCH]: '开关',
  [FieldType.TITLE]: '说明块',
};

const fieldConfigMap: Record<FieldType, ConfigItem[]> = {
  [FieldType.INPUT]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 category' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)', type: 'switch' },
    { key: 'placeholder', label: '占位提示 (placeholder)', type: 'text', placeholder: '请输入' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'maxLength', label: '最大长度 (maxLength)', type: 'number', min: 1, placeholder: '200' },
  ],
  [FieldType.TEXTAREA]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 content' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)', type: 'switch' },
    { key: 'placeholder', label: '占位提示 (placeholder)', type: 'text', placeholder: '请输入' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'autoSize', label: '自适应高度 (autoSize)', type: 'switch' },
  ],
  [FieldType.RADIO]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 category' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)', type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'options', label: '选项列表 (options)', type: 'options' },
    {
      key: 'direction',
      label: '排列方向',
      type: 'select',
      options: [{ label: '垂直', value: 'vertical' }, { label: '水平', value: 'horizontal' }],
    },
  ],
  [FieldType.CHECKBOX]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 tags' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)', type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'options', label: '选项列表 (options)', type: 'options' },
    {
      key: 'direction',
      label: '排列方向',
      type: 'select',
      options: [{ label: '垂直', value: 'vertical' }, { label: '水平', value: 'horizontal' }],
    },
    { key: 'maxCheck', label: '最多可选数 (maxCheck)', type: 'number', min: 1 },
  ],
  [FieldType.SELECT]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 city' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)', type: 'switch' },
    { key: 'placeholder', label: '占位提示 (placeholder)', type: 'text', placeholder: '请选择' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'options', label: '选项列表 (options)', type: 'options' },
    { key: 'searchable', label: '可搜索 (searchable)', type: 'switch' },
  ],
  [FieldType.RATING]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 score' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)', type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'maxScore', label: '最高分 (maxScore)', type: 'number', min: 1, max: 10, placeholder: '5' },
    { key: 'allowHalf', label: '允许半星 (allowHalf)', type: 'switch' },
  ],
  [FieldType.SWITCH]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 enabled' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)', type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'defaultValue', label: '默认值 (defaultValue)', type: 'switch' },
    { key: 'checkedChildren', label: '开启文字 (checkedChildren)', type: 'text', placeholder: '是' },
    { key: 'unCheckedChildren', label: '关闭文字 (unCheckedChildren)', type: 'text', placeholder: '否' },
  ],
  [FieldType.TITLE]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如 section1' },
    { key: 'label', label: '标题 (label)', type: 'text', placeholder: '说明标题' },
    { key: 'content', label: '说明正文 (content)', type: 'textarea', placeholder: '说明内容' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    { key: 'level', label: '标题级别 (level)', type: 'select', options: [1, 2, 3, 4, 5].map((value) => ({ label: `H${value}`, value })) },
  ],
};

const canvasFields = computed<TemplateField[]>({
  get: () => store.fields,
  set: (nextFields) => {
    store.loadFields(nextFields.filter(isTemplateField));
  },
});

const selectedField = computed(() => store.selectedField);
const currentConfigItems = computed(() => (selectedField.value ? fieldConfigMap[selectedField.value.type] : []));
const selectedOptions = computed(() => {
  const field = selectedField.value;
  return field && hasOptions(field) ? field.options : [];
});
const isCreateMode = computed(() => store.mode === 'create');
const requiredCount = computed(() => store.fields.filter((field) => field.type !== FieldType.TITLE && field.required).length);
const titleCount = computed(() => store.fields.filter((field) => field.type === FieldType.TITLE).length);
const schema = computed(() => ({
  version: 1,
  meta: {
    name: store.templateMeta.name,
    description: store.templateMeta.description,
    type: store.templateMeta.type,
  },
  fieldCount: store.fields.length,
  fields: store.fields.map(cleanFieldForSchema),
}));
const schemaJson = computed(() => JSON.stringify(schema.value, null, 2));

onMounted(() => {
  const templateId = typeof route.query.id === 'string' ? route.query.id : null;
  const mode = typeof route.query.mode === 'string' ? route.query.mode : null;

  if (templateId) {
    void store.loadTemplate(templateId);
  } else if (mode === 'create' || !store.templateId) {
    store.initCreateMode();
  }
});

onBeforeUnmount(() => {
  store.reset();
});

function isTemplateField(value: unknown): value is TemplateField {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'type' in value);
}

function hasOptions(field: TemplateField): field is RadioField | CheckboxField | SelectField {
  return 'options' in field && Array.isArray(field.options);
}

function clonePaletteItem(item: PaletteItem): TemplateField {
  return createDefaultField(item.type);
}

function addField(type: FieldType) {
  store.addField(type);
}

function handleCanvasAdd(event: DraggableEvent<TemplateField>) {
  const field = event.clonedData ?? store.fields[event.newIndex ?? store.fields.length - 1];
  if (field?.id) {
    store.selectField(field.id);
    rightTab.value = 'config';
  }
}

function handleCanvasSort() {
  if (store.selectedFieldId && !store.fields.some((field) => field.id === store.selectedFieldId)) {
    store.selectField(null);
  }
}

function removeField(id: string) {
  store.removeField(id);
}

function removeSelectedField() {
  if (!selectedField.value) return;
  store.removeField(selectedField.value.id);
}

function getSelectedValue(key: string): unknown {
  return selectedField.value ? (selectedField.value as unknown as Record<string, unknown>)[key] : undefined;
}

function updateSelectedField(key: string, value: unknown) {
  if (!selectedField.value) return;
  store.updateField(selectedField.value.id, { [key]: value } as Partial<TemplateField>);
}

function updateOption(index: number, key: 'label' | 'value', value: string) {
  if (!selectedField.value || !hasOptions(selectedField.value)) return;
  const options = selectedField.value.options.map((option, currentIndex) =>
    currentIndex === index ? { ...option, [key]: value } : option,
  );
  store.updateField(selectedField.value.id, { options } as Partial<TemplateField>);
}

function addOption() {
  if (!selectedField.value || !hasOptions(selectedField.value)) return;
  const index = selectedField.value.options.length + 1;
  const option: FieldOption = {
    id: `opt_${Date.now().toString(36)}_${index}`,
    label: `选项${index}`,
    value: `opt${index}`,
  };
  store.updateField(selectedField.value.id, { options: [...selectedField.value.options, option] } as Partial<TemplateField>);
}

function removeOption(index: number) {
  if (!selectedField.value || !hasOptions(selectedField.value)) return;
  const options = selectedField.value.options.filter((_, currentIndex) => currentIndex !== index);
  store.updateField(selectedField.value.id, { options } as Partial<TemplateField>);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function getDirection(field: TemplateField): 'horizontal' | 'vertical' {
  if ('direction' in field && field.direction) return field.direction;
  return 'vertical';
}

function getStringField(field: TemplateField, key: string, fallback: string): string {
  const value = (field as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : fallback;
}

function getNumberField(field: TemplateField, key: string, fallback: number): number {
  const value = (field as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : fallback;
}

function cleanFieldForSchema(field: TemplateField): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(field).forEach(([key, value]) => {
    if (value === '' || value === undefined || value === null) return;
    if (key === 'options' && Array.isArray(value)) {
      result.options = value.map(({ label, value: optionValue }) => ({ label, value: optionValue }));
      return;
    }
    result[key] = value;
  });
  return result;
}

function validateBeforeSave(): string | null {
  if (!store.templateMeta.name.trim()) {
    return '请填写模板名称';
  }
  if (store.fields.length === 0) {
    return '请至少添加一个字段';
  }

  const keys = new Set<string>();
  for (const [index, field] of store.fields.entries()) {
    if (!field.label.trim()) {
      return `第 ${index + 1} 个字段缺少标题`;
    }
    if (field.type === FieldType.TITLE) {
      continue;
    }

    const key = field.fieldKey.trim();
    if (!key) {
      return `字段「${field.label}」缺少字段标识`;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return `字段「${field.label}」的字段标识只能使用字母、数字和下划线，且不能以数字开头`;
    }
    if (keys.has(key)) {
      return `字段标识「${key}」重复`;
    }
    keys.add(key);
  }

  return null;
}

async function handleSave() {
  const validationError = validateBeforeSave();
  if (validationError) {
    message.warning(validationError);
    return;
  }

  const wasCreateMode = store.mode === 'create';
  try {
    await store.saveTemplate(authStore.user?.username);
    message.success(wasCreateMode ? '模板创建成功' : '模板已保存');
    await router.push('/templates');
  } catch (error) {
    const errorMessage = error instanceof Error && error.message ? error.message : '保存失败，请重试';
    message.error(errorMessage);
  }
}

function copySchema() {
  if (store.fields.length === 0) {
    message.warning('画布为空，无法复制');
    return;
  }

  navigator.clipboard
    .writeText(schemaJson.value)
    .then(() => message.success('Schema JSON 已复制到剪贴板'))
    .catch(() => message.error('复制失败，请手动复制'));
}

function exportSchema() {
  if (store.fields.length === 0) {
    message.warning('画布为空，无法导出');
    return;
  }

  const blob = new Blob([schemaJson.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `template-schema-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  message.success('Schema 已导出');
}

function importSchema(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    importErrors.value = ['JSON 格式无效'];
    message.error('JSON 格式无效，请检查输入');
    return false;
  }

  const result = validateImportSchema(parsed);
  importErrors.value = result.errors;

  if (result.fields.length === 0) {
    message.error('导入失败：没有可恢复的字段');
    return false;
  }

  store.loadFields(result.fields);
  message.success(`成功导入 ${result.fields.length} 个字段`);
  resetImportModal();
  importOpen.value = false;
  return true;
}

function importSchemaFromText() {
  if (!importText.value.trim()) return;
  importSchema(importText.value);
}

function importSchemaFromFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    importSchema(String(reader.result ?? ''));
  };
  reader.onerror = () => {
    importErrors.value = ['文件读取失败'];
    message.error('文件读取失败');
  };
  reader.readAsText(file);
  return false;
}

function resetImportModal() {
  importText.value = '';
  importErrors.value = [];
}

function goBack() {
  void router.push('/templates');
}
</script>

<style scoped>
.template-builder {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 92px);
  min-height: 640px;
  overflow: hidden;
}

.builder-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  padding: 0 2px 10px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--lh-divider);
  border-radius: 0;
  box-shadow: none;
}

.builder-title {
  margin: 0;
}

.meta-card {
  margin-bottom: 10px;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.meta-form {
  row-gap: 8px;
}

.meta-input {
  width: 200px;
}

.meta-desc-input {
  width: 260px;
}

.meta-select {
  width: 150px;
}

.builder-main {
  display: grid;
  grid-template-columns: minmax(210px, 230px) minmax(440px, 1fr) minmax(320px, 360px);
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--lh-border);
  border-radius: 8px;
}

.palette-card,
.canvas-card,
.inspector-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.palette-card,
.canvas-card {
  border-right: 1px solid var(--lh-divider);
}

.palette-card :deep(.ant-card-body),
.canvas-card :deep(.ant-card-body),
.inspector-card :deep(.ant-card-body) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.palette-hint {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
}

.palette-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.palette-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  gap: 8px;
  color: #202124;
  background: #fff;
  border: 1px solid var(--lh-divider);
  border-radius: 6px;
  cursor: grab;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.palette-item:hover {
  background: #f8fbff;
  border-color: rgba(26, 115, 232, 0.28);
  box-shadow: none;
  transform: translateY(-1px);
}

.palette-icon {
  color: var(--lh-primary);
  font-size: 16px;
}

.canvas-list {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  gap: 8px;
  padding: 2px;
}

.canvas-list--empty {
  justify-content: center;
  background:
    linear-gradient(rgba(226, 232, 240, 0.72) 1px, transparent 1px),
    linear-gradient(90deg, rgba(226, 232, 240, 0.72) 1px, transparent 1px);
  background-color: #fbfcfe;
  background-size: 18px 18px;
  border: 1px dashed rgba(148, 163, 184, 0.52);
  border-radius: 8px;
}

.canvas-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--lh-divider);
  border-radius: 6px;
  cursor: pointer;
  box-shadow: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.canvas-field:hover {
  background: #fff;
  border-color: rgba(138, 180, 248, 0.74);
  box-shadow: none;
  transform: translateY(-1px);
}

.canvas-field--selected {
  border-color: var(--lh-primary);
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12);
}

.field-drag-handle {
  flex: 0 0 auto;
  color: #8c8c8c;
  cursor: grab;
}

.field-type-tag,
.required-tag {
  flex: 0 0 auto;
  margin: 0;
}

.field-content {
  flex: 1;
  min-width: 0;
}

.field-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  color: #202124;
  font-weight: 600;
}

.field-description,
.field-preview {
  color: #5f6368;
  font-size: 12px;
  line-height: 1.5;
}

.canvas-empty {
  display: grid;
  min-height: 360px;
  place-items: center;
}

.inspector-tabs {
  height: 100%;
}

.inspector-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
  padding-inline: 12px;
  background: transparent;
}

.inspector-tabs :deep(.ant-tabs-content-holder),
.inspector-tabs :deep(.ant-tabs-content),
.inspector-tabs :deep(.ant-tabs-tabpane) {
  min-height: 0;
  height: 100%;
}

.inspector-pane,
.schema-pane {
  height: 100%;
  padding: 12px 16px 16px;
  overflow: auto;
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inspector-title {
  margin: 0;
}

.compact-divider {
  margin: 8px 0;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  padding: 8px 0 10px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--lh-divider);
  border-radius: 6px;
}

.config-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.number-input,
.select-input {
  width: 100%;
}

.options-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.option-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px;
  gap: 4px;
  align-items: center;
}

.inspector-empty {
  display: grid;
  height: 100%;
  min-height: 320px;
  place-items: center;
}

.schema-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.schema-preview {
  min-height: 420px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  color: #0f172a;
  background: #f7f9fc;
  border: 1px solid var(--lh-divider);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.import-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.json-textarea {
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
}

.drag-ghost {
  opacity: 0.45;
  background: var(--lh-primary-soft);
  border-color: var(--lh-primary);
}

.drag-chosen {
  cursor: grabbing;
  box-shadow: 0 8px 24px rgba(26, 115, 232, 0.18);
}

@media (max-width: 1200px) {
  .template-builder {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .builder-main {
    grid-template-columns: minmax(210px, 240px) minmax(380px, 1fr);
  }

  .inspector-card {
    grid-column: 1 / -1;
    min-height: 460px;
  }
}

@media (max-width: 820px) {
  .builder-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .builder-main {
    grid-template-columns: 1fr;
  }

  .meta-input,
  .meta-desc-input,
  .meta-select {
    width: min(100%, 320px);
  }
}
</style>
