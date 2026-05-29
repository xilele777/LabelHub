// placeholder
import { useEffect } from 'react';
import { Form, Input, Radio, Checkbox, Select, Rate, Switch, Typography, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import {
  FieldType,
  type TemplateField,
  type InputField,
  type TextareaField,
  type RadioField,
  type CheckboxField,
  type SelectField,
  type RatingField,
  type SwitchField,
  type TitleField,
} from '../../../types';

const { TextArea } = Input;
const { Title: AntTitle, Text, Paragraph } = Typography;

interface DynamicFormRendererProps {
  fields: TemplateField[];
  form: FormInstance;
  initialValues?: Record<string, unknown>;
}

/** 根据 schema 字段类型渲染对应的表单控件 */
function renderFormControl(field: TemplateField) {
  switch (field.type) {
    case FieldType.INPUT: {
      const f = field as InputField;
      return <Input placeholder={f.placeholder} maxLength={f.maxLength} showCount={!!f.maxLength} />;
    }
    case FieldType.TEXTAREA: {
      const f = field as TextareaField;
      return (
        <TextArea
          placeholder={f.placeholder}
          maxLength={f.maxLength}
          showCount={!!f.maxLength}
          autoSize={f.autoSize ? { minRows: 3 } : undefined}
        />
      );
    }
    case FieldType.RADIO: {
      const f = field as RadioField;
      return (
        <Radio.Group
          optionType="default"
          style={{ flexDirection: f.direction === 'vertical' ? 'column' : 'row', display: 'flex', gap: 8 }}
          options={f.options.map((o) => ({ label: o.label, value: o.value }))}
        />
      );
    }
    case FieldType.CHECKBOX: {
      const f = field as CheckboxField;
      return (
        <Checkbox.Group
          options={f.options.map((o) => ({ label: o.label, value: o.value }))}
        />
      );
    }
    case FieldType.SELECT: {
      const f = field as SelectField;
      return (
        <Select
          placeholder={f.placeholder}
          showSearch={f.searchable}
          mode={f.multiple ? 'multiple' : undefined}
          options={f.options.map((o) => ({ label: o.label, value: o.value }))}
        />
      );
    }
    case FieldType.RATING: {
      const f = field as RatingField;
      return <Rate count={f.maxScore} allowHalf={f.allowHalf} />;
    }
    case FieldType.SWITCH: {
      const f = field as SwitchField;
      return (
        <Switch
          checkedChildren={f.checkedChildren}
          unCheckedChildren={f.unCheckedChildren}
        />
      );
    }
    case FieldType.TITLE:
      return null;
    default:
      return null;
  }
}

/** 渲染单个字段的 FormItem 或纯展示块 */
function renderField(field: TemplateField) {
  if (field.type === FieldType.TITLE) {
    const f = field as TitleField;
    return (
      <div key={field.id} style={{ marginBottom: 24 }}>
        <AntTitle level={f.level ?? 4} style={{ marginBottom: 4 }}>{f.label}</AntTitle>
        {f.content && <Paragraph>{f.content}</Paragraph>}
        {f.description && <Text type="secondary">{f.description}</Text>}
      </div>
    );
  }

  const labelNode = field.description ? (
    <span>
      {field.label}{field.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}{' '}
      <Tooltip title={field.description}>
        <QuestionCircleOutlined style={{ color: '#999', fontSize: 12 }} />
      </Tooltip>
    </span>
  ) : (
    field.label
  );

  return (
    <Form.Item
      key={field.id}
      name={field.fieldKey}
      label={labelNode}
      valuePropName={field.type === FieldType.SWITCH ? 'checked' : 'value'}
      initialValue={field.type === FieldType.CHECKBOX ? [] : undefined}
      rules={[
        {
          required: !!field.required,
          message: `请填写${field.label}`,
        },
      ]}
    >
      {renderFormControl(field)}
    </Form.Item>
  );
}

export default function DynamicFormRenderer({ fields, form, initialValues }: DynamicFormRendererProps) {
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  return <>{fields.map(renderField)}</>;
}
