<template>
  <div class="skeleton-loader">
    <!-- Page header skeleton -->
    <div class="skeleton-header">
      <a-skeleton active :paragraph="false" :title="{ width: '30%' }" />
      <a-skeleton active :paragraph="false" :title="{ width: '60%' }" />
    </div>

    <!-- Card content skeleton -->
    <a-card class="skeleton-card">
      <template v-if="variant === 'table'">
        <!-- Table skeleton -->
        <a-skeleton active :paragraph="{ rows: 4 }" />
        <a-divider />
        <a-skeleton active :paragraph="{ rows: 4 }" />
        <a-divider />
        <a-skeleton active :paragraph="{ rows: 4 }" />
      </template>

      <template v-else-if="variant === 'card-grid'">
        <!-- Card grid skeleton -->
        <a-row :gutter="[16, 16]">
          <a-col v-for="i in 4" :key="i" :xs="24" :sm="12" :lg="6">
            <a-card>
              <a-skeleton active :paragraph="{ rows: 2 }" />
            </a-card>
          </a-col>
        </a-row>
      </template>

      <template v-else>
        <!-- Default: content skeleton -->
        <a-skeleton active :paragraph="{ rows: 6 }" />
        <a-divider />
        <a-skeleton active :paragraph="{ rows: 4 }" />
      </template>
    </a-card>
  </div>
</template>

<script setup lang="ts">
/**
 * SkeletonLoader — 通用页面骨架屏组件
 *
 * Props:
 *   variant: 'table' | 'card-grid' | 'content' (默认)
 *
 * 用法:
 *   <SkeletonLoader v-if="loading" variant="table" />
 *   <RealContent v-else ... />
 */
withDefaults(
  defineProps<{
    variant?: 'table' | 'card-grid' | 'content';
  }>(),
  {
    variant: 'content',
  },
);
</script>

<style scoped>
.skeleton-loader {
  padding: 16px 0;
}

.skeleton-header {
  margin-bottom: 24px;
}

.skeleton-header :deep(.ant-skeleton) {
  margin-bottom: 8px;
}

.skeleton-card {
  border-radius: 8px;
}
</style>
