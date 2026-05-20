/**
 * ContractTable - 合同表格组件
 *
 * 功能：
 *  - 显示合同列表表格
 *  - 集成编辑弹窗、添加内容弹窗、附件弹窗
 *  - 通过 props 控制是否显示供应商列、各操作按钮
 */

import { useState } from 'react'
import {
  Button,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface'
import { deleteContract } from '../../api/contracts'
import type { ContractListItem, ContractPlatformItem } from '../../types/trade'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import EditContractModal from './EditContractModal'
import AddContentModal from './AddContentModal'
import AttachmentsModal from './AttachmentsModal'
import { isHandledError } from '../../api'
import { getPlatformColor } from '../../constants/platform'

interface ContractTableProps {
  dataSource: ContractListItem[]
  loading?: boolean
  platformOptions: { label: string; value: string }[]
  /** 是否显示供应商列 */
  showProvider?: boolean
  /** 是否显示详情按钮 */
  showDetail?: boolean
  /** 是否显示添加内容按钮 */
  showAddContent?: boolean
  /** 是否显示编辑按钮 */
  showEdit?: boolean
  /** 是否显示删除按钮 */
  showDelete?: boolean
  /** 是否显示附件按钮 */
  showAttachments?: boolean
  /** 点击详情回调 */
  onDetail?: (record: ContractListItem) => void
  /** 数据变更回调 */
  onDataChange?: () => void
  /** 选中项变更回调 */
  onSelectionChange?: (selectedRowKeys: number[]) => void
  /** 分页配置 */
  pagination?: false | object
  /** 表格滚动配置 */
  scroll?: object
  /** 行选择配置 */
  rowSelection?: TableRowSelection<ContractListItem>
  /** 表格 onChange 回调 */
  onTableChange?: (pagination: object, filters: object, sorter: object) => void
}

export default function ContractTable({
  dataSource,
  loading = false,
  platformOptions,
  showProvider = false,
  showDetail = true,
  showAddContent = true,
  showEdit = true,
  showDelete = true,
  showAttachments = true,
  onDetail,
  onDataChange,
  onSelectionChange,
  pagination = { pageSize: 10, position: ['bottomCenter'] as const },
  scroll = { x: 1000 },
  rowSelection,
  onTableChange,
}: ContractTableProps) {
  const { t } = useI18n()

  const { hasPermission } = usePermission()
  const canViewContract = hasPermission('menu.trade.contracts.view') || hasPermission('menu.trade.contracts.operate')
  const canOperateContract = hasPermission('menu.trade.contracts.operate')
  const canOperateContent = hasPermission('menu.trade.contents.operate')

  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<ContractListItem | null>(null)

  // 添加内容弹窗
  const [addContentModalOpen, setAddContentModalOpen] = useState(false)
  const [addContentContract, setAddContentContract] = useState<ContractListItem | null>(null)

  // 附件弹窗
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false)
  const [attachmentsContract, setAttachmentsContract] = useState<ContractListItem | null>(null)

  const handleDelete = async (record: ContractListItem) => {
    try {
      await deleteContract(record.id)
      void message.success(t('provider.detail.msgContractDeleted'), 3)
      if (rowSelection?.selectedRowKeys) {
        const newKeys = (rowSelection.selectedRowKeys as number[]).filter(id => id !== record.id)
        onSelectionChange?.(newKeys)
      }
      onDataChange?.()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('provider.detail.msgContractDeleteFailed'), 5)
    }
  }

  const openEdit = (record: ContractListItem) => {
    setEditingContract(record)
    setEditModalOpen(true)
  }

  const openAddContent = (record: ContractListItem) => {
    setAddContentContract(record)
    setAddContentModalOpen(true)
  }

  const openAttachments = (record: ContractListItem) => {
    setAttachmentsContract(record)
    setAttachmentsModalOpen(true)
  }

  const columns: ColumnsType<ContractListItem> = [
    {
      title: t('provider.detail.contractName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },

      render: (val: string, record) => (
        <Tooltip title={val} autoAdjustOverflow={false} placement={'topLeft'} >
          <span
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => onDetail?.(record)}
          >
            {val}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('provider.detail.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 130,
      render: (val: string | undefined) => val ?? '—',
    },
    {
      title: t('provider.detail.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 130,
      render: (val: string | undefined) => val ?? '—',
    },
    ...(showProvider
      ? [
          {
            title: t('trade.addContent.provider'),
            dataIndex: 'provider_name',
            key: 'provider_name',
            width: 220,
            ellipsis: { showTitle: false } as const,
            render: (val: string | undefined) => val ?? '—',
          },
        ]
      : []),
    {
      title: t('provider.detail.platform'),
      dataIndex: 'platforms',
      key: 'platforms',
      width: 360,
      render: (platforms: ContractPlatformItem[]) => (
        <Space size={4} wrap>
          {(platforms ?? []).map((p) => {
            // 从 platformOptions 中查找平台名称
            const platformLabel = platformOptions.find(opt => opt.value === p.platform)?.label ?? p.platform
            return (
              <Tag key={p.platform} color={getPlatformColor(p.platform)}>
                {platformLabel}
              </Tag>
            )
          })}
        </Space>
      ),
    },
    {
      title: t('provider.detail.licenseCount'),
      dataIndex: 'license_count',
      key: 'license_count',
      width: 160,
      align: 'center' as const,
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right' as const,
      width: 180,
      render: (_, record) => (
        <Space size={0}>
          {showDetail && canViewContract && onDetail && (
            <Tooltip title={t('common.detail')}>
              <Button
                type="link"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => onDetail(record)}
              />
            </Tooltip>
          )}
          {showAddContent && canOperateContent && (
            <Tooltip title={t('contract.tooltip.addContent')}>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openAddContent(record)}
              />
            </Tooltip>
          )}
          {showEdit && canOperateContract && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          {showDelete && canOperateContract && (
            <Popconfirm
              title={t('contract.confirmDelete', { name: record.name })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => void handleDelete(record)}
              disabled={(record.license_count ?? 0) > 0}
            >
              <Tooltip
                title={
                  (record.license_count ?? 0) > 0
                    ? t('contract.tooltip.cannotDeleteWithLicenses')
                    : t('common.delete')
                }
              >
                <Button
                  type="link"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  disabled={(record.license_count ?? 0) > 0}
                />
              </Tooltip>
            </Popconfirm>
          )}
          {showAttachments && canViewContract && (
            <Tooltip title={t('contract.tooltip.attachments')}>
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => openAttachments(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Table<ContractListItem>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={dataSource}
        scroll={scroll}
        pagination={pagination}
        rowSelection={rowSelection}
        onChange={onTableChange}
      />

      {/* 编辑弹窗 */}
      <EditContractModal
        open={editModalOpen}
        contract={editingContract}
        platformOptions={platformOptions}
        onClose={() => {
          setEditModalOpen(false)
          setEditingContract(null)
        }}
        onSuccess={() => onDataChange?.()}
        showDelete={false}
        showAddContent={false}
      />

      {/* 添加内容弹窗 */}
      <AddContentModal
        open={addContentModalOpen}
        contract={addContentContract}
        onClose={() => {
          setAddContentModalOpen(false)
          setAddContentContract(null)
        }}
        onSuccess={() => onDataChange?.()}
      />

      {/* 附件弹窗 */}
      <Modal
        title={`${t('contract.tooltip.attachments')} — ${attachmentsContract?.name ?? ''}`}
        open={attachmentsModalOpen}
        onCancel={() => {
          setAttachmentsModalOpen(false)
          setAttachmentsContract(null)
        }}
        footer={
          <Button
            onClick={() => {
              setAttachmentsModalOpen(false)
              setAttachmentsContract(null)
            }}
          >
            {t('common.close')}
          </Button>
        }
        width={700}
        destroyOnHidden
      >
        <AttachmentsModal
          open={attachmentsModalOpen}
          contract={attachmentsContract}
        />
      </Modal>
    </>
  )
}

// 导出子组件供单独使用
export { default as EditContractModal } from './EditContractModal'
export { default as AddContentModal } from './AddContentModal'
export { default as AttachmentsModal } from './AttachmentsModal'
