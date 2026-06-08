<template>
  <section class="user-manage-page app-page">
    <header class="app-page-header">
      <div class="app-page-title">
        <a-typography-title :level="5" class="page-title">用户管理</a-typography-title>
        <a-typography-text class="app-page-desc" type="secondary">维护平台用户和角色权限。</a-typography-text>
      </div>
      <div class="app-page-tools">
        <a-button :loading="loading" @click="fetchUsers">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button type="primary" @click="openCreate">
          <template #icon><UserAddOutlined /></template>
          新增用户
        </a-button>
      </div>
    </header>

    <a-card size="small" class="app-table-card" :body-style="{ padding: 0 }">
      <a-table
        row-key="id"
        size="small"
        :columns="columns"
        :data-source="users"
        :loading="loading"
        :pagination="{ pageSize: 20, showSizeChanger: false }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="getRoleMeta(record.role).color">{{ getRoleMeta(record.role).label }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a-button type="link" size="small" @click="openEdit(record)">
                <template #icon><EditOutlined /></template>
                编辑
              </a-button>
              <a-button type="link" size="small" @click="openPassword(record)">
                <template #icon><KeyOutlined /></template>
                改密
              </a-button>
              <a-popconfirm :title="`确定删除用户 ${record.username} 吗？`" @confirm="handleDelete(record.id)">
                <a-button type="link" size="small" danger>
                  <template #icon><DeleteOutlined /></template>
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="createModalOpen" title="新增用户" width="520px" ok-text="创建" :confirm-loading="submitting" @ok="handleCreate">
      <a-form ref="createFormRef" :model="createForm" :rules="createRules" layout="vertical" autocomplete="off" class="modal-form">
        <a-form-item name="username" label="用户名">
          <a-input v-model:value="createForm.username" :maxlength="30" placeholder="请输入用户名" />
        </a-form-item>
        <a-form-item name="password" label="密码">
          <a-input-password v-model:value="createForm.password" :maxlength="50" placeholder="请输入密码" />
        </a-form-item>
        <a-form-item name="role" label="角色">
          <a-select v-model:value="createForm.role" :options="roleOptions" placeholder="请选择角色" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editModalOpen" title="编辑用户" width="520px" ok-text="保存" :confirm-loading="submitting" @ok="handleEdit">
      <a-form ref="editFormRef" :model="editForm" :rules="editRules" layout="vertical" autocomplete="off" class="modal-form">
        <a-form-item name="username" label="用户名">
          <a-input v-model:value="editForm.username" :maxlength="30" placeholder="请输入用户名" />
        </a-form-item>
        <a-form-item name="role" label="角色">
          <a-select v-model:value="editForm.role" :options="roleOptions" placeholder="请选择角色" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="passwordModalOpen" title="修改密码" width="520px" ok-text="确认修改" :confirm-loading="submitting" @ok="handleChangePassword">
      <a-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" layout="vertical" autocomplete="off" class="modal-form">
        <a-form-item name="newPassword" label="新密码">
          <a-input-password v-model:value="passwordForm.newPassword" :maxlength="50" placeholder="请输入新密码" />
        </a-form-item>
        <a-form-item name="confirmPassword" label="确认密码">
          <a-input-password v-model:value="passwordForm.confirmPassword" :maxlength="50" placeholder="请再次输入新密码" />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message, type FormInstance, type FormProps, type TableColumnsType } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined, KeyOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons-vue';
import * as authApi from '../../api/auth';
import { Role, type UserInfo } from '../../types';

const users = ref<UserInfo[]>([]);
const loading = ref(false);
const submitting = ref(false);
const createModalOpen = ref(false);
const editModalOpen = ref(false);
const passwordModalOpen = ref(false);
const editingUser = ref<UserInfo | null>(null);

const createFormRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();
const passwordFormRef = ref<FormInstance>();

const createForm = reactive({ username: '', password: '', role: undefined as Role | undefined });
const editForm = reactive({ username: '', role: undefined as Role | undefined });
const passwordForm = reactive({ newPassword: '', confirmPassword: '' });

const roleOptions = [
  { label: '管理员', value: Role.ADMIN },
  { label: '负责人', value: Role.OWNER },
  { label: '标注员', value: Role.ANNOTATOR },
  { label: '审核员', value: Role.REVIEWER },
];

const columns: TableColumnsType<UserInfo> = [
  { title: '用户名', dataIndex: 'username', key: 'username', ellipsis: true },
  { title: '角色', dataIndex: 'role', key: 'role', width: 104 },
  { title: 'ID', dataIndex: 'id', key: 'id', width: 140, ellipsis: true, responsive: ['lg'] },
  { title: '操作', key: 'action', width: 176 },
];

const createRules: FormProps['rules'] = {
  username: [{ required: true, message: '请输入用户名' }, { min: 2, message: '用户名至少 2 个字符' }],
  password: [{ required: true, message: '请输入密码' }, { min: 4, message: '密码至少 4 位' }],
  role: [{ required: true, message: '请选择角色' }],
};

const editRules: FormProps['rules'] = {
  username: [{ required: true, message: '请输入用户名' }, { min: 2, message: '用户名至少 2 个字符' }],
  role: [{ required: true, message: '请选择角色' }],
};

const passwordRules: FormProps['rules'] = {
  newPassword: [{ required: true, message: '请输入新密码' }, { min: 4, message: '密码至少 4 位' }],
  confirmPassword: [
    { required: true, message: '请确认新密码' },
    {
      validator: async (_rule, value) => {
        if (value !== passwordForm.newPassword) throw new Error('两次密码输入不一致');
      },
    },
  ],
};

onMounted(() => {
  void fetchUsers();
});

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await authApi.getUserList();
    users.value = res.data.items || [];
  } catch (error) {
    message.error(error instanceof Error ? error.message : '获取用户列表失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  createForm.username = '';
  createForm.password = '';
  createForm.role = undefined;
  createModalOpen.value = true;
}

function openEdit(record: UserInfo) {
  editingUser.value = record;
  editForm.username = record.username;
  editForm.role = record.role;
  editModalOpen.value = true;
}

function openPassword(record: UserInfo) {
  editingUser.value = record;
  passwordForm.newPassword = '';
  passwordForm.confirmPassword = '';
  passwordModalOpen.value = true;
}

async function handleCreate() {
  await createFormRef.value?.validate();
  submitting.value = true;
  try {
    await authApi.createUser({
      username: createForm.username,
      password: createForm.password,
      role: createForm.role as Role,
    });
    message.success('用户创建成功');
    createModalOpen.value = false;
    await fetchUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建用户失败');
  } finally {
    submitting.value = false;
  }
}

async function handleEdit() {
  if (!editingUser.value) return;
  await editFormRef.value?.validate();
  submitting.value = true;
  try {
    await authApi.updateUser(editingUser.value.id, {
      username: editForm.username,
      role: editForm.role,
    });
    message.success('用户更新成功');
    editModalOpen.value = false;
    editingUser.value = null;
    await fetchUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新用户失败');
  } finally {
    submitting.value = false;
  }
}

async function handleChangePassword() {
  if (!editingUser.value) return;
  await passwordFormRef.value?.validate();
  submitting.value = true;
  try {
    await authApi.changePassword(editingUser.value.id, { newPassword: passwordForm.newPassword });
    message.success('密码修改成功');
    passwordModalOpen.value = false;
    editingUser.value = null;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '修改密码失败');
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(id: string) {
  try {
    await authApi.deleteUser(id);
    message.success('用户删除成功');
    await fetchUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除用户失败');
  }
}

function getRoleMeta(role: Role | string) {
  const map: Record<string, { label: string; color: string }> = {
    [Role.ADMIN]: { label: '管理员', color: 'purple' },
    [Role.OWNER]: { label: '负责人', color: 'red' },
    [Role.ANNOTATOR]: { label: '标注员', color: 'blue' },
    [Role.REVIEWER]: { label: '审核员', color: 'green' },
  };
  return map[role] ?? { label: role, color: 'default' };
}
</script>

<style scoped>
.page-title {
  margin: 0;
}

.modal-form :deep(.ant-form-item:last-child) {
  margin-bottom: 0;
}
</style>
