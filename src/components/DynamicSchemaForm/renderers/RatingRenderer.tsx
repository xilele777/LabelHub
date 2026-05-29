import { Rate } from 'antd';
import type { FieldRendererContext } from '../types';
import type { RatingField } from '../../../types';

const renderer = ({ field, readonly, value, onChange }: FieldRendererContext) => {
  const f = field as RatingField;
  return (
    <Rate
      count={f.maxScore}
      allowHalf={f.allowHalf}
      disabled={readonly}
      value={value as number}
      onChange={(val) => onChange(val)}
    />
  );
};

export default renderer;