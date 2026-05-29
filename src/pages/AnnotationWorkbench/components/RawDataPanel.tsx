// placeholder
import { Card, Descriptions, Tag, Image, Typography } from 'antd';
import { FileImageOutlined } from '@ant-design/icons';
import type { DataItem } from '../../../types';

const { Paragraph } = Typography;

interface RawDataPanelProps {
  dataItem: DataItem;
}

export default function RawDataPanel({ dataItem }: RawDataPanelProps) {
  const { rawData } = dataItem;

  const imageUrl = typeof rawData.imageUrl === 'string' ? rawData.imageUrl : undefined;
  const fileName = typeof rawData.fileName === 'string' ? rawData.fileName : '—';
  const fileSize = typeof rawData.fileSize === 'string' ? rawData.fileSize : '—';
  const resolution = typeof rawData.resolution === 'string' ? rawData.resolution : '—';
  const description = typeof rawData.description === 'string' ? rawData.description : '';

  return (
    <Card
      title={
        <span>
          <FileImageOutlined style={{ marginRight: 8 }} />
          原始数据
        </span>
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      styles={{ body: { overflowY: 'auto', flex: 1, minHeight: 0 } }}
    >
      {imageUrl && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Image
            src={imageUrl}
            alt={fileName}
            style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5Ij7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+"
          />
        </div>
      )}

      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="文件名">{fileName}</Descriptions.Item>
        <Descriptions.Item label="文件大小">{fileSize}</Descriptions.Item>
        <Descriptions.Item label="分辨率">{resolution}</Descriptions.Item>
        <Descriptions.Item label="数据项ID">
          <Tag>{dataItem.id}</Tag>
        </Descriptions.Item>
      </Descriptions>

      {description && (
        <div style={{ marginTop: 16 }}>
          <Paragraph type="secondary" style={{ fontWeight: 500 }}>描述</Paragraph>
          <Paragraph>{description}</Paragraph>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Paragraph type="secondary" style={{ fontWeight: 500 }}>完整原始数据</Paragraph>
        <Paragraph>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            overflow: 'auto',
            maxHeight: 200,
          }}>
            {JSON.stringify(rawData, null, 2)}
          </pre>
        </Paragraph>
      </div>
    </Card>
  );
}
