/**
 * 角色相关辅助工具
 * 原数据来自 mock/users.ts，后续可从 API 配置获取
 */
import { Role } from '../types';

/** 根据角色获取默认登录后跳转路径 */
export function getDefaultPath(role: Role): string {
  switch (role) {
    case Role.OWNER:
      return '/dashboard';
    case Role.ANNOTATOR:
      return '/annotate';
    case Role.REVIEWER:
      return '/review';
    default:
      return '/dashboard';
  }
}
