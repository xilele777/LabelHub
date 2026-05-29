import { useCallback, useMemo } from 'react';
import { Form, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { FieldType, type TemplateField } from '../../types';
import type { FieldRendererRegistry } from './types';
import builtinRegistry from './registry';

export type { FieldRenderer, FieldRendererContext, FieldRendererRegistry } from './types';
export { registerRenderer } from './types';

export interface DynamicSchemaFormProps {
  /** 模板 schema 字段列表 */
  schema: TemplateField[];
  /** 当前表单值 */
  value: Record<string, unknown>;
  /** 值变化回调 */
  onChange: (values: Record<string, unknown>) => void;
  /** 是否只读模式 */
  readonly?: boolean;
  /** 自定义渲染器注册表，会与内置注册表合并，同类型时覆盖内置 */
  customRenderers?: FieldRendererRegistry;
  /** 表单布局 */
  layout?: 'horizontal' | 'vertical';
}

export default function DynamicSchemaForm({
  schema,
  value,
  onChange,
  readonly = false,
  customRenderers,
}: DynamicSchemaFormProps) {
  const registry = useMemo(
    () => ({ ...builtinRegistry, ...customRenderers }),
    [customRenderers],
  );

  const handleChange = useCallback(
    (fieldKey: string, fieldValue: unknown) => {
      onChange({ ...value, [fieldKey]: fieldValue });
    },
    [value, onChange],
  );

  return (
    <div>
      {schema.map((field) => {
        // Title 字段直接渲染，不包 Form.Item
        if (field.type === FieldType.TITLE) {
          const renderer = registry[field.type];
          if (!renderer) return null;
          return (
            <div key={field.id}>
              {renderer({
                field,
                readonly,
                value: undefined,
                onChange: () => {},
              })}
            </div>
          );
        }

        const renderer = registry[field.type];
        if (!renderer) return null;

        const labelNode = field.description ? (
          <span>
            {field.label}
            {field.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}{' '}
            <Tooltip title={field.description}>
              <QuestionCircleOutlined style={{ color: '#999', fontSize: 12 }} />
            </Tooltip>
          </span>
        ) : (
          <span>
            {field.label}
            {field.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
          </span>
        );

        return (
          <Form.Item
            key={field.id}
            label={labelNode}
            required={false}
            style={{ marginBottom: 16 }}
          >
            {renderer({
              field,
              readonly,
              value: value[field.fieldKey],
              onChange: (v) => handleChange(field.fieldKey, v),
            })}
          </Form.Item>
        );
      })}
    </div>
  );
}
