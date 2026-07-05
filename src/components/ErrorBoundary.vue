<template>
  <slot v-if="!error" />
  <div v-else class="error-boundary">
    <a-result status="error" title="模块加载异常" :sub-title="errorMessage">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="retry">重试</a-button>
          <a-button @click="goHome">返回首页</a-button>
        </a-space>
      </template>
    </a-result>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import { useRouter } from 'vue-router';
import { logger } from '../utils/logger';

defineOptions({ name: 'ErrorBoundary' });

const router = useRouter();

const error = ref<Error | null>(null);
const errorMessage = ref('');

onErrorCaptured((err: Error, _instance, info: string) => {
  error.value = err;
  errorMessage.value = err.message || '未知错误';

  logger.error('[ErrorBoundary]', err, 'Info:', info);

  // 生产环境上报错误
  if (import.meta.env.PROD) {
    try {
      const payload = JSON.stringify({
        message: err.message,
        stack: err.stack,
        info,
        component: 'ErrorBoundary',
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
      navigator.sendBeacon('/api/error-report', payload);
    } catch {
      // 上报本身不应引发新错误
    }
  }

  // 返回 false 阻止错误继续向上传播到全局 errorHandler
  return false;
});

function retry() {
  error.value = null;
  errorMessage.value = '';
}

function goHome() {
  error.value = null;
  errorMessage.value = '';
  void router.replace('/dashboard');
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 48px 24px;
}
</style>
