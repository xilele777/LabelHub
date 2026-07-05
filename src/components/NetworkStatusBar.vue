<template>
  <Transition name="network-bar">
    <div v-if="visible" class="network-bar" :class="`network-bar--${state}`">
      <span class="network-bar__icon">
        <WifiOutlined v-if="state === 'online'" />
        <LoadingOutlined v-else-if="state === 'reconnecting'" spin />
        <DisconnectOutlined v-else />
      </span>
      <span class="network-bar__text">{{ message }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DisconnectOutlined, LoadingOutlined, WifiOutlined } from '@ant-design/icons-vue';
import { useNetworkStatus, type NetworkState } from '../composables/useNetworkStatus';

defineOptions({ name: 'NetworkStatusBar' });

const { state, justRecovered } = useNetworkStatus();

const visible = computed(() => state.value !== 'online' || justRecovered.value);

const message = computed(() => {
  const map: Record<NetworkState, string> = {
    online: '网络已恢复，数据已同步',
    reconnecting: '网络连接中断，正在重连…',
    offline: '网络已断开，请检查网络连接',
  };
  return map[state.value];
});
</script>

<style scoped>
.network-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  text-align: center;
  transition: background-color var(--lh-motion-base) var(--lh-ease-standard);
}

.network-bar--offline,
.network-bar--reconnecting {
  color: #fff;
  background: #d93025;
}

.network-bar--online {
  color: #fff;
  background: #188038;
}

.network-bar__icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
}

.network-bar__text {
  white-space: nowrap;
}

/* transition */
.network-bar-enter-active,
.network-bar-leave-active {
  transition:
    transform var(--lh-motion-base) var(--lh-ease-standard),
    opacity var(--lh-motion-base) var(--lh-ease-standard);
}

.network-bar-enter-from,
.network-bar-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
