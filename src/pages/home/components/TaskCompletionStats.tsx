import { Card, Col, Row } from 'antd'
import { Pie } from '@ant-design/charts'
import { useState, useCallback } from 'react'
import type { TaskCompletionStats as TaskCompletionStatsType } from '../../../types/dashboard'
import { useI18n } from '../../../i18n/useI18n'

interface TaskCompletionStatsProps {
  data: TaskCompletionStatsType
}

const TaskCompletionStats: React.FC<TaskCompletionStatsProps> = ({ data }) => {
  const { t } = useI18n()

  const arrangementData = data.arrangement?.length > 0 ? data.arrangement : [{ name: t('common.noData'), value: 0 }]
  const reviewL1Data = data.review_l1?.length > 0 ? data.review_l1 : [{ name: t('common.noData'), value: 0 }]
  const reviewL2Data = data.review_l2?.length > 0 ? data.review_l2 : [{ name: t('common.noData'), value: 0 }]
  const reviewL3Data = data.review_l3?.length > 0 ? data.review_l3 : [{ name: t('common.noData'), value: 0 }]

  const [selectedArrangement, setSelectedArrangement] = useState<string | null>(null)
  const [selectedReviewL1, setSelectedReviewL1] = useState<string | null>(null)
  const [selectedReviewL2, setSelectedReviewL2] = useState<string | null>(null)
  const [selectedReviewL3, setSelectedReviewL3] = useState<string | null>(null)

  const usePieClick = (setSelected: React.Dispatch<React.SetStateAction<string | null>>) => {
    return useCallback(
      (name: string) => {
        setSelected((prev) => (prev === name ? null : name))
      },
      [setSelected],
    )
  }

  const handleArrangementClick = usePieClick(setSelectedArrangement)
  const handleReviewL1Click = usePieClick(setSelectedReviewL1)
  const handleReviewL2Click = usePieClick(setSelectedReviewL2)
  const handleReviewL3Click = usePieClick(setSelectedReviewL3)

  const pieConfig = (
    chartData: { name: string; value: number }[],
    selectedName: string | null,
    onClick: (name: string) => void,
  ) => {
    const filteredData = selectedName ? chartData.filter((d) => d.name === selectedName) : chartData
    const colorDomain = chartData.map((d) => d.name)

    return {
      data: filteredData,
      angleField: 'value',
      colorField: 'name',
      radius: 0.8,
      height: 220,
      scale: {
        color: {
          domain: colorDomain,
        },
      },
      legend: {
        color: {
          title: false,
          position: 'right' as const,
          rowPadding: 5,
        },
      },
      interaction: {
        elementSelect: {
          single: true,
        },
      },
      state: {
        active: {
          style: {
            lineWidth: 2,
            stroke: '#1890ff',
          },
        },
      },
      onReady: ({ chart }: { chart: { on: (event: string, callback: (...args: unknown[]) => void) => void } }) => {
        chart.on('element:click', (...args: unknown[]) => {
          const eventData = args[0] as { data?: { data?: { name?: string } } }
          const name = eventData?.data?.data?.name
          if (name) {
            onClick(name)
          }
        })
      },
    }
  }

  return (
    <Card title={t('dashboard.taskCompletionStats')}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.taskType.arrangement')}</div>
          <div style={{ height: 220 }}>
            <Pie {...pieConfig(arrangementData, selectedArrangement, handleArrangementClick)} />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.taskType.reviewL1')}</div>
          <div style={{ height: 220 }}>
            <Pie {...pieConfig(reviewL1Data, selectedReviewL1, handleReviewL1Click)} />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.taskType.reviewL2')}</div>
          <div style={{ height: 220 }}>
            <Pie {...pieConfig(reviewL2Data, selectedReviewL2, handleReviewL2Click)} />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.taskType.reviewL3')}</div>
          <div style={{ height: 220 }}>
            <Pie {...pieConfig(reviewL3Data, selectedReviewL3, handleReviewL3Click)} />
          </div>
        </Col>
      </Row>
    </Card>
  )
}

export default TaskCompletionStats
