/**
 * PostersModal — 海报管理弹框
 *
 * 功能：按 PosterSize 规格展示海报，支持预览 / 下载 / 上传 / 删除。
 * 上传使用通用附件 API（uploadAttachment）+ createPicture 两步调用。
 */
import { useEffect, useState } from 'react'
import { Button, Modal, Space, Table, Tooltip, Upload, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'

import { getPosterSizes } from '../api/posterSizes'
import { getPictures, deletePicture, createPicture } from '../api/pictures'
import type { PictureItem } from '../api/pictures'
import { uploadAttachment } from '../api/attachments'
import type { PosterSizeListItem } from '../types/basic'
import { useI18n } from '../i18n/useI18n'
import { isHandledError } from '../api'


interface PostersModalProps {
  open: boolean
  entityType: string
  entityId: number
  entityName?: string
  readOnly?: boolean
  onClose: () => void
}

interface PosterRow {
  posterSize: PosterSizeListItem
  picture: PictureItem | null
}

type RowStatus = 'ok' | 'warn' | 'error' | 'none'

function getRowStatus(row: PosterRow): RowStatus {
  const { posterSize, picture } = row
  if (!picture) return posterSize.mandatory ? 'warn' : 'none'
  const sizeOk = posterSize.max_file_size_kb <= 0 || picture.file_size <= posterSize.max_file_size_kb * 1024
  const widthOk = posterSize.width <= 0 || picture.width == null || picture.width === posterSize.width
  const heightOk = posterSize.height <= 0 || picture.height == null || picture.height === posterSize.height
  if (sizeOk && widthOk && heightOk) return 'ok'
  return 'error'
}

function StatusIcon({ status }: { status: RowStatus }) {
  if (status === 'ok') return <CheckCircleOutlined style={{ color: '#52c41a' }} />
  if (status === 'warn') return <WarningOutlined style={{ color: '#faad14' }} />
  if (status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
  return null
}

export default function PostersModal({ open, entityType, entityId, entityName, readOnly = false, onClose }: PostersModalProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PosterRow[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const belonging = entityType.charAt(0).toUpperCase() + entityType.slice(1)
      const [sizesResp, pictures] = await Promise.all([
        getPosterSizes({ page: 1, page_size: 200, belongings: [belonging] }),
        getPictures(entityType, entityId),
      ])
      const picMap = new Map<number, PictureItem>()
      pictures.forEach((item) => picMap.set(item.poster_size_id, item))
      setRows(sizesResp.items.map((posterSize) => ({ posterSize, picture: picMap.get(posterSize.id) ?? null })))
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.poster.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && entityId) void load()
  }, [open, entityId])

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const fetchBlob = async (url: string): Promise<string> => {
    const token = localStorage.getItem('token')
    const resp = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) throw new Error(`${resp.status}`)
    return URL.createObjectURL(await resp.blob())
  }

  const handlePreview = async (picture: PictureItem) => {
    try {
      const blobUrl = await fetchBlob(picture.url)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(blobUrl)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.poster.previewFailed'), 5)
    }
  }

  const handleDownload = async (picture: PictureItem) => {
    try {
      const blobUrl = await fetchBlob(picture.url)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = picture.file_name
      link.click()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.poster.downloadFailed'), 5)
    }
  }

  const handleUpload = async (posterSizeId: number, file: File) => {
    // 获取当前 posterSize 的配置
    const row = rows.find((r) => r.posterSize.id === posterSizeId)
    if (!row) return false

    const { posterSize } = row

    // 前置校验：文件大小
    if (posterSize.max_file_size_kb > 0) {
      const fileSizeKb = file.size / 1024
      if (fileSizeKb > posterSize.max_file_size_kb) {
        message.error(
          t('content.poster.fileTooLarge', {
            maxSize: posterSize.max_file_size_kb,
            actualSize: Math.round(fileSizeKb),
          }),
          5,
        )
        return false
      }
    }

    try {
      // 第一步：通过通用附件 API 上传文件
      const uploadResult = await uploadAttachment(file, 'pictures')
      // 第二步：创建 Picture 记录，关联到实体和海报规格
      const picture = await createPicture({
        entity_type: entityType,
        entity_id: entityId,
        poster_size_id: posterSizeId,
        file_path: uploadResult.file_path,
        file_name: uploadResult.file_name,
        file_size: uploadResult.file_size,
      })
      setRows((prev) => prev.map((row) => (row.posterSize.id === posterSizeId ? { ...row, picture } : row)))
      message.success(t('content.poster.uploadSuccess'), 3)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(detail ?? t('content.poster.uploadFailed'), 5)
    }
    return false
  }

  const handleDelete = async (row: PosterRow) => {
    if (!row.picture) return
    try {
      await deletePicture(row.picture.id)
      setRows((prev) => prev.map((item) => (item.posterSize.id === row.posterSize.id ? { ...item, picture: null } : item)))
      message.success(t('content.poster.deleteSuccess'), 3)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.poster.deleteFailed'), 5)
    }
  }

  const columns: ColumnsType<PosterRow> = [
    {
      title: 'Name',
      key: 'name',
      render: (_, row) => (
        <Space size={6}>
          <StatusIcon status={getRowStatus(row)} />
          <span>{row.posterSize.name}</span>
        </Space>
      ),
    },
    { title: 'Mandatory', key: 'mandatory', width: 120, render: (_, row) => (row.posterSize.mandatory ? 'YES' : '') },
    { title: 'Max File Size(Kb)', key: 'max_file_size_kb', width: 180, render: (_, row) => row.posterSize.max_file_size_kb },
    { title: 'Width(Px)', key: 'width', width: 120, render: (_, row) => row.posterSize.width },
    { title: 'Height(Px)', key: 'height', width: 120, render: (_, row) => row.posterSize.height },
    { title: 'Aspect Ratio', key: 'aspect_ratio', width: 140, render: (_, row) => row.posterSize.aspect_ratio ?? '' },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: readOnly ? 100 : 160,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="预览">
            <Button
              type="link" size="small" icon={<EyeOutlined />}
              disabled={!row.picture}
              onClick={() => row.picture && void handlePreview(row.picture)}
            />
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="link" size="small" icon={<DownloadOutlined />}
              disabled={!row.picture}
              onClick={() => row.picture && void handleDownload(row.picture)}
            />
          </Tooltip>
          {!readOnly && (
            <Upload
              showUploadList={false}
              beforeUpload={(file) => { void handleUpload(row.posterSize.id, file); return false }}
              accept={row.posterSize.extensions.map((item) => `.${item}`).join(',')}
            >
              <Tooltip title="上传">
                <Button type="link" size="small" icon={<UploadOutlined />} />
              </Tooltip>
            </Upload>
          )}
          {!readOnly && (
            <Tooltip title="删除">
              <Button
                type="link" size="small" danger icon={<DeleteOutlined />}
                disabled={!row.picture}
                onClick={() => void handleDelete(row)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Modal
        title={`Posters${entityName ? ` — ${entityName}` : ''}`}
        open={open}
        onCancel={onClose}
        footer={<Button onClick={onClose}>Close</Button>}
        width="70%"
        destroyOnHidden
      >
        <Table<PosterRow>
          rowKey={(row) => row.posterSize.id}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 920 }}
          locale={{ emptyText: `未找到匹配的海报规格（请先在海报尺寸管理中配置 Belonging 包含 ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} 的规格）` }}
        />
      </Modal>
      <Modal
        open={!!previewUrl}
        footer={null}
        onCancel={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
        width="auto"
        centered
        styles={{ body: { padding: 24 } }}
      >
        {previewUrl && (
          <img src={previewUrl} alt="preview" style={{ maxWidth: '80vw', maxHeight: '80vh', display: 'block' }} />
        )}
      </Modal>
    </>
  )
}
