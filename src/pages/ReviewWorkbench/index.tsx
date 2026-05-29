import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Typography, Spin, Empty, Alert, Space, Tag, Select, Input, Button, Row, Col, message, Modal, Table, Checkbox } from 'antd';
import { FilterOutlined, ClearOutlined, InboxOutlined, ReloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { DataItemStatus, type DataItem } from '../../types';
import { ReviewStatus, type AIReviewResult } from '../../types/aiReview';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import * as taskApi from '../../api/task';
import * as annotationApi from '../../api/annotation';
import type { TaskItem } from '../../types';
import CompactAuditHistory from '../../components/CompactAuditHistory';
import ReviewList from './components/ReviewList';
import ReviewContentPanel from './components/ReviewContentPanel';
import ReviewActionPanel from './components/ReviewActionPanel';

const { Title, Text } = Typography;

/** 审核状态筛选选项 */
const STATUS_FILTER_OPTIONS = [
  { label: 'AI 预审中', value: 'ai_reviewing_group', statuses: [DataItemStatus.SUBMITTED, DataItemStatus.AI_REVIEWING, DataItemStatus.AI_REVIEWED] },
  { label: '待人工审核', value: DataItemStatus.PENDING_REVIEW },
  { label: '审核通过', value: DataItemStatus.REVIEWED },
  { label: '审核驳回', value: DataItemStatus.REJECTED },
];

/** AI 预审结论筛选选项 */
const AI_REVIEW_FILTER_OPTIONS = [
  { label: 'AI 通过', value: ReviewStatus.PASS },
  { label: 'AI 风险', value: ReviewStatus.RISK },
  { label: 'AI 不通过', value: ReviewStatus.FAIL },
];

interface FilterState {
  status: string | undefined;
  taskId: string | undefined;
  annotator: string | undefined;
  aiReviewResult: string | undefined;
  keyword: string | undefined;
}

export default function ReviewWorkbench() {
  const [searchParams] = useSearchParams();
  const queryTaskId = searchParams.get('taskId') || undefined;
  const queryDataItemId = searchParams.get('dataItemId') || undefined;
  const {
    dataItems,
    aiReviewResults,
    loading,
    error,
    fetchDataItems,
    fetchAIReviews,
  } = useAnnotationStore();

  // ===== 筛选状态 =====
  const [filters, setFilters] = useState<FilterState>({
    status: undefined,
    taskId: undefined,
    annotator: undefined,
    aiReviewResult: undefined,
    keyword: undefined,
  });
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [reviewPoolItems, setReviewPoolItems] = useState<annotationApi.AvailableItem[]>([]);
  const [reviewPoolLoading, setReviewPoolLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [continuousClaimEnabled, setContinuousClaimEnabled] = useState(false);

  useEffect(() => {
    fetchDataItems(queryTaskId);
    fetchAIReviews(queryTaskId);
    // 加载任务列表供筛选使用
    taskApi.getTaskList().then((res) => {
      setTasks(res.data.items || []);
    }).catch(() => {});
  }, [fetchDataItems, fetchAIReviews, queryTaskId]);

  const loadReviewPool = useCallback(async () => {
    setReviewPoolLoading(true);
    try {
      const res = await annotationApi.getReviewAvailableItems(filters.taskId ? { taskId: filters.taskId } : undefined);
      const items = res.data.items || [];
      setReviewPoolItems(items);
      return items;
    } catch (err: any) {
      message.error(err?.message || '加载审核任务池失败');
      return [];
    } finally {
      setReviewPoolLoading(false);
    }
  }, [filters.taskId]);

  const openClaimModal = useCallback(() => {
    setClaimModalOpen(true);
    setSelectedClaimIds([]);
    loadReviewPool();
  }, [loadReviewPool]);

  const handleClaimReview = useCallback(async (id: string) => {
    setClaimingId(id);
    try {
      await annotationApi.claimReview(id);
      message.success('审核项领取成功');
      await fetchDataItems(queryTaskId);
      await loadReviewPool();
      setSelectedId(id);
      setClaimModalOpen(false);
    } catch (err: any) {
      Modal.warning({
        title: '领取失败',
        content: err?.message || '领取审核项失败',
      });
    } finally {
      setClaimingId(null);
    }
  }, [fetchDataItems, loadReviewPool, queryTaskId]);

  // 仅展示与审核员相关的数据（已提交/待审核/已审核/已驳回），过滤已归档项
  const reviewableItems = useMemo(
    () =>
      dataItems.filter(
        (d) =>
          !d.archived &&
          (d.status === DataItemStatus.SUBMITTED ||
            d.status === DataItemStatus.AI_REVIEWING ||
            d.status === DataItemStatus.AI_REVIEWED ||
            d.status === DataItemStatus.PENDING_REVIEW ||
            d.status === DataItemStatus.REVIEWED ||
            d.status === DataItemStatus.REJECTED),
      ),
    [dataItems],
  );

  // 构建 AI 审核结果映射
  const aiResultMap = useMemo(() => {
    const map = new Map<string, AIReviewResult>();
    aiReviewResults.forEach((r) => map.set(r.dataItemId, r));
    return map;
  }, [aiReviewResults]);

  // 从可审核数据中提取标注员列表（去重）
  const annotatorOptions = useMemo(() => {
    const annotators = new Set<string>();
    reviewableItems.forEach((d) => {
      if (d.annotator) annotators.add(d.annotator);
    });
    return Array.from(annotators).sort().map((a) => ({ label: a, value: a }));
  }, [reviewableItems]);

  // 任务选项（仅显示已发布的任务，未发布任务的数据不可见）
  const taskOptions = useMemo(() => {
    return tasks.filter((t) => t.status === 'in_progress').map((t) => ({ label: t.name, value: t.id }));
  }, [tasks]);

  // 应用筛选条件
  const filteredItems = useMemo(() => {
    let result = reviewableItems;

    // 1. 按状态筛选
    if (filters.status) {
      const statusOption = STATUS_FILTER_OPTIONS.find((o) => o.value === filters.status);
      if (statusOption && 'statuses' in statusOption && Array.isArray(statusOption.statuses)) {
        result = result.filter((d) => statusOption.statuses!.includes(d.status));
      } else {
        result = result.filter((d) => d.status === filters.status);
      }
    }

    // 2. 按任务筛选
    if (filters.taskId) {
      result = result.filter((d) => d.taskId === filters.taskId);
    }

    // 3. 按标注员筛选
    if (filters.annotator) {
      result = result.filter((d) => d.annotator === filters.annotator);
    }

    // 4. 按 AI 预审结论筛选
    if (filters.aiReviewResult) {
      result = result.filter((d) => {
        const aiResult = aiResultMap.get(d.id);
        return aiResult?.reviewStatus === filters.aiReviewResult;
      });
    }

    // 5. 按关键词筛选（搜索文件名或ID）
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      result = result.filter((d) => {
        const fileName = String(d.rawData.fileName ?? '').toLowerCase();
        const description = String(d.rawData.description ?? '').toLowerCase();
        return fileName.includes(kw) || description.includes(kw) || d.id.toLowerCase().includes(kw);
      });
    }

    return result;
  }, [reviewableItems, filters, aiResultMap]);

  const handleFilterChange = useCallback((key: keyof FilterState, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      status: undefined,
      taskId: undefined,
      annotator: undefined,
      aiReviewResult: undefined,
      keyword: undefined,
    });
  }, []);

  const hasActiveFilters = useMemo(
    () => !!(filters.status || filters.taskId || filters.annotator || filters.aiReviewResult || filters.keyword),
    [filters],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleBatchClaimReviews = useCallback(async (ids = selectedClaimIds) => {
    if (ids.length === 0) {
      message.warning('请先选择要领取的审核任务');
      return;
    }

    setBatchClaiming(true);
    try {
      const res = await annotationApi.batchClaimReviews(ids);
      const result = res.data;
      setSelectedClaimIds((prev) => prev.filter((id) => !result.claimed.some((item) => item.id === id)));

      const firstClaimed = result.claimed[0];
      if (firstClaimed) {
        message.success(`已领取 ${result.claimedCount} 条审核任务`);
        await fetchDataItems(queryTaskId);
        await loadReviewPool();
        setSelectedId(firstClaimed.id);
        setClaimModalOpen(false);
      }
      if (result.failedCount > 0) {
        message.warning(`${result.failedCount} 条领取失败，可能已被分配或不在可领取状态`);
      }
    } catch (err: any) {
      Modal.warning({
        title: '批量领取失败',
        content: err?.message || '批量领取审核项失败',
      });
    } finally {
      setBatchClaiming(false);
    }
  }, [fetchDataItems, loadReviewPool, queryTaskId, selectedClaimIds]);

  const tryContinuousClaim = useCallback(async () => {
    if (!continuousClaimEnabled) return;

    const poolItems = await loadReviewPool();
    const nextItem = poolItems[0];
    if (!nextItem) {
      message.info('当前任务暂无可连续领取的审核数据');
      return;
    }

    try {
      const res = await annotationApi.batchClaimReviews([nextItem.id]);
      const result = res.data;
      const firstClaimed = result.claimed[0];
      if (firstClaimed) {
        await fetchDataItems(queryTaskId);
        await loadReviewPool();
        setSelectedId(firstClaimed.id);
        message.success('已自动领取下一条审核任务');
      }
    } catch (err: any) {
      message.warning(err?.message || '连续领取审核任务失败');
    }
  }, [continuousClaimEnabled, fetchDataItems, loadReviewPool, queryTaskId]);

  useEffect(() => {
    if (queryTaskId) {
      setFilters((prev) => (prev.taskId === queryTaskId ? prev : { ...prev, taskId: queryTaskId }));
    }
  }, [queryTaskId]);

  useEffect(() => {
    if (!queryDataItemId) return;
    if (dataItems.some((item) => item.id === queryDataItemId)) {
      setSelectedId(queryDataItemId);
    }
  }, [dataItems, queryDataItemId]);

  // 当筛选变化导致选中项不在过滤结果中时，自动清除选中
  useEffect(() => {
    if (selectedId && !filteredItems.some((d) => d.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredItems, selectedId]);

  const selectedItem = useMemo(
    () => (selectedId ? dataItems.find((d) => d.id === selectedId) : null) as DataItem | null,
    [selectedId, dataItems],
  );

  const aiReviewResult = useMemo(
    () => (selectedItem ? aiReviewResults.find((r) => r.dataItemId === selectedItem.id) : undefined),
    [selectedItem, aiReviewResults],
  );

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await annotationApi.approveAnnotation(id);
        await fetchDataItems(queryTaskId);
        message.success('审核通过');
        await tryContinuousClaim();
      } catch (err: any) {
        Modal.warning({
          title: '审核失败',
          content: err?.message || '审核通过失败',
        });
      }
    },
    [fetchDataItems, queryTaskId, tryContinuousClaim],
  );

  const handleReject = useCallback(
    async (id: string, reason: string) => {
      try {
        await annotationApi.rejectAnnotation(id, reason);
        await fetchDataItems(queryTaskId);
        message.success('已驳回');
        await tryContinuousClaim();
      } catch (err: any) {
        Modal.warning({
          title: '审核失败',
          content: err?.message || '驳回失败',
        });
      }
    },
    [fetchDataItems, queryTaskId, tryContinuousClaim],
  );

  if (loading && reviewableItems.length === 0) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* 顶部标题栏 - 固定高度 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
        <Title level={4} style={{ margin: 0 }}>审核工作台</Title>
        <Space>
          <Tag color="blue">{filteredItems.length} / {reviewableItems.length} 条</Tag>
          <Button size="small" icon={<InboxOutlined />} onClick={openClaimModal}>
            领取审核
          </Button>
          <Checkbox
            checked={continuousClaimEnabled}
            onChange={(e) => setContinuousClaimEnabled(e.target.checked)}
          >
            连续领取
          </Checkbox>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            disabled={!selectedItem}
            onClick={() => setFlowModalOpen(true)}
          >
            流转记录
          </Button>
          {loading && <Spin size="small" />}
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card
        size="small"
        style={{ marginBottom: 8, flexShrink: 0, borderColor: hasActiveFilters ? '#1890ff' : undefined }}
        styles={{ body: { padding: '6px 16px' } }}
      >
        <Row gutter={8} align="middle">
          <Col flex="none">
            <Space size={4} style={{ color: hasActiveFilters ? '#1890ff' : undefined, fontWeight: hasActiveFilters ? 600 : undefined }}>
              <FilterOutlined />
              <span>筛选</span>
            </Space>
          </Col>
          <Col flex="none">
            <Select
              placeholder="审核状态"
              allowClear
              style={{ width: 110 }}
              value={filters.status}
              onChange={(v) => handleFilterChange('status', v)}
              options={STATUS_FILTER_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              size="small"
            />
          </Col>
          <Col flex="none">
            <Select
              placeholder="所属任务"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 140 }}
              value={filters.taskId}
              onChange={(v) => handleFilterChange('taskId', v)}
              options={taskOptions}
              size="small"
            />
          </Col>
          <Col flex="none">
            <Select
              placeholder="标注员"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 110 }}
              value={filters.annotator}
              onChange={(v) => handleFilterChange('annotator', v)}
              options={annotatorOptions}
              size="small"
            />
          </Col>
          <Col flex="none">
            <Select
              placeholder="AI 预审结论"
              allowClear
              style={{ width: 120 }}
              value={filters.aiReviewResult}
              onChange={(v) => handleFilterChange('aiReviewResult', v)}
              options={AI_REVIEW_FILTER_OPTIONS}
              size="small"
            />
          </Col>
          <Col flex="none">
            <Input
              placeholder="搜索文件名/描述/ID"
              allowClear
              style={{ width: 180 }}
              value={filters.keyword || ''}
              onChange={(e) => handleFilterChange('keyword', e.target.value || undefined)}
              size="small"
            />
          </Col>
          {hasActiveFilters && (
            <Col flex="none">
              <Button
                type="link"
                size="small"
                icon={<ClearOutlined />}
                onClick={handleClearFilters}
                danger
              >
                清除
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* 主内容区 - flex:1 占满剩余空间，三栏布局 */}
      {reviewableItems.length === 0 ? (
        <Card style={{ flex: 1, minHeight: 0 }}>
          <Empty description="暂无已领取的审核数据">
            <Space direction="vertical" size={12}>
              <Text type="secondary">
                {tasks.length === 0 || tasks.every((t) => t.status !== 'in_progress')
                  ? '任务尚未发布，发布后才能进行审核操作'
                  : '可点击右上角“领取审核”从任务池领取待审数据'}
              </Text>
              <Button type="primary" icon={<InboxOutlined />} onClick={openClaimModal}>
                领取审核
              </Button>
            </Space>
          </Empty>
        </Card>
      ) : (
        <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>
          {/* 左侧：审核列表 - 仅列表内部滚动 */}
          <div style={{ width: 280, flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Card
              title="审核列表"
              size="small"
              style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
              styles={{ body: { overflowY: 'auto', flex: 1, minHeight: 0, padding: '8px 12px' } }}
            >
              <ReviewList
                items={filteredItems}
                selectedId={selectedId}
                onSelect={setSelectedId}
                aiReviewResults={aiReviewResults}
              />
            </Card>
          </div>

          {/* 中间：审核内容面板 - 仅内容区滚动 */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ReviewContentPanel dataItem={selectedItem} />
          </div>

          {/* 右侧：审核操作面板 - 仅操作区滚动 */}
          <div style={{ width: 380, flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ReviewActionPanel
                dataItem={selectedItem}
                aiReviewResult={aiReviewResult}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>
          </div>
        </div>
      )}
      <Modal
        title="流转记录"
        open={flowModalOpen}
        onCancel={() => setFlowModalOpen(false)}
        footer={<Button onClick={() => setFlowModalOpen(false)}>关闭</Button>}
        width={760}
      >
        {selectedItem ? (
          <CompactAuditHistory history={selectedItem.auditHistory || []} />
        ) : (
          <Empty description="请先选择审核项" />
        )}
      </Modal>
      <Modal
        title="领取审核任务"
        open={claimModalOpen}
        onCancel={() => setClaimModalOpen(false)}
        footer={null}
        width={760}
      >
        <Space style={{ marginBottom: 12 }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadReviewPool} loading={reviewPoolLoading}>
            刷新
          </Button>
          <Button
            size="small"
            type="primary"
            disabled={selectedClaimIds.length === 0}
            loading={batchClaiming}
            onClick={() => handleBatchClaimReviews()}
          >
            批量领取 {selectedClaimIds.length || ''}
          </Button>
          <Checkbox
            checked={continuousClaimEnabled}
            onChange={(e) => setContinuousClaimEnabled(e.target.checked)}
          >
            连续领取
          </Checkbox>
          <Text type="secondary">仅展示尚未分配审核员的待审数据。</Text>
        </Space>
        <Table
          size="small"
          rowKey="id"
          loading={reviewPoolLoading}
          dataSource={reviewPoolItems}
          pagination={{ pageSize: 8 }}
          rowSelection={{
            selectedRowKeys: selectedClaimIds,
            onChange: (keys) => setSelectedClaimIds(keys.map(String)),
          }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 120, ellipsis: true },
            { title: '任务', dataIndex: 'taskId', width: 120, ellipsis: true },
            { title: '状态', dataIndex: 'status', width: 120 },
            { title: '标注员', dataIndex: 'annotator', width: 120, render: (v: string | null) => v || '未分配' },
            { title: '数据摘要', dataIndex: 'rawDataPreview', ellipsis: true },
            {
              title: '操作',
              width: 100,
              render: (_, record) => (
                <Button
                  type="link"
                  size="small"
                  loading={claimingId === record.id}
                  onClick={() => handleClaimReview(record.id)}
                >
                  领取
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
