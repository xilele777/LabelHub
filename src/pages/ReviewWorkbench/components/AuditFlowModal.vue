<template>
  <a-modal
    :open="open"
    title="流转记录"
    width="760px"
    :footer="null"
    @update:open="emit('update:open', $event)"
  >
    <div class="lh-modal-detail">
      <a-empty v-if="records.length === 0" description="暂无审核记录" />
      <a-timeline v-else mode="left" class="audit-timeline">
        <a-timeline-item
          v-for="record in records"
          :key="record.id"
          :color="actionMeta(record.actionType).color"
        >
          <div class="timeline-row">
            <a-space wrap>
              <a-tag :color="actionMeta(record.actionType).tagColor">
                {{ actionMeta(record.actionType).label }}
              </a-tag>
              <a-tag>{{ statusLabel(record.fromStatus) }}</a-tag>
              <span class="timeline-arrow">→</span>
              <a-tag>{{ statusLabel(record.toStatus) }}</a-tag>
            </a-space>
            <div class="timeline-meta">
              {{ record.operator }} · {{ formatTime(record.timestamp) }}
            </div>
            <a-typography-paragraph v-if="record.reason" class="timeline-reason">
              {{ record.reason }}
            </a-typography-paragraph>
          </div>
        </a-timeline-item>
      </a-timeline>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { AuditHistoryRecord } from '../../../types';
import { actionMeta, formatTime, statusLabel } from '../reviewDisplay';

defineProps<{
  open: boolean;
  records: AuditHistoryRecord[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();
</script>

<style scoped>
.audit-timeline {
  margin-top: 12px;
}

.timeline-row {
  padding-bottom: 8px;
}

.timeline-meta {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 12px;
}

.timeline-arrow {
  color: #8c8c8c;
}

.timeline-reason {
  margin: 6px 0 0;
  padding: 6px 8px;
  background: #f8fafc;
  border-left: 3px solid #d7dde7;
  border-radius: 4px;
}
</style>
