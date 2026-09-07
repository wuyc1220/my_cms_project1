/**
 * PostersModal — 海报管理弹框
 *
 * 功能：按 PosterSize 规格展示海报，支持预览 / 下载 / 上传 / 删除。
 * 上传使用通用附件 API（uploadAttachment）+ createPicture 两步调用。
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Modal, Popconfirm, Space, Table, Tooltip, Upload, message } from 'antd'
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
import { getPictures, deletePicture, createPicture, publishPictures } from '../api/pictures'
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
  const [modalApi, contextHolder] = Modal.useModal()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PosterRow[]>([])
  const [publishing, setPublishing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // series/season/season_series 统一归属 Series（与 SEASON 保持一致）
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

  const fetchBlob = async (url: string): Promise<string> => {
    const token = localStorage.getItem('token')
    const resp = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) throw new Error(`${resp.status}`)
    return URL.createObjectURL(await resp.blob())
  }

  // 构造下载 URL：优先使用 relative_path，避免加密路径双重编码问题
  const getDownloadUrl = (item: PictureItem): string => {
    return item.relative_path
      ? `/api/v1/attachments/download?path=${encodeURIComponent(item.relative_path)}&inline=1`
      : item.url
  }

  const handlePreview = useCallback(async (picture: PictureItem) => {
    try {
      const blobUrl = await fetchBlob(getDownloadUrl(picture))
      modalApi.info({
        title: t('common.preview'),
        content: <img src={blobUrl} alt="preview" style={{ maxWidth: '80vw', maxHeight: '80vh', display: 'block' }} />,
        centered: true,
        width: 'auto',
        maskClosable: true,
        onOk: () => URL.revokeObjectURL(blobUrl),
        onCancel: () => URL.revokeObjectURL(blobUrl),
      })
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.poster.previewFailed'), 5)
    }
  }, [t, modalApi])

  const handleDownload = async (picture: PictureItem) => {
    try {
      const blobUrl = await fetchBlob(getDownloadUrl(picture))
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

    // 前置校验：文件扩展名（accept 仅过滤文件选择器，可被绕过，此处强制校验）
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
    const allowedExts = posterSize.extensions.map((item) => item.toLowerCase())
    if (allowedExts.length > 0 && !allowedExts.includes(ext)) {
      message.error(t('content.poster.invalidFormat', { extensions: allowedExts.join(', ') }), 5)
      return false
    }

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
      const picture = await createPicture({
        entity_type: entityType,
        entity_id: entityId,
        poster_size_id: posterSizeId,
        file_path: uploadResult.storage_url,
        file_name: uploadResult.file_name,
        file_size: uploadResult.file_size,
        relative_path: uploadResult.file_path,
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

  const handlePublish = async () => {
    // 校验必填海报是否全部上传（必填未全传不允许发布）
    const missingMandatory = rows.filter((row) => row.posterSize.mandatory && !row.picture)
    if (missingMandatory.length > 0) {
      message.warning(t('content.poster.mandatoryMissing'), 5)
      return
    }

    // 检查是否有海报可发布
    const hasPictures = rows.some((row) => row.picture !== null)
    if (!hasPictures) {
      message.warning(t('content.poster.noPicturesToPublish'), 5)
      return
    }

    setPublishing(true)
    try {
      const result = await publishPictures(entityType, entityId)
      if (result.success) {
        message.success(t('content.poster.publishSuccess'), 3)
      } else {
        message.error(result.message || t('content.poster.publishFailed'), 5)
      }
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.poster.publishFailed'), 5)
    } finally {
      setPublishing(false)
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
    { title: 'Extensions', key: 'extensions', width: 180, render: (_, row) => row.posterSize.extensions.map((item) => `.${item}`).join(', ') },
    { title: 'Width(Px)', key: 'width', width: 120, render: (_, row) => row.posterSize.width },
    { title: 'Height(Px)', key: 'height', width: 120, render: (_, row) => row.posterSize.height },
    { title: 'Aspect Ratio', key: 'aspect_ratio', width: 140, render: (_, row) => row.posterSize.aspect_ratio ?? '' },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: readOnly ? 100 : 160,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title={t('common.preview')}>
            <Button
              type="link" size="small" icon={<EyeOutlined />}
              disabled={!row.picture}
              onClick={() => row.picture && void handlePreview(row.picture)}
            />
          </Tooltip>
          <Tooltip title={t('common.download')}>
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
              <Tooltip title={t('common.upload')}>
                <Button type="link" size="small" icon={<UploadOutlined />} />
              </Tooltip>
            </Upload>
          )}
          {!readOnly && (
            <Popconfirm
              title={t('common.confirmDelete', { name: row.posterSize.name })}
              onConfirm={() => void handleDelete(row)}
            >
              <Tooltip title={t('common.delete')}>
                <Button
                  type="link" size="small" danger icon={<DeleteOutlined />}
                  disabled={!row.picture}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      {contextHolder}
      <Modal
        title={`Posters${entityName ? ` — ${entityName}` : ''}`}
        open={open}
        onCancel={onClose}
        footer={[
          !readOnly && (
            <Button
              key="publish"
              type="primary"
              loading={publishing}
              disabled={rows.length > 0 && rows.some((row) => row.posterSize.mandatory && !row.picture)}
              onClick={handlePublish}
            >
              {t('content.poster.publish')}
            </Button>
          ),
          <Button key="close" onClick={onClose}>
            {t('content.poster.close')}
          </Button>,
        ].filter(Boolean)}
        width="70%"
        destroyOnHidden
      >
        <Table<PosterRow>
          rowKey={(row) => row.posterSize.id}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: t('content.poster.noMatchingSpec', { belonging: entityType.charAt(0).toUpperCase() + entityType.slice(1) }) }}
        />
      </Modal>

    </>
  )
}
