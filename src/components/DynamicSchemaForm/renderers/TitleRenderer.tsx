import { Typography } from 'antd';
import type { FieldRendererContext } from '../types';
import type { TitleField } from '../../../types';

const { Title: AntTitle, Text, Paragraph } = Typography;

const renderer = ({ field }: FieldRendererContext) => {
  const f = field as TitleField;
  return (
    <div style={{ marginBottom: 24 }}>
      <AntTitle level={f.level ?? 4} style={{ marginBottom: 4 }}>{f.label}</AntTitle>
      {f.content && <Paragraph>{f.content}</Paragraph>}
      {f.description && <Text type='secondary'>{f.description}</Text>}
    </div>
  );
};

export default renderer;