import { Input } from 'antd';
import type { FieldRendererContext } from '../types';
import type { InputField } from '../../../types';

const renderer = ({ field, readonly, value, onChange }: FieldRendererContext) => {
  const f = field as InputField;
  return (
    <Input
      placeholder={f.placeholder}
      maxLength={f.maxLength}
      showCount={!!f.maxLength}
      readOnly={readonly}
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      style={readonly ? { background: '#fafafa', cursor: 'default' } : undefined}
    />
  );
};

export default renderer;