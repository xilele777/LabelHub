import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Typography, Card, Button, Space, Tooltip, Spin, message, Input, Select, Form } from 'antd';
import { EyeOutlined, ExportOutlined, ImportOutlined, CopyOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import FieldPalette from './components/FieldPalette';
import TemplateCanvas from './components/TemplateCanvas';
import FieldConfigPanel from './components/FieldConfigPanel';
import SchemaPreviewModal from './components/SchemaPreviewModal';
import SchemaImportModal from './components/SchemaImportModal';
import { useTemplateBuilderStore } from './useTemplateBuilderStore';
import { useSchemaExport } from './hooks/useSchemaIO';
import { useAuthStore } from '../../store/useAuthStore';
import { FieldType, TaskType, type TemplateField } from '../../types';

const { Title } = Typography;

const taskTypeOptions = [
  { value: TaskType.IMAGE_CLASSIFICATION, label: '图像分类' },
  { value: TaskType.OBJECT_DETECTION, label: '目标检测' },
  { value: TaskType.SEMANTIC_SEGMENTATION, label: '语义分割' },
  { value: TaskType.TEXT_NER, label: '文本NER' },
];

function validateBeforeSave(name: string, fields: TemplateField[]): string | null {
  if (!name.trim()) {
    return '请填写模板名称';
  }
  if (fields.length === 0) {
    return '请至少添加一个字段';
  }

  const keys = new Set<string>();
  for (const [index, field] of fields.entries()) {
    if (!field.label.trim()) {
      return `第 ${index + 1} 个字段缺少标题`;
    }
    if (field.type === FieldType.TITLE) {
      continue;
    }
    const key = field.fieldKey.trim();
    if (!key) {
      return `字段「${field.label}」缺少字段标识`;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return `字段「${field.label}」的字段标识只能使用字母、数字和下划线，且不能以数字开头`;
    }
    if (keys.has(key)) {
      return `字段标识「${key}」重复`;
    }
    keys.add(key);
  }

  return null;
}

export default function TemplateBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const templateIdFromUrl = searchParams.get('id');
  const modeFromUrl = searchParams.get('mode'); // 'create' or null

  const fields = useTemplateBuilderStore((s) => s.fields);
  const templateMeta = useTemplateBuilderStore((s) => s.templateMeta);
  const mode = useTemplateBuilderStore((s) => s.mode);
  const loading = useTemplateBuilderStore((s) => s.loading);
  const saving = useTemplateBuilderStore((s) => s.saving);
  const loadTemplate = useTemplateBuilderStore((s) => s.loadTemplate);
  const initCreateMode = useTemplateBuilderStore((s) => s.initCreateMode);
  const saveTemplate = useTemplateBuilderStore((s) => s.saveTemplate);
  const setTemplateMeta = useTemplateBuilderStore((s) => s.setTemplateMeta);
  const reset = useTemplateBuilderStore((s) => s.reset);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { exportJSON, copyToClipboard } = useSchemaExport();

  // 根据 URL 参数初始化：编辑模式加载模板，新建模式初始化空画布
  useEffect(() => {
    if (templateIdFromUrl) {
      // 编辑已有模板
      loadTemplate(templateIdFromUrl);
    } else if (modeFromUrl === 'create') {
      // 新建模板
      initCreateMode();
    }
    return () => {
      reset();
    };
  }, [templateIdFromUrl, modeFromUrl, loadTemplate, initCreateMode, reset]);

  // 保存模板
  const handleSave = async () => {
    const validationError = validateBeforeSave(templateMeta.name, fields);
    if (validationError) {
      message.warning(validationError);
      return;
    }

    // 在保存前记录当前模式（saveTemplate 在 create 模式下会把 mode 切换为 edit）
    const wasCreateMode = mode === 'create';
    try {
      await saveTemplate(user?.username);
      message.success(wasCreateMode ? '模板创建成功' : '模板已保存');
      // 保存成功后返回模板管理页
      navigate('/templates');
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : '保存失败，请重试';
      message.error(msg);
    }
  };

  const isCreateMode = mode === 'create';

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* 顶部工具栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space align="center">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/templates')}
            >
              返回
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {isCreateMode ? '新建模板' : '编辑模板'}
            </Title>
          </Space>
          <Space>
            <Tooltip title={isCreateMode ? '创建模板并保存到服务器' : '保存模板到服务器'}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                {isCreateMode ? '创建并保存' : '保存'}
              </Button>
            </Tooltip>
            <Tooltip title="预览当前模板的完整表单">
              <Button
                icon={<EyeOutlined />}
                onClick={() => setPreviewOpen(true)}
                disabled={fields.length === 0}
              >
                预览模板
              </Button>
            </Tooltip>
            <Tooltip title="复制 Schema JSON 到剪贴板">
              <Button
                icon={<CopyOutlined />}
                onClick={copyToClipboard}
                disabled={fields.length === 0}
              >
                复制 JSON
              </Button>
            </Tooltip>
            <Tooltip title="下载 Schema JSON 文件">
              <Button
                icon={<ExportOutlined />}
                onClick={exportJSON}
                disabled={fields.length === 0}
              >
                导出 JSON
              </Button>
            </Tooltip>
            <Tooltip title="从 JSON 文件或文本导入 Schema">
              <Button
                icon={<ImportOutlined />}
                onClick={() => setImportOpen(true)}
              >
                导入 JSON
              </Button>
            </Tooltip>
          </Space>
        </div>

        {/* 模板元信息编辑区（新建和编辑都显示） */}
        <Card size="small" style={{ marginBottom: 12 }}>
          <Form layout="inline" style={{ gap: 16 }}>
            <Form.Item label="模板名称" style={{ marginBottom: 0 }}>
              <Input
                value={templateMeta.name}
                onChange={(e) => setTemplateMeta({ name: e.target.value })}
                placeholder="请输入模板名称"
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item label="模板描述" style={{ marginBottom: 0 }}>
              <Input
                value={templateMeta.description}
                onChange={(e) => setTemplateMeta({ description: e.target.value })}
                placeholder="请输入模板描述"
                style={{ width: 240 }}
              />
            </Form.Item>
            <Form.Item label="任务类型" style={{ marginBottom: 0 }}>
              <Select
                value={templateMeta.type}
                onChange={(value) => setTemplateMeta({ type: value })}
                options={taskTypeOptions}
                style={{ width: 140 }}
              />
            </Form.Item>
          </Form>
        </Card>

        {/* 主体区域：组件面板 + 画布 + 属性面板 */}
        <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>
          <Card
            title="组件"
            size="small"
            style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { overflowY: 'auto', flex: 1, minHeight: 0, padding: '8px 12px' } }}
          >
            <FieldPalette />
          </Card>
          <Card
            title="画布"
            size="small"
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { overflowY: 'auto', flex: 1, minHeight: 0, padding: '12px 16px' } }}
          >
            <TemplateCanvas />
          </Card>
          <Card
            title="属性"
            size="small"
            style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { overflowY: 'auto', flex: 1, minHeight: 0, padding: '12px 16px' } }}
          >
            <FieldConfigPanel />
          </Card>
        </div>

        <SchemaPreviewModal
          open={previewOpen}
          fields={fields}
          onCancel={() => setPreviewOpen(false)}
        />
        <SchemaImportModal
          open={importOpen}
          onCancel={() => setImportOpen(false)}
          onSuccess={() => setImportOpen(false)}
        />
      </div>
    </Spin>
  );
}
