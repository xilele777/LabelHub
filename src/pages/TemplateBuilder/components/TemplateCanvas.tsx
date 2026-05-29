import { useCallback } from 'react';
import { Typography, Empty, Card, Tag, Button, Space } from 'antd';
import { DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,

} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type TemplateField, FieldType } from '../../../types';
import { useTemplateBuilderStore } from '../useTemplateBuilderStore';
import { fieldTypeLabelMap } from './FieldPalette';

const { Text, Paragraph } = Typography;

function FieldPreview({ field }: { field: TemplateField }) {
  switch (field.type) {
    case FieldType.INPUT:
      return <Text type="secondary">{field.placeholder || '请输入'}</Text>;
    case FieldType.TEXTAREA:
      return <Text type="secondary">{field.placeholder || '请输入'}</Text>;
    case FieldType.RADIO:
      return (
        <Space direction={field.direction === 'horizontal' ? 'horizontal' : 'vertical'}>
          {field.options.map((opt) => (
            <Tag key={opt.id}>{opt.label}</Tag>
          ))}
        </Space>
      );
    case FieldType.CHECKBOX:
      return (
        <Space direction={field.direction === 'horizontal' ? 'horizontal' : 'vertical'}>
          {field.options.map((opt) => (
            <Tag key={opt.id}>{opt.label}</Tag>
          ))}
        </Space>
      );
    case FieldType.SELECT:
      return (
        <Space>
          {field.options.map((opt) => (
            <Tag key={opt.id}>{opt.label}</Tag>
          ))}
        </Space>
      );
    case FieldType.RATING:
      return <Text type="secondary">{'★'.repeat(field.maxScore ?? 5)}</Text>;
    case FieldType.SWITCH:
      return (
        <Text type="secondary">
          {field.checkedChildren ?? '是'} / {field.unCheckedChildren ?? '否'}
        </Text>
      );
    case FieldType.TITLE:
      return (
        <div>
          <Text strong>{field.label || '说明标题'}</Text>
          {field.description && (
            <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>{field.description}</Paragraph>
          )}
        </div>
      );
    default:
      return null;
  }
}

function SortableFieldCard({ field, isSelected }: { field: TemplateField; isSelected: boolean }) {
  const selectField = useTemplateBuilderStore((s) => s.selectField);
  const removeField = useTemplateBuilderStore((s) => s.removeField);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const label = field.label || fieldTypeLabelMap[field.type] || field.type;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      size="small"
      onClick={() => selectField(field.id)}
      className={isSelected ? 'canvas-field-selected' : undefined}
      styles={{
        body: {
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: isSelected ? '2px solid #1677ff' : undefined,
          borderRadius: 6,
          cursor: isDragging ? 'grabbing' : 'default',
        },
      }}
    >
      {/* 拖拽把手 */}
      <span
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: '#999', flexShrink: 0 }}
      >
        <HolderOutlined />
      </span>

      {/* 字段类型标签 */}
      <Tag color="blue" style={{ margin: 0, flexShrink: 0 }}>{fieldTypeLabelMap[field.type]}</Tag>

      {/* 字段内容预览 */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <FieldPreview field={field} />
      </div>

      {/* 删除按钮 */}
      <Button
        type="text"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          removeField(field.id);
        }}
      />
    </Card>
  );
}

export default function TemplateCanvas() {
  const fields = useTemplateBuilderStore((s) => s.fields);
  const selectedFieldId = useTemplateBuilderStore((s) => s.selectedFieldId);
  const moveField = useTemplateBuilderStore((s) => s.moveField);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        moveField(oldIndex, newIndex);
      }
    },
    [fields, moveField],
  );

  if (fields.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="点击左侧组件添加字段" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={fields.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map((field) => (
            <SortableFieldCard
              key={field.id}
              field={field}
              isSelected={field.id === selectedFieldId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
