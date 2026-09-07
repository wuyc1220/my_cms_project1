/**
 * ScheduleImportModal - 节目单导入弹框
 * 
 * 功能:
 * - 文件选择与上传
 * - 模板下载
 * - 导入进度显示
 */

import { useState } from 'react'
import { Button, Modal, Upload, message } from 'antd'
import { DownloadOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useI18n } from '../i18n/useI18n'
import { usePermission } from '../hooks/usePermission'
import { importSchedulesExcel, downloadScheduleTemplate, type ScheduleImportResultPayload } from '../api/live'
import { isHandledError } from '../api'

interface ScheduleImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ScheduleImportModal({ open, onClose, onSuccess }: ScheduleImportModalProps) {
  const { t } = useI18n()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.live.schedules.operate')
  
  const [importing, setImporting] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadScheduleTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Schedule_Import_Template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      void message.success(t('live.schedule.msg.templateDownloaded'))
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('live.schedule.msg.templateDownloadFailed'))
    }
  }

  // 处理文件导入
  const handleImport = async (file: File) => {
    if (!canOperate) return

    setImporting(true)
    try {
      // 第一次调用: force=false,检查冲突
      const result = await importSchedulesExcel(file, false)

      // 如果有冲突,弹窗确认（确认前不导入任何数据）
      if (result.conflicts && result.conflicts.length > 0) {
        const preview = result.conflicts
          .slice(0, 5)
          .map((c: {
            channel_name?: string | null
            begin_time?: string | null
            end_time?: string | null
            title?: string | null
            conflict_source?: 'existing' | 'in_file'
            conflict_row?: number | null
          }) => {
            const base = `• ${c.channel_name ?? ''} ${c.begin_time ?? ''} ~ ${c.end_time ?? ''} (${c.title ?? ''})`
            const suffix = c.conflict_source === 'in_file'
              ? ` — ${t('live.schedule.msg.importConflictWithRow', { row: c.conflict_row ?? '' })}`
              : ` — ${t('live.schedule.msg.importConflictWithExisting')}`
            return base + suffix
          })
          .join('\n')
        const more = result.conflicts.length > 5 ? `\n...(+${result.conflicts.length - 5})` : ''

        Modal.confirm({
          title: t('live.schedule.msg.importConflictTitle'),
          content: (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {t('live.schedule.msg.importConflictContent').replace('{n}', String(result.conflicts.length))}
              {'\n\n'}
              {preview}
              {more}
              {'\n\n'}
              {t('live.schedule.msg.importConflictOverwriteHint')}
              {'\n'}
              {t('live.schedule.msg.importConflictCancelHint')}
            </div>
          ),
          okText: t('live.schedule.msg.importConflictOkText'),
          cancelText: t('live.schedule.msg.importConflictCancelText'),
          okButtonProps: { danger: true },
          onOk: async () => {
            // 用户确认覆盖,重新调用 force=true
            await handleImportForce(file)
          },
          onCancel: () => {
            // 取消：本次导入不做任何处理
            void message.info(t('live.schedule.msg.importCancelled'))
          },
        })
        return
      }

      // 无冲突,直接处理结果
      handleImportResult(result)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail || t('live.schedule.msg.importFailed'), 5)
    } finally {
      setImporting(false)
      setFileList([])
    }
  }

  // 强制覆盖导入
  const handleImportForce = async (file: File) => {
    setImporting(true)
    try {
      const result = await importSchedulesExcel(file, true)
      handleImportResult(result)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail || t('live.schedule.msg.importFailed'), 5)
    } finally {
      setImporting(false)
      setFileList([])
    }
  }

  // 处理导入结果
  const handleImportResult = (result: ScheduleImportResultPayload) => {
    const skippedInfo = result.skipped ? `, ${t('live.schedule.msg.importSkipped', { skipped: result.skipped })}` : ''
    
    // 有校验错误
    if (result.errors && result.errors.length > 0) {
      const errorLines = result.errors
        .map((e) => e.errors.map((msg) => t('live.schedule.msg.importValidationErrorDetail', { row: e.row, error: msg })).join('\n'))
        .join('\n')
      
      Modal.warning({
        title: t('live.schedule.msg.importValidationError'),
        width: 640,
        content: (
          <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
            <div>
              {t('live.schedule.msg.importSuccess')} (total: {result.total}, created: {result.created}, updated: {result.updated}{skippedInfo})
            </div>
            <div style={{ marginTop: 8, color: '#ff4d4f' }}>{errorLines}</div>
          </div>
        ),
      })
    } else {
      // 成功
      void message.success(
        `${t('live.schedule.msg.importSuccess')} (total: ${result.total}, created: ${result.created}, updated: ${result.updated}${skippedInfo})`,
      )
    }
    
    // 刷新列表
    onSuccess()
    onClose()
  }

  return (
    <Modal
      title={t('live.schedule.importModal.title')}
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
            {t('live.schedule.importModal.templateSectionTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
            {t('live.schedule.importModal.templateSectionDesc')}
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
            {t('live.schedule.importModal.uploadSectionTitle')}
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
              setFileList([file as UploadFile])
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
              {importing ? t('live.schedule.importModal.importing') : t('live.schedule.importModal.chooseFileButton')}
            </Button>
          </Upload>
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            {t('live.schedule.importModal.fileFormatHint')}
          </div>
        </div>
      </div>
    </Modal>
  )
}
