import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Space,
  Typography,
  Popconfirm,
  message,
  Card,
  Tag,
  Modal,
  Descriptions,
  Spin,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { TaskType, type TemplateItem, type AnnotationTemplate } from '../../types';
import { useTemplateStore } from '../../store/useTemplateStore';
import { getTemplateSchemaAsync } from '../../utils/templateSchemaHelper';

const { Title } = Typography;
const PAGE_SIZE = 5;

const taskTypeMap: Record<TaskType, { label: string; color: string }> = {
  [TaskType.IMAGE_CLASSIFICATION]: { label: '图像分类', color: 'blue' },
  [TaskType.OBJECT_DETECTION]: { label: '目标检测', color: 'green' },
  [TaskType.SEMANTIC_SEGMENTATION]: { label: '语义分割', color: 'purple' },
  [TaskType.TEXT_NER]: { label: '文本NER', color: 'orange' },
};

function renderTaskTypeTag(type: TaskType) {
  const info = taskTypeMap[type];
  return info ? <Tag color={info.color}>{info.label}</Tag> : type;
}

export default function TemplateManage() {
  const navigate = useNavigate();

  const templates = useTemplateStore((s) => s.templates);
  const loading = useTemplateStore((s) => s.loading);
  const error = useTemplateStore((s) => s.error);
  const fetchTemplates = useTemplateStore((s) => s.fetchTemplates);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);

  // 页面加载时从 API 获取模板列表
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const [keyword, setKeyword] = useState('');
  const [current, setCurrent] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<AnnotationTemplate | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const filtered = useMemo(() => {
    return templates.filter((t) =>
      t.name.toLowerCase().includes(keyword.toLowerCase()),
    );
  }, [templates, keyword]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTemplate(id);
        message.success('模板已删除');
      } catch (err: any) {
        message.error(err?.message || '删除模板失败');
      }
    },
    [deleteTemplate],
  );

  const handleEdit = useCallback(
    (id: string) => {
      navigate(`/templates/builder?id=${id}`);
    },
    [navigate],
  );

  const handleCreate = useCallback(() => {
    // 不预先创建模板，直接进入搭建页面的"新建模式"
    // 用户在搭建页面点"保存"时才会真正创建到服务端
    navigate('/templates/builder?mode=create');
  }, [navigate]);

  const handlePreview = useCallback(async (record: TemplateItem) => {
    setPreviewLoading(true);
    try {
      const schema = await getTemplateSchemaAsync(record.id);
      if (schema) {
        setPreviewData(schema);
        setPreviewOpen(true);
      } else {
        // 如果模板尚未配置 fields，展示基础信息
        setPreviewData({
          id: record.id,
          name: record.name,
          type: record.type,
          fields: [],
          version: 1,
          createdAt: record.createdAt,
          updatedAt: record.createdAt,
        });
        setPreviewOpen(true);
      }
    } catch {
      message.warning('获取模板 Schema 失败');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const columns: ColumnsType<TemplateItem> = useMemo(
    () => [
      {
        title: '模板名称',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        width: 180,
      },
      {
        title: '模板描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        width: 240,
      },
      {
        title: '任务类型',
        dataIndex: 'type',
        key: 'type',
        width: 120,
        render: (type: TaskType) => renderTaskTypeTag(type),
      },
      {
        title: '字段数量',
        dataIndex: 'fieldCount',
        key: 'fieldCount',
        width: 100,
        align: 'center',
      },
      {
        title: '创建人',
        dataIndex: 'creator',
        key: 'creator',
        width: 100,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'action',
        width: 220,
        render: (_, record) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
              loading={previewLoading}
            >
              预览
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.id)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除该模板？删除后无法恢复。"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, handleEdit, handlePreview],
  );

  return (
    <>
      <Title level={4}>模板列表</Title>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => useTemplateStore.setState({ error: null })}
        />
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索模板名称"
            allowClear
            style={{ width: 240 }}
            onSearch={(val) => {
              setKeyword(val);
              setCurrent(1);
            }}
            onChange={(e) => {
              if (!e.target.value) {
                setKeyword('');
                setCurrent(1);
              }
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建模板
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Table<TemplateItem>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{
            current,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            showSizeChanger: false,
            showTotal: (t) => '共 ' + t + ' 条',
            onChange: (page) => setCurrent(page),
          }}
        />
      </Spin>

      <Modal
        title="模板 Schema 预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={680}
      >
        {previewData && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="模板ID">{previewData.id}</Descriptions.Item>
            <Descriptions.Item label="模板名称">{previewData.name}</Descriptions.Item>
            <Descriptions.Item label="任务类型">
              {renderTaskTypeTag(previewData.type)}
            </Descriptions.Item>
            <Descriptions.Item label="版本">v{previewData.version}</Descriptions.Item>
            <Descriptions.Item label="字段数量">{previewData.fields.length}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(previewData.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(previewData.updatedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="字段列表">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {previewData.fields.map((field) => (
                  <Tag key={field.id}>
                    {field.label}（{field.type}）
                  </Tag>
                ))}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="完整 Schema">
              <pre
                style={{
                  maxHeight: 300,
                  overflow: 'auto',
                  fontSize: 12,
                  background: '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                }}
              >
                {JSON.stringify(previewData, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </>
  );
}
