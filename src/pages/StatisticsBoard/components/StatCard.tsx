import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { StatCard as StatCardData } from '../utils/computeStatistics';

const { Text } = Typography;

const iconMap: Record<string, ReactNode> = {
  UnorderedListOutlined: <UnorderedListOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  AuditOutlined: <AuditOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  CloseCircleOutlined: <CloseCircleOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
};

interface StatCardProps {
  data: StatCardData;
}

export default function StatCard({ data }: StatCardProps) {
  const { title, value, icon, color, suffix, description } = data;

  return (
    <Card
      hoverable
      styles={{
        body: { padding: 18 },
      }}
      style={{
        height: '100%',
        borderTop: `3px solid ${color}`,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: `${color}14`,
            border: `1px solid ${color}24`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color,
            flexShrink: 0,
          }}
        >
          {iconMap[icon] ?? <UnorderedListOutlined />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text type="secondary" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            {title}
          </Text>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>
            {value}
            {suffix && <span style={{ marginLeft: 2, fontSize: 15, fontWeight: 600, color }}>{suffix}</span>}
          </div>
          {description && (
            <Text
              type="secondary"
              ellipsis={{ tooltip: description }}
              style={{ display: 'block', marginTop: 8, fontSize: 12 }}
            >
              {description}
            </Text>
          )}
        </div>
      </div>
    </Card>
  );
}
