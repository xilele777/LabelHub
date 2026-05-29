import { Card, Descriptions, Typography, Tag, Space } from 'antd';
import {
  FileImageOutlined,
  FormOutlined,
  LockOutlined,
} from '@ant-design/icons';
import type { DataItem } from '../../../types';
import { useTaskStore } from '../../../store/useTaskStore';
import { getTemplateSchema } from '../../../utils/templateSchemaHelper';
import type { AnnotationTemplate } from '../../../types';

const { Text, Paragraph } = Typography;

interface ReviewContentPanelProps {
  dataItem: DataItem | null;
}

/** 将标注数据按照模板字段定义格式化展示 */
function AnnotationDisplay({ data, template }: { data: Record<string, unknown>; template: AnnotationTemplate }) {
  return (
    <div>
      {template.fields
        .filter((f) => f.fieldKey) // 跳过 TITLE 类型
        .map((field) => {
          const value = data[field.fieldKey];
          if (value === undefined || value === null || value === '') return null;

          const displayValue = formatFieldValue(field, value);

          return (
            <div
              key={field.id}
              style={{
                marginBottom: 12,
                padding: '8px 12px',
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {field.label}
                  {field.required && <Text type="danger" style={{ marginLeft: 4 }}>*</Text>}
                </Text>
              </div>
              <div>{displayValue}</div>
            </div>
          );
        })}
    </div>
  );
}

/** 格式化字段值用于只读展示 */
function formatFieldValue(field: AnnotationTemplate['fields'][0], value: unknown): React.ReactNode {
  // 找到选项的 label
  const findOptionLabel = (val: string): string => {
    if ('options' in field) {
      const opt = field.options?.find((o) => o.value === val);
      return opt?.label ?? val;
    }
    return val;
  };

  switch (field.type) {
    case 'radio': {
      const label = findOptionLabel(String(value));
      return <Tag color="blue">{label}</Tag>;
    }
    case 'checkbox': {
      const vals = Array.isArray(value) ? value : [value];
      return (
        <Space wrap>
          {vals.map((v: string) => (
            <Tag key={v} color="cyan">{findOptionLabel(v)}</Tag>
          ))}
        </Space>
      );
    }
    case 'select': {
      const label = findOptionLabel(String(value));
      return <Tag color="geekblue">{label}</Tag>;
    }
    case 'switch':
      return value ? (
        <Tag color="success">{(field as any).checkedChildren ?? '是'}</Tag>
      ) : (
        <Tag color="default">{(field as any).unCheckedChildren ?? '否'}</Tag>
      );
    case 'rating':
      return (
        <Space>
          <Text strong style={{ color: '#faad14', fontSize: 18 }}>{String(value)}</Text>
          <Text type="secondary">/ {field.maxScore ?? 5}</Text>
        </Space>
      );
    case 'textarea':
      return <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{String(value)}</Paragraph>;
    default:
      return <Text>{String(value)}</Text>;
  }
}

export default function ReviewContentPanel({ dataItem }: ReviewContentPanelProps) {
  const tasks = useTaskStore((s) => s.tasks);

  if (!dataItem) {
    return (
      <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' } }}>
        <Text type="secondary">请从左侧列表选择待审核数据</Text>
      </Card>
    );
  }

  const task = tasks.find((t) => t.id === dataItem.taskId);
  const template = task ? getTemplateSchema(task.templateId) : undefined;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
      {/* 原始数据 */}
      <Card
        title={
          <Space>
            <FileImageOutlined />
            <span>原始数据</span>
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={1} size="small" bordered>
          {Object.entries(dataItem.rawData).map(([key, val]) => (
            <Descriptions.Item key={key} label={key} labelStyle={{ width: 120, fontWeight: 500 }}>
              {key === 'imageUrl' ? (
                <a href={String(val)} target="_blank" rel="noopener noreferrer">{String(val)}</a>
              ) : (
                String(val)
              )}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>

      {/* 标注结果（只读） */}
      <Card
        title={
          <Space size="small" wrap>
            <FormOutlined />
            <span>标注结果</span>
            <Tag icon={<LockOutlined />} color="orange">只读</Tag>
          </Space>
        }
        size="small"
      >
        <div style={{ marginBottom: 8 }}>
          <Space size="small" wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              标注员: {dataItem.annotator ?? '—'}
            </Text>
            {dataItem.submittedAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                提交于: {new Date(dataItem.submittedAt).toLocaleString('zh-CN')}
              </Text>
            )}
          </Space>
        </div>
        {dataItem.annotationData && template ? (
          <AnnotationDisplay data={dataItem.annotationData} template={template} />
        ) : dataItem.annotationData ? (
          <Descriptions column={1} size="small" bordered>
            {Object.entries(dataItem.annotationData).map(([key, val]) => (
              <Descriptions.Item key={key} label={key}>
                {Array.isArray(val) ? val.join(', ') : String(val)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : (
          <Text type="secondary">暂无标注数据</Text>
        )}
      </Card>
    </div>
  );
}
