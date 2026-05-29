import { useState, useCallback } from 'react';
import { Modal, Input, Alert, Upload, Button, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useSchemaImport } from '../hooks/useSchemaIO';

const { TextArea } = Input;
const { Text } = Typography;

interface SchemaImportModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

/** */
export default function SchemaImportModal({ open, onCancel, onSuccess }: SchemaImportModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const { importFromJSON, importFromFile, validating } = useSchemaImport();

  const handleImport = useCallback(() => {
    if (!jsonText.trim()) return;
    const result = importFromJSON(jsonText);
    setErrors(result.errors);
    if (result.success) {
      setJsonText('');
      setErrors([]);
      onSuccess();
    }
  }, [jsonText, importFromJSON, onSuccess]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const result = await importFromFile(file);
      setErrors(result.errors);
      if (result.success) {
        setJsonText('');
        setErrors([]);
        onSuccess();
      }
      return false; // prevent antd default upload
    },
    [importFromFile, onSuccess],
  );

  const handleCancel = useCallback(() => {
    setJsonText('');
    setErrors([]);
    onCancel();
  }, [onCancel]);

  return (
    <Modal
      title="导入 Schema"
      open={open}
      onCancel={handleCancel}
      onOk={handleImport}
      okText="导入"
      okButtonProps={{ disabled: !jsonText.trim(), loading: validating }}
      width={640}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Text type="secondary">
          粘贴 JSON 或上传文件导入 Schema，导入将覆盖当前画布内容。
        </Text>

        <Upload
          accept=".json"
          showUploadList={false}
          beforeUpload={handleFileUpload}
        >
          <Button icon={<UploadOutlined />}>选择 JSON 文件</Button>
        </Upload>

        <TextArea
          rows={12}
          placeholder='粘贴 JSON，例如: { "fields": [...] }'
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />

        {errors.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="校验警告"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            }
          />
        )}
      </div>
    </Modal>
  );
}
