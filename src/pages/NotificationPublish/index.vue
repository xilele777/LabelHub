<template>
  <section class="notification-page">
    <a-card class="page-hero" :body-style="{ padding: '18px 20px' }">
      <a-row :gutter="[16, 12]" align="middle" justify="space-between">
        <a-col :xs="24" :lg="14">
          <a-space>
            <NotificationOutlined class="page-icon" />
            <a-space direction="vertical" :size="4">
              <a-typography-title :level="4" class="page-title">通知发布</a-typography-title>
              <a-typography-text type="secondary">按角色或指定人员发送站内通知。</a-typography-text>
            </a-space>
          </a-space>
        </a-col>
        <a-col :xs="24" :lg="10" class="page-hero__actions">
          <a-tag color="blue">管理员权限</a-tag>
        </a-col>
      </a-row>
    </a-card>

    <a-alert type="info" show-icon message="通知会进入接收人的通知中心，可按角色、指定人员或两者组合发送。" />

    <a-card size="small" class="form-card">
      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical" autocomplete="off">
        <a-form-item name="title" label="通知标题">
          <a-input v-model:value="formState.title" :maxlength="60" show-count placeholder="例如：本周审核安排调整" />
        </a-form-item>
        <a-form-item name="message" label="通知内容">
          <a-textarea v-model:value="formState.message" :rows="6" :maxlength="500" show-count placeholder="请输入需要同步给目标人员的内容" />
        </a-form-item>
        <a-form-item name="priority" label="优先级">
          <a-select v-model:value="formState.priority" class="priority-select" :options="priorityOptions" />
        </a-form-item>
        <a-form-item name="targetRoles" label="按角色发送">
          <a-checkbox-group v-model:value="formState.targetRoles" :options="roleOptions" />
        </a-form-item>
        <a-form-item name="targetUsernames" label="按人员发送">
          <a-select
            v-model:value="formState.targetUsernames"
            mode="multiple"
            allow-clear
            show-search
            option-filter-prop="label"
            :loading="loadingUsers"
            :options="userOptions"
            placeholder="选择指定接收人员"
          />
        </a-form-item>
        <a-space wrap class="form-actions">
          <a-button type="primary" :loading="submitting" @click="handleSubmit">
            <template #icon><SendOutlined /></template>
            发布通知
          </a-button>
          <a-button @click="resetForm">重置</a-button>
          <a-typography-text type="secondary">角色和人员取并集，重复人员只发送一次。</a-typography-text>
        </a-space>
      </a-form>
    </a-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { message, type FormInstance, type FormProps } from 'ant-design-vue';
import { NotificationOutlined, SendOutlined } from '@ant-design/icons-vue';
import { publishNotification, type PublishNotificationParams } from '../../api/notification';
import * as authApi from '../../api/auth';
import { Role, type UserInfo } from '../../types';

type Priority = NonNullable<PublishNotificationParams['priority']>;

const route = useRoute();
const formRef = ref<FormInstance>();
const users = ref<UserInfo[]>([]);
const loadingUsers = ref(false);
const submitting = ref(false);

const formState = reactive({
  title: '',
  message: '',
  priority: 'medium' as Priority,
  targetRoles: [] as string[],
  targetUsernames: [] as string[],
});

const roleOptions = [
  { label: '负责人', value: Role.OWNER },
  { label: '标注员', value: Role.ANNOTATOR },
  { label: '审核员', value: Role.REVIEWER },
];

const priorityOptions = [
  { label: '普通', value: 'medium' },
  { label: '重要', value: 'high' },
  { label: '低优先级', value: 'low' },
];

const rules: FormProps['rules'] = {
  title: [{ required: true, message: '请输入通知标题' }],
  message: [{ required: true, message: '请输入通知内容' }],
};

const userOptions = computed(() =>
  users.value.map((user) => ({
    label: `${user.username} (${roleOptions.find((role) => role.value === user.role)?.label ?? user.role})`,
    value: user.username,
  })),
);

onMounted(() => {
  void fetchUsers();
  const query = route.query;
  if (typeof query.title === 'string') formState.title = query.title;
  if (typeof query.message === 'string') formState.message = query.message;
});

async function fetchUsers() {
  loadingUsers.value = true;
  try {
    const res = await authApi.getUserList();
    users.value = res.data.items || [];
  } catch (error) {
    message.error(error instanceof Error ? error.message : '获取用户列表失败');
  } finally {
    loadingUsers.value = false;
  }
}

async function handleSubmit() {
  await formRef.value?.validate();
  if (formState.targetRoles.length === 0 && formState.targetUsernames.length === 0) {
    message.warning('请至少选择一个接收角色或接收人员');
    return;
  }

  submitting.value = true;
  try {
    const res = await publishNotification({
      title: formState.title,
      message: formState.message,
      priority: formState.priority,
      targetRoles: formState.targetRoles,
      targetUsernames: formState.targetUsernames,
    });
    message.success(`通知已发布，送达 ${res.data.delivered} 人`);
    resetForm();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '发布通知失败');
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  formRef.value?.resetFields();
  formState.priority = 'medium';
  formState.targetRoles = [];
  formState.targetUsernames = [];
}
</script>

<style scoped>
.notification-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.page-hero__actions {
  text-align: right;
}

.page-title {
  margin: 0;
}

.page-icon {
  color: var(--lh-primary);
}

.form-card {
  max-width: 820px;
}

.priority-select {
  width: 180px;
}

.form-actions {
  align-items: center;
}

@media (max-width: 992px) {
  .page-hero__actions {
    text-align: left;
  }
}
</style>
