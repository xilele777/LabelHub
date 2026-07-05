<template>
  <a-result status="403" title="403" sub-title="当前账号无权访问该页面">
    <template #extra>
      <a-button type="primary" @click="goHome">返回首页</a-button>
    </template>
  </a-result>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../store/useAuthStore';
import { getDefaultPath } from '../../utils/roleHelper';

const router = useRouter();
const userStore = useAuthStore();

function goHome() {
  const role = userStore.user?.role;
  router.replace(role ? getDefaultPath(role) : '/login');
}
</script>
