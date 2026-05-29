import { useMemo } from 'react';
import { Modal, Tag, Divider } from 'antd';
import { FieldType, type TemplateField } from '../../../types';
import DynamicSchemaForm from '../../../components/DynamicSchemaForm';
import { fieldTypeLabelMap } from './FieldPalette';

interface SchemaPreviewModalProps {
  open: boolean;
  fields: TemplateField[];
  onCancel: () => void;
}

export default function SchemaPreviewModal({ open, fields, onCancel }: SchemaPreviewModalProps) {
  const nonTitleFields = useMemo(
    () => fields.filter((f) => f.type !== FieldType.TITLE),
    [fields],
  );
  const titleFields = useMemo(
    () => fields.filter((f) => f.type === FieldType.TITLE),
    [fields],
  );
  const requiredCount = useMemo(
    () => nonTitleFields.filter((f) => f.required).length,
    [nonTitleFields],
  );
  return (
    <Modal
      title='预览模板'
      open={open}
      onCancel={onCancel}
      width={720}
      footer={null}
      destroyOnClose
    >
      {fields.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          暂无字段，请先在画布中添加字段
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tag color='blue'>共 {fields.length} 个字段</Tag>
            {nonTitleFields.length > 0 && (
              <Tag color='green'>可填写： {nonTitleFields.length}</Tag>
            )}
            {titleFields.length > 0 && (
              <Tag color='orange'>说明块： {titleFields.length}</Tag>
            )}
            {requiredCount > 0 && (
              <Tag color='red'>必填： {requiredCount}</Tag>
            )}
          </div>
          <Divider style={{ margin: '8px 0 16px' }} />
          {fields.map((field) => (
            <div key={field.id} style={{ marginBottom: field.type === FieldType.TITLE ? 0 : 8 }}>
              {field.type !== FieldType.TITLE && (
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tag color='blue' style={{ margin: 0 }}>{fieldTypeLabelMap[field.type]}</Tag>
                  {field.required && <Tag color='red' style={{ margin: 0 }}>必填</Tag>}
                  {field.fieldKey && <Tag style={{ margin: 0 }}>{field.fieldKey}</Tag>}
                </div>
              )}
              <DynamicSchemaForm
                schema={[field]}
                value={{}}
                onChange={() => {}}
                readonly
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}