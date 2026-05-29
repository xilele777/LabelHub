import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Typography,
  Card,
  Select,
  Radio,
  Button,
  Table,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
  Alert,
  Empty,
  message,
  Tooltip,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DataItemStatus, STATUS_DISPLAY_CONFIG } from '../../types';
import { useTaskStore } from '../../store/useTaskStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import {
  ExportFormat,
  ExportRange,
  type ExportRecord,
  buildExportRecords,
  filterByRange,
  performExport,
  CSV_COLUMN_MAP,
  CSV_COLUMN_ORDER,
} from '../../utils/exportUtils';

const { Title, Paragraph } = Typography;

const RANGE_OPTIONS = [
  { label: '全部数据', value: ExportRange.ALL },
  { label: '仅审核通过', value: ExportRange.APPROVED },
  { label: '仅驳回数据', value: ExportRange.REJECTED },
];

const FORMAT_OPTIONS = [
  { label: 'JSON', value: ExportFormat.JSON },
  { label: 'CSV', value: ExportFormat.CSV },
];

function renderStatusTag(status: DataItemStatus) {
  const config = STATUS_DISPLAY_CONFIG[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}

export default function DataExport() {
  const tasks = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const dataItems = useAnnotationStore((s) => s.dataItems);
  const archivedItems = useAnnotationStore((s) => s.archivedItems);
  const aiReviewResults = useAnnotationStore((s) => s.aiReviewResults);
  const fetchDataItems = useAnnotationStore((s) => s.fetchDataItems);
  const fetchArchivedItems = useAnnotationStore((s) => s.fetchArchivedItems);
  const fetchAIReviews = useAnnotationStore((s) => s.fetchAIReviews);

  // 页面加载时从 API 获取数据
  useEffect(() => {
    fetchTasks();
    fetchDataItems();
    fetchArchivedItems();
    fetchAIReviews();
  }, [fetchTasks, fetchDataItems, fetchArchivedItems, fetchAIReviews]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [exportRange, setExportRange] = useState<ExportRange>(ExportRange.ALL);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(ExportFormat.JSON);

  const taskOptions = useMemo(
    () =>
      tasks.map((t) => ({
        label: t.name + '（' + t.id + '）',
        value: t.id,
      })),
    [tasks],
  );

  const allExportRecords = useMemo(() => {
    const itemMap = new Map(dataItems.map((item) => [item.id, item]));
    archivedItems.forEach((item) => itemMap.set(item.id, item));
    const exportItems = Array.from(itemMap.values());
    const filteredItems = selectedTaskId
      ? exportItems.filter((d) => d.taskId === selectedTaskId)
      : exportItems;
    return buildExportRecords(filteredItems, aiReviewResults);
  }, [selectedTaskId, dataItems, archivedItems, aiReviewResults]);

  const exportRecords = useMemo(
    () => filterByRange(allExportRecords, exportRange),
    [allExportRecords, exportRange],
  );

  const stats = useMemo(() => {
    const total = allExportRecords.length;
    const approved = allExportRecords.filter((r) => r.status === DataItemStatus.REVIEWED).length;
    const rejected = allExportRecords.filter((r) => r.status === DataItemStatus.REJECTED).length;
    return { total, approved, rejected };
  }, [allExportRecords]);

  const selectedTaskName = useMemo(() => {
    if (!selectedTaskId) return 'LabelHub_全部任务';
    const task = tasks.find((t) => t.id === selectedTaskId);
    return task ? 'LabelHub_' + task.name : 'LabelHub_导出';
  }, [selectedTaskId, tasks]);

  const handleExport = useCallback(() => {
    if (exportRecords.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }
    performExport(exportRecords, exportFormat, selectedTaskName);
    message.success('已导出 ' + exportRecords.length + ' 条数据');
  }, [exportRecords, exportFormat, selectedTaskName]);

  const previewColumns: ColumnsType<ExportRecord> = useMemo(
    () => [
      {
        title: '数据ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
      },
      {
        title: '任务ID',
        dataIndex: 'taskId',
        key: 'taskId',
        width: 80,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DataItemStatus) => renderStatusTag(status),
      },
      {
        title: '原始数据',
        dataIndex: 'rawData',
        key: 'rawData',
        width: 200,
        ellipsis: true,
        render: (v: Record<string, unknown> | null) =>
          v ? (
            <Tooltip title={JSON.stringify(v, null, 2)}>
              <span style={{ cursor: 'pointer' }}>{JSON.stringify(v).slice(0, 60) + '…'}</span>
            </Tooltip>
          ) : (
            <Tag>无</Tag>
          ),
      },
      {
        title: '标注结果',
        dataIndex: 'annotationResult',
        key: 'annotationResult',
        width: 200,
        ellipsis: true,
        render: (v: Record<string, unknown> | null) =>
          v ? (
            <Tooltip title={JSON.stringify(v, null, 2)}>
              <span style={{ cursor: 'pointer' }}>{JSON.stringify(v).slice(0, 60) + '…'}</span>
            </Tooltip>
          ) : (
            <Tag>未标注</Tag>
          ),
      },
      {
        title: 'AI预审',
        key: 'aiReview',
        width: 130,
        render: (_: unknown, record: ExportRecord) => {
          const ai = record.aiReviewResult;
          if (!ai) return <Tag>无</Tag>;
          const colorMap: Record<string, string> = {
            pass: 'success',
            risk: 'warning',
            fail: 'error',
          };
          return (
            <Space direction="vertical" size={0}>
              <Tag color={colorMap[ai.reviewStatus] ?? 'default'}>{ai.reviewStatus}</Tag>
              <span style={{ fontSize: 12, color: '#999' }}>评分: {ai.score}</span>
            </Space>
          );
        },
      },
      {
        title: '人工审核',
        key: 'humanReview',
        width: 150,
        render: (_: unknown, record: ExportRecord) => {
          const human = record.humanReviewResult;
          if (!human || !human.result) return <Tag>无</Tag>;
          const colorMap: Record<string, string> = {
            approved: 'success',
            rejected: 'error',
          };
          const labelMap: Record<string, string> = {
            approved: '通过',
            rejected: '驳回',
          };
          return (
            <Space direction="vertical" size={0}>
              <Tag color={colorMap[human.result]}>{labelMap[human.result]}</Tag>
              {human.reviewer && (
                <span style={{ fontSize: 12, color: '#999' }}>审核人: {human.reviewer}</span>
              )}
              {human.rejectReason && (
                <Tooltip title={human.rejectReason}>
                  <span style={{ fontSize: 12, color: '#ff4d4f', cursor: 'pointer' }}>
                    驳回原因…
                  </span>
                </Tooltip>
              )}
            </Space>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <Title level={4}>数据导出</Title>
      <Paragraph type="secondary">
        选择任务与导出条件，预览后点击导出按钮下载标注数据。
      </Paragraph>

      <Card title="导出配置" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>
              <InfoCircleOutlined style={{ marginRight: 4 }} />
              选择任务
            </div>
            <Select
              placeholder="选择要导出的任务（留空=全部）"
              allowClear
              showSearch
              style={{ width: '100%' }}
              options={taskOptions}
              value={selectedTaskId}
              onChange={(val) => setSelectedTaskId(val)}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Col>

          <Col xs={24} md={8}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>导出范围</div>
            <Radio.Group
              options={RANGE_OPTIONS}
              value={exportRange}
              onChange={(e) => setExportRange(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            />
          </Col>

          <Col xs={24} md={8}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>导出格式</div>
            <Radio.Group
              options={FORMAT_OPTIONS}
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            />
          </Col>
        </Row>
      </Card>

      <Card title="数据概览" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Statistic title="总数据" value={stats.total} />
          </Col>
          <Col span={6}>
            <Statistic
              title="审核通过"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已驳回"
              value={stats.rejected}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Space>
              <span style={{ color: '#999' }}>
                当前筛选: <strong>{exportRecords.length}</strong> 条
              </span>
              <Button
                type="primary"
                size="large"
                icon={
                  exportFormat === ExportFormat.JSON ? (
                    <FileTextOutlined />
                  ) : (
                    <FileExcelOutlined />
                  )
                }
                onClick={handleExport}
                disabled={exportRecords.length === 0}
              >
                {'导出 ' + exportFormat.toUpperCase()}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        title="导出字段映射"
        size="small"
        style={{ marginBottom: 16 }}
        extra={<DownloadOutlined />}
      >
        <Alert
          type="info"
          showIcon
          message="导出字段说明"
          description={
            <div>
              <p style={{ marginBottom: 8 }}>
                导出文件包含以下字段，其中嵌套对象在 CSV 中以 JSON
                序列化形式存储，同时将常用字段提取为独立列便于筛选：
              </p>
              <Row gutter={[8, 4]}>
                {CSV_COLUMN_ORDER.map((key) => (
                  <Col key={key} span={8}>
                    <Tag style={{ margin: 0 }}>
                      {CSV_COLUMN_MAP[key] + '（' + key + '）'}
                    </Tag>
                  </Col>
                ))}
              </Row>
            </div>
          }
          style={{ marginBottom: 0 }}
        />
      </Card>

      <Card
        title={'数据预览（' + exportRecords.length + ' 条）'}
        size="small"
        extra={
          <span style={{ color: '#999', fontSize: 12 }}>
            仅展示摘要，完整数据请下载导出文件
          </span>
        }
      >
        {exportRecords.length === 0 ? (
          <Empty
            description={
              selectedTaskId
                ? '所选任务下没有符合条件的数据'
                : '没有符合条件的数据，请调整筛选范围'
            }
          />
        ) : (
          <Table<ExportRecord>
            rowKey="id"
            columns={previewColumns}
            dataSource={exportRecords}
            size="small"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => '共 ' + total + ' 条',
            }}
            scroll={{ x: 950 }}
          />
        )}
      </Card>
    </>
  );
}
