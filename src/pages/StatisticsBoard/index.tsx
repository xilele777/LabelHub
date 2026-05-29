import { useMemo, useEffect } from 'react';
import { Alert, Card, Col, Row, Space, Spin, Tag, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import StatCard from './components/StatCard';
import { computeStatistics } from './utils/computeStatistics';
import {
  buildAnnotatorRankOption,
  buildStatusDistributionOption,
  buildAIRiskDistributionOption,
  buildReviewPassRateGaugeOption,
} from './utils/chartConfigs';
import { useTaskStore } from '../../store/useTaskStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';

const { Text, Title } = Typography;

interface ChartPanelProps {
  children: React.ReactNode;
  minHeight?: number;
}

function ChartPanel({ children, minHeight = 360 }: ChartPanelProps) {
  return (
    <Card
      styles={{ body: { padding: '18px 18px 10px' } }}
      style={{
        height: '100%',
        minHeight,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
      }}
    >
      {children}
    </Card>
  );
}

const StatisticsBoard: React.FC = () => {
  const tasks = useTaskStore((s) => s.tasks);
  const taskLoading = useTaskStore((s) => s.loading);
  const taskError = useTaskStore((s) => s.error);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);

  const dataItems = useAnnotationStore((s) => s.dataItems);
  const archivedItems = useAnnotationStore((s) => s.archivedItems);
  const aiReviewResults = useAnnotationStore((s) => s.aiReviewResults);
  const annotationLoading = useAnnotationStore((s) => s.loading);
  const annotationError = useAnnotationStore((s) => s.error);
  const fetchDataItems = useAnnotationStore((s) => s.fetchDataItems);
  const fetchArchivedItems = useAnnotationStore((s) => s.fetchArchivedItems);
  const fetchAIReviews = useAnnotationStore((s) => s.fetchAIReviews);

  useEffect(() => {
    fetchTasks();
    fetchDataItems();
    fetchArchivedItems();
    fetchAIReviews();
  }, [fetchTasks, fetchDataItems, fetchArchivedItems, fetchAIReviews]);

  const loading = taskLoading || annotationLoading;
  const error = taskError || annotationError;

  const allDataItems = useMemo(() => {
    const itemMap = new Map(dataItems.map((item) => [item.id, item]));
    archivedItems.forEach((item) => itemMap.set(item.id, item));
    return Array.from(itemMap.values());
  }, [dataItems, archivedItems]);

  const stats = useMemo(
    () => {
      const visibleItemIds = new Set(allDataItems.map((item) => item.id));
      const visibleAIReviews = aiReviewResults.filter((review) => visibleItemIds.has(review.dataItemId));
      return computeStatistics(tasks, allDataItems, visibleAIReviews);
    },
    [tasks, allDataItems, aiReviewResults],
  );

  if (error) {
    return (
      <Alert
        type="error"
        message={error}
        showIcon
        closable
        description="统计数据加载失败，请稍后重试"
      />
    );
  }

  const passRatePercent = Math.round(stats.reviewPassRate.rate * 100);
  const activeTaskRatio = stats.totalTasks > 0
    ? Math.round((stats.inProgressTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <Spin spinning={loading} style={{ display: 'block' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
        <Card
          styles={{ body: { padding: '18px 20px' } }}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 58%, #f7fffc 100%)',
            borderColor: '#e8eef7',
          }}
        >
          <Row gutter={[16, 12]} align="middle" justify="space-between">
            <Col xs={24} lg={12}>
              <Space direction="vertical" size={4}>
                <Title level={4} style={{ margin: 0 }}>
                  统计看板
                </Title>
                <Text type="secondary">
                  汇总任务、标注、审核和 AI 预审风险，帮助快速判断当前数据流转状态。
                </Text>
              </Space>
            </Col>
            <Col xs={24} lg={12}>
              <Space size={[8, 8]} wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Tag color="blue">进行中任务 {stats.inProgressTasks} / {stats.totalTasks}</Tag>
                <Tag color="cyan">活跃占比 {activeTaskRatio}%</Tag>
                <Tag color={passRatePercent >= 80 ? 'green' : passRatePercent >= 50 ? 'orange' : 'red'}>
                  审核通过率 {passRatePercent}%
                </Tag>
              </Space>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          {stats.statCards.map((card) => (
            <Col key={card.title} xs={24} sm={12} xl={8} xxl={4}>
              <StatCard data={card} />
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <ChartPanel>
              <ReactECharts
                option={buildAnnotatorRankOption(stats.annotatorRank)}
                style={{ height: 336 }}
                opts={{ renderer: 'canvas' }}
                notMerge
                lazyUpdate
              />
            </ChartPanel>
          </Col>

          <Col xs={24} xl={12}>
            <ChartPanel>
              <ReactECharts
                option={buildReviewPassRateGaugeOption(stats.reviewPassRate)}
                style={{ height: 336 }}
                opts={{ renderer: 'canvas' }}
                notMerge
                lazyUpdate
              />
            </ChartPanel>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <ChartPanel minHeight={378}>
              <ReactECharts
                option={buildStatusDistributionOption(stats.statusDistribution)}
                style={{ height: 356 }}
                opts={{ renderer: 'canvas' }}
                notMerge
                lazyUpdate
              />
            </ChartPanel>
          </Col>

          <Col xs={24} xl={12}>
            <ChartPanel minHeight={378}>
              <ReactECharts
                option={buildAIRiskDistributionOption(stats.aiRiskDistribution)}
                style={{ height: 356 }}
                opts={{ renderer: 'canvas' }}
                notMerge
                lazyUpdate
              />
            </ChartPanel>
          </Col>
        </Row>
      </div>
    </Spin>
  );
};

export default StatisticsBoard;
