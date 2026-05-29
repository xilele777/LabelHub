import { useCallback, useState } from 'react';
import { message } from 'antd';
import { type TemplateField } from '../../../types';
import { useTemplateBuilderStore } from '../useTemplateBuilderStore';
import { validateImportSchema } from '../utils/validateSchema';

/** Clean internal IDs from options for export */
function cleanFieldForExport(field: TemplateField): Record<string, unknown> {
  const { ...rest } = field;
  if ('options' in rest && Array.isArray((rest as Record<string, unknown>).options)) {
    const cleanOptions = ((rest as Record<string, unknown>).options as Array<{ id?: string; label: string; value: string }>).map(
      ({ id: _id, ...optRest }) => optRest,
    );
    (rest as Record<string, unknown>).options = cleanOptions;
  }
  return rest;
}

/** Export hook */
export function useSchemaExport() {
  const fields = useTemplateBuilderStore((s) => s.fields);

  const exportJSON = useCallback(() => {
    if (fields.length === 0) {
      message.warning('画布为空，无法导出');
      return;
    }

    const schema = {
      version: 1,
      exportedAt: new Date().toISOString(),
      fields: fields.map(cleanFieldForExport),
    };

    const jsonStr = JSON.stringify(schema, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-schema-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success('Schema 已导出');
  }, [fields]);

  const copyToClipboard = useCallback(async () => {
    if (fields.length === 0) {
      message.warning('画布为空，无法复制');
      return;
    }

    const schema = {
      version: 1,
      exportedAt: new Date().toISOString(),
      fields: fields.map(cleanFieldForExport),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
      message.success('Schema JSON 已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动复制');
    }
  }, [fields]);

  return { exportJSON, copyToClipboard };
}

/** Import hook */
export function useSchemaImport() {
  const loadFields = useTemplateBuilderStore((s) => s.loadFields);
  const [validating, setValidating] = useState(false);

  const importFromJSON = useCallback(
    (raw: string): { success: boolean; errors: string[] } => {
      setValidating(true);
      try {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          message.error('JSON 格式无效，请检查输入');
          return { success: false, errors: ['JSON 格式无效'] };
        }

        const result = validateImportSchema(parsed);

        if (result.fields.length === 0) {
          message.error('导入失败：没有可恢复的字段');
          return { success: false, errors: result.errors };
        }

        loadFields(result.fields);

        if (result.errors.length > 0) {
          message.warning(`已导入 ${result.fields.length} 个字段，但有 ${result.errors.length} 项警告`);
        } else {
          message.success(`成功导入 ${result.fields.length} 个字段`);
        }

        return { success: true, errors: result.errors };
      } finally {
        setValidating(false);
      }
    },
    [loadFields],
  );

  const importFromFile = useCallback(
    (file: File): Promise<{ success: boolean; errors: string[] }> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          resolve(importFromJSON(text));
        };
        reader.onerror = () => {
          message.error('文件读取失败');
          resolve({ success: false, errors: ['文件读取失败'] });
        };
        reader.readAsText(file);
      });
    },
    [importFromJSON],
  );

  return { importFromJSON, importFromFile, validating };
}
