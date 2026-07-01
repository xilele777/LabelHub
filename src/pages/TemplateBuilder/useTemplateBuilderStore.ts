import { computed, ref, shallowReactive, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  FieldType,
  TaskType,
  type CheckboxField,
  type FieldOption,
  type InputField,
  type RadioField,
  type RatingField,
  type SelectField,
  type SwitchField,
  type TemplateField,
  type TextareaField,
  type TitleField,
} from '../../types';
import * as templateApi from '../../api/template';
import { clearSchemaCache } from '../../utils/templateSchemaHelper';

export { FieldType, TaskType };
export type {
  CheckboxField,
  FieldOption,
  InputField,
  RadioField,
  RatingField,
  SelectField,
  SwitchField,
  TemplateField,
  TextareaField,
  TitleField,
};

export type TemplateBuilderMode = 'create' | 'edit';

export interface TemplateMeta {
  name: string;
  description: string;
  type: TaskType;
}

export interface TemplateBuilderState {
  fields: TemplateField[];
  selectedFieldId: string | null;
  templateId: string | null;
  mode: TemplateBuilderMode;
  templateMeta: TemplateMeta;
  loading: boolean;
  saving: boolean;
}

let fieldSeq = 0;
let optSeq = 0;

function nextId(): string {
  fieldSeq += 1;
  return `field_${Date.now().toString(36)}_${fieldSeq}`;
}

function nextOptId(): string {
  optSeq += 1;
  return `opt_${Date.now().toString(36)}_${optSeq}`;
}

function makeOption(label: string, value: string): FieldOption {
  return { id: nextOptId(), label, value };
}

function defaultFieldKey(type: FieldType): string {
  return `${type}_${fieldSeq}`;
}

export function createDefaultField(type: FieldType): TemplateField {
  const id = nextId();
  const base = {
    id,
    fieldKey: defaultFieldKey(type),
    label: '',
    required: false,
    placeholder: '',
    description: '',
  };

  switch (type) {
    case FieldType.INPUT:
      return { ...base, type, label: '单行输入', placeholder: '请输入', maxLength: 200 } satisfies InputField;
    case FieldType.TEXTAREA:
      return { ...base, type, label: '多行文本', placeholder: '请输入', autoSize: true } satisfies TextareaField;
    case FieldType.RADIO:
      return {
        ...base,
        type,
        label: '单选',
        options: [makeOption('选项1', 'opt1'), makeOption('选项2', 'opt2')],
        direction: 'vertical',
      } satisfies RadioField;
    case FieldType.CHECKBOX:
      return {
        ...base,
        type,
        label: '多选',
        options: [makeOption('选项1', 'opt1'), makeOption('选项2', 'opt2')],
        direction: 'horizontal',
      } satisfies CheckboxField;
    case FieldType.SELECT:
      return {
        ...base,
        type,
        label: '下拉选择',
        placeholder: '请选择',
        options: [makeOption('选项1', 'opt1'), makeOption('选项2', 'opt2')],
        searchable: false,
      } satisfies SelectField;
    case FieldType.RATING:
      return { ...base, type, label: '评分', maxScore: 5, allowHalf: false } satisfies RatingField;
    case FieldType.SWITCH:
      return {
        ...base,
        type,
        label: '开关',
        defaultValue: false,
        checkedChildren: '是',
        unCheckedChildren: '否',
      } satisfies SwitchField;
    case FieldType.TITLE:
      return {
        ...base,
        type,
        fieldKey: '',
        label: '说明标题',
        content: '',
        description: '说明文字',
        level: 4,
      } satisfies TitleField;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

const DEFAULT_META: TemplateMeta = {
  name: '新建模板',
  description: '',
  type: TaskType.IMAGE_CLASSIFICATION,
};

const useTemplateBuilderPiniaStore = defineStore('templateBuilder', () => {
  const fieldIds = shallowRef<string[]>([]);
  const fieldsById = shallowReactive<Record<string, TemplateField>>({});
  const selectedFieldId = ref<string | null>(null);
  const templateId = ref<string | null>(null);
  const mode = ref<TemplateBuilderMode>('create');
  const templateMeta = ref<TemplateMeta>({ ...DEFAULT_META });
  const loading = ref(false);
  const saving = ref(false);

  const fields = computed<TemplateField[]>(() =>
    fieldIds.value.map((id) => fieldsById[id]).filter((field): field is TemplateField => Boolean(field)),
  );
  const selectedField = computed(() => (selectedFieldId.value ? fieldsById[selectedFieldId.value] ?? null : null));
  const fieldCount = computed(() => fieldIds.value.length);
  const isEditMode = computed(() => mode.value === 'edit');

  function replaceFields(nextFields: TemplateField[], clearSelection = true): void {
    Object.keys(fieldsById).forEach((id) => {
      delete fieldsById[id];
    });

    const nextIds: string[] = [];
    nextFields.forEach((field) => {
      fieldsById[field.id] = field;
      nextIds.push(field.id);
    });
    fieldIds.value = nextIds;

    if (clearSelection || (selectedFieldId.value && !fieldsById[selectedFieldId.value])) {
      selectedFieldId.value = null;
    }
  }

  function hasSameFieldSet(nextFields: TemplateField[]): boolean {
    if (nextFields.length !== fieldIds.value.length) return false;
    return nextFields.every((field) => Boolean(fieldsById[field.id]));
  }

  function addField(type: FieldType): void {
    const field = createDefaultField(type);
    fieldsById[field.id] = field;
    fieldIds.value = [...fieldIds.value, field.id];
    selectedFieldId.value = field.id;
  }

  function removeField(id: string): void {
    delete fieldsById[id];
    fieldIds.value = fieldIds.value.filter((fieldId) => fieldId !== id);
    if (selectedFieldId.value === id) {
      selectedFieldId.value = null;
    }
  }

  function selectField(id: string | null): void {
    selectedFieldId.value = id;
  }

  function updateField(id: string, updates: Partial<TemplateField>): void {
    const current = fieldsById[id];
    if (!current) return;
    fieldsById[id] = { ...current, ...updates } as TemplateField;
  }

  function moveField(fromIndex: number, toIndex: number): void {
    const nextIds = [...fieldIds.value];
    const [removed] = nextIds.splice(fromIndex, 1);
    if (!removed) return;
    nextIds.splice(toIndex, 0, removed);
    fieldIds.value = nextIds;
  }

  function loadFields(nextFields: TemplateField[]): void {
    if (hasSameFieldSet(nextFields)) {
      fieldIds.value = nextFields.map((field) => field.id);
      if (selectedFieldId.value && !fieldsById[selectedFieldId.value]) {
        selectedFieldId.value = null;
      }
      return;
    }

    replaceFields(nextFields);
  }

  async function loadTemplate(id: string): Promise<void> {
    loading.value = true;
    templateId.value = id;
    mode.value = 'edit';

    try {
      const res = await templateApi.getTemplate(id);
      const data = res.data;
      templateMeta.value = {
        name: data.name || '',
        description: data.description || '',
        type: data.type || TaskType.IMAGE_CLASSIFICATION,
      };
      replaceFields(data.fields || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载模板失败';
      console.error('[TemplateBuilder] Failed to load template:', message);
    } finally {
      loading.value = false;
    }
  }

  function initCreateMode(): void {
    templateId.value = null;
    mode.value = 'create';
    templateMeta.value = { ...DEFAULT_META };
    replaceFields([]);
  }

  async function saveTemplate(creator?: string): Promise<string> {
    saving.value = true;

    try {
      if (mode.value === 'create' || !templateId.value) {
        const payload = {
          name: templateMeta.value.name || '新建模板',
          description: templateMeta.value.description || '',
          type: templateMeta.value.type,
          fieldCount: fieldCount.value,
          fields: fields.value,
          creator: creator || 'unknown',
        };

        const res = await templateApi.createTemplate(payload);
        templateId.value = res.data.id;
        mode.value = 'edit';
        clearSchemaCache();
        return res.data.id;
      }

      await templateApi.updateTemplate(templateId.value, {
        name: templateMeta.value.name,
        description: templateMeta.value.description,
        type: templateMeta.value.type,
        fieldCount: fieldCount.value,
        fields: fields.value,
      });
      clearSchemaCache();
      return templateId.value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存模板失败';
      console.error('[TemplateBuilder] Failed to save template:', message);
      throw err;
    } finally {
      saving.value = false;
    }
  }

  function setTemplateMeta(meta: Partial<TemplateMeta>): void {
    templateMeta.value = { ...templateMeta.value, ...meta };
  }

  function reset(): void {
    replaceFields([]);
    templateId.value = null;
    mode.value = 'create';
    templateMeta.value = { ...DEFAULT_META };
    loading.value = false;
    saving.value = false;
  }

  return {
    fieldIds,
    fieldsById,
    fields,
    selectedFieldId,
    templateId,
    mode,
    templateMeta,
    loading,
    saving,
    selectedField,
    fieldCount,
    isEditMode,
    addField,
    removeField,
    selectField,
    updateField,
    moveField,
    loadFields,
    loadTemplate,
    initCreateMode,
    saveTemplate,
    setTemplateMeta,
    reset,
  };
});

export type TemplateBuilderStore = ReturnType<typeof useTemplateBuilderPiniaStore>;

interface UseTemplateBuilderStore {
  (): TemplateBuilderStore;
  <T>(selector: (store: TemplateBuilderStore) => T): T;
  getState: () => TemplateBuilderStore;
  setState: (patch: Partial<TemplateBuilderState>) => void;
}

export const useTemplateBuilderStore = ((selector?: (store: TemplateBuilderStore) => unknown) => {
  const store = useTemplateBuilderPiniaStore();
  return selector ? selector(store) : store;
}) as UseTemplateBuilderStore;

useTemplateBuilderStore.getState = () => useTemplateBuilderPiniaStore();
useTemplateBuilderStore.setState = (patch) => {
  const store = useTemplateBuilderPiniaStore();
  const hasPatch = <K extends keyof TemplateBuilderState>(key: K) =>
    Object.prototype.hasOwnProperty.call(patch, key);

  if (hasPatch('fields') && patch.fields) store.loadFields(patch.fields);
  if (hasPatch('selectedFieldId')) store.selectedFieldId = patch.selectedFieldId ?? null;
  if (hasPatch('templateId')) store.templateId = patch.templateId ?? null;
  if (hasPatch('mode') && patch.mode) store.mode = patch.mode;
  if (hasPatch('templateMeta') && patch.templateMeta) store.templateMeta = patch.templateMeta;
  if (hasPatch('loading') && typeof patch.loading === 'boolean') store.loading = patch.loading;
  if (hasPatch('saving') && typeof patch.saving === 'boolean') store.saving = patch.saving;
};
