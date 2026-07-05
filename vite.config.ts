import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';
import { visualizer } from 'rollup-plugin-visualizer';

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3001';

  return {
    base: env.VITE_APP_BASE || '/',
    plugins: [
      vue(),
      // antd v4 使用 CSS-in-JS，无需样式按需引入，importStyle 关闭
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: false })],
        dts: 'src/components.d.ts',
      }),
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: env.VITE_DEV_HOST || '127.0.0.1',
      port: toNumber(env.VITE_DEV_PORT, 3000),
      strictPort: false,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      host: env.VITE_PREVIEW_HOST || '127.0.0.1',
      port: toNumber(env.VITE_PREVIEW_PORT, 4173),
      strictPort: false,
    },
    build: {
      target: 'es2020',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // antd/icons 不再强制单 chunk：按需引入后交由 rollup 按页面依赖自然拆分，
          // 登录等轻页面无需加载完整组件库
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            request: ['axios'],
            realtime: ['socket.io-client'],
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  };
});
