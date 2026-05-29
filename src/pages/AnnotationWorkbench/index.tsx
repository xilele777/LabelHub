import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Row, Col, Card, Steps, Tag, Button, Space, message, Typography, Spin, Empty, Alert, Modal, Table, Select, Checkbox } from 'antd';
import {
  SaveOutlined,
  SendOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  RobotOutlined,
  FormOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  PlusCircleOutlined,
  ShoppingOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { DataItemStatus, type DataItem, type AnnotationTemplate } from '../../types';
import { ReviewStatus, type ReviewSuggestion } from '../../types/aiReview';
import { useTaskStore } from '../../store/useTaskStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getTemplateSchemaAsync } from '../../utils/templateSchemaHelper';
import DynamicSchemaForm from '../../components/DynamicSchemaForm';
import CompactAuditHistory from '../../components/CompactAuditHistory';
import RawDataPanel from './components/RawDataPanel';
import AIReviewPanel from './components/AIReviewPanel';

const { Title, Text } = Typography;

const statusConfig: Record<DataItemStatus, { label: string; color: string }> = {
  [DataItemStatus.PENDING]: { label: '待标注', color: 'default' },
  [DataItemStatus.DRAFT]: { label: '草稿', color: 'processing' },
  [DataItemStatus.SUBMITTED]: { label: '已提交', color: 'success' },
  [DataItemStatus.AI_REVIEWING]: { label: 'AI预审中', color: 'processing' },
  [DataItemStatus.AI_REVIEWED]: { label: 'AI已预审', color: 'cyan' },
  [DataItemStatus.PENDING_REVIEW]: { label: '待人工审核', color: 'orange' },
  [DataItemStatus.REVIEWED]: { label: '已审核', color: 'green' },
  [DataItemStatus.REJECTED]: { label: '已驳回', color: 'red' },
};

const progressConfig: Record<DataItemStatus, { current: number; annotationTitle: string }> = {
  [DataItemStatus.PENDING]: { current: 0, annotationTitle: '待标注' },
  [DataItemStatus.DRAFT]: { current: 0, annotationTitle: '草稿' },
  [DataItemStatus.REJECTED]: { current: 0, annotationTitle: '已驳回' },
  [DataItemStatus.SUBMITTED]: { current: 1, annotationTitle: '已提交' },
  [DataItemStatus.AI_REVIEWING]: { current: 1, annotationTitle: '已提交' },
  [DataItemStatus.AI_REVIEWED]: { current: 1, annotationTitle: '已提交' },
  [DataItemStatus.PENDING_REVIEW]: { current: 2, annotationTitle: '已提交' },
  [DataItemStatus.REVIEWED]: { current: 3, annotationTitle: '已提交' },
};

export default function AnnotationWorkbench() {
  const [searchParams] = useSearchParams();
  const queryTaskId = searchParams.get('taskId') || undefined;
  const queryDataItemId = searchParams.get('dataItemId') || undefined;
  const [submitting, setSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  // AI 预审结果与标注表单的切换：true 显示表单，false 显示 AI 预审
  const [showFormView, setShowFormView] = useState(false);
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const formAreaRef = useRef<HTMLDivElement>(null);

  const {
    dataItems,
    aiReviewResults,
    currentIndex,
    loading,
    error,
    conflictInfo,
    setCurrentIndex,
    saveDraft,
    submitAnnotation,
    resubmitItem,
    fetchDataItems,
    fetchAIReviews,
    resolveConflictWithServer,
    clearConflict,
    availableItems,
    availableLoading,
    fetchAvailableItems,
    claimAssignment,
    batchClaimAssignments,
  } = useAnnotationStore();
  const tasks = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const user = useAuthStore((s) => s.user);

  // 领取弹窗状态
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [continuousClaimEnabled, setContinuousClaimEnabled] = useState(false);
  const [filterTaskId, setFilterTaskId] = useState<string | undefined>(undefined);

  // 页面加载时从 API 获取数据
  useEffect(() => {
    fetchTasks();
    fetchDataItems(queryTaskId);
    fetchAIReviews(queryTaskId);
  }, [fetchTasks, fetchDataItems, fetchAIReviews, queryTaskId]);

  useEffect(() => {
    if (dataItems.length === 0) return;

    if (queryDataItemId) {
      const targetIndex = dataItems.findIndex((item) => item.id === queryDataItemId);
      if (targetIndex >= 0 && targetIndex !== currentIndex) {
        setCurrentIndex(targetIndex);
      }
      return;
    }

    if (currentIndex >= dataItems.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, dataItems, queryDataItemId, setCurrentIndex]);

  const currentItem = dataItems[currentIndex] as DataItem | undefined;

  /** 打开领取弹窗 */
  const handleOpenClaimModal = useCallback(() => {
    setClaimModalOpen(true);
    setSelectedClaimIds([]);
    fetchAvailableItems(filterTaskId);
  }, [fetchAvailableItems, filterTaskId]);

  const focusClaimedItem = useCallback((id: string) => {
    const newItems = useAnnotationStore.getState().dataItems;
    const idx = newItems.findIndex((d) => d.id === id);
    if (idx >= 0) setCurrentIndex(idx);
  }, [setCurrentIndex]);

  /** 领取一个标注项 */
  const handleClaimAssignment = useCallback(async (id: string) => {
    setClaimingId(id);
    const ok = await claimAssignment(id);
    setClaimingId(null);
    if (ok) {
      message.success('领取成功，该标注项已分配给你');
      // 关闭弹窗，切换到刚领取的项
      setClaimModalOpen(false);
      // dataItems 已经在 store 中更新了，设置 currentIndex 到最新项
      focusClaimedItem(id);
    }
  }, [claimAssignment, focusClaimedItem]);

  const handleBatchClaimAssignments = useCallback(async (ids = selectedClaimIds) => {
    if (ids.length === 0) {
      message.warning('请先选择要领取的标注任务');
      return;
    }

    setBatchClaiming(true);
    const result = await batchClaimAssignments(ids);
    setBatchClaiming(false);

    if (!result) {
      message.error('批量领取失败');
      return;
    }

    setSelectedClaimIds((prev) => prev.filter((id) => !result.claimed.some((item) => item.id === id)));
    const firstClaimed = result.claimed[0];
    if (firstClaimed) {
      message.success(`已领取 ${result.claimedCount} 条标注任务`);
      setClaimModalOpen(false);
      focusClaimedItem(firstClaimed.id);
    }
    if (result.failedCount > 0) {
      message.warning(`${result.failedCount} 条领取失败，可能已被分配或不在可领取状态`);
    }
  }, [batchClaimAssignments, focusClaimedItem, selectedClaimIds]);

  const tryContinuousClaim = useCallback(async () => {
    if (!continuousClaimEnabled) return;

    const targetTaskId = filterTaskId || currentItem?.taskId || queryTaskId;
    await fetchAvailableItems(targetTaskId);
    const nextItem = useAnnotationStore.getState().availableItems[0];
    if (!nextItem) {
      message.info('当前任务暂无可连续领取的数据');
      return;
    }

    const result = await batchClaimAssignments([nextItem.id]);
    const firstClaimed = result?.claimed[0];
    if (firstClaimed) {
      message.success('已自动领取下一条标注任务');
      focusClaimedItem(firstClaimed.id);
    }
  }, [batchClaimAssignments, continuousClaimEnabled, currentItem?.taskId, fetchAvailableItems, filterTaskId, focusClaimedItem, queryTaskId]);

  // 查找当前数据项的 AI 预审结果
  const aiReviewResult = useMemo(
    () => (currentItem ? aiReviewResults.find((r) => r.dataItemId === currentItem.id) : undefined),
    [currentItem, aiReviewResults],
  );

  const task = useMemo(
    () => (currentItem ? tasks.find((t) => t.id === currentItem.taskId) : undefined),
    [currentItem, tasks],
  );

  const [template, setTemplate] = useState<AnnotationTemplate | undefined>(undefined);

  // 异步加载模板 Schema
  useEffect(() => {
    if (!task?.templateId) {
      setTemplate(undefined);
      return;
    }
    getTemplateSchemaAsync(task.templateId).then((t) => {
      setTemplate(t);
    });
  }, [task?.templateId]);

  const sameTaskItems = useMemo(
    () => (currentItem ? dataItems.filter((d) => d.taskId === currentItem.taskId) : []),
    [currentItem, dataItems],
  );
  const submittedCount = sameTaskItems.filter(
    (d) =>
      d.status === DataItemStatus.SUBMITTED ||
      d.status === DataItemStatus.AI_REVIEWING ||
      d.status === DataItemStatus.AI_REVIEWED ||
      d.status === DataItemStatus.PENDING_REVIEW ||
      d.status === DataItemStatus.REVIEWED,
  ).length;
  const totalCount = sameTaskItems.length;

  const currentGlobalIndex = useMemo(
    () => (currentItem ? sameTaskItems.findIndex((d) => d.id === currentItem.id) : -1),
    [currentItem, sameTaskItems],
  );

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < dataItems.length - 1;

  const handlePrev = useCallback(() => {
    if (canPrev) setCurrentIndex(currentIndex - 1);
  }, [canPrev, currentIndex, setCurrentIndex]);

  const handleNext = useCallback(() => {
    if (canNext) setCurrentIndex(currentIndex + 1);
  }, [canNext, currentIndex, setCurrentIndex]);

  const handleSaveDraft = useCallback(async () => {
    if (!currentItem || !user) return;
    try {
      await saveDraft(currentItem.id, formValues, user.username);
      message.success('草稿已保存');
    } catch (err: any) {
      // 冲突时由 conflictInfo 状态驱动 UI，不在此处额外提示
      if (err?.code !== 409) {
        message.error('保存草稿失败');
      }
    }
  }, [currentItem, formValues, saveDraft, user]);

  const handleSubmit = useCallback(async () => {
    if (!currentItem || !user) return;
    try {
      setSubmitting(true);
      if (currentItem.status === DataItemStatus.REJECTED) {
        await resubmitItem(currentItem.id, formValues, user.username);
        message.success('标注已重新提交，AI 预审已完成');
      } else {
        await submitAnnotation(currentItem.id, formValues, user.username);
        message.success('标注已提交，AI 预审已完成');
      }
      await tryContinuousClaim();
    } catch (err: any) {
      if (err?.code !== 409) {
        Modal.warning({
          title: '提交失败',
          content: err?.message || '提交失败，请稍后重试',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [currentItem, formValues, resubmitItem, submitAnnotation, tryContinuousClaim, user]);

  /** 冲突解决：用服务端数据覆盖本地 */
  const handleResolveConflict = useCallback(() => {
    if (!currentItem) return;
    Modal.confirm({
      title: '解决并发冲突',
      icon: <ExclamationCircleOutlined />,
      content: '你的修改与他人冲突。点击"放弃本地修改"将使用服务端最新数据覆盖你的更改，此操作不可恢复。',
      okText: '放弃本地修改',
      okType: 'danger',
      cancelText: '我再看一下',
      onOk() {
        resolveConflictWithServer(currentItem.id);
        message.success('已同步为服务端最新数据');
      },
    });
  }, [currentItem, resolveConflictWithServer]);

  // 已提交（含 AI 预审）后表单只读，驳回状态可重新编辑
  const isReadOnly =
    currentItem?.status === DataItemStatus.SUBMITTED ||
    currentItem?.status === DataItemStatus.AI_REVIEWING ||
    currentItem?.status === DataItemStatus.AI_REVIEWED ||
    currentItem?.status === DataItemStatus.PENDING_REVIEW ||
    currentItem?.status === DataItemStatus.REVIEWED;

  const isEditable = !isReadOnly && !conflictInfo;
  const canSaveDraft = !isReadOnly && currentItem?.status !== DataItemStatus.REJECTED;

  const formInitialValues = useMemo(() => {
    if (!currentItem?.annotationData) return {};
    return currentItem.annotationData;
  }, [currentItem?.annotationData]);

  // 当数据项切换时同步表单值
  useEffect(() => {
    setFormValues(formInitialValues);
  }, [formInitialValues]);

  // ⚠️ All hooks MUST be called before any early returns (React Rules of Hooks)

  /** 点击字段警告中的字段名 → 切换到表单视图 */
  const handleFieldClick = useCallback((fieldKey: string) => {
    setShowFormView(true);
    // 延迟一帧等 DOM 渲染后滚动到对应字段
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-field-key="${fieldKey}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  /** 采纳建议 → 将建议值写入表单 */
  const handleApplySuggestion = useCallback((suggestion: ReviewSuggestion) => {
    setFormValues((prev) => ({
      ...prev,
      [suggestion.fieldKey]: suggestion.suggested,
    }));
    message.success(`已采纳建议：${suggestion.fieldLabel} → ${String(suggestion.suggested)}`);
  }, []);

  // --- Early returns (after all hooks) ---

  if (loading && dataItems.length === 0) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        message={error}
        showIcon
        closable
        onClose={() => useAnnotationStore.setState({ error: null })}
        style={{ margin: '24px' }}
      />
    );
  }

  if (dataItems.length === 0) {
    return (
      <>
        <Empty description="暂无分配给您的标注数据">
          <Space direction="vertical" align="center">
            <Text type="secondary">
              您可以手动领取待标注的数据项，或等待负责人分配
            </Text>
            <Button
              type="primary"
              icon={<ShoppingOutlined />}
              onClick={handleOpenClaimModal}
            >
              领取标注任务
            </Button>
          </Space>
        </Empty>

        {/* 领取标注项弹窗 */}
        <Modal
          title="领取标注任务"
          open={claimModalOpen}
          onCancel={() => setClaimModalOpen(false)}
          footer={null}
          width={720}
        >
          <Space style={{ marginBottom: 12 }} wrap>
            <Text>按任务筛选：</Text>
            <Select
              allowClear
              placeholder="全部任务"
              style={{ width: 240 }}
              value={filterTaskId}
              onChange={(val) => setFilterTaskId(val || undefined)}
              options={tasks.filter((t) => t.status === 'in_progress').map((t) => ({ label: t.name, value: t.id }))}
            />
            <Button onClick={() => fetchAvailableItems(filterTaskId)}>刷新</Button>
            <Button
              type="primary"
              disabled={selectedClaimIds.length === 0}
              loading={batchClaiming}
              onClick={() => handleBatchClaimAssignments()}
            >
              批量领取 {selectedClaimIds.length || ''}
            </Button>
            <Checkbox
              checked={continuousClaimEnabled}
              onChange={(e) => setContinuousClaimEnabled(e.target.checked)}
            >
              连续领取
            </Checkbox>
          </Space>
          {tasks.length > 0 && tasks.every((t) => t.status !== 'in_progress') && (
            <Alert
              type="info"
              showIcon
              message="暂无可领取的任务，所有任务均未发布"
              description="任务需要由负责人发布后，标注员才能领取标注数据"
              style={{ marginBottom: 12 }}
            />
          )}
          <Table
            dataSource={availableItems}
            loading={availableLoading}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            rowSelection={{
              selectedRowKeys: selectedClaimIds,
              onChange: (keys) => setSelectedClaimIds(keys.map(String)),
            }}
            columns={[
              {
                title: 'ID',
                dataIndex: 'id',
                width: 120,
                ellipsis: true,
              },
              {
                title: '所属任务',
                dataIndex: 'taskId',
                width: 160,
                ellipsis: true,
                render: (taskId: string) => tasks.find((t) => t.id === taskId)?.name || taskId,
              },
              {
                title: '数据预览',
                dataIndex: 'rawDataPreview',
                ellipsis: true,
              },
              {
                title: '操作',
                width: 100,
                render: (_: unknown, record: { id: string }) => (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusCircleOutlined />}
                    loading={claimingId === record.id}
                    onClick={() => handleClaimAssignment(record.id)}
                  >
                    领取
                  </Button>
                ),
              },
            ]}
          />
        </Modal>
      </>
    );
  }

  if (!template) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  const statusInfo = statusConfig[currentItem!.status];
  const progressInfo = progressConfig[currentItem!.status];

  // 右侧面板：AI_REVIEWED / PENDING_REVIEW 时展示预审结果，否则展示标注表单
  const showAIReview = (currentItem!.status === DataItemStatus.AI_REVIEWED || currentItem!.status === DataItemStatus.PENDING_REVIEW) && aiReviewResult;

  // ⚠️ 并发冲突横幅：覆盖在主内容区上方
  const conflictBanner = conflictInfo ? (
    <Alert
      type="error"
      showIcon
      icon={<WarningOutlined />}
      message="并发冲突：数据已被其他操作修改"
      description={
        <Space direction="vertical" size={4}>
          <span>你的修改与服务器最新版本冲突（你的版本 {conflictInfo.currentVersion - 1}，服务器版本 {conflictInfo.currentVersion}）。</span>
          <Space>
            <Button size="small" danger onClick={handleResolveConflict}>
              放弃本地修改，使用服务端数据
            </Button>
            <Button size="small" onClick={() => clearConflict()}>
              稍后处理
            </Button>
          </Space>
        </Space>
      }
      closable
      onClose={() => clearConflict()}
      style={{ marginBottom: 12 }}
    />
  ) : null;

  // 领取标注项弹窗（在主视图中也需要使用）
  const claimModal = (
    <Modal
      title="领取标注任务"
      open={claimModalOpen}
      onCancel={() => setClaimModalOpen(false)}
      footer={null}
      width={720}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Text>按任务筛选：</Text>
        <Select
          allowClear
          placeholder="全部任务"
          style={{ width: 240 }}
          value={filterTaskId}
          onChange={(val) => setFilterTaskId(val || undefined)}
          options={tasks.filter((t) => t.status === 'in_progress').map((t) => ({ label: t.name, value: t.id }))}
        />
        <Button onClick={() => fetchAvailableItems(filterTaskId)}>刷新</Button>
        <Button
          type="primary"
          disabled={selectedClaimIds.length === 0}
          loading={batchClaiming}
          onClick={() => handleBatchClaimAssignments()}
        >
          批量领取 {selectedClaimIds.length || ''}
        </Button>
        <Checkbox
          checked={continuousClaimEnabled}
          onChange={(e) => setContinuousClaimEnabled(e.target.checked)}
        >
          连续领取
        </Checkbox>
      </Space>
      <Table
        dataSource={availableItems}
        loading={availableLoading}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 8 }}
        rowSelection={{
          selectedRowKeys: selectedClaimIds,
          onChange: (keys) => setSelectedClaimIds(keys.map(String)),
        }}
        columns={[
          {
            title: 'ID',
            dataIndex: 'id',
            width: 120,
            ellipsis: true,
          },
          {
            title: '所属任务',
            dataIndex: 'taskId',
            width: 160,
            ellipsis: true,
            render: (taskId: string) => tasks.find((t) => t.id === taskId)?.name || taskId,
          },
          {
            title: '数据预览',
            dataIndex: 'rawDataPreview',
            ellipsis: true,
          },
          {
            title: '操作',
            width: 100,
            render: (_: unknown, record: { id: string }) => (
              <Button
                type="primary"
                size="small"
                icon={<PlusCircleOutlined />}
                loading={claimingId === record.id}
                onClick={() => handleClaimAssignment(record.id)}
              >
                领取
              </Button>
            ),
          },
        ]}
      />
    </Modal>
  );

  return (
    <>
    {claimModal}
    <Spin spinning={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* 顶部信息栏 - 固定高度，不滚动 */}
        <Card size="small" style={{ marginBottom: 12, flexShrink: 0 }}>
          <Row justify="space-between" align="middle" wrap>
            <Col flex="auto" style={{ minWidth: 0 }}>
              <Space size="middle" wrap>
                <Title level={5} style={{ margin: 0 }}>{task?.name ?? '—'}</Title>
                <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                <Text type="secondary">{currentGlobalIndex + 1} / {totalCount}</Text>
                <Button
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={() => setFlowModalOpen(true)}
                >
                  流转记录
                </Button>
              </Space>
            </Col>
            <Col flex="none">
              <Steps
                size="small"
                current={progressInfo.current}
                items={[
                  { title: progressInfo.annotationTitle, icon: <FileTextOutlined /> },
                  { title: `AI 预审`, icon: <RobotOutlined /> },
                  { title: `待审核 ${submittedCount}/${totalCount}`, icon: <CheckCircleOutlined /> },
                  { title: '完成', icon: <CheckCircleOutlined /> },
                ]}
                style={{ minWidth: 420, maxWidth: 520 }}
              />
            </Col>
          </Row>
          {task?.instructions && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              <EditOutlined style={{ marginRight: 4 }} />
              {task.instructions}
            </Text>
          )}
        </Card>

        {/* 并发冲突提示横幅 */}
        {conflictBanner}

        {/* 主内容区 - flex:1 占满剩余空间，内部左右分栏 */}
        <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>
          {/* 左侧：原始数据 */}
          <div style={{ width: '41.666%', flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <RawDataPanel dataItem={currentItem!} />
          </div>
          {/* 右侧：标注表单 / AI预审 */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }} ref={formAreaRef}>
            {showAIReview && !showFormView ? (
              <AIReviewPanel
                result={aiReviewResult!}
                onFieldClick={handleFieldClick}
                onApplySuggestion={handleApplySuggestion}
              />
            ) : (
              <Card
                title="标注表单"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                styles={{ body: { overflowY: 'auto', flex: 1, minHeight: 0 } }}
                extra={
                  showAIReview ? (
                    <Button
                      size="small"
                      type="link"
                      icon={<RobotOutlined />}
                      onClick={() => setShowFormView(false)}
                    >
                      查看 AI 预审
                    </Button>
                  ) : null
                }
              >
                <DynamicSchemaForm
                  schema={template.fields}
                  value={formValues}
                  onChange={setFormValues}
                  readonly={!isEditable}
                  key={currentItem!.id}
                />
              </Card>
            )}
          </div>
        </div>

        {/* 底部操作栏 - 固定高度，不滚动 */}
        <Card size="small" style={{ marginTop: 12, flexShrink: 0 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button icon={<LeftOutlined />} disabled={!canPrev} onClick={handlePrev}>
                  上一条
                </Button>
                <Button icon={<RightOutlined />} disabled={!canNext} onClick={handleNext}>
                  下一条
                </Button>
                <Button icon={<ShoppingOutlined />} onClick={handleOpenClaimModal}>
                  领取更多
                </Button>
                <Checkbox
                  checked={continuousClaimEnabled}
                  onChange={(e) => setContinuousClaimEnabled(e.target.checked)}
                >
                  连续领取
                </Checkbox>
              </Space>
            </Col>
            <Col>
              <Space>
                {/* 待标注 / 草稿 状态：可保存草稿、提交 */}
                {!isReadOnly && (
                  <>
                    {canSaveDraft && (
                      <Button icon={<SaveOutlined />} onClick={handleSaveDraft} disabled={!!conflictInfo}>
                        保存草稿
                      </Button>
                    )}
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={submitting}
                      onClick={handleSubmit}
                      disabled={!!conflictInfo}
                    >
                      {currentItem!.status === DataItemStatus.REJECTED ? '重新提交' : '提交'}
                    </Button>
                  </>
                )}
                {/* AI 已预审状态：显示预审结果摘要 + 切换按钮 */}
                {showAIReview && (
                  <>
                    <Tag
                      icon={<RobotOutlined />}
                      color={
                        aiReviewResult!.reviewStatus === ReviewStatus.PASS
                          ? 'success'
                          : aiReviewResult!.reviewStatus === ReviewStatus.RISK
                            ? 'warning'
                            : 'error'
                      }
                      style={{ fontSize: 14, padding: '4px 12px' }}
                    >
                      AI预审：{aiReviewResult!.score}分
                    </Tag>
                    <Button
                      icon={showFormView ? <RobotOutlined /> : <FormOutlined />}
                      onClick={() => setShowFormView((v) => !v)}
                    >
                      {showFormView ? '预审结果' : '标注表单'}
                    </Button>
                  </>
                )}
                {/* 已提交（旧流程，无AI预审） */}
                {currentItem!.status === DataItemStatus.SUBMITTED && (
                  <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                    已提交
                  </Tag>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      </div>
    </Spin>
    <Modal
      title="流转记录"
      open={flowModalOpen}
      onCancel={() => setFlowModalOpen(false)}
      footer={<Button onClick={() => setFlowModalOpen(false)}>关闭</Button>}
      width={760}
    >
      <CompactAuditHistory history={currentItem!.auditHistory || []} />
    </Modal>
    </>
  );
}
