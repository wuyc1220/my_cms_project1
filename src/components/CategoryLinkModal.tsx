/**
 * CategoryLinkModal — 注入栏目弹框 (Allocate Content to Category)
 *
 * 需求：3.6.9 注入栏目弹框
 * - 标题：Allocate Content to Category
 * - 搜索条件：Platform、Category Name、Category Type
 * - 树形表格，按 Platform 分组，Action 列显示 + / − 切换关联状态
 * - 底部：Cancel / Confirm
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Modal, Select, Space, Spin, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CaretDownOutlined, CaretRightOutlined, CheckCircleFilled, MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons'
import TrimInput from './TrimInput'
import {
  getContentCategories,
  linkContentCategories,
  unlinkContentCategory,
} from '../api/live'
import { getCategoryTree } from '../api/categories'
import { getDictTree } from '../api/dicts'
import { useI18n } from '../i18n/useI18n'
import type { CategoryListItem } from '../types/basic'
import type { DictNodeListItem } from '../types/dict'
import CategoryIngestHistoryModal from './CategoryIngestHistoryModal'
import { isHandledError } from '../api'
import type { CSSProperties } from 'react'


interface Props {
  open: boolean
  contentId: number
  contentName: string
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
}

/** 从字典树提取指定 code 的选项 */
function extractDictOptions(
  tree: DictNodeListItem[],
  code: string
): { label: string; value: string }[] {
  for (const node of tree) {
    if (node.code === code) {
      return node.children.map((c) => ({ label: c.name, value: c.code }))
    }
    if (node.children?.length) {
      const found = extractDictOptions(node.children, code)
      if (found.length) return found
    }
  }
  return []
}

/** 平台根节点（与栏目管理页面保持一致） */
interface PlatformRow {
  key: string
  rowType: 'platform'
  platform: string
  platformLabel: string
  children: CategoryRow[]
}

/** 栏目节点 */
interface CategoryRow extends CategoryListItem {
  key: number
  rowType: 'category'
  children: CategoryRow[]
}

type TreeRow = PlatformRow | CategoryRow

const mapCategoryRow = (node: CategoryListItem): CategoryRow => ({
  ...node,
  key: node.id,
  rowType: 'category',
  children: node.children?.map(mapCategoryRow) ?? [],
})

const buildPlatformTree = (
  categories: CategoryListItem[],
  options: { label: string; value: string }[],
  showAllPlatforms: boolean = true,
): PlatformRow[] => {
  const groups = new Map<string, CategoryRow[]>()
  if (showAllPlatforms) {
    options.forEach(({ value }) => groups.set(value, []))
  }
  categories.forEach((node) => {
    if (!groups.has(node.platform)) groups.set(node.platform, [])
    groups.get(node.platform)!.push(mapCategoryRow(node))
  })

  return Array.from(groups.entries())
    .filter(([, children]) => showAllPlatforms || children.length > 0)
    .map(([platform, children]) => ({
      key: `platform-${platform}`,
      rowType: 'platform' as const,
      platform,
      platformLabel: options.find((o) => o.value === platform)?.label ?? platform,
      children,
    }))
}

/** 递归收集所有已选中栏目的父节点 key */
const collectParentKeys = (
  rows: CategoryRow[],
  linkedIds: Set<number>,
  parentKey?: string
): string[] => {
  const keys: string[] = []
  for (const row of rows) {
    if (linkedIds.has(row.id)) {
      if (parentKey) keys.push(parentKey)
    }
    if (row.children?.length) {
      keys.push(...collectParentKeys(row.children, linkedIds, row.key.toString()))
    }
  }
  return keys
}

export default function CategoryLinkModal({
  open,
  contentId,
  contentName,
  readOnly = false,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categoryTree, setCategoryTree] = useState<CategoryListItem[]>([])
  const [initialLinkedIds, setInitialLinkedIds] = useState<Set<number>>(new Set())
  const [pendingLinkedIds, setPendingLinkedIds] = useState<Set<number>>(new Set())
  const [dictTree, setDictTree] = useState<DictNodeListItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyCategory, setHistoryCategory] = useState<{ id: number; name: string } | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  /* ── 搜索条件 ─────────────────────────────────────────────────────────── */
  const [searchPlatforms, setSearchPlatforms] = useState<string[]>([])
  const [searchName, setSearchName] = useState('')
  const [searchCategoryTypes, setSearchCategoryTypes] = useState<string[]>([])
  const [searchIngestStatuses, setSearchIngestStatuses] = useState<string[]>([])

  const platformOptions = useMemo(
    () => extractDictOptions(dictTree, 'Platform'),
    [dictTree]
  )
  const categoryTypeOptions = useMemo(
    () => extractDictOptions(dictTree, 'Category_Type'),
    [dictTree]
  )
  const ingestStatusOptions = useMemo(
    () => [
      { label: 'none', value: 'none' },
      { label: 'processing', value: 'processing' },
      { label: 'success', value: 'success' },
      { label: 'failure', value: 'failure' },
    ],
    []
  )

  /* ── 数据加载 ─────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tree, linked, dicts] = await Promise.all([
        getCategoryTree({}),
        getContentCategories(contentId),
        getDictTree(),
      ])
      setCategoryTree(tree)
      setDictTree(dicts)
      const linkedSet = new Set(linked.map((c) => c.id))
      setInitialLinkedIds(linkedSet)
      setPendingLinkedIds(new Set(linkedSet))
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('category.allocate.msg.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }, [contentId, t])

  useEffect(() => {
    if (open) {
      void loadData()
    }
  }, [open, loadData])

  // 当数据加载完成后，自动展开包含已选中栏目的平台
  useEffect(() => {
    if (open && categoryTree.length > 0 && platformOptions.length > 0) {
      const treeData = buildPlatformTree(categoryTree, platformOptions, !hasFilters)
      const parentKeys = collectParentKeys(
        treeData.flatMap((p) => p.children),
        pendingLinkedIds
      )
      // 展开所有包含选中项的平台
      const platformKeys = treeData
        .filter((p) => p.children.some((c) => pendingLinkedIds.has(c.id) || c.children?.some((gc) => pendingLinkedIds.has(gc.id))))
        .map((p) => p.key)
      
      setExpandedKeys([...new Set([...parentKeys, ...platformKeys])])
    }
  }, [open, categoryTree, platformOptions, pendingLinkedIds])

  /* ── 筛选 ─────────────────────────────────────────────────────────────── */
  const handleFilter = async () => {
    setLoading(true)
    try {
      const tree = await getCategoryTree({
        name: searchName || undefined,
        platforms: searchPlatforms.length ? searchPlatforms : undefined,
        category_types: searchCategoryTypes.length ? searchCategoryTypes : undefined,
        ingest_statuses: searchIngestStatuses.length ? searchIngestStatuses : undefined,
      })
      setCategoryTree(tree)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('category.allocate.msg.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSearchPlatforms([])
    setSearchName('')
    setSearchCategoryTypes([])
    setSearchIngestStatuses([])
    void loadData()
  }

  /* ── 关联切换 ─────────────────────────────────────────────────────────── */
  const toggleLink = (categoryId: number) => {
    setPendingLinkedIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  /* ── 确认保存 ─────────────────────────────────────────────────────────── */
  const handleConfirm = async () => {
    const toAdd: number[] = []
    const toRemove: number[] = []

    for (const id of pendingLinkedIds) {
      if (!initialLinkedIds.has(id)) toAdd.push(id)
    }
    for (const id of initialLinkedIds) {
      if (!pendingLinkedIds.has(id)) toRemove.push(id)
    }

    if (toAdd.length === 0 && toRemove.length === 0) {
      onClose()
      return
    }

    setSaving(true)
    try {
      if (toAdd.length > 0) {
        await linkContentCategories(contentId, toAdd)
      }
      for (const id of toRemove) {
        await unlinkContentCategory(contentId, id)
      }
      void message.success(t('category.allocate.msg.saved'))
      onSuccess?.()
      onClose()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('category.allocate.msg.saveFailed'), 5)
    } finally {
      setSaving(false)
    }
  }

  /* ── 表格数据 ─────────────────────────────────────────────────────────── */
  const hasFilters = searchName || searchPlatforms.length > 0 || searchCategoryTypes.length > 0 || searchIngestStatuses.length > 0

  const tableData = useMemo(
    () => buildPlatformTree(categoryTree, platformOptions, !hasFilters),
    [categoryTree, platformOptions, hasFilters],
  )

  const columns: ColumnsType<TreeRow> = [
    {
      title: t('category.allocate.platform'),
      dataIndex: 'platform',
      width: 120,
      render: (_: string, record) => {
        if (record.rowType === 'platform') return <strong>{record.platformLabel}</strong>
        // 栏目节点也显示平台名称
        return platformOptions.find((o) => o.value === record.platform)?.label ?? record.platform
      },
    },
    {
      title: t('category.allocate.categoryId'),
      dataIndex: 'id',
      width: 120,
      render: (id: number, record) => {
        if (record.rowType === 'platform') return null
        return id
      },
    },
    {
      title: t('category.allocate.categoryName'),
      dataIndex: 'name',
      render: (name: string, record) => {
        if (record.rowType === 'platform') return null
        const isLinked = pendingLinkedIds.has(record.id)
        const style: CSSProperties = isLinked
          ? {
              color: '#1890ff',
              fontWeight: 'bold',
              backgroundColor: '#e6f7ff',
              padding: '2px 6px',
              borderRadius: '4px',
            }
          : {}
        return <span style={style}>{name}</span>
      },
    },
    {
      title: t('category.allocate.categoryType'),
      dataIndex: 'category_type',
      width: 140,
      render: (type: string | null, record) => {
        if (record.rowType === 'platform') return null
        return type || '—'
      },
    },
    {
      title: t('category.allocate.ingestStatus'),
      dataIndex: 'ingest_status',
      width: 120,
      render: (status: string, record) => {
        if (record.rowType === 'platform') return null
        if (!status || status === 'None') return '—'
        const tag =
          status === 'success' ? (
            <Tag color="success">{status}</Tag>
          ) : status === 'failure' ? (
            <Tag color="error">{status}</Tag>
          ) : (
            <Tag>{status}</Tag>
          )
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => {
              setHistoryCategory({ id: record.id, name: record.name })
              setHistoryOpen(true)
            }}
          >
            {tag}
          </Button>
        )
      },
    },
    {
      title: t('category.allocate.action'),
      width: 80,
      align: 'center',
      render: (_: unknown, record) => {
        if (record.rowType === 'platform') return null
        if (readOnly) {
          return pendingLinkedIds.has(record.id) ? (
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
          ) : null
        }
        const isLinked = pendingLinkedIds.has(record.id)
        return (
          <Button
            type="link"
            size="large"
            onClick={() => toggleLink(record.id)}
            icon={isLinked ? <MinusCircleOutlined /> : <PlusCircleOutlined />}
          />
        )
      },
    },
  ]

  const titleText = contentName
    ? `${t('category.allocate.title')} - ${contentName}`
    : t('category.allocate.title')

  return (
    <>
      <Modal
        title={titleText}
        open={open}
        onCancel={onClose}
        width={'60%'}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={onClose}>{t('category.allocate.cancel')}</Button>
            {!readOnly && (
              <Button type="primary" loading={saving} onClick={handleConfirm}>
                {t('category.allocate.confirm')}
              </Button>
            )}
          </Space>
        }
      >
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          showSearch
          optionFilterProp="label"
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          style={{ minWidth: 160 }}
          placeholder={t('category.allocate.placeholder.platform')}
          value={searchPlatforms}
          onChange={setSearchPlatforms}
          options={platformOptions}
        />
        <TrimInput
          style={{ width: 180 }}
          placeholder={t('category.allocate.placeholder.categoryName')}
          value={searchName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchName(e.target.value)}
          onPressEnter={handleFilter}
        />
        <Select
          showSearch
          optionFilterProp="label"
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          style={{ minWidth: 160 }}
          placeholder={t('category.allocate.placeholder.categoryType')}
          value={searchCategoryTypes}
          onChange={setSearchCategoryTypes}
          options={categoryTypeOptions}
        />
        <Select
          showSearch
          optionFilterProp="label"
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          style={{ minWidth: 160 }}
          placeholder={t('category.allocate.placeholder.ingestStatus')}
          value={searchIngestStatuses}
          onChange={setSearchIngestStatuses}
          options={ingestStatusOptions}
        />
        <Button onClick={handleReset}>{t('category.allocate.reset')}</Button>
        <Button type="primary" onClick={handleFilter}>
          {t('category.allocate.filter')}
        </Button>
      </Space>

      {loading ? (
        <div
          style={{
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin />
        </div>
      ) : (
        <Table<TreeRow>
          dataSource={tableData}
          columns={columns}
          pagination={false}
          rowKey="key"
          childrenColumnName="children"
          size="small"
          scroll={{ y: 420 }}
          locale={{ emptyText: t('live.channel.emptyCategories') }}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpand: (expanded, record) => {
              setExpandedKeys((prev) => expanded ? [...prev, record.key] : prev.filter((k) => k !== record.key))
            },
            indentSize: 20,
            expandIcon: ({ expanded, onExpand, record }) => {
              const hasChildren = 'children' in record && Array.isArray(record.children) && (record.children as CategoryRow[]).length > 0
              if (!hasChildren) return <span style={{ display: 'inline-block', width: 17 }} />
              return expanded
                ? <CaretDownOutlined style={{ marginRight: 10 }} onClick={(e) => { e.stopPropagation(); onExpand(record, e) }} />
                : <CaretRightOutlined style={{ marginRight: 10 }} onClick={(e) => { e.stopPropagation(); onExpand(record, e) }} />
            },
          }}
        />
      )}
    </Modal>

      {historyCategory && (
        <CategoryIngestHistoryModal
          open={historyOpen}
          entityType="Category"
          entityId={historyCategory.id}
          entityName={historyCategory.name}
          onClose={() => {
            setHistoryOpen(false)
            setHistoryCategory(null)
          }}
        />
      )}
    </>
  )
}
