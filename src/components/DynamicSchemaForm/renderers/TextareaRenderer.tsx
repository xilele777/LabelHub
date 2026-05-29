import { Input } from 'antd';
import type { FieldRendererContext } from '../types';
import type { TextareaField } from '../../../types';

const renderer = ({ field, readonly, value, onChange }: FieldRendererContext) => {
  const f = field as TextareaField;
  return (
    <Input.TextArea
      placeholder={f.placeholder}
      maxLength={f.maxLength}
      showCount={!!f.maxLength}
      autoSize={f.autoSize ? { minRows: 3 } : undefined}
      readOnly={readonly}
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      style={readonly ? { background: '#fafafa', cursor: 'default' } : undefined}
    />
  );
};

export default renderer;