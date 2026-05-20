import { Card, Col, Row } from 'antd'
import { Pie } from '@ant-design/charts'
import { useState, useCallback } from 'react'
import type { PublishedStats as PublishedStatsType } from '../../../types/dashboard'
import { useI18n } from '../../../i18n/useI18n'

interface PublishedStatsProps {
  data: PublishedStatsType
}

const PublishedStats: React.FC<PublishedStatsProps> = ({ data }) => {
  const { t } = useI18n()

  const platformData = data.by_platform?.length > 0 ? data.by_platform : [{ name: t('common.noData'), value: 0 }]
  const contentTypeData = data.by_content_type?.length > 0 ? data.by_content_type : [{ name: t('common.noData'), value: 0 }]
  const genreData = data.by_genre?.length > 0 ? data.by_genre : [{ name: t('common.noData'), value: 0 }]
  const statusData = data.by_ingest_status?.length > 0 ? data.by_ingest_status : [{ name: t('common.noData'), value: 0 }]

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedContentType, setSelectedContentType] = useState<string | null>(null)
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

  const usePieClick = (setSelected: React.Dispatch<React.SetStateAction<string | null>>) => {
    return useCallback(
      (name: string) => {
        setSelected((prev) => (prev === name ? null : name))
      },
      [setSelected],
    )
  }

  const handlePlatformClick = usePieClick(setSelectedPlatform)
  const handleContentTypeClick = usePieClick(setSelectedContentType)
  const handleGenreClick = usePieClick(setSelectedGenre)
  const handleStatusClick = usePieClick(setSelectedStatus)

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
      height: 200,
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
    <Card title={t('dashboard.contentPublishedStats')}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.pie.byPlatform')}</div>
          <div style={{ height: 200 }}>
            <Pie {...pieConfig(platformData, selectedPlatform, handlePlatformClick)} />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.pie.byContentType')}</div>
          <div style={{ height: 200 }}>
            <Pie {...pieConfig(contentTypeData, selectedContentType, handleContentTypeClick)} />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.pie.byGenre')}</div>
          <div style={{ height: 200 }}>
            <Pie {...pieConfig(genreData, selectedGenre, handleGenreClick)} />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>{t('dashboard.pie.byIngestStatus')}</div>
          <div style={{ height: 200 }}>
            <Pie {...pieConfig(statusData, selectedStatus, handleStatusClick)} />
          </div>
        </Col>
      </Row>
    </Card>
  )
}

export default PublishedStats
