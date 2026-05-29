import { Tag } from 'antd';
import { TaskStatus, TaskType } from '../../types';

// ========== 状态映射 ==========

export const statusMap: Record<
  TaskStatus,
  { label: string; color: string }
> = {
  [TaskStatus.DRAFT]: { label: '草稿', color: 'default' },
  [TaskStatus.PENDING]: { label: '待发布', color: 'processing' },
  [TaskStatus.IN_PROGRESS]: { label: '进行中', color: 'blue' },
  [TaskStatus.COMPLETED]: { label: '已完成', color: 'success' },
  [TaskStatus.ENDED]: { label: '已结束', color: 'warning' },
};

export const statusOptions = Object.entries(statusMap).map(([value, { label }]) => ({
  label,
  value,
}));

// ========== 任务类型映射 ==========

export const taskTypeMap: Record<
  TaskType,
  { label: string; color: string }
> = {
  [TaskType.IMAGE_CLASSIFICATION]: { label: '图像分类', color: 'blue' },
  [TaskType.OBJECT_DETECTION]: { label: '目标检测', color: 'green' },
  [TaskType.SEMANTIC_SEGMENTATION]: { label: '语义分割', color: 'purple' },
  [TaskType.TEXT_NER]: { label: '文本NER', color: 'orange' },
};

// ========== 状态 Tag 渲染工具 ==========

export function renderStatusTag(status: TaskStatus) {
  const info = statusMap[status];
  return info ? <Tag color={info.color}>{info.label}</Tag> : status;
}

export function renderTaskTypeTag(type: TaskType) {
  const info = taskTypeMap[type];
  return info ? <Tag color={info.color}>{info.label}</Tag> : type;
}

// ========== 操作权限判断 ==========

/** 可编辑状态：草稿、待发布 */
export function canEdit(status: TaskStatus): boolean {
  return status === TaskStatus.DRAFT || status === TaskStatus.PENDING;
}

/** 可发布状态：草稿、待发布 */
export function canPublish(status: TaskStatus): boolean {
  return status === TaskStatus.DRAFT || status === TaskStatus.PENDING;
}

/** 可结束状态：进行中 */
export function canEnd(status: TaskStatus): boolean {
  return status === TaskStatus.IN_PROGRESS;
}
