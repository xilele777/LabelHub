<template>
  <a-card size="small" class="inspector-card" :body-style="{ padding: '0' }">
    <a-tabs v-model:active-key="activeTab" class="inspector-tabs">
      <a-tab-pane key="config" tab="属性">
        <div class="inspector-pane">
          <template v-if="field">
            <div class="inspector-header">
              <a-typography-title :level="5" class="inspector-title">
                {{ typeLabel }}配置
              </a-typography-title>
              <a-button size="small" danger @click="$emit('delete', field.id)">
                <template #icon><DeleteOutlined /></template>
                删除
              </a-button>
            </div>

            <a-divider class="compact-divider" />

            <template v-for="item in configItems" :key="item.key">
              <!-- Switch -->
              <template v-if="item.type === 'switch'">
                <div class="config-switch-row">
                  <a-typography-text type="secondary">{{ item.label }}</a-typography-text>
                  <a-switch
                    size="small"
                    :checked="Boolean(field[item.key as keyof typeof field])"
                    @update:checked="(v: boolean) => $emit('update:field', item.key, v)"
                  />
                </div>
              </template>

              <!-- Options editor -->
              <template v-else-if="item.type === 'options'">
                <a-divider class="compact-divider" />
                <a-typography-text type="secondary">{{ item.label }}</a-typography-text>
                <div class="options-editor">
                  <div v-for="(option, idx) in fieldOptions" :key="option.id" class="option-row">
                    <a-input
                      size="small"
                      :value="option.label"
                      placeholder="标签"
                      @update:value="(v: string) => $emit('update:option', idx, 'label', v)"
                    />
                    <a-input
                      size="small"
                      :value="option.value"
                      placeholder="值"
                      @update:value="(v: string) => $emit('update:option', idx, 'value', v)"
                    />
                    <a-button type="text" size="small" danger @click="$emit('remove:option', idx)">
                      <template #icon><DeleteOutlined /></template>
                    </a-button>
                  </div>
                  <a-button block size="small" type="dashed" @click="$emit('add:option')">
                    <template #icon><PlusOutlined /></template>
                    添加选项
                  </a-button>
                </div>
              </template>

              <!-- Text / Textarea / Number / Select -->
              <template v-else>
                <a-typography-text type="secondary">{{ item.label }}</a-typography-text>

                <a-input
                  v-if="item.type === 'text'"
                  size="small"
                  :value="asInputString(item.key)"
                  :placeholder="item.placeholder"
                  @update:value="(v: string) => $emit('update:field', item.key, v)"
                />
                <a-textarea
                  v-else-if="item.type === 'textarea'"
                  size="small"
                  :value="asInputString(item.key)"
                  :placeholder="item.placeholder"
                  :auto-size="{ minRows: 1, maxRows: 3 }"
                  @update:value="(v: string) => $emit('update:field', item.key, v)"
                />
                <a-input-number
                  v-else-if="item.type === 'number'"
                  size="small"
                  class="number-input"
                  :value="asInputNumber(item.key)"
                  :min="(item as NumberConfigItem).min"
                  :max="(item as NumberConfigItem).max"
                  :placeholder="item.placeholder"
                  @update:value="
                    (v: number | null) => $emit('update:field', item.key, v ?? undefined)
                  "
                />
                <a-select
                  v-else-if="item.type === 'select'"
                  size="small"
                  class="select-input"
                  :value="asInputValue(item.key)"
                  :options="(item as SelectConfigItem).options"
                  @update:value="(v: string | number) => $emit('update:field', item.key, v)"
                />
              </template>
            </template>
          </template>

          <div v-else class="inspector-empty">
            <a-empty description="选择画布中的字段以配置属性" />
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="schema" tab="Schema">
        <div class="schema-pane">
          <div class="schema-summary">
            <a-tag color="blue">共 {{ fieldCount }} 个字段</a-tag>
            <a-tag color="red">必填 {{ requiredCount }} 个</a-tag>
            <a-tag color="orange">说明 {{ titleCount }} 个</a-tag>
          </div>
          <pre class="schema-preview">{{ schemaJson }}</pre>
        </div>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { type FieldOption, type TemplateField } from '../../../types';

interface BaseConfigItem {
  key: string;
  label: string;
  type: string;
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

type ConfigItem = BaseConfigItem | SelectConfigItem | NumberConfigItem;

const props = defineProps<{
  field: TemplateField | undefined;
  fieldCount: number;
  requiredCount: number;
  titleCount: number;
  schemaJson: string;
  typeLabel: string;
  configItems: ConfigItem[];
  fieldOptions: FieldOption[];
}>();

defineEmits<{
  'update:field': [key: string, value: unknown];
  'update:option': [index: number, key: string, value: string];
  'add:option': [];
  'remove:option': [index: number];
  delete: [fieldId: string];
}>();

const activeTab = ref('config');

function asInputString(key: string): string {
  const val = (props.field as Record<string, unknown> | undefined)?.[key];
  return val != null ? String(val) : '';
}

function asInputNumber(key: string): number | undefined {
  const val = (props.field as Record<string, unknown> | undefined)?.[key];
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : undefined;
}

function asInputValue(key: string): unknown {
  return (props.field as Record<string, unknown> | undefined)?.[key];
}
</script>

<style scoped>
.inspector-card,
.inspector-card :deep(.ant-card) {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.inspector-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.inspector-pane {
  padding: 12px 16px 16px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.inspector-title {
  margin-bottom: 0;
}

.compact-divider {
  margin-block: 8px;
}

.config-item {
  margin-bottom: 10px;
}

.config-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block: 4px;
}

.config-item :deep(.ant-typography) {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
}

.options-editor {
  margin-top: 6px;
}

.option-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.number-input,
.select-input {
  width: 100%;
}

.inspector-empty {
  padding: 40px 16px;
}

.schema-pane {
  padding: 12px 16px;
}

.schema-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.schema-preview {
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  background: #f8fafd;
  border: 1px solid var(--lh-border);
  border-radius: 6px;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
