<template>
  <main class="login-page">
    <a-spin :spinning="authStore.loading">
      <a-card class="login-card">
        <div class="login-card__header">
          <a-typography-title :level="3" class="login-card__title">LabelHub</a-typography-title>
          <a-typography-text type="secondary">数据标注平台</a-typography-text>
        </div>

        <a-alert
          v-if="authStore.error"
          type="error"
          :message="authStore.error"
          show-icon
          class="login-card__alert"
        />

        <a-form
          :model="formState"
          :rules="rules"
          size="large"
          autocomplete="off"
          @finish="handleFinish"
        >
          <input
            type="text"
            name="username"
            autocomplete="username"
            class="login-card__hidden-input"
          />
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            class="login-card__hidden-input"
          />

          <a-form-item name="account">
            <a-input
              v-model:value="formState.account"
              placeholder="用户名"
              autocomplete="off"
              :disabled="authStore.loading"
            >
              <template #prefix><UserOutlined /></template>
            </a-input>
          </a-form-item>

          <a-form-item name="passcode">
            <a-input-password
              v-model:value="formState.passcode"
              placeholder="密码"
              autocomplete="new-password"
              :disabled="authStore.loading"
            >
              <template #prefix><LockOutlined /></template>
            </a-input-password>
          </a-form-item>

          <a-form-item class="login-card__submit">
            <a-button type="primary" html-type="submit" block :loading="authStore.loading">
              登录
            </a-button>
          </a-form-item>
        </a-form>
      </a-card>
    </a-spin>
  </main>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message, type FormProps } from 'ant-design-vue';
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '../../store/useAuthStore';
import { getDefaultPath } from '../../utils/roleHelper';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const formState = reactive({
  account: '',
  passcode: '',
});

const rules: FormProps['rules'] = {
  account: [{ required: true, message: '请输入用户名' }],
  passcode: [{ required: true, message: '请输入密码' }],
};

async function handleFinish() {
  const user = await authStore.login(formState.account, formState.passcode);
  if (!user) {
    message.error(authStore.error || '用户名或密码错误');
    return;
  }

  message.success('登录成功');
  const defaultPath = getDefaultPath(user.role);
  const redirect = getSafeRedirect(route.query.redirect, defaultPath);
  await router.replace(redirect);
}

function getSafeRedirect(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value === '/login' || value.startsWith('/login?')) return fallback;
  return value;
}
</script>

<style scoped>
.login-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  overflow: hidden;
  background:
    linear-gradient(
        90deg,
        rgba(66, 133, 244, 0.12) 0 25%,
        rgba(234, 67, 53, 0.1) 25% 50%,
        rgba(251, 188, 4, 0.12) 50% 75%,
        rgba(52, 168, 83, 0.1) 75% 100%
      )
      top / 100% 4px no-repeat,
    linear-gradient(180deg, #ffffff 0%, #f8fafd 100%);
}

.login-page::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background-image:
    linear-gradient(rgba(60, 64, 67, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(60, 64, 67, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(180deg, transparent 0%, #000 16%, #000 72%, transparent 100%);
}

.login-card {
  position: relative;
  width: min(420px, calc(100vw - 48px));
  background: #fff;
  border: 1px solid var(--lh-border);
  border-radius: 8px;
  box-shadow: var(--lh-shadow-lg);
}

.login-card :deep(.ant-card-body) {
  padding: 30px;
}

.login-card__header {
  margin-bottom: 28px;
  text-align: center;
}

.login-card__title {
  margin: 0 0 4px;
  color: #202124;
  letter-spacing: 0;
}

.login-card :deep(.ant-input-affix-wrapper) {
  min-height: 42px;
}

.login-card :deep(.ant-btn) {
  height: 42px;
  font-weight: 500;
}

.login-card__alert {
  margin-bottom: 16px;
}

.login-card__hidden-input {
  display: none;
}

.login-card__submit {
  margin-bottom: 0;
}
</style>
