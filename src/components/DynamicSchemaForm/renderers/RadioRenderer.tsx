import { Radio, Space } from 'antd';
import type { FieldRendererContext } from '../types';
import type { RadioField } from '../../../types';

const renderer = ({ field, readonly, value, onChange }: FieldRendererContext) => {
  const f = field as RadioField;
  return (
    <Radio.Group
      disabled={readonly}
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      style={{ flexDirection: f.direction === 'vertical' ? 'column' : 'row', display: 'flex', gap: 8 }}
    >
      <Space direction={f.direction === 'vertical' ? 'vertical' : 'horizontal'}>
        {f.options.map((opt) => (
          <Radio key={opt.id || opt.value} value={opt.value}>{opt.label}</Radio>
        ))}
      </Space>
    </Radio.Group>
  );
};

export default renderer;