import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import type { Role } from '../types';
import { getDefaultPath } from '../utils/roleHelper';
import { preloadTemplateSchemas } from '../utils/templateSchemaHelper';

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: Role[];
}

/** 标记是否已完成预加载（全局单次） */
let preloaded = false;

/**
 * 路由守卫组件
 * - 未登录 → 跳转 /login（携带来源路径）
 * - 已登录但角色不匹配 → 跳转角色默认页
 * - 满足条件 → 渲染子组件
 * - 登录后自动预加载模板 Schema
 */
export default function AuthGuard({ children, roles }: AuthGuardProps) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const preloadRef = useRef(false);

  // 登录后预加载模板 Schema（每个 AuthGuard 实例仅触发一次）
  useEffect(() => {
    if (user && !preloadRef.current && !preloaded) {
      preloadRef.current = true;
      preloaded = true;
      preloadTemplateSchemas();
    }
    // 登出时重置，以便下次登录重新预加载
    if (!user) {
      preloadRef.current = false;
      preloaded = false;
    }
  }, [user]);

  if (!user) {
    return <Navigate to='/login' state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getDefaultPath(user.role)} replace />;
  }

  return <>{children}</>;
}
