import { computed, getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue';
import { FieldType, type AnnotationTemplate, type DataItem } from '../../../types';
import {
  ReviewStatus,
  type AIReviewResult,
  type FieldWarning,
  type Severity,
} from '../../../types/aiReview';
import { getNumberField, isEmpty } from '../fieldHelpers';

export interface UseLivePreReviewOptions {
  templateSchema: Ref<AnnotationTemplate | undefined>;
  currentItem: Ref<DataItem | undefined>;
  formState: Record<string, unknown>;
  /** 表单变化后防抖延迟 (ms)，默认 300。避免逐键触发全量规则重算。 */
  debounceMs?: number;
}

/**
 * 本地实时预审引擎：监听表单变化，按模板规则（必填/评分范围/文本长度/选项完整性）
 * 即时产出与后端规则预审同构的结果对象，用于标注过程中的实时反馈。
 *
 * 性能策略：
 * - templateSchema / currentItem 切换立即响应（数据源变化）；
 * - formState 变化经过防抖（250-300ms）后再计算，避免逐键触发 O(n×rules) 遍历；
 * - 表单快照采用浅层拷贝，因为字段值都是原始类型（string/number/boolean）。
 */
export function useLivePreReview(options: UseLivePreReviewOptions) {
  const { templateSchema, currentItem, formState, debounceMs = 300 } = options;

  const liveReviewResult = ref<AIReviewResult>(createEmptyReview());
  /** 防抖后的表单浅层快照 */
  const formSnapshot = ref<Record<string, unknown>>({});
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function createEmptyReview(): AIReviewResult {
    return {
      id: 'local_empty',
      dataItemId: currentItem.value?.id ?? '',
      taskId: currentItem.value?.taskId ?? '',
      templateId: templateSchema.value?.id ?? '',
      reviewStatus: ReviewStatus.PASS,
      score: 100,
      summary: '实时预审通过，当前未发现风险。',
      matchedRules: [],
      fieldWarnings: [],
      suggestions: [],
      reviewedAt: new Date().toISOString(),
      modelVersion: 'labelhub-local-watch-v1',
    };
  }

  function runReactivePreReview(): AIReviewResult {
    if (!templateSchema.value || !currentItem.value) return createEmptyReview();

    const warnings: FieldWarning[] = [];
    for (const field of templateSchema.value.fields) {
      if (field.type === FieldType.TITLE) continue;
      // 使用防抖后的快照而非原始 formState，保持与 watch 触发方一致
      const value = formSnapshot.value[field.fieldKey];

      if (field.required && isEmpty(value)) {
        warnings.push({
          fieldKey: field.fieldKey,
          fieldLabel: field.label,
          message: `"${field.label}" 为必填字段`,
          value,
          severity: 'error',
        });
        continue;
      }

      if (field.type === FieldType.RATING && !isEmpty(value)) {
        const maxScore = getNumberField(field, 'maxScore', 5) ?? 5;
        const score = Number(value);
        if (!Number.isFinite(score) || score < 0 || score > maxScore) {
          warnings.push({
            fieldKey: field.fieldKey,
            fieldLabel: field.label,
            message: `"${field.label}" 评分超出允许范围 0-${maxScore}`,
            value,
            severity: 'error',
          });
        } else if (score > 0 && score < 2) {
          warnings.push({
            fieldKey: field.fieldKey,
            fieldLabel: field.label,
            message: `"${field.label}" 评分偏低，建议复核标注判断`,
            value,
            severity: 'warning',
          });
        }
      }

      if (
        (field.type === FieldType.INPUT || field.type === FieldType.TEXTAREA) &&
        !isEmpty(value)
      ) {
        const text = String(value);
        const minLength = getNumberField(field, 'minLength', 2) ?? 2;
        if (text.length < minLength) {
          warnings.push({
            fieldKey: field.fieldKey,
            fieldLabel: field.label,
            message: `"${field.label}" 文本过短，当前 ${text.length} 字符，建议至少 ${minLength} 字符`,
            value,
            severity: 'warning',
          });
        }
      }

      if (
        [FieldType.RADIO, FieldType.CHECKBOX, FieldType.SELECT].includes(field.type) &&
        !field.required &&
        isEmpty(value)
      ) {
        warnings.push({
          fieldKey: field.fieldKey,
          fieldLabel: field.label,
          message: `"${field.label}" 未选择，可能影响分类完整性`,
          value,
          severity: 'info',
        });
      }
    }

    const score = calculateScore(warnings);
    const reviewStatus = deriveReviewStatus(score, warnings);
    return {
      id: `local_${currentItem.value.id}`,
      dataItemId: currentItem.value.id,
      taskId: currentItem.value.taskId,
      templateId: templateSchema.value.id,
      reviewStatus,
      score,
      summary: buildReviewSummary(reviewStatus, score),
      matchedRules: [],
      fieldWarnings: warnings,
      suggestions: [],
      reviewedAt: new Date().toISOString(),
      modelVersion: 'labelhub-local-watch-v1',
    };
  }

  function calculateScore(warnings: FieldWarning[]) {
    const deduction = warnings.reduce((sum, warning) => {
      if (warning.severity === 'error') return sum + 30;
      if (warning.severity === 'warning') return sum + 15;
      return sum + 5;
    }, 0);
    return Math.max(0, 100 - deduction);
  }

  function deriveReviewStatus(score: number, warnings: FieldWarning[]) {
    if (warnings.some((warning) => warning.severity === 'error') || score < 60)
      return ReviewStatus.FAIL;
    if (warnings.some((warning) => warning.severity === 'warning') || score < 80)
      return ReviewStatus.RISK;
    return ReviewStatus.PASS;
  }

  function buildReviewSummary(status: ReviewStatus, score: number) {
    if (status === ReviewStatus.PASS) return `实时预审通过，质量评分 ${score} 分。`;
    if (status === ReviewStatus.RISK)
      return `实时预审发现风险项，质量评分 ${score} 分，建议提交前复核。`;
    return `实时预审未通过，质量评分 ${score} 分，请修正严重问题后提交。`;
  }

  // ── 防抖：formState 变化时生成浅拷贝快照，定时器到期后更新 ──
  watch(
    () => {
      // 浅拷贝快照：formState 的值均为原始类型，无需深度遍历
      const snapshot: Record<string, unknown> = {};
      for (const key of Object.keys(formState)) {
        snapshot[key] = formState[key];
      }
      return snapshot;
    },
    (snapshot) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        formSnapshot.value = snapshot;
      }, debounceMs);
    },
    { immediate: true },
  );

  // ── 防抖后的快照 + schema/item 变化 → 执行规则计算 ──
  // templateSchema / currentItem 是 Ref 切换，立即响应；formState 经防抖后生效。
  watch(
    [formSnapshot, templateSchema, currentItem],
    () => {
      liveReviewResult.value = runReactivePreReview();
    },
    { immediate: true },
  );

  const riskStats = computed(() => {
    const init = { error: 0, warning: 0, info: 0 };
    return liveReviewResult.value.fieldWarnings.reduce((stats, warning) => {
      stats[warning.severity] += 1;
      return stats;
    }, init);
  });

  const sortedWarnings = computed(() => {
    const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
    return [...liveReviewResult.value.fieldWarnings].sort(
      (a, b) => order[a.severity] - order[b.severity],
    );
  });

  function fieldWarnings(fieldKey: string) {
    return liveReviewResult.value.fieldWarnings.filter((warning) => warning.fieldKey === fieldKey);
  }

  function fieldValidateStatus(fieldKey: string) {
    const warnings = fieldWarnings(fieldKey);
    if (warnings.some((warning) => warning.severity === 'error')) return 'error';
    if (warnings.some((warning) => warning.severity === 'warning')) return 'warning';
    return undefined;
  }

  function fieldHelp(fieldKey: string) {
    return (
      fieldWarnings(fieldKey)
        .map((warning) => warning.message)
        .join('；') || undefined
    );
  }

  // 组件卸载时清理防抖定时器，防止内存泄漏
  if (getCurrentScope()) {
    onScopeDispose(() => clearTimeout(debounceTimer));
  }

  return { liveReviewResult, riskStats, sortedWarnings, fieldValidateStatus, fieldHelp };
}
