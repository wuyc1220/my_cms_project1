/**
 * ArchiveImportModal - 归档内容导入弹框
 *
 * 功能:
 * - 文件选择与上传
 * - 模板下载
 * - 导入结果展示
 */

import { useState } from 'react'
import { Button, Modal, Upload, message } from 'antd'
import { DownloadOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useI18n } from '../i18n/useI18n'
import { usePermission } from '../hooks/usePermission'
import { importArchivesExcel, downloadArchiveTemplate, type ArchiveImportResultPayload } from '../api/live'
import { isHandledError } from '../api'

interface ArchiveImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ArchiveImportModal({ open, onClose, onSuccess }: ArchiveImportModalProps) {
  const { t } = useI18n()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.live.archives.operate')

  const [importing, setImporting] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadArchiveTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Archive_Import_Template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      void message.success(t('live.archive.msg.templateDownloaded'))
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('live.archive.msg.templateDownloadFailed'))
    }
  }

  // 处理文件导入
  const handleImport = async (file: File) => {
    if (!canOperate) return

    setImporting(true)
    try {
      const result = await importArchivesExcel(file)
      handleImportResult(result)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail || t('live.archive.msg.importFailed'), 5)
    } finally {
      setImporting(false)
      setFileList([])
    }
  }

  // 处理导入结果
  const handleImportResult = (result: ArchiveImportResultPayload) => {
    const skippedInfo = result.skipped ? `, ${t('live.archive.msg.importSkipped', { skipped: result.skipped })}` : ''
    const createdInfo = result.created ? `, ${t('live.archive.msg.importCreated', { created: result.created })}` : ''
    const updatedInfo = result.updated ? `, ${t('live.archive.msg.importUpdated', { updated: result.updated })}` : ''

    // 有校验错误
    if (result.errors && result.errors.length > 0) {
      const errorLines = result.errors
        .map((e) => e.errors.map((msg) => t('live.archive.msg.importValidationErrorDetail', { row: e.row, error: msg })).join('\n'))
        .join('\n')

      Modal.warning({
        title: t('live.archive.msg.importValidationError'),
        width: 640,
        content: (
          <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
            <div>
              {t('live.archive.msg.importPartialSuccess')} (total: {result.total}{createdInfo}{updatedInfo}{skippedInfo})
            </div>
            <div style={{ marginTop: 8, color: '#ff4d4f' }}>{errorLines}</div>
          </div>
        ),
      })
    } else {
      // 成功
      void message.success(
        `${t('live.archive.msg.importSuccess')} (total: ${result.total}${createdInfo}${updatedInfo}${skippedInfo})`,
      )
    }

    // 刷新列表
    onSuccess()
    onClose()
  }

  return (
    <Modal
      title={t('live.archive.importModal.title')}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={560}
    >
      <div style={{ padding: '24px 0' }}>
        {/* 模板下载区域 */}
        <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            <FileExcelOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            {t('live.archive.importModal.templateSectionTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
            {t('live.archive.importModal.templateSectionDesc')}
          </div>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            size="small"
          >
            {t('common.btn.downloadTemplate')}
          </Button>
        </div>

        {/* 文件上传区域 */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            <UploadOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {t('live.archive.importModal.uploadSectionTitle')}
          </div>
          <Upload
            accept=".xlsx,.xls"
            fileList={fileList}
            maxCount={1}
            showUploadList={false}
            beforeUpload={() => false}
            onChange={({ file }) => {
              // antd v6: beforeUpload 返回 false 时, file 已经是原生 File 对象
              const f = file as unknown as File
              if (!f.name) return
              setFileList([file])
              void handleImport(f)
            }}
            disabled={importing}
          >
            <Button
              icon={<UploadOutlined />}
              loading={importing}
              disabled={!canOperate || importing}
              block
              size="large"
            >
              {importing ? t('live.archive.importModal.importing') : t('live.archive.importModal.chooseFileButton')}
            </Button>
          </Upload>
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            {t('live.archive.importModal.fileFormatHint')}
          </div>
        </div>
      </div>
    </Modal>
  )
}
