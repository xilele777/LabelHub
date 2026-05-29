/**
 * 审核 / AI预审相关 API
 */
import { get, post, put, del } from './request';
import type { AIReviewResult } from '../types/aiReview';

export interface ReviewListResult {
  items: AIReviewResult[];
  total: number;
}

/** 获取审核结果列表 */
export function getReviewList(params?: Record<string, unknown>) {
  return get<ReviewListResult>('/reviews', params);
}

/** 获取单条审核结果 */
export function getReview(id: string) {
  return get<AIReviewResult>(`/reviews/${id}`);
}

/** 按标注项 ID 获取审核结果 */
export function getReviewByItemId(dataItemId: string) {
  return get<AIReviewResult>(`/reviews/by-item/${dataItemId}`);
}

/** 按任务 ID 获取审核结果列表 */
export function getReviewsByTaskId(taskId: string) {
  return get<ReviewListResult>(`/reviews/by-task/${taskId}`);
}

/** 创建审核结果（AI 预审结果持久化） */
export function createReview(data: Partial<AIReviewResult>) {
  return post<AIReviewResult>('/reviews', data);
}

/** 更新审核结果 */
export function updateReview(id: string, data: Partial<AIReviewResult>) {
  return put<AIReviewResult>(`/reviews/${id}`, data);
}

/** 删除审核结果 */
export function deleteReview(id: string) {
  return del<void>(`/reviews/${id}`);
}
