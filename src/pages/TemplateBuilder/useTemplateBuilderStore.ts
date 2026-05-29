import { create } from 'zustand';
import {
  type TemplateField,
  FieldType,
  type FieldOption,
  type InputField,
  type TextareaField,
  type RadioField,
  type CheckboxField,
  type SelectField,
  type RatingField,
  type SwitchField,
  type TitleField,
  type TaskType,
} from '../../types';
import * as templateApi from '../../api/template';
import { clearSchemaCache } from '../../utils/templateSchemaHelper';

// ========== State ==========

interface TemplateBuilderState {
  /** 画布中的字段列表 */
  fields: TemplateField[];
  /** 当前选中的字段 ID */
  selectedFieldId: string | null;
  /** 当前正在编辑的模板 ID（编辑模式有值，新建模式为 null） */
  templateId: string | null;
  /** 模式：create 新建 / edit 编辑已有模板 */
  mode: 'create' | 'edit';
  /** 模板元信息（name, description, type 等） */
  templateMeta: {
    name: string;
    description: string;
    type: TaskType;
  };
  /** 是否正在加载/保存 */
  loading: boolean;
  /** 保存状态提示 */
  saving: boolean;

  addField: (type: FieldType) => void;
  removeField: (id: string) => void;
  selectField: (id: string | null) => void;
  updateField: (id: string, updates: Partial<TemplateField>) => void;
  moveField: (fromIndex: number, toIndex: number) => void;
  /** 从外部加载字段（导入或编辑已有模板） */
  loadFields: (fields: TemplateField[]) => void;
  /** 根据 ID 从服务端加载模板数据（编辑模式） */
  loadTemplate: (id: string) => Promise<void>;
  /** 初始化新建模式 */
  initCreateMode: () => void;
  /** 保存当前画布字段到服务端（新建用 POST，编辑用 PUT） */
  saveTemplate: (creator?: string) => Promise<string>;
  /** 设置模板元信息 */
  setTemplateMeta: (meta: Partial<{ name: string; description: string; type: TaskType }>) => void;
  /** 重置 store（离开搭建页面时调用） */
  reset: () => void;
}

// ========== Helpers ==========

let fieldSeq = 0;
function nextId(): string {
  return 'field_' + Date.now().toString(36) + '_' + (++fieldSeq);
}
let optSeq = 0;
function nextOptId(): string {
  return 'opt_' + Date.now().toString(36) + '_' + (++optSeq);
}
function makeOption(label: string, value: string): FieldOption {
  return { id: nextOptId(), label, value };
}

function defaultFieldKey(type: FieldType): string {
  return `${type}_${fieldSeq}`;
}

function createDefaultField(type: FieldType): TemplateField {
  const id = nextId();
  const base = { id, fieldKey: defaultFieldKey(type), label: '', required: false, placeholder: '', description: '' };

  switch (type) {
    case FieldType.INPUT:
      return { ...base, type, label: '单行输入', placeholder: '请输入', maxLength: 200 } satisfies InputField;
    case FieldType.TEXTAREA:
      return { ...base, type, label: '多行文本', placeholder: '请输入', autoSize: true } satisfies TextareaField;
    case FieldType.RADIO:
      return { ...base, type, label: '单选', options: [makeOption('选项1', 'opt1'), makeOption('选项2', 'opt2')], direction: 'vertical' } satisfies RadioField;
    case FieldType.CHECKBOX:
      return { ...base, type, label: '多选', options: [makeOption('选项1', 'opt1'), makeOption('选项2', 'opt2')], direction: 'horizontal' } satisfies CheckboxField;
    case FieldType.SELECT:
      return { ...base, type, label: '下拉选择', placeholder: '请选择', options: [makeOption('选项1', 'opt1'), makeOption('选项2', 'opt2')], searchable: false } satisfies SelectField;
    case FieldType.RATING:
      return { ...base, type, label: '评分', maxScore: 5, allowHalf: false } satisfies RatingField;
    case FieldType.SWITCH:
      return { ...base, type, label: '开关', defaultValue: false, checkedChildren: '是', unCheckedChildren: '否' } satisfies SwitchField;
    case FieldType.TITLE:
      return { ...base, type, fieldKey: '', label: '说明标题', content: '', description: '说明文字', level: 4 } satisfies TitleField;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

const DEFAULT_META: { name: string; description: string; type: TaskType } = {
  name: '新建模板',
  description: '',
  type: 'image_classification' as TaskType,
};

// ========== Store ==========

export const useTemplateBuilderStore = create<TemplateBuilderState>()((set, get) => ({
  fields: [],
  selectedFieldId: null,
  templateId: null,
  mode: 'create',
  templateMeta: { ...DEFAULT_META },
  loading: false,
  saving: false,

  addField(type) {
    const field = createDefaultField(type);
    set((state) => ({
      fields: [...state.fields, field],
      selectedFieldId: field.id,
    }));
  },

  removeField(id) {
    set((state) => ({
      fields: state.fields.filter((f) => f.id !== id),
      selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
    }));
  },

  selectField(id) {
    set({ selectedFieldId: id });
  },

  updateField(id, updates) {
    set((state) => ({
      fields: state.fields.map((f) =>
        f.id === id ? ({ ...f, ...updates } as TemplateField) : f,
      ),
    }));
  },

  moveField(fromIndex, toIndex) {
    set((state) => {
      const next = [...state.fields];
      const removed = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed[0]!);
      return { fields: next };
    });
  },

  loadFields(fields) {
    set({ fields, selectedFieldId: null });
  },

  async loadTemplate(id) {
    set({ loading: true, templateId: id, mode: 'edit' });
    try {
      const res = await templateApi.getTemplate(id);
      const data = res.data as any; // TemplateItem with fields
      set({
        templateMeta: {
          name: data.name || '',
          description: data.description || '',
          type: data.type || 'image_classification',
        },
        fields: data.fields || [],
        selectedFieldId: null,
        loading: false,
      });
    } catch (err: any) {
      console.error('[TemplateBuilder] Failed to load template:', err?.message);
      set({ loading: false });
    }
  },

  initCreateMode() {
    set({
      templateId: null,
      mode: 'create',
      templateMeta: { ...DEFAULT_META },
      fields: [],
      selectedFieldId: null,
    });
  },

  async saveTemplate(creator?: string) {
    const { templateId, fields, templateMeta, mode } = get();
    set({ saving: true });
    try {
      if (mode === 'create' || !templateId) {
        // 新建模式：POST 创建模板
        const payload = {
          name: templateMeta.name || '新建模板',
          description: templateMeta.description || '',
          type: templateMeta.type,
          fieldCount: fields.length,
          fields,
          creator: creator || 'unknown',
        };
        const res = await templateApi.createTemplate(payload);
        const created = res.data;
        // 创建成功后切换为编辑模式，后续保存走 PUT
        set({
          templateId: created.id,
          mode: 'edit',
          saving: false,
        });
        clearSchemaCache();
        return created.id;
      } else {
        // 编辑模式：PUT 更新模板
        const updates = {
          name: templateMeta.name,
          description: templateMeta.description,
          type: templateMeta.type,
          fieldCount: fields.length,
          fields,
        };
        await templateApi.updateTemplate(templateId, updates);
        clearSchemaCache();
        set({ saving: false });
        return templateId;
      }
    } catch (err: any) {
      console.error('[TemplateBuilder] Failed to save template:', err?.message);
      set({ saving: false });
      throw err;
    }
  },

  setTemplateMeta(meta) {
    set((state) => ({
      templateMeta: { ...state.templateMeta, ...meta },
    }));
  },

  reset() {
    set({
      fields: [],
      selectedFieldId: null,
      templateId: null,
      mode: 'create',
      templateMeta: { ...DEFAULT_META },
      loading: false,
      saving: false,
    });
  },
}));
