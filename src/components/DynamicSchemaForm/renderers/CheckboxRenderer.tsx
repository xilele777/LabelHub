import { Checkbox, Space } from 'antd';
import type { FieldRendererContext } from '../types';
import type { CheckboxField } from '../../../types';

const renderer = ({ field, readonly, value, onChange }: FieldRendererContext) => {
  const f = field as CheckboxField;
  // Checkbox.Group requires value to be an array; fallback to [] for undefined/non-array values
  const checkedValues = Array.isArray(value) ? value : [];
  return (
    <Checkbox.Group
      disabled={readonly}
      value={checkedValues}
      onChange={(vals) => onChange(vals)}
    >
      <Space direction={f.direction === 'vertical' ? 'vertical' : 'horizontal'}>
        {f.options.map((opt) => (
          <Checkbox key={opt.id || opt.value} value={opt.value}>{opt.label}</Checkbox>
        ))}
      </Space>
    </Checkbox.Group>
  );
};

export default renderer;
