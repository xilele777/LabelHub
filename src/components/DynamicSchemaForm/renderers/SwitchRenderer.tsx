import { Switch } from 'antd';
import type { FieldRendererContext } from '../types';
import type { SwitchField } from '../../../types';

const renderer = ({ field, readonly, value, onChange }: FieldRendererContext) => {
  const f = field as SwitchField;
  return (
    <Switch
      disabled={readonly}
      checkedChildren={f.checkedChildren}
      unCheckedChildren={f.unCheckedChildren}
      checked={value as boolean}
      onChange={(checked) => onChange(checked)}
    />
  );
};

export default renderer;