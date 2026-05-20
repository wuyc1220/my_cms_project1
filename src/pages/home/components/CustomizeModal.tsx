import { useState, useEffect } from 'react'
import { Modal, Table, Checkbox, Button, Space, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  HolderOutlined,
} from '@ant-design/icons'
import type {
  ModuleConfigItem,
  StatusConfigItem,
  GenreConfigItem,
  UserDashboardConfig,
} from '../../../types/dashboard'
import {
  COMPUTED_STATUS_ITEMS,
} from '../../../types/dashboard'
import {
  getDashboardConfig,
  updateDashboardConfig,
} from '../../../api/dashboard'
import { useI18n } from '../../../i18n/useI18n'
import { isHandledError } from '../../../api'


interface CustomizeModalProps {
  open: boolean
  onClose: () => void
  onConfigChange: () => void
}

const CustomizeModal: React.FC<CustomizeModalProps> = ({
  open,
  onClose,
  onConfigChange,
}) => {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [moduleConfig, setModuleConfig] = useState<ModuleConfigItem[]>([])
  const [statusConfig, setStatusConfig] = useState<StatusConfigItem[]>([])
  const [genreConfig, setGenreConfig] = useState<GenreConfigItem[]>([])

  // 拖拽状态
  const [moduleDragIndex, setModuleDragIndex] = useState<number | null>(null)
  const [statusDragIndex, setStatusDragIndex] = useState<number | null>(null)
  const [genreDragIndex, setGenreDragIndex] = useState<number | null>(null)

  // 加载配置数据
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const config: UserDashboardConfig = await getDashboardConfig()
      setModuleConfig(config.module_config)
      setGenreConfig(config.content_genre_config)

      const mergedStatusConfig = mergeComputedStatuses(config.content_status_config)
      setStatusConfig(mergedStatusConfig)
    } catch (error) {
      if (isHandledError(error)) return
      message.error(t('dashboard.loadConfigFailed'))
    } finally {
      setLoading(false)
    }
  }

  const mergeComputedStatuses = (config: StatusConfigItem[]): StatusConfigItem[] => {
    const existingCodes = new Set(config.map((s) => s.code))
    const merged = [...config]
    for (const item of COMPUTED_STATUS_ITEMS) {
      if (!existingCodes.has(item.code)) {
        merged.push({ ...item, sort_order: merged.length + 1 })
      }
    }
    return merged
  }

  // 保存配置
  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDashboardConfig({
        module_config: moduleConfig,
        content_status_config: statusConfig,
        content_genre_config: genreConfig,
      })
      message.success(t('dashboard.saveSuccess'))
      onConfigChange()
      onClose()
    } catch (error) {
      if (isHandledError(error)) return
      message.error(t('dashboard.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // 上移
  const moveUp = <T extends { sort_order: number }>(
    index: number,
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    if (index === 0) return
    const newList = [...list]
    const temp = newList[index]
    newList[index] = newList[index - 1]
    newList[index - 1] = temp
    // 更新sort_order
    newList.forEach((item, i) => {
      ;(item as { sort_order: number }).sort_order = i + 1
    })
    setList(newList)
  }

  // 下移
  const moveDown = <T extends { sort_order: number }>(
    index: number,
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    if (index === list.length - 1) return
    const newList = [...list]
    const temp = newList[index]
    newList[index] = newList[index + 1]
    newList[index + 1] = temp
    // 更新sort_order
    newList.forEach((item, i) => {
      ;(item as { sort_order: number }).sort_order = i + 1
    })
    setList(newList)
  }

  // 切换可见性
  const toggleVisible = <T extends { visible: boolean }>(
    index: number,
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    const newList = [...list]
    newList[index] = { ...newList[index], visible: !newList[index].visible }
    setList(newList)
  }

  // 拖拽开始
  const handleDragStart = (index: number, setDragIndex: React.Dispatch<React.SetStateAction<number | null>>) => {
    setDragIndex(index)
  }

  // 拖拽经过
  const handleDragOver = <T extends { sort_order: number }>(
    e: React.DragEvent,
    index: number,
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
    dragIndex: number | null,
    setDragIndex: React.Dispatch<React.SetStateAction<number | null>>
  ) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const newList = [...list]
    const dragItem = newList[dragIndex]
    newList.splice(dragIndex, 1)
    newList.splice(index, 0, dragItem)
    // 更新sort_order
    newList.forEach((item, i) => {
      ;(item as { sort_order: number }).sort_order = i + 1
    })
    setDragIndex(index)
    setList(newList)
  }

  // 拖拽结束
  const handleDragEnd = (setDragIndex: React.Dispatch<React.SetStateAction<number | null>>) => {
    setDragIndex(null)
  }

  // 模块配置表格列
  const moduleColumns: ColumnsType<ModuleConfigItem> = [
    {
      title: '',
      key: 'checkbox',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => (
        <Checkbox
          checked={moduleConfig[index]?.visible}
          onChange={() => toggleVisible(index, moduleConfig, setModuleConfig)}
        />
      ),
    },
    {
      title: t('dashboard.moduleName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('dashboard.action'),
      key: 'action',
      width: 220,
      render: (_: unknown, __: unknown, index: number) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => moveUp(index, moduleConfig, setModuleConfig)}
          >
            {t('dashboard.moveUp')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === moduleConfig.length - 1}
            onClick={() => moveDown(index, moduleConfig, setModuleConfig)}
          >
            {t('dashboard.moveDown')}
          </Button>
          <HolderOutlined style={{ cursor: 'grab', color: '#999', marginLeft: 8 }} />
        </Space>
      ),
    },
  ]

  // 状态配置表格列
  const statusColumns: ColumnsType<StatusConfigItem> = [
    {
      title: '',
      key: 'checkbox',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => (
        <Checkbox
          checked={statusConfig[index]?.visible}
          onChange={() => toggleVisible(index, statusConfig, setStatusConfig)}
        />
      ),
    },
    {
      title: t('dashboard.statusName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('dashboard.action'),
      key: 'action',
      width: 260,
      render: (_: unknown, __: unknown, index: number) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => moveUp(index, statusConfig, setStatusConfig)}
          >
            {t('dashboard.moveUp')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === statusConfig.length - 1}
            onClick={() => moveDown(index, statusConfig, setStatusConfig)}
          >
            {t('dashboard.moveDown')}
          </Button>
          <HolderOutlined style={{ cursor: 'grab', color: '#999', marginLeft: 8 }} />
        </Space>
      ),
    },
  ]

  // 题材配置表格列
  const genreColumns: ColumnsType<GenreConfigItem> = [
    {
      title: '',
      key: 'checkbox',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => (
        <Checkbox
          checked={genreConfig[index]?.visible}
          onChange={() => toggleVisible(index, genreConfig, setGenreConfig)}
        />
      ),
    },
    {
      title: t('dashboard.genreName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('dashboard.action'),
      key: 'action',
      width: 220,
      render: (_: unknown, __: unknown, index: number) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => moveUp(index, genreConfig, setGenreConfig)}
          >
            {t('dashboard.moveUp')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === genreConfig.length - 1}
            onClick={() => moveDown(index, genreConfig, setGenreConfig)}
          >
            {t('dashboard.moveDown')}
          </Button>
          <HolderOutlined style={{ cursor: 'grab', color: '#999', marginLeft: 8 }} />
        </Space>
      ),
    },
  ]

  return (
    <Modal
      title={t('dashboard.customizeTitle')}
      open={open}
      onCancel={onClose}
      width="80%"
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('dashboard.cancel')}
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={saving}
          onClick={handleSave}
        >
          {t('dashboard.save')}
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', gap: 24 }}>
        {/* 左侧：模块配置和题材配置 */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>{t('dashboard.moduleConfig')}</h4>
            <Table
              columns={moduleColumns}
              dataSource={moduleConfig}
              rowKey="code"
              pagination={false}
              size="small"
              loading={loading}
              bordered
              onRow={(_, index) => ({
                draggable: true,
                onDragStart: () => index !== undefined && handleDragStart(index, setModuleDragIndex),
                onDragOver: (e) => index !== undefined && handleDragOver(e, index, moduleConfig, setModuleConfig, moduleDragIndex, setModuleDragIndex),
                onDragEnd: () => handleDragEnd(setModuleDragIndex),
                style: {
                  cursor: 'move',
                  background: moduleDragIndex === index ? '#f0f7ff' : undefined,
                },
              })}
            />
          </div>
          <div>
            <h4 style={{ marginBottom: 12 }}>{t('dashboard.genreConfig')}</h4>
            <Table
              columns={genreColumns}
              dataSource={genreConfig}
              rowKey="id"
              pagination={false}
              size="small"
              loading={loading}
              bordered
              onRow={(_, index) => ({
                draggable: true,
                onDragStart: () => index !== undefined && handleDragStart(index, setGenreDragIndex),
                onDragOver: (e) => index !== undefined && handleDragOver(e, index, genreConfig, setGenreConfig, genreDragIndex, setGenreDragIndex),
                onDragEnd: () => handleDragEnd(setGenreDragIndex),
                style: {
                  cursor: 'move',
                  background: genreDragIndex === index ? '#f0f7ff' : undefined,
                },
              })}
            />
          </div>
        </div>

        {/* 右侧：状态配置 */}
        <div style={{ flex: 1.2 }}>
          <h4 style={{ marginBottom: 12 }}>{t('dashboard.statusConfig')}</h4>
          <Table
            columns={statusColumns}
            dataSource={statusConfig}
            rowKey="code"
            pagination={false}
            size="small"
            loading={loading}
            bordered
            onRow={(_, index) => ({
              draggable: true,
              onDragStart: () => index !== undefined && handleDragStart(index, setStatusDragIndex),
              onDragOver: (e) => index !== undefined && handleDragOver(e, index, statusConfig, setStatusConfig, statusDragIndex, setStatusDragIndex),
              onDragEnd: () => handleDragEnd(setStatusDragIndex),
              style: {
                cursor: 'move',
                background: statusDragIndex === index ? '#f0f7ff' : undefined,
              },
            })}
          />
          <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
            {t('dashboard.dragSortHint')}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default CustomizeModal
