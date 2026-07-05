<template>
  <a-modal
    :open="open"
    title="驳回标注"
    ok-text="确认驳回"
    cancel-text="取消"
    :confirm-loading="loading"
    :ok-button-props="{ danger: true }"
    @update:open="emit('update:open', $event)"
    @ok="handleOk"
  >
    <div class="lh-modal-stack">
      <a-alert
        type="warning"
        show-icon
        message="驳回后数据会返回给标注员重新修改，请填写清晰的原因。"
        class="reject-alert"
      />
      <a-textarea
        v-model:value="reason"
        :rows="5"
        :maxlength="500"
        show-count
        placeholder="请输入驳回原因"
      />
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';

const props = defineProps<{
  open: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [reason: string];
}>();

const reason = ref('');

// 每次打开重置原因，避免上一次驳回内容残留
watch(
  () => props.open,
  (open) => {
    if (open) reason.value = '';
  },
);

function handleOk() {
  const trimmed = reason.value.trim();
  if (!trimmed) {
    message.warning('请填写驳回原因');
    return;
  }
  emit('confirm', trimmed);
}
</script>

<style scoped>
.reject-alert {
  margin-bottom: 12px;
}
</style>
