import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import { RouterView } from 'vue-router';
import Antd, { ConfigProvider } from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import router from './router';
import { setUnauthorizedHandler } from './api/request';
import './assets/global.css';

const googleTheme = {
  token: {
    colorPrimary: '#1a73e8',
    colorSuccess: '#188038',
    colorWarning: '#f9ab00',
    colorError: '#d93025',
    colorInfo: '#129eaf',
    colorText: '#202124',
    colorTextSecondary: '#5f6368',
    colorBorder: '#e0e3eb',
    borderRadius: 8,
    fontFamily: "Inter, Roboto, 'Google Sans', 'Segoe UI', Arial, sans-serif",
  },
};

const app = createApp({
  render: () => h(ConfigProvider, { theme: googleTheme }, () => h(RouterView)),
});

setUnauthorizedHandler(() => {
  const current = router.currentRoute.value;
  if (current.path === '/login') return;

  void router.replace({
    path: '/login',
    query: {
      redirect: current.fullPath,
    },
  });
});

app.use(createPinia());
app.use(router);
app.use(Antd);

// ─── Global Vue error boundary ─────────────────────────────
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue Error]', err, 'Info:', info);

  // Report to backend error-tracking endpoint in production
  if (import.meta.env.PROD) {
    try {
      const payload = JSON.stringify({
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        info,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
      navigator.sendBeacon('/api/error-report', payload);
    } catch {
      // Silently fail — error reporting itself should not cause errors.
    }
  }
};

app.config.warnHandler = (msg, _instance, trace) => {
  if (import.meta.env.DEV) {
    console.warn(`[Vue Warning] ${msg}`, trace);
  }
};

app.mount('#root');
