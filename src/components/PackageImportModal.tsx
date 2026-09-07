/**
 * PackageImportModal - 服务包导入弹框
 *
 * 功能:
 * - 模板下载
 * - 文件选择与上传
 */
import { useState } from 'react'
import { Button, Modal, Upload, message } from 'antd'
import { DownloadOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useI18n } from '../i18n/useI18n'
import { usePermission } from '../hooks/usePermission'
import { importPackageContentsExcel, downloadPackageImportTemplate } from '../api/packages'
import { isHandledError } from '../api'

interface PackageImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function PackageImportModal({ open, onClose, onSuccess }: PackageImportModalProps) {
  const { t } = useI18n()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.business.packages.operate')

  const [importing, setImporting] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadPackageImportTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'package_import_template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      void message.success(t('package.msg.templateDownloadSuccess'))
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('package.msg.templateDownloadFailed'))
    }
  }

  // 处理文件导入
  const handleImport = async () => {
    if (!canOperate) return
    const file = fileList[0]?.originFileObj as File | undefined
    if (!file) {
      void message.warning(t('package.msg.noFileSelected'))
      return
    }

    setImporting(true)
    try {
      const result = await importPackageContentsExcel(file)

      if (result.errors && result.errors.length > 0) {
        const errorLines = result.errors
          .slice(0, 10)
          .map((e) => t('package.msg.importErrors', { row: String(e.row), error: e.error_message }))
          .join('\n')
        const more = result.errors.length > 10 ? `\n...(+${result.errors.length - 10})` : ''

        Modal.warning({
          title: t('package.msg.importErrorsTitle'),
          width: 640,
          content: (
            <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
              <div>
                {t('package.msg.importSuccess')} {t('package.msg.importResult', {
                  total: String(result.total),
                  created: String(result.created),
                  deleted: String(result.deleted),
                  skipped: String(result.skipped),
                })}
              </div>
              <div style={{ marginTop: 8, color: '#ff4d4f' }}>{errorLines}</div>
              {more && <div style={{ marginTop: 4, color: '#999' }}>{more}</div>}
            </div>
          ),
        })
      } else {
        void message.success(
          `${t('package.msg.importSuccess')} ${t('package.msg.importResult', {
            total: String(result.total),
            created: String(result.created),
            deleted: String(result.deleted),
            skipped: String(result.skipped),
          })}`,
          5,
        )
      }

      onSuccess()
      onClose()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('package.msg.importFailed'), 5)
    } finally {
      setImporting(false)
      setFileList([])
    }
  }

  return (
    <Modal
      title={t('package.importModal.title')}
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
            {t('package.importModal.templateSectionTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
            {t('package.importModal.templateSectionDesc')}
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
            {t('package.importModal.uploadSectionTitle')}
          </div>
          <Upload
            accept=".xlsx,.xls"
            fileList={fileList}
            maxCount={1}
            beforeUpload={(file) => {
              const isValid = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
              if (!isValid) {
                void message.error(t('package.msg.invalidFileType'))
                return Upload.LIST_IGNORE
              }
              return false
            }}
            onChange={({ fileList: newList }) => {
              setFileList(newList)
            }}
            disabled={importing}
          >
            <Button
              icon={<UploadOutlined />}
              disabled={!canOperate || importing}
              block
              size="large"
            >
              {t('package.importModal.chooseFileButton')}
            </Button>
          </Upload>
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            {t('package.importModal.fileFormatHint')}
          </div>
        </div>
      </div>

      {/* 底部操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onClose} disabled={importing}>
          {t('common.btn.cancel')}
        </Button>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={importing}
          disabled={!canOperate || importing || fileList.length === 0}
          onClick={handleImport}
        >
          {t('common.btn.import')}
        </Button>
      </div>
    </Modal>
  )
}
