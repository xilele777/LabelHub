import { Card, Typography } from 'antd';
import {
  FormOutlined,
  AlignLeftOutlined,
  AudioOutlined,
  CheckSquareOutlined,
  DownCircleOutlined,
  StarOutlined,
  SwapOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { FieldType } from '../../../types';
import { useTemplateBuilderStore } from '../useTemplateBuilderStore';

const { Text } = Typography;

interface PaletteItem {
  type: FieldType;
  label: string;
  icon: React.ReactNode;
}

const paletteItems: PaletteItem[] = [
  { type: FieldType.INPUT, label: '单行输入', icon: <FormOutlined /> },
  { type: FieldType.TEXTAREA, label: '多行文本', icon: <AlignLeftOutlined /> },
  { type: FieldType.RADIO, label: '单选', icon: <AudioOutlined /> },
  { type: FieldType.CHECKBOX, label: '多选', icon: <CheckSquareOutlined /> },
  { type: FieldType.SELECT, label: '下拉选择', icon: <DownCircleOutlined /> },
  { type: FieldType.RATING, label: '评分', icon: <StarOutlined /> },
  { type: FieldType.SWITCH, label: '开关', icon: <SwapOutlined /> },
  { type: FieldType.TITLE, label: '说明块', icon: <ReadOutlined /> },
];

/** 字段类型 → 中文标签映射（供其他组件复用） */
export const fieldTypeLabelMap: Record<FieldType, string> = Object.fromEntries(
  paletteItems.map((item) => [item.type, item.label]),
) as Record<FieldType, string>;

/** 左侧：字段组件面板 */
export default function FieldPalette() {
  const addField = useTemplateBuilderStore((s) => s.addField);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
        点击添加字段
      </Text>
      {paletteItems.map((item) => (
        <Card
          key={item.type}
          hoverable
          size="small"
          style={{ cursor: 'pointer' }}
          onClick={() => addField(item.type)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.icon}
            <Text>{item.label}</Text>
          </div>
        </Card>
      ))}
    </div>
  );
}
