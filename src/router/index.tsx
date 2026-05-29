import { lazy, Suspense, type ReactNode } from 'react';
import { Spin } from 'antd';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthGuard from './AuthGuard';
import MainLayout from '../layouts/MainLayout';
import { Role } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { getDefaultPath } from '../utils/roleHelper';

const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const TaskList = lazy(() => import('../pages/TaskList'));
const TaskForm = lazy(() => import('../pages/TaskForm'));
const TaskDetail = lazy(() => import('../pages/TaskDetail'));
const TemplateManage = lazy(() => import('../pages/TemplateManage'));
const TemplateBuilder = lazy(() => import('../pages/TemplateBuilder'));
const AnnotationWorkbench = lazy(() => import('../pages/AnnotationWorkbench'));
const ReviewWorkbench = lazy(() => import('../pages/ReviewWorkbench'));
const DataExport = lazy(() => import('../pages/DataExport'));
const StatisticsBoard = lazy(() => import('../pages/StatisticsBoard'));
const UserManage = lazy(() => import('../pages/UserManage'));
const TaskArchive = lazy(() => import('../pages/TaskArchive'));
const NotificationPublish = lazy(() => import('../pages/NotificationPublish'));
const NotificationManage = lazy(() => import('../pages/NotificationManage'));

function RouteFallback() {
  return (
    <div style={{ display: 'grid', minHeight: 240, placeItems: 'center' }}>
      <Spin />
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

/** 已登录用户访问 /login 时，重定向到其角色默认页 */
function LoginRedirect() {
  const user = useAuthStore((s) => s.user);
  if (user) {
    return <Navigate to={getDefaultPath(user.role)} replace />;
  }
  return <Login />;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(<LoginRedirect />),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: withSuspense(<Dashboard />),
      },
      {
        path: 'tasks',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <TaskList />
          </AuthGuard>,
        ),
      },
      {
        path: 'tasks/create',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <TaskForm />
          </AuthGuard>,
        ),
      },
      {
        path: 'tasks/detail',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <TaskDetail />
          </AuthGuard>,
        ),
      },
      {
        path: 'tasks/edit',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <TaskForm />
          </AuthGuard>,
        ),
      },
      {
        path: 'templates',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <TemplateManage />
          </AuthGuard>,
        ),
      },
      {
        path: 'templates/builder',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <TemplateBuilder />
          </AuthGuard>,
        ),
      },
      {
        path: 'annotate',
        element: withSuspense(
          <AuthGuard roles={[Role.ANNOTATOR]}>
            <AnnotationWorkbench />
          </AuthGuard>,
        ),
      },
      {
        path: 'review',
        element: withSuspense(
          <AuthGuard roles={[Role.REVIEWER]}>
            <ReviewWorkbench />
          </AuthGuard>,
        ),
      },
      {
        path: 'export',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER, Role.REVIEWER]}>
            <DataExport />
          </AuthGuard>,
        ),
      },
      {
        path: 'statistics',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER, Role.REVIEWER]}>
            <StatisticsBoard />
          </AuthGuard>,
        ),
      },
      {
        path: 'users',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <UserManage />
          </AuthGuard>,
        ),
      },
      {
        path: 'notifications/publish',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <NotificationPublish />
          </AuthGuard>,
        ),
      },
      {
        path: 'notifications/manage',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER]}>
            <NotificationManage />
          </AuthGuard>,
        ),
      },
      {
        path: 'archive',
        element: withSuspense(
          <AuthGuard roles={[Role.OWNER, Role.ANNOTATOR, Role.REVIEWER]}>
            <TaskArchive />
          </AuthGuard>,
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default router;
