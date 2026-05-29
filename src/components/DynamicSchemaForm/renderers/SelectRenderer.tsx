import { Select } from 'antd';
import type { FieldRendererContext } from '../types';
import type { SelectField } from '../../../types';

const renderer = ({ field, readonly, value, onChange }: FieldRendererContext) => {
  const f = field as SelectField;
  return (
    <Select
      placeholder={f.placeholder}
      showSearch={f.searchable}
      mode={f.multiple ? 'multiple' : undefined}
      disabled={readonly}
      value={value as string | string[]}
      onChange={(vals) => onChange(vals)}
      options={f.options.map((o) => ({ label: o.label, value: o.value }))}
    />
  );
};

export default renderer;