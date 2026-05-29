import { useCallback, useMemo, memo } from 'react';
import { Typography, Input, Switch, InputNumber, Select, Button, Divider, Empty } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  type TemplateField,
  type FieldOption,
  FieldType,
} from '../../../types';
import { useTemplateBuilderStore } from '../useTemplateBuilderStore';
import { fieldTypeLabelMap } from './FieldPalette';

const { Text, Title: AntTitle } = Typography;
const { TextArea } = Input;

// ============================================================
// 1. 配置项描述符 — 声明式映射，驱动面板渲染
// ============================================================

type ConfigItemType = 'text' | 'textarea' | 'switch' | 'number' | 'select' | 'options';

interface BaseConfigItem {
  key: string;                          // 对应字段上的属性名
  label: string;                        // 面板上显示的标签
  type: ConfigItemType;
}

interface TextConfigItem extends BaseConfigItem { type: 'text'; placeholder?: string }
interface TextareaConfigItem extends BaseConfigItem { type: 'textarea'; placeholder?: string }
interface SwitchConfigItem extends BaseConfigItem { type: 'switch' }
interface NumberConfigItem extends BaseConfigItem { type: 'number'; min?: number; max?: number; placeholder?: string }
interface SelectConfigItem extends BaseConfigItem {
  type: 'select';
  options: { label: string; value: string | number }[];
}
interface OptionsConfigItem extends BaseConfigItem { type: 'options' }

type ConfigItem =
  | TextConfigItem
  | TextareaConfigItem
  | SwitchConfigItem
  | NumberConfigItem
  | SelectConfigItem
  | OptionsConfigItem;

/**
 * 字段类型 → 配置项列表的映射
 *
 * 通用属性 (label / fieldKey / required / description) 按 visible 控制：
 *   - title  不显示 required / placeholder
 *   - 其余类型全部显示
 *
 * 专属属性按类型追加
 */
const FIELD_CONFIG_MAP: Record<FieldType, ConfigItem[]> = {
  [FieldType.INPUT]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如: category' },
    { key: 'label',    label: '标题 (label)',         type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)',       type: 'switch' },
    { key: 'placeholder', label: '占位提示 (placeholder)', type: 'text', placeholder: '请输入' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'maxLength', label: '最大长度 (maxLength)', type: 'number', min: 1, placeholder: '200' },
  ],
  [FieldType.TEXTAREA]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如: content' },
    { key: 'label',    label: '标题 (label)',         type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)',       type: 'switch' },
    { key: 'placeholder', label: '占位提示 (placeholder)', type: 'text', placeholder: '请输入' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'autoSize', label: '自适应高度 (autoSize)', type: 'switch' },
  ],
  [FieldType.RADIO]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如: gender' },
    { key: 'label',    label: '标题 (label)',         type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)',       type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'options',  label: '选项列表 (options)',   type: 'options' },
    { key: 'direction', label: '排列方向',             type: 'select', options: [{ label: '竖直', value: 'vertical' }, { label: '水平', value: 'horizontal' }] },
  ],
  [FieldType.CHECKBOX]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如: tags' },
    { key: 'label',    label: '标题 (label)',         type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)',       type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'options',  label: '选项列表 (options)',   type: 'options' },
    { key: 'direction', label: '排列方向',             type: 'select', options: [{ label: '竖直', value: 'vertical' }, { label: '水平', value: 'horizontal' }] },
    { key: 'maxCheck', label: '最多可选数 (maxCheck)',  type: 'number', min: 1 },
  ],
  [FieldType.SELECT]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如: city' },
    { key: 'label',    label: '标题 (label)',         type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)',       type: 'switch' },
    { key: 'placeholder', label: '占位提示 (placeholder)', type: 'text', placeholder: '请选择' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'options',   label: '选项列表 (options)',   type: 'options' },
    { key: 'searchable', label: '可搜索 (searchable)',  type: 'switch' },
  ],
  [FieldType.RATING]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如: score' },
    { key: 'label',    label: '标题 (label)',         type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)',       type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'maxScore', label: '最高分 (maxScore)',     type: 'number', min: 1, max: 10, placeholder: '5' },
    { key: 'allowHalf', label: '允许半选 (allowHalf)', type: 'switch' },
  ],
  [FieldType.SWITCH]: [
    { key: 'fieldKey', label: '字段标识 (fieldKey)', type: 'text', placeholder: '如: enabled' },
    { key: 'label',    label: '标题 (label)',         type: 'text', placeholder: '字段标题' },
    { key: 'required', label: '必填 (required)',       type: 'switch' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'defaultValue',       label: '默认值 (defaultValue)',       type: 'switch' },
    { key: 'checkedChildren',     label: '开启文字 (checkedChildren)',   type: 'text', placeholder: '是' },
    { key: 'unCheckedChildren',   label: '关闭文字 (unCheckedChildren)', type: 'text', placeholder: '否' },
  ],
  [FieldType.TITLE]: [
    { key: 'fieldKey',   label: '字段标识 (fieldKey)',   type: 'text', placeholder: '如: section1' },
    { key: 'label',      label: '标题 (label)',           type: 'text', placeholder: '说明标题' },
    { key: 'content',    label: '说明正文 (content)',     type: 'textarea', placeholder: '说明内容' },
    { key: 'description', label: '补充说明 (description)', type: 'textarea', placeholder: '可选' },
    // 专属
    { key: 'level', label: '标题级别 (level)', type: 'select', options: [1, 2, 3, 4, 5].map(n => ({ label: `H${n}`, value: n })) },
  ],
};

// ============================================================
// 2. OptionsEditor — 选项编辑器 (memo 避免非选项变更时重渲染)
// ============================================================

const OptionsEditor = memo(function OptionsEditor({
  options,
  onChange,
}: {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
}) {
  const handleChange = useCallback(
    (index: number, key: 'label' | 'value', val: string) => {
      const next = [...options];
      next[index] = { ...next[index]!, [key]: val };
      onChange(next);
    },
    [options, onChange],
  );

  const handleAdd = useCallback(() => {
    const idx = options.length + 1;
    const id = 'opt_' + Date.now().toString(36) + '_' + idx;
    onChange([...options, { id, label: `选项${idx}`, value: `opt${idx}` }]);
  }, [options, onChange]);

  const handleRemove = useCallback(
    (index: number) => onChange(options.filter((_, i) => i !== index)),
    [options, onChange],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {options.map((opt, i) => (
        <div key={opt.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Input
            size="small"
            placeholder="标签"
            value={opt.label}
            onChange={(e) => handleChange(i, 'label', e.target.value)}
            style={{ flex: 1 }}
          />
          <Input
            size="small"
            placeholder="值"
            value={opt.value}
            onChange={(e) => handleChange(i, 'value', e.target.value)}
            style={{ flex: 1 }}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemove(i)}
          />
        </div>
      ))}
      <Button
        size="small"
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ width: '100%' }}
      >
        添加选项
      </Button>
    </div>
  );
});

// ============================================================
// 3. ConfigItemRenderer — 单个配置项渲染器（类型安全）
// ============================================================

function ConfigItemRenderer({
  item,
  value,
  onChange,
}: {
  item: ConfigItem;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
  switch (item.type) {
    case 'text':
      return (
        <Input
          size="small"
          placeholder={item.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(item.key, e.target.value)}
          style={{ marginTop: 4 }}
        />
      );
    case 'textarea':
      return (
        <TextArea
          size="small"
          placeholder={item.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(item.key, e.target.value)}
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ marginTop: 4 }}
        />
      );
    case 'switch':
      return (
        <Switch
          size="small"
          checked={!!value}
          onChange={(v) => onChange(item.key, v)}
        />
      );
    case 'number':
      return (
        <InputNumber
          size="small"
          min={item.min}
          max={item.max}
          placeholder={item.placeholder}
          value={(value as number) ?? undefined}
          onChange={(v) => onChange(item.key, v ?? undefined)}
          style={{ marginTop: 4, width: '100%' }}
        />
      );
    case 'select':
      return (
        <Select
          size="small"
          value={value as string | number}
          onChange={(v) => onChange(item.key, v)}
          style={{ marginTop: 4, width: '100%' }}
          options={item.options}
        />
      );
    case 'options':
      // options 类型由 OptionsEditor 单独处理，不会走到这里
      return null;
  }
}

// ============================================================
// 4. FieldConfigPanel — 主面板
// ============================================================

/** 类型安全的字段值读取 — 按照 key 从具体字段类型中提取值 */
function getFieldProp(field: TemplateField, key: string): unknown {
  return (field as unknown as Record<string, unknown>)[key];
}

export default function FieldConfigPanel() {
  /* --- 精细 selector：只在相关切片变化时重渲染 --- */
  const field = useTemplateBuilderStore(
    useCallback(
      (s) => s.fields.find((f) => f.id === s.selectedFieldId) ?? null,
      [],
    ),
  );
  const updateField = useTemplateBuilderStore((s) => s.updateField);
  const removeField = useTemplateBuilderStore((s) => s.removeField);
  const selectField = useTemplateBuilderStore((s) => s.selectField);

  /* --- 根据 field.type 查找配置项列表 --- */
  const configItems = useMemo<ConfigItem[]>(
    () => (field ? FIELD_CONFIG_MAP[field.type] : []),
    [field],
  );

  /* --- 通用更新 — 只更新单个 key，避免对象展开产生多余属性 --- */
  const handleChange = useCallback(
    (key: string, val: unknown) => {
      if (!field) return;
      updateField(field.id, { [key]: val } as Partial<TemplateField>);
    },
    [field, updateField],
  );

  /* --- 选项专用更新 --- */
  const handleOptionsChange = useCallback(
    (options: FieldOption[]) => {
      if (!field) return;
      updateField(field.id, { options } as Partial<TemplateField>);
    },
    [field, updateField],
  );

  /* --- 空状态 --- */
  if (!field) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="选择字段以配置属性" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <AntTitle level={5} style={{ margin: 0 }}>
          {fieldTypeLabelMap[field.type]} 配置
        </AntTitle>
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            removeField(field.id);
            selectField(null);
          }}
        >
          删除
        </Button>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* 动态渲染配置项 */}
      {configItems.map((item) => {
        // options 类型走 OptionsEditor 分支
        if (item.type === 'options') {
          const optionsField = field as TemplateField & { options: FieldOption[] };
          return (
            <div key={item.key}>
              <Divider style={{ margin: '4px 0' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{item.label}</Text>
              <OptionsEditor
                options={optionsField.options}
                onChange={handleOptionsChange}
              />
            </div>
          );
        }

        // switch 类型：行内布局（标签 + 开关）
        if (item.type === 'switch') {
          return (
            <div
              key={item.key}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>{item.label}</Text>
              <ConfigItemRenderer
                item={item}
                value={getFieldProp(field, item.key)}
                onChange={handleChange}
              />
            </div>
          );
        }

        // 其余类型：标签在上，控件在下
        return (
          <div key={item.key}>
            <Text type="secondary" style={{ fontSize: 12 }}>{item.label}</Text>
            <ConfigItemRenderer
              item={item}
              value={getFieldProp(field, item.key)}
              onChange={handleChange}
            />
          </div>
        );
      })}
    </div>
  );
}
