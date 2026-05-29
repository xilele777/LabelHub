import type { ReactNode } from 'react';
import { FieldType, type TemplateField } from '../../types';

/** 字段渲染器上下文：传入当前字段配置 + 读写模式 + 受控值 */
export interface FieldRendererContext {
  field: TemplateField;
  readonly: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** 字段渲染器：放宽 field 类型到基类，具体字段由 renderer 内部断言 */
export type FieldRenderer = (
  ctx: FieldRendererContext,
) => ReactNode;

/** 字段渲染器注册表类型 */
export type FieldRendererRegistry = Partial<Record<FieldType, FieldRenderer>>;

/** 向注册表中注册渲染器 */
export function registerRenderer(
  registry: FieldRendererRegistry,
  type: FieldType,
  renderer: FieldRenderer,
): FieldRendererRegistry {
  return { ...registry, [type]: renderer };
}
