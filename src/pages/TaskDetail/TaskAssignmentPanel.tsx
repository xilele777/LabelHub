/**
 * 任务分配面板组件
 *
 * 功能：
 *   - 查看分配统计（总数据、已分配、未分配、按标注员分布）
 *   - 执行分配（按量均分 / 手动指定）
 *   - 清除分配
 */
import { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Table,
  Select,
  InputNumber,
  Radio,
  Alert,
  Statistic,
  Row,
  Col,
  message,
  Modal,
  Spin,
  Empty,
  Tooltip,
  Progress,
} from 'antd';
import {
  TeamOutlined,
  PartitionOutlined,
  ClearOutlined,
  ReloadOutlined,
  UserSwitchOutlined,
  CheckSquareOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { AssignmentStats, AnnotatorInfo } from '../../types';
import { AssignmentStrategy } from '../../types';
import {
  getAnnotators,
  getReviewers,
  getAssignmentStats,
  getAssignableItems,
  getReviewAssignableItems,
  executeAssignment,
  executeReviewAssignment,
  clearAssignment,
} from '../../api/assignment';

interface TaskAssignmentPanelProps {
  taskId: string;
  onAssignmentChange?: () => void;
}

const STRATEGY_CONFIG = {
  [AssignmentStrategy.EVEN_SPLIT]: {
    label: '按量均分',
    icon: <PartitionOutlined />,
    desc: '将待分配数据平均分配给选定的标注员',
  },
  [AssignmentStrategy.MANUAL]: {
    label: '手动指定',
    icon: <UserSwitchOutlined />,
    desc: 'Owner 手动为特定数据条目指定标注员',
  },
} as const;

export default function TaskAssignmentPanel({ taskId, onAssignmentChange }: TaskAssignmentPanelProps) {
  // 统计信息
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 标注员列表
  const [annotators, setAnnotators] = useState<AnnotatorInfo[]>([]);

  // 分配表单
  const [strategy, setStrategy] = useState<AssignmentStrategy>(AssignmentStrategy.EVEN_SPLIT);
  const [selectedAnnotators, setSelectedAnnotators] = useState<string[]>([]);
  const [perPerson, setPerPerson] = useState(0);
  const [assigning, setAssigning] = useState(false);

  // 手动分配 - 待分配数据列表
  const [manualItems, setManualItems] = useState<Array<{ id: string; taskId: string; status: string; annotator: string | null; rawDataPreview: string }>>([]);
  const [manualLoading, setManualLoading] = useState(false);
  // 手动分配 - 每条数据的标注员选择 { itemId => annotatorUsername }
  const [manualAssignMap, setManualAssignMap] = useState<Record<string, string>>({});
  const [manualAssigning, setManualAssigning] = useState(false);
  const [reviewers, setReviewers] = useState<AnnotatorInfo[]>([]);
  const [reviewItems, setReviewItems] = useState<Array<{ id: string; taskId: string; status: string; annotator: string | null; reviewer: string | null; submittedAt: string | null; rawDataPreview: string }>>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewAssignMap, setReviewAssignMap] = useState<Record<string, string>>({});
  const [reviewAssigning, setReviewAssigning] = useState(false);

  // 清除确认
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);

  /** 加载分配统计 */
  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await getAssignmentStats(taskId);
      setStats(res.data);
    } catch (err: any) {
      message.error(err?.message || '加载分配统计失败');
    } finally {
      setLoading(false);
    }
  };

  /** 加载标注员列表 */
  const loadAnnotators = async () => {
    try {
      const res = await getAnnotators();
      setAnnotators(res.data || []);
      const reviewerRes = await getReviewers();
      setReviewers(reviewerRes.data || []);
    } catch {
      // 可能是权限不足，静默处理
    }
  };

  const loadReviewItems = async () => {
    setReviewLoading(true);
    try {
      const res = await getReviewAssignableItems(taskId, { includeAssigned: true });
      const items = res.data.items || [];
      setReviewItems(items);
      const initMap: Record<string, string> = {};
      items.forEach((item) => {
        if (item.reviewer) initMap[item.id] = item.reviewer;
      });
      setReviewAssignMap(initMap);
    } catch (err: any) {
      message.error(err?.message || '加载审核分配数据失败');
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadAnnotators();
  }, [taskId]);

  /** 执行分配 */
  const handleAssign = async () => {
    if (strategy !== 'manual' && selectedAnnotators.length === 0) {
      message.warning('请至少选择一名标注员');
      return;
    }

    setAssigning(true);
    try {
      let options: Record<string, unknown> = {};
      if (strategy === 'even_split') {
        options = { perPerson };
      }

      const res = await executeAssignment(taskId, {
        strategy,
        annotators: strategy === 'manual' ? undefined : selectedAnnotators,
        options,
      });

      if (res.data?.error) {
        message.error(res.data.error);
      } else {
        message.success(`分配成功，共分配 ${res.data?.assigned ?? 0} 条数据`);
        loadStats();
        onAssignmentChange?.();
      }
    } catch (err: any) {
      message.error(err?.message || '分配失败');
    } finally {
      setAssigning(false);
    }
  };

  /** 清除分配 */
  const handleClear = async () => {
    setAssigning(true);
    try {
      const res = await clearAssignment(taskId);
      message.success(`已清除 ${res.data?.cleared ?? 0} 条数据的分配`);
      setClearConfirmVisible(false);
      loadStats();
      onAssignmentChange?.();
    } catch (err: any) {
      message.error(err?.message || '清除失败');
    } finally {
      setAssigning(false);
    }
  };

  // 标注员分布表格列
  const annotatorColumns = [
    {
      title: '标注员',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '分配数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => (
        <span style={{ fontWeight: count > 0 ? 'bold' : 'normal', color: count > 0 ? undefined : '#999' }}>
          {count}
        </span>
      ),
    },
    {
      title: '占比',
      key: 'percent',
      width: 180,
      render: (_: unknown, record: { name: string; count: number }) => {
        const total = stats?.total || 0;
        if (total === 0 || record.name === '(未分配)') return null;
        const percent = Math.round((record.count / total) * 100);
        return <Progress percent={percent} size="small" />;
      },
    },
  ];

  // 构造标注员分布数据
  const annotatorTableData = stats
    ? Object.entries(stats.byAnnotator).map(([name, count]) => ({ name, count, key: name }))
    : [];

  // 分配率
  const assignRate = stats && stats.total > 0
    ? Math.round((stats.assigned / stats.total) * 100)
    : 0;

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Space>
            <TeamOutlined />
            <span>任务分配</span>
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={loadStats}>
            刷新
          </Button>
        }
        style={{ marginTop: 16 }}
      >
        {/* 统计概览 */}
        {stats && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Statistic title="数据总量" value={stats.total} />
            </Col>
            <Col span={6}>
              <Statistic
                title="已分配"
                value={stats.assigned}
                valueStyle={{ color: stats.assigned > 0 ? '#52c41a' : undefined }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="未分配"
                value={stats.unassigned}
                valueStyle={{ color: stats.unassigned > 0 ? '#faad14' : undefined }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="分配率"
                value={assignRate}
                suffix="%"
                valueStyle={{ color: assignRate === 100 ? '#52c41a' : assignRate > 0 ? '#1890ff' : '#999' }}
              />
            </Col>
          </Row>
        )}

        {/* 分配率进度条 */}
        {stats && stats.total > 0 && (
          <Progress
            percent={assignRate}
            status={assignRate === 100 ? 'success' : 'active'}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 标注员分布 */}
        {stats && stats.total > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Alert
              type="info"
              showIcon
              message="当前分配分布"
              style={{ marginBottom: 12 }}
            />
            <Table
              size="small"
              columns={annotatorColumns}
              dataSource={annotatorTableData}
              pagination={false}
              bordered
            />
          </div>
        )}

        {/* 分配操作区 */}
        <Card
          type="inner"
          title="执行分配"
          style={{ marginBottom: 16 }}
        >
          {/* 策略选择 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>分配策略</div>
            <Radio.Group
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as AssignmentStrategy)}
              optionType="button"
              buttonStyle="solid"
            >
              {Object.entries(STRATEGY_CONFIG).map(([key, cfg]) => (
                <Radio.Button key={key} value={key}>
                  <Tooltip title={cfg.desc}>
                    <Space>
                      {cfg.icon}
                      {cfg.label}
                    </Space>
                  </Tooltip>
                </Radio.Button>
              ))}
            </Radio.Group>
            <div style={{ marginTop: 4, color: '#888', fontSize: 12 }}>
              {STRATEGY_CONFIG[strategy]?.desc}
            </div>
          </div>

          {/* 标注员选择（非 manual 模式） */}
          {strategy !== 'manual' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>选择标注员</div>
              <Select
                mode="multiple"
                placeholder="请选择标注员"
                value={selectedAnnotators}
                onChange={setSelectedAnnotators}
                style={{ width: '100%' }}
                options={annotators.map((a) => ({
                  label: `${a.username} (${a.role})`,
                  value: a.username,
                }))}
                notFoundContent={annotators.length === 0 ? '暂无标注员' : undefined}
              />
            </div>
          )}

          {/* 策略参数 */}
          {strategy === 'even_split' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>每人分配数量</div>
              <InputNumber
                min={0}
                max={stats?.unassigned || 9999}
                value={perPerson}
                onChange={(v) => setPerPerson(v || 0)}
                style={{ width: 200 }}
                addonAfter={perPerson === 0 ? '自动均分' : '条/人'}
              />
              <div style={{ marginTop: 4, color: '#888', fontSize: 12 }}>
                设为 0 则将所有待分配数据平均分配
              </div>
            </div>
          )}

          {strategy === 'manual' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                <Space>
                  <span>待分配数据列表</span>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={async () => {
                      setManualLoading(true);
                      try {
                        const res = await getAssignableItems(taskId, { includeAssigned: true });
                        setManualItems(res.data.items || []);
                        // 初始化分配映射
                        const initMap: Record<string, string> = {};
                        (res.data.items || []).forEach((item) => {
                          if (item.annotator) initMap[item.id] = item.annotator;
                        });
                        setManualAssignMap(initMap);
                      } catch (err: any) {
                        message.error(err?.message || '加载待分配数据失败');
                      } finally {
                        setManualLoading(false);
                      }
                    }}
                  >
                    加载数据
                  </Button>
                </Space>
              </div>
              <Table
                size="small"
                loading={manualLoading}
                dataSource={manualItems}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                scroll={{ y: 320 }}
                columns={[
                  {
                    title: 'ID',
                    dataIndex: 'id',
                    width: 100,
                    ellipsis: true,
                  },
                  {
                    title: '数据预览',
                    dataIndex: 'rawDataPreview',
                    ellipsis: true,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (status: string) => (
                      <span style={{ color: status === 'pending' ? '#faad14' : '#52c41a' }}>
                        {status === 'pending' ? '待标注' : status}
                      </span>
                    ),
                  },
                  {
                    title: '当前标注员',
                    dataIndex: 'annotator',
                    width: 120,
                    render: (annotator: string | null) => annotator || <span style={{ color: '#999' }}>未分配</span>,
                  },
                  {
                    title: '指定标注员',
                    width: 180,
                    render: (_: unknown, record: { id: string }) => (
                      <Select
                        allowClear
                        placeholder="选择标注员"
                        size="small"
                        style={{ width: '100%' }}
                        value={manualAssignMap[record.id] || undefined}
                        onChange={(val) => {
                          setManualAssignMap((prev) => ({
                            ...prev,
                            [record.id]: val || '',
                          }));
                        }}
                        options={annotators.map((a) => ({
                          label: a.username,
                          value: a.username,
                        }))}
                      />
                    ),
                  },
                ]}
              />
              <div style={{ marginTop: 8 }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={manualAssigning}
                    disabled={Object.values(manualAssignMap).filter(Boolean).length === 0}
                    onClick={async () => {
                      // 构造手动分配列表
                      const assignments = Object.entries(manualAssignMap)
                        .filter(([, annotator]) => annotator)
                        .map(([itemId, annotator]) => ({ itemId, annotator }));

                      if (assignments.length === 0) {
                        message.warning('请至少为一条数据指定标注员');
                        return;
                      }

                      setManualAssigning(true);
                      try {
                        const res = await executeAssignment(taskId, {
                          strategy: 'manual',
                          options: { assignments },
                        });
                        if (res.data?.error) {
                          message.error(res.data.error);
                        } else {
                          message.success(`手动分配成功，共分配 ${res.data?.assigned ?? 0} 条数据`);
                          loadStats();
                          onAssignmentChange?.();
                          // 重新加载列表
                          const itemsRes = await getAssignableItems(taskId, { includeAssigned: true });
                          setManualItems(itemsRes.data.items || []);
                          const initMap: Record<string, string> = {};
                          (itemsRes.data.items || []).forEach((item) => {
                            if (item.annotator) initMap[item.id] = item.annotator;
                          });
                          setManualAssignMap(initMap);
                        }
                      } catch (err: any) {
                        message.error(err?.message || '手动分配失败');
                      } finally {
                        setManualAssigning(false);
                      }
                    }}
                  >
                    提交手动分配 ({Object.values(manualAssignMap).filter(Boolean).length} 条)
                  </Button>
                </Space>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <Space>
            <Button
              type="primary"
              icon={<CheckSquareOutlined />}
              loading={assigning}
              onClick={handleAssign}
              disabled={strategy === 'manual'}
            >
              执行分配
            </Button>
            <Button
              danger
              icon={<ClearOutlined />}
              onClick={() => setClearConfirmVisible(true)}
              disabled={!stats || stats.assigned === 0}
            >
              清除分配
            </Button>
          </Space>
        </Card>

        {/* 上次分配信息 */}
        {stats && stats.assigned > 0 && (
          <Alert
            type="success"
            showIcon
            message={`已分配 ${stats.assigned} / ${stats.total} 条数据`}
            description={
              stats.unassigned > 0
                ? `还有 ${stats.unassigned} 条数据未分配，可选择标注员后继续分配`
                : '所有数据均已分配完毕'
            }
          />
        )}

        {/* 无数据提示 */}
        {stats && stats.total === 0 && (
          <Empty description="该任务暂无数据，请先导入数据后再进行分配" />
        )}
        <Card type="inner" title="审核分配" style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon
            message="负责人可将已提交/待审核数据分配给审核员；未分配数据也可由审核员在审核工作台手动领取。"
            style={{ marginBottom: 12 }}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={loadReviewItems} loading={reviewLoading} style={{ marginBottom: 12 }}>
            加载待审数据
          </Button>
          <Table
            size="small"
            loading={reviewLoading}
            dataSource={reviewItems}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 100, ellipsis: true },
              { title: '数据预览', dataIndex: 'rawDataPreview', ellipsis: true },
              { title: '状态', dataIndex: 'status', width: 110 },
              { title: '标注员', dataIndex: 'annotator', width: 110, render: (v: string | null) => v || '未分配' },
              { title: '当前审核员', dataIndex: 'reviewer', width: 120, render: (v: string | null) => v || <span style={{ color: '#999' }}>未分配</span> },
              {
                title: '指定审核员',
                width: 180,
                render: (_: unknown, record: { id: string }) => (
                  <Select
                    allowClear
                    placeholder="选择审核员"
                    size="small"
                    style={{ width: '100%' }}
                    value={reviewAssignMap[record.id] || undefined}
                    onChange={(val) => setReviewAssignMap((prev) => ({ ...prev, [record.id]: val || '' }))}
                    options={reviewers.map((r) => ({ label: r.username, value: r.username }))}
                  />
                ),
              },
            ]}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={reviewAssigning}
            disabled={Object.values(reviewAssignMap).filter(Boolean).length === 0}
            style={{ marginTop: 8 }}
            onClick={async () => {
              const assignments = Object.entries(reviewAssignMap)
                .filter(([, reviewer]) => reviewer)
                .map(([itemId, reviewer]) => ({ itemId, reviewer }));
              if (assignments.length === 0) {
                message.warning('请至少为一条数据指定审核员');
                return;
              }
              setReviewAssigning(true);
              try {
                const res = await executeReviewAssignment(taskId, assignments);
                message.success(`审核分配成功，共分配 ${res.data?.assigned ?? 0} 条数据`);
                await loadReviewItems();
                onAssignmentChange?.();
              } catch (err: any) {
                message.error(err?.message || '审核分配失败');
              } finally {
                setReviewAssigning(false);
              }
            }}
          >
            提交审核分配 ({Object.values(reviewAssignMap).filter(Boolean).length} 条)
          </Button>
        </Card>
      </Card>

      {/* 清除确认弹窗 */}
      <Modal
        title="确认清除分配"
        open={clearConfirmVisible}
        onCancel={() => setClearConfirmVisible(false)}
        onOk={handleClear}
        okText="确认清除"
        okButtonProps={{ danger: true }}
        confirmLoading={assigning}
      >
        <Alert
          type="warning"
          showIcon
          message="此操作将清除所有未开始标注的数据的分配信息"
          description="已提交或已审核的数据不会被清除。清除后标注员将看不到这些数据。"
        />
      </Modal>
    </Spin>
  );
}
