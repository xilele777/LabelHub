import {
  createRouter,
  createWebHistory,
  type RouteComponent,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router';
import { Role } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { getDefaultPath, hasRouteRole } from '../utils/roleHelper';
import { preloadTemplateSchemas } from '../utils/templateSchemaHelper';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    roles?: Role[];
  }
}

type LazyRouteComponent = () => Promise<RouteComponent>;

function lazy(loader: LazyRouteComponent): LazyRouteComponent {
  return loader;
}

const MainLayout = lazy(() => import('../layouts/MainLayout.vue'));
const Login = lazy(() => import('../pages/Login/index.vue'));
const Forbidden = lazy(() => import('../pages/Exception/Forbidden.vue'));
const NotFound = lazy(() => import('../pages/Exception/NotFound.vue'));

export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'Dashboard',
    component: lazy(() => import('../pages/Dashboard/index.vue')),
    meta: {
      title: '仪表盘',
      roles: [Role.ADMIN, Role.ANNOTATOR, Role.REVIEWER],
    },
  },
  {
    path: 'tasks',
    name: 'TaskList',
    component: lazy(() => import('../pages/TaskList/index.vue')),
    meta: {
      title: '任务列表',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'tasks/create',
    name: 'TaskCreate',
    component: lazy(() => import('../pages/TaskForm/index.vue')),
    meta: {
      title: '创建任务',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'tasks/detail',
    name: 'TaskDetail',
    component: lazy(() => import('../pages/TaskDetail/index.vue')),
    meta: {
      title: '任务详情',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'tasks/edit',
    name: 'TaskEdit',
    component: lazy(() => import('../pages/TaskForm/index.vue')),
    meta: {
      title: '编辑任务',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'archive',
    name: 'TaskArchive',
    component: lazy(() => import('../pages/TaskArchive/index.vue')),
    meta: {
      title: '任务归档',
      roles: [Role.ADMIN, Role.ANNOTATOR, Role.REVIEWER],
    },
  },
  {
    path: 'templates',
    name: 'TemplateManage',
    component: lazy(() => import('../pages/TemplateManage/index.vue')),
    meta: {
      title: '模板管理',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'templates/builder',
    name: 'TemplateBuilder',
    component: lazy(() => import('../pages/TemplateBuilder/index.vue')),
    meta: {
      title: '模板搭建',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'annotate',
    name: 'AnnotationWorkbench',
    component: lazy(() => import('../pages/AnnotationWorkbench/index.vue')),
    meta: {
      title: '标注工作台',
      roles: [Role.ANNOTATOR],
    },
  },
  {
    path: 'review',
    name: 'ReviewWorkbench',
    component: lazy(() => import('../pages/ReviewWorkbench/index.vue')),
    meta: {
      title: '审核工作台',
      roles: [Role.REVIEWER],
    },
  },
  {
    path: 'export',
    name: 'DataExport',
    component: lazy(() => import('../pages/DataExport/index.vue')),
    meta: {
      title: '数据导出',
      roles: [Role.ADMIN, Role.REVIEWER],
    },
  },
  {
    path: 'statistics',
    name: 'StatisticsBoard',
    component: lazy(() => import('../pages/StatisticsBoard/index.vue')),
    meta: {
      title: '统计看板',
      roles: [Role.ADMIN, Role.REVIEWER],
    },
  },
  {
    path: 'monitoring',
    name: 'MonitoringBoard',
    component: lazy(() => import('../pages/MonitoringBoard/index.vue')),
    meta: {
      title: '性能监控',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'users',
    name: 'UserManage',
    component: lazy(() => import('../pages/UserManage/index.vue')),
    meta: {
      title: '用户管理',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'notifications/publish',
    name: 'NotificationPublish',
    component: lazy(() => import('../pages/NotificationPublish/index.vue')),
    meta: {
      title: '通知发布',
      roles: [Role.ADMIN],
    },
  },
  {
    path: 'notifications/manage',
    name: 'NotificationManage',
    component: lazy(() => import('../pages/NotificationManage/index.vue')),
    meta: {
      title: '通知管理',
      roles: [Role.ADMIN],
    },
  },
];

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: {
      title: '登录',
      requiresAuth: false,
    },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: Forbidden,
    meta: {
      title: '无权限',
      requiresAuth: true,
    },
  },
  {
    path: '/',
    name: 'Root',
    component: MainLayout,
    redirect: '/dashboard',
    meta: {
      requiresAuth: true,
    },
    children: asyncRoutes,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
    meta: {
      title: '页面不存在',
      requiresAuth: false,
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

let templateSchemasPreloaded = false;

function isPublicRoute(to: RouteLocationNormalized): boolean {
  return to.matched.some((record) => record.meta.requiresAuth === false);
}

function getRequiredRoles(to: RouteLocationNormalized): Role[] {
  const roles = to.matched.flatMap((record) => record.meta.roles ?? []);
  return Array.from(new Set(roles));
}

router.beforeEach((to) => {
  const userStore = useAuthStore();
  const isLoggedIn = Boolean(userStore.token && userStore.user);

  if (to.path === '/login' && isLoggedIn && userStore.user) {
    return getDefaultPath(userStore.user.role);
  }

  if (!isPublicRoute(to) && !isLoggedIn) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
      replace: true,
    };
  }

  const requiredRoles = getRequiredRoles(to);
  if (requiredRoles.length > 0) {
    if (!hasRouteRole(userStore.user?.role, requiredRoles)) {
      return {
        path: '/403',
        replace: true,
      };
    }
  }

  if (isLoggedIn && !templateSchemasPreloaded) {
    templateSchemasPreloaded = true;
    void preloadTemplateSchemas();
  }

  if (!isLoggedIn) {
    templateSchemasPreloaded = false;
  }

  return true;
});

export default router;
