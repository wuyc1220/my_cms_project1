import { useMemo } from 'react'
import { Card, Table, Tooltip, Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { GenreStatusMatrix as GenreStatusMatrixType } from '../../../types/dashboard'
import { useI18n } from '../../../i18n/useI18n'

interface GenreStatusMatrixProps {
  data: GenreStatusMatrixType
  statusNameMap?: Record<string, string>
  /** 用户配置的可见题材（按 sort_order 排序），用于前端防御性过滤 */
  visibleGenres?: string[]
  /** 用户配置的可见状态（按 sort_order 排序），用于前端防御性过滤 */
  visibleStatuses?: string[]
}

const GenreStatusMatrix: React.FC<GenreStatusMatrixProps> = ({
  data,
  statusNameMap,
  visibleGenres,
  visibleStatuses,
}) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { genres, statuses, data: matrixData } = data

  // 防御性过滤：按用户配置的可见集合取交集（后端已过滤，此处兜底）
  const filteredStatuses = useMemo(() => {
    const list = visibleStatuses
      ? statuses.filter((s) => visibleStatuses.includes(s))
      : statuses
    return Array.from(new Set(list))
  }, [statuses, visibleStatuses])

  const filteredGenres = useMemo(() => {
    const list = visibleGenres
      ? genres.filter((g) => visibleGenres.includes(g))
      : genres
    // 去重兜底（同名多语言题材）
    return Array.from(new Set(list))
  }, [genres, visibleGenres])

  const handleCellClick = (genre: string, status: string) => {
    // 计算状态 Deleted：按 Deleted=YES 过滤跳转（与统计口径一致）
    if (status === 'Deleted') {
      navigate('/vod/contents', {
        state: {
          filters: {
            contentType: ['MOVIE', 'SEASON', 'SEASON_SERIES', 'SERIES'],
            genre: [genre],
            deleted: 'YES',
          },
        },
      })
      return
    }

    // 跳转到Vod内容管理列表，携带查询条件
    navigate('/vod/contents', {
      state: {
        filters: {
          contentType: ['MOVIE', 'SEASON', 'SEASON_SERIES', 'SERIES'],
          genre: [genre],
          ingestStatus: status,
        },
      },
    })
  }

  // 构建表格列
  const columns = [
    {
      title: t('dashboard.column.genreStatus'),
      dataIndex: 'genre',
      key: 'genre',
      fixed: 'left' as const,
      width: 150,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Tooltip autoAdjustOverflow={false} placement="topLeft" title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    ...filteredStatuses.map((status) => ({
      title: statusNameMap?.[status] || status,
      dataIndex: status,
      key: status,
      width: 160,
      render: (value: number, record: { genre: string }) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleCellClick(record.genre, status)}
        >
          {value}
        </span>
      ),
    })),
  ]

  // 构建表格数据
  const tableData = filteredGenres.map((genre) => ({
    key: genre,
    genre,
    ...matrixData[genre],
  }))

  return (
    <Card title={t('dashboard.genreStatusTable')}>
      {filteredGenres.length === 0 || filteredStatuses.length === 0 ? (
        <Empty description={t('dashboard.matrixEmptyHint')} />
      ) : (
        <Table
          columns={columns}
          dataSource={tableData}
          scroll={{ x: 700 }}
          pagination={false}
          size="small"
          bordered
          className="compact-table"
        />
      )}
    </Card>
  )
}

export default GenreStatusMatrix
