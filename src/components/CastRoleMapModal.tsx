/**
 * CastRoleMapModal — 演员角色映射弹框
 *
 * 布局：
 * ┌──────────────────────────────────────────────────────────┐
 * │  左侧：Cast 搜索列表         │  右侧：内容信息 + 已关联角色 │
 * │  [搜索框]                     │  Content Info 区域           │
 * │  [Cast Table: Name/Desc/Add] │  [Mapped Table: Name/Role/  │
 * │                               │   Edit/Delete]              │
 * ├──────────────────────────────────────────────────────────┤
 * │                          [Cancel] [Confirm]               │
 * └──────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Col,
  Modal,
  Popconfirm,
  Popover,
  Row,
  Space,
  Table,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import TrimInput from './TrimInput'
import { getCasts } from '../api/casts'
import {
  getCastRoleMaps,
  batchCreateCastRoleMaps,
  batchDeleteCastRoleMaps,
} from '../api/castRoleMap'
import { getDictChildren } from '../api/dicts'
import type { LanguageOption } from '../types/i18n'
import { useI18n } from '../i18n/useI18n'
import { isHandledError } from '../api'
import { useTablePagination } from '../hooks/useTablePagination'
import type {
  CastListItem,
  CastRoleMapItem,
  CastRoleMapCreatePayload,
} from '../types/basic'
import CastRoleMapMetadataModal from './CastRoleMapMetadataModal'
import CastFormModal from './CastFormModal'

interface CastRoleMapModalProps {
  open: boolean
  contentId: number
  contentName?: string
  contentType?: string
  programId?: number | null
  movieId?: number | null
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CastRoleMapModal({
  open,
  contentId,
  contentName,
  contentType,
  programId,
  movieId,
  readOnly = false,
  onClose,
  onSuccess,
}: CastRoleMapModalProps) {
  const { t } = useI18n()

  // ── 海报图片组件（加载失败时显示灰色占位符） ────────────
  const PosterImage: React.FC<{ src?: string | null; alt?: string }> = ({ src, alt }) => {
    const [error, setError] = useState(false)
    if (!src || error) {
      return <div style={{ width: 40, height: 60, background: '#f0f0f0', borderRadius: 4 }} />
    }
    return (
      <img
        src={src}
        alt={alt ?? ''}
        style={{ width: 40, height: 60, objectFit: 'cover', borderRadius: 4 }}
        onError={() => setError(true)}
      />
    )
  }

  // ── Cast 搜索 ──────────────────────────────────────────
  const [castSearch, setCastSearch] = useState('')
  const castSearchRef = useRef('')
  const [casts, setCasts] = useState<CastListItem[]>([])
  const [castsLoading, setCastsLoading] = useState(false)
  const prevOpenRef = useRef(false)
  const {
    pagination: castPagination,
    updatePagination: updateCastPagination,
    resetPagination: resetCastPagination,
    tablePaginationProps: castPaginationProps,
    handleTableChange: handleCastTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize }) => {
      void loadCasts(page, pageSize)
    },
  })

  // ── 已关联的 CastRoleMap（后端加载） ────────────────────
  const [mappings, setMappings] = useState<CastRoleMapItem[]>([])
  const [mappingsLoading, setMappingsLoading] = useState(false)

  // ── 前端暂存的新增映射 ──────────────────────────────────
  const [pendingAdditions, setPendingAdditions] = useState<CastRoleMapItem[]>([])

  // ── 前端暂存的删除映射 ──────────────────────────────────
  const [pendingDeletions, setPendingDeletions] = useState<CastRoleMapItem[]>([])

  // ── 正在编辑的临时项数据 ────────────────────────────────
  const [pendingEditItem, setPendingEditItem] = useState<CastRoleMapItem | null>(null)

  // ── 预设角色（从字典表加载） ────────────────────────────
  const [presetRoles, setPresetRoles] = useState<Pick<LanguageOption, 'code' | 'name'>[]>([])

  // ── 元数据编辑弹框 ────────────────────────────────────
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const [editingMapId, setEditingMapId] = useState<number | null>(null)

  // ── 新建 Cast 弹框 ──────────────────────────────────────
  const [newCastOpen, setNewCastOpen] = useState(false)

  // ── 加载 Cast 列表 ──────────────────────────────────────
  const loadCasts = useCallback(
    async (page = 1, pageSize?: number) => {
      setCastsLoading(true)
      try {
        const ps = pageSize ?? castPagination.pageSize
        const resp = await getCasts({
          page,
          page_size: ps,
          name: castSearchRef.current || undefined,
        })
        setCasts(resp.items)
        updateCastPagination(resp)
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('content.castRoleMap.loadError'), 5)
      } finally {
        setCastsLoading(false)
      }
    },
    [castPagination.pageSize, updateCastPagination, t],
  )

  // ── 加载已关联 CastRoleMap ──────────────────────────────
  const loadMappings = useCallback(async () => {
    setMappingsLoading(true)
    try {
      const resp = await getCastRoleMaps({
        content_id: contentId,
        page: 1,
        page_size: 100,
      })
      setMappings(resp.items)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('content.castRoleMap.loadError'), 5)
    } finally {
      setMappingsLoading(false)
    }
  }, [contentId, t])

  // ── 加载预设角色（从 Cast_Role 字典获取） ───────────────
  const loadPresetRoles = useCallback(async () => {
    try {
      const roles = await getDictChildren('Cast_Role')
      setPresetRoles(roles)
    } catch (err) {
      if (isHandledError(err)) return
      // 加载失败时保底使用默认值
      setPresetRoles([
        { code: 'DIRECTOR', name: 'Director' },
        { code: 'ACTOR', name: 'Actor' },
      ])
    }
  }, [])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCastSearch('')
      castSearchRef.current = ''
      resetCastPagination()
      void loadCasts(1)
      void loadMappings()
      void loadPresetRoles()
      setEditingMapId(null)
      setPendingAdditions([])
      setPendingEditItem(null)
    }
    prevOpenRef.current = open
  }, [open])

  // ── 合并显示的映射列表（倒序：新增的显示在最前面） ───────
  const displayMappings = useMemo(() => {
    // pendingAdditions 是新增的，放在最前面（倒序）
    // mappings 是后端的，已经按 map_id 倒序
    return [...pendingAdditions].reverse().concat(mappings)
  }, [mappings, pendingAdditions])

  const displayTotal = displayMappings.length

  // ── 添加 Cast 角色映射（本地暂存） ────────────────────────
  const handleAdd = (castId: number, roleName: string, roleCode: string) => {
    if (readOnly) return
    // 检查是否已关联同一角色（包含后端数据和暂存数据）
    const exists = displayMappings.some(
      (m) => m.cast_id === castId && m.role_code === roleCode,
    )
    if (exists) {
      void message.warning(t('content.castRoleMap.alreadyMapped'), 3)
      return
    }

    const cast = casts.find((c) => c.id === castId)
    const tempItem: CastRoleMapItem = {
      map_id: -(pendingAdditions.length + 1), // 临时负 ID
      cast_id: castId,
      cast_name: cast?.name ?? `Cast#${castId}`,
      cast_poster_url: cast?.poster_url ?? null,
      role_name: roleName,
      role_code: roleCode,
      program_id: programId ?? null,
      movie_id: movieId ?? null,
    }
    setPendingAdditions((prev) => [...prev, tempItem])
  }

  // ── 打开元数据编辑弹框 ─────────────────────────────────
  const handleEditStart = (record: CastRoleMapItem) => {
    if (readOnly) return
    setEditingMapId(record.map_id)
    // 如果是临时项，传递完整数据
    if (record.map_id < 0) {
      setPendingEditItem(record)
    } else {
      setPendingEditItem(null)
    }
    setMetadataModalOpen(true)
  }

  const handleMetadataSuccess = () => {
    void loadMappings()
  }

  // ── 更新临时项数据 ────────────────────────────────────
  const handleUpdatePendingItem = (mapId: number, data: Partial<CastRoleMapItem>) => {
    setPendingAdditions((prev) =>
      prev.map((item) =>
        item.map_id === mapId ? { ...item, ...data } : item
      )
    )
  }

  // ── 删除角色映射 ────────────────────────────────────────
  const handleDelete = async (mapId: number) => {
    if (readOnly) return
    if (mapId < 0) {
      // 删除暂存的新增项
      setPendingAdditions((prev) => prev.filter((m) => m.map_id !== mapId))
      return
    }
    // 已保存的项暂存到待删除列表
    const item = mappings.find((m) => m.map_id === mapId)
    if (item) {
      setPendingDeletions((prev) => [...prev, item])
      setMappings((prev) => prev.filter((m) => m.map_id !== mapId))
    }
  }

  // ── 批量提交（确定按钮） ─────────────────────────────────
  const handleConfirm = async () => {
    try {
      // 处理新增
      if (pendingAdditions.length > 0) {
        const payloads: CastRoleMapCreatePayload[] = pendingAdditions.map(item => ({
          content_id: contentId,
          cast_id: item.cast_id,
          program_id: programId ?? null,
          movie_id: movieId ?? null,
          role_name: item.role_name ?? null,
          role_code: item.role_code ?? null,
        }))
        await batchCreateCastRoleMaps(payloads)
      }
      // 处理删除
      if (pendingDeletions.length > 0) {
        const mapIds = pendingDeletions.map(item => item.map_id).filter((id): id is number => id > 0)
        if (mapIds.length > 0) {
          await batchDeleteCastRoleMaps(mapIds)
        }
      }
      void message.success(t('content.castRoleMap.addSuccess'), 3)
      setPendingAdditions([])
      setPendingDeletions([])
      await loadMappings()
      onSuccess?.()
      onClose()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('content.castRoleMap.loadError'), 5)
    }
  }

  // ── 取消（清空暂存） ────────────────────────────────────
  const handleCancel = () => {
    setPendingAdditions([])
    setPendingDeletions([])
    onClose()
  }

  // ── Cast 列定义 ─────────────────────────────────────────
  const castColumns: ColumnsType<CastListItem> = [
    {
      title: t('content.col.poster'),
      key: 'poster_url',
      width: 60,
      render: (_, record) => (
        <PosterImage src={record.poster_url} alt={record.name} />
      ),
    },
    {
      title: t('content.castRoleMap.castName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('content.col.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.action'),
      key: 'action',
      width: 120,
      render: (_, record) => {
        const roleMenu = (
          <Space direction="vertical" size={4} style={{ padding: '4px 0' }}>
            {presetRoles.map((role) => (
              <Button
                key={role.code}
                type="link"
                size="small"
                disabled={readOnly}
                onClick={() => void handleAdd(record.id, role.name, role.code)}
              >
                {role.name}
              </Button>
            ))}
          </Space>
        )
        return (
          <Popover content={roleMenu} trigger={readOnly ? undefined : 'click'} placement="right">
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              disabled={readOnly}
            />
          </Popover>
        )
      },
    },
  ]

  // ── 已关联 CastRoleMap 列定义 ────────────────────────────
  const mappingColumns: ColumnsType<CastRoleMapItem> = [
    {
      title: t('content.col.poster'),
      key: 'cast_poster_url',
      width: 50,
      render: (_, record) => (
        <PosterImage src={record.cast_poster_url} alt={record.cast_name ?? undefined} />
      ),
    },
    {
      title: t('content.castRoleMap.castName'),
      dataIndex: 'cast_name',
      key: 'cast_name',
      ellipsis: true,
      render: (v?: string) => v ?? `Cast#${'cast_id'}`,
    },
    {
      title: t('content.castRoleMap.castRole'),
      dataIndex: 'role_name',
      key: 'role_name',
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: t('content.col.action'),
      key: 'action',
      width: 100,
      hidden: readOnly,
      render: (_, record) => {
        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditStart(record)}
            />
            <Popconfirm
              title={t('content.castRoleMap.deleteConfirm')}
              onConfirm={() => void handleDelete(record.map_id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  // ── 搜索 ────────────────────────────────────────────────
  const handleCastSearch = () => {
    castSearchRef.current = castSearch
    resetCastPagination()
    void loadCasts(1)
  }

  return (
    <Modal
      title={`${t('content.castRoleMap.title')}${contentName ? ` — ${contentName}` : ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={'70%'}
      destroyOnHidden
    >
      <Row gutter={40}>
        {/* 左侧：Cast 搜索列表 */}
        <Col span={12}>
          {/* Cast Name 搜索区域 - 参考原型图布局 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>
              {t('content.castRoleMap.castName')}
            </div>
            <div style={{ display: 'flex',  alignItems: 'center',justifyContent:'space-between' }}>
              <TrimInput
                placeholder={t('content.castRoleMap.castSearch')}
                value={castSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCastSearch(e.target.value)}
                onPressEnter={handleCastSearch}
                allowClear
                style={{ width: '300px' }}
              />
              <div style={{display: 'flex',gap: 8,}}>
                <Button onClick={() => { setCastSearch(''); castSearchRef.current = ''; handleCastSearch(); }}>
                  {t('common.reset')}
                </Button>
                <Button type="primary" onClick={handleCastSearch}>
                  {t('common.search')}
                </Button>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              onClick={() => setNewCastOpen(true)}
              disabled={readOnly}
            >
              {t('cast.toolbar.newCast')}
            </Button>
          </div>
          <Table<CastListItem>
            rowKey="id"
            loading={castsLoading}
            columns={castColumns}
            dataSource={casts}
            scroll={{ y: 400 }}
            size="small"
            pagination={{ ...castPaginationProps, size: 'small' }}
            onChange={handleCastTableChange}
            locale={{ emptyText: t('content.castRoleMap.noCasts') }}
          />
        </Col>

        {/* 右侧：内容信息 + 已关联角色 */}
        <Col span={12}>
          {/* Name / Type */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
              <span style={{ fontWeight: 600 }}>{t('content.col.name')}</span>
              <TrimInput
                value={contentName ?? ''}
                disabled
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>{t('content.col.type')}</span>
              <TrimInput
                value={contentType ?? ''}
                disabled
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          {/* Mapped Roles Table */}
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {t('content.castRoleMap.mappedList')} ({displayTotal})
          </div>
          <Table<CastRoleMapItem>
            rowKey="map_id"
            loading={mappingsLoading}
            columns={mappingColumns}
            dataSource={displayMappings}
            scroll={{ y: 340 }}
            size="small"
            pagination={false}
            locale={{ emptyText: t('content.castRoleMap.noMappings') }}
          />
        </Col>
      </Row>

      {/* 底部按钮 */}
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button style={{ marginRight: 8 }} onClick={handleCancel}>
          {t('content.castRoleMap.cancel')}
        </Button>
        {!readOnly && (
          <Button type="primary" onClick={() => void handleConfirm()}>
            {t('content.castRoleMap.confirm')}
          </Button>
        )}
      </div>

      {/* 新建 Cast 弹框 */}
      <CastFormModal
        open={newCastOpen}
        mode="create"
        onClose={() => setNewCastOpen(false)}
        onSuccess={() => {
          setNewCastOpen(false)
          void loadCasts(castPagination.current)
        }}
      />

      {/* CastRoleMap 元数据编辑弹框 */}
      <CastRoleMapMetadataModal
        open={metadataModalOpen}
        mapId={editingMapId}
        pendingItem={pendingEditItem}
        onUpdatePendingItem={handleUpdatePendingItem}
        readOnly={readOnly}
        onClose={() => {
          setMetadataModalOpen(false)
          setEditingMapId(null)
          setPendingEditItem(null)
        }}
        onSuccess={handleMetadataSuccess}
      />
    </Modal>
  )
}
