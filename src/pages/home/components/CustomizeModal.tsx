import { useState, useEffect, useRef } from 'react'
import { Modal, Table, Checkbox, Button, Space, Tooltip, message } from 'antd'
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
import { MODULE_CODES, TASK_MODULE_CODES } from '../../../types/dashboard'
import {
  getDashboardConfig,
  updateDashboardConfig,
} from '../../../api/dashboard'
import { useI18n } from '../../../i18n/useI18n'
import type { MessageKey } from '../../../i18n/messages'
import { isHandledError } from '../../../api'

// 模块 code → i18n key 映射（与看板卡片标题同一翻译来源，name 字段仅作兜底显示）
const MODULE_I18N_KEYS: Record<string, MessageKey> = {
  [MODULE_CODES.PUBLISHED_STATS]: 'dashboard.contentPublishedStats',
  [MODULE_CODES.CONTENT_STATUS_COUNT]: 'dashboard.contentStatusCount',
  [MODULE_CODES.GENRE_STATUS_TABLE]: 'dashboard.genreStatusTable',
  [MODULE_CODES.ASSIGNED_TO_ME]: 'dashboard.assignedToMe',
  [MODULE_CODES.TASK_COMPLETION_STATS]: 'dashboard.taskCompletionStats',
  [MODULE_CODES.TASK_STATUS_COUNT]: 'dashboard.taskStatusCount',
  [MODULE_CODES.TASK_ASSIGNED_TABLE]: 'dashboard.taskAssignedTable',
  [MODULE_CODES.NOT_ASSIGNED_TASKS]: 'dashboard.notAssignedTasks',
}


interface CustomizeModalProps {
  open: boolean
  onClose: () => void
  onConfigChange: () => void
  /** 是否可见任务相关模块（无权限时自定义弹窗中隐藏这些模块） */
  canSeeTaskModules: boolean
}

const CustomizeModal: React.FC<CustomizeModalProps> = ({
  open,
  onClose,
  onConfigChange,
  canSeeTaskModules,
}) => {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [moduleConfig, setModuleConfig] = useState<ModuleConfigItem[]>([])
  const [statusConfig, setStatusConfig] = useState<StatusConfigItem[]>([])
  const [genreConfig, setGenreConfig] = useState<GenreConfigItem[]>([])
  // 暂存被权限过滤的任务模块原始配置，保存时原样合并回去，避免破坏用户配置
  const hiddenTaskModulesRef = useRef<ModuleConfigItem[]>([])

  // 拖拽状态
  const [moduleDragIndex, setModuleDragIndex] = useState<number | null>(null)
  const [statusDragIndex, setStatusDragIndex] = useState<number | null>(null)
  const [genreDragIndex, setGenreDragIndex] = useState<number | null>(null)

  // 加载配置数据
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open, canSeeTaskModules])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const config: UserDashboardConfig = await getDashboardConfig()
      // 无任务权限时隐藏任务模块（暂存原始配置，保存时原样回传）
      const allModules = config.module_config
      if (canSeeTaskModules) {
        hiddenTaskModulesRef.current = []
        setModuleConfig(allModules)
      } else {
        hiddenTaskModulesRef.current = allModules.filter((m) => TASK_MODULE_CODES.has(m.code))
        setModuleConfig(allModules.filter((m) => !TASK_MODULE_CODES.has(m.code)))
      }
      setGenreConfig(config.content_genre_config)
      setStatusConfig(config.content_status_config)
    } catch (error) {
      if (isHandledError(error)) return
      message.error(t('dashboard.loadConfigFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 保存配置（无权限被隐藏的任务模块原样合并回传，不破坏用户原有配置）
  const handleSave = async () => {
    setSaving(true)
    try {
      const mergedModules = [...moduleConfig, ...hiddenTaskModulesRef.current]
      await updateDashboardConfig({
        module_config: mergedModules,
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
      render: (_, record) => {
        const i18nKey = MODULE_I18N_KEYS[record.code]
        return i18nKey ? t(i18nKey) : record.name
      },
    },
    {
      title: t('dashboard.action'),
      key: 'action',
      width: 120,
      render: (_: unknown, __: unknown, index: number) => (
        <Space size={0}>
          <Tooltip title={t('dashboard.moveUp')}>
            <Button
              type="link"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => moveUp(index, moduleConfig, setModuleConfig)}
            />
          </Tooltip>
          <Tooltip title={t('dashboard.moveDown')}>
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index === moduleConfig.length - 1}
              onClick={() => moveDown(index, moduleConfig, setModuleConfig)}
            />
          </Tooltip>
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
      width: 120,
      render: (_: unknown, __: unknown, index: number) => (
        <Space size={0}>
          <Tooltip title={t('dashboard.moveUp')}>
            <Button
              type="link"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => moveUp(index, statusConfig, setStatusConfig)}
            />
          </Tooltip>
          <Tooltip title={t('dashboard.moveDown')}>
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index === statusConfig.length - 1}
              onClick={() => moveDown(index, statusConfig, setStatusConfig)}
            />
          </Tooltip>
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
      width: 120,
      render: (_: unknown, __: unknown, index: number) => (
        <Space size={0}>
          <Tooltip title={t('dashboard.moveUp')}>
            <Button
              type="link"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => moveUp(index, genreConfig, setGenreConfig)}
            />
          </Tooltip>
          <Tooltip title={t('dashboard.moveDown')}>
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index === genreConfig.length - 1}
              onClick={() => moveDown(index, genreConfig, setGenreConfig)}
            />
          </Tooltip>
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
