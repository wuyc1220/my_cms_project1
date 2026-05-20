/**
 * AttachmentsModal - 合同附件管理弹窗
 */

import { useEffect, useState } from 'react'
import {
  Button,
  Space,
  Table,
  Tooltip,
  Upload,
  message,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadRequestOption } from '@rc-component/upload/lib/interface'
import {
  getContractAttachments,
  deleteContractAttachment,
  uploadContractAttachment,
  downloadContractAttachment,
} from '../../api/contracts'
import type { ContractAttachmentItem, ContractListItem } from '../../types/trade'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { isHandledError } from '../../api'


interface AttachmentsModalProps {
  open: boolean
  contract: ContractListItem | null
}

export default function AttachmentsModal({
  open,
  contract,
}: AttachmentsModalProps) {
  const { t } = useI18n()

  const { hasPermission } = usePermission()
  const canOperateContract = hasPermission('menu.trade.contracts.operate')

  const [attachments, setAttachments] = useState<ContractAttachmentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  useEffect(() => {
    if (open && contract) {
      void loadAttachments(contract.id)
    }
  }, [open, contract])

  const loadAttachments = async (contractId: number) => {
    setLoading(true)
    try {
      const data = await getContractAttachments(contractId)
      setAttachments(data)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('contract.msg.attachLoadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (options: UploadRequestOption) => {
    if (!contract) return
    const { file, onSuccess, onError } = options
    const fileObj = file instanceof File ? file : await fetch(file as string).then((r) => r.blob())
    const formData = new FormData()
    formData.append('file', fileObj as File)
    setUploading(true)
    try {
      const result = await uploadContractAttachment(contract.id, formData)
      setAttachments((prev) => [result, ...prev])
      void message.success(`「${result.file_name}」${t('common.msg.saveSuccess')}`, 3)
      if (onSuccess) onSuccess(result)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('contract.msg.uploadFailed'), 5)
      if (onError) onError(new Error('upload failed'))
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (attachment: ContractAttachmentItem) => {
    setDownloadingId(attachment.id)
    try {
      const blob = await downloadContractAttachment(attachment.contract_id, attachment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('contract.msg.downloadFailed'), 5)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (attachment: ContractAttachmentItem) => {
    try {
      await deleteContractAttachment(attachment.contract_id, attachment.id)
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
      void message.success(t('contract.msg.attachDeleted'), 3)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.deleteFailed'), 5)
    }
  }

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes == null) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const columns: ColumnsType<ContractAttachmentItem> = [
    {
      title: t('content.col.fileName'),
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('contract.col.size'),
      dataIndex: 'file_size',
      key: 'file_size',
      width: 90,
      render: (val: number | null) => formatFileSize(val),
    },
    {
      title: t('contract.col.uploadedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string | null) =>
        val ? new Date(val).toLocaleString(undefined, { hour12: false }) : '—',
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title={t('contract.tooltip.download')}>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              loading={downloadingId === row.id}
              onClick={() => void handleDownload(row)}
            />
          </Tooltip>
          <Tooltip title={canOperateContract ? t('common.delete') : t('common.msg.noPermission')}>
            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              danger
              disabled={!canOperateContract}
              onClick={() => canOperateContract && void handleDelete(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Upload.Dragger
        name="file"
        multiple={false}
        showUploadList={false}
        customRequest={handleUpload}
        disabled={uploading || !canOperateContract}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {uploading ? t('contract.upload.uploading') : t('contract.upload.hint')}
        </p>
        <p className="ant-upload-hint">{t('contract.upload.subHint')}</p>
      </Upload.Dragger>

      <Table<ContractAttachmentItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={attachments}
        scroll={{ x: 580 }}
        pagination={false}
        locale={{ emptyText: t('contract.empty.noAttachments') }}
        size="small"
      />
    </div>
  )
}
