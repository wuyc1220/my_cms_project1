import { Card, Table } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { GenreStatusMatrix as GenreStatusMatrixType } from '../../../types/dashboard'
import { useI18n } from '../../../i18n/useI18n'

interface GenreStatusMatrixProps {
  data: GenreStatusMatrixType
  statusNameMap?: Record<string, string>
}

const GenreStatusMatrix: React.FC<GenreStatusMatrixProps> = ({ data, statusNameMap }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { genres, statuses, data: matrixData } = data

  const handleCellClick = (genre: string, status: string) => {
    // 跳转到Vod内容管理列表，携带查询条件
    navigate('/vod/contents', {
      state: {
        filters: {
          contentType: ['MOVIE', 'SEASON', 'SERIES'],
          genre: genre,
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
    },
    ...statuses.map((status) => ({
      title: statusNameMap?.[status] || status,
      dataIndex: status,
      key: status,
      width: 120,
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
  const tableData = genres.map((genre) => ({
    key: genre,
    genre,
    ...matrixData[genre],
  }))

  return (
    <Card title={t('dashboard.genreStatusTable')}>
      <Table
        columns={columns}
        dataSource={tableData}
        scroll={{ x: 700 }}
        pagination={false}
        size="small"
        bordered
        className="compact-table"
      />
    </Card>
  )
}

export default GenreStatusMatrix
