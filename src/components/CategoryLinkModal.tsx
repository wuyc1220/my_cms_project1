/**
 * CategoryLinkModal — 注入栏目弹框 (Allocate Content to Category)
 *
 * 需求：3.6.9 注入栏目弹框
 * - 标题：Allocate Content to Category
 * - 搜索条件：Platform、Category Name、Category Type
 * - 树形表格，按 Platform 分组，Action 列显示 + / − 切换关联状态
 * - 底部：Cancel / Confirm
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Col, Form, Modal, Row, Select, Space, Spin, Table, Tag, Tooltip, message } from 'antd'
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
  // 记录上一次渲染时条件是否非空，用于检测「条件被清空」的时机
  const prevHasFiltersRef = useRef(false)

  /* ── 搜索条件 ─────────────────────────────────────────────────────────── */
  const [searchPlatforms, setSearchPlatforms] = useState<string[]>([])
  const [searchName, setSearchName] = useState('')
  const [searchCategoryTypes, setSearchCategoryTypes] = useState<string[]>([])
  const [searchIngestStatuses, setSearchIngestStatuses] = useState<string[]>([])

  // 是否存在筛选条件（提前声明，供展开策略/自动查询等 effect 使用）
  const hasFilters = searchName || searchPlatforms.length > 0 || searchCategoryTypes.length > 0 || searchIngestStatuses.length > 0

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
      { label: t('common.ingestStatus.none'), value: 'none' },
      { label: t('common.ingestStatus.processing'), value: 'processing' },
      { label: t('common.ingestStatus.success'), value: 'success' },
      { label: t('common.ingestStatus.failure'), value: 'failure' },
    ],
    [t]
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

  // 关闭弹窗时清空查询条件，避免再次打开时残留上一次的筛选内容
  useEffect(() => {
    if (!open) {
      setSearchPlatforms([])
      setSearchName('')
      setSearchCategoryTypes([])
      setSearchIngestStatuses([])
    }
  }, [open])

  // 自动展开策略：数据加载后默认展开所有层级（平台 + 各级父栏目），
  // 无论是否带筛选条件，平台下的全部子集都直接可见，
  // 避免只展示平台层或只展示两级
  useEffect(() => {
    if (!open || categoryTree.length === 0 || platformOptions.length === 0) return
    const treeData = buildPlatformTree(categoryTree, platformOptions, !hasFilters)
    const keys: React.Key[] = []
    const walkChildren = (rows: CategoryRow[]) => {
      for (const row of rows) {
        if (row.children?.length) {
          keys.push(row.key)
          walkChildren(row.children)
        }
      }
    }
    for (const p of treeData) {
      if (!p.children.length) continue
      keys.push(p.key)
      walkChildren(p.children)
    }
    setExpandedKeys([...new Set(keys)])
  }, [open, categoryTree, platformOptions, hasFilters])

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
    // Reset 自身会重新加载完整树，抑制下方「条件清空自动查询」的重复请求
    prevHasFiltersRef.current = false
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
  const tableData = useMemo(
    () => buildPlatformTree(categoryTree, platformOptions, !hasFilters),
    [categoryTree, platformOptions, hasFilters],
  )

  // 条件由非空变为全空时，自动按空条件重新查询恢复完整树；
  // 否则 categoryTree 仍为上次过滤后的剪枝子树，平台下的子集不会展示，
  // 需要再点一次查询才能刷新
  useEffect(() => {
    if (!open) {
      prevHasFiltersRef.current = false
      return
    }
    const hadFilters = prevHasFiltersRef.current
    prevHasFiltersRef.current = Boolean(hasFilters)
    if (hadFilters && !hasFilters) {
      void handleFilter()
    }
  }, [open, hasFilters])

  const columns: ColumnsType<TreeRow> = [
    {
      title: t('category.allocate.platform'),
      dataIndex: 'platform',
      width: 300,
      render: (_: string, record) => {
        if (record.rowType === 'platform') return <strong>{record.platformLabel}</strong>
        // 栏目节点也显示平台名称
        return platformOptions.find((o) => o.value === record.platform)?.label ?? record.platform
      },
    },
    {
      title: t('category.allocate.categoryId'),
      dataIndex: 'id',
      width: 140,
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
      width: 160,
      render: (type: string | null, record) => {
        if (record.rowType === 'platform') return null
        if (!type) return '—'
        return categoryTypeOptions.find((o) => o.value === type)?.label ?? type
      },
    },
    {
      title: t('category.allocate.ingestStatus'),
      dataIndex: 'ingest_status',
      width: 160,
      render: (status: string, record) => {
        if (record.rowType === 'platform') return null
        if (!status || status === 'None') return '—'
        const statusKey = status === 'Publishing' ? 'processing' : status === 'failed' ? 'failure' : status
        const tag =
          statusKey === 'success' ? (
            <Tag color="success">{t(`common.ingestStatus.${statusKey}` as any)}</Tag>
          ) : statusKey === 'failure' ? (
            <Tag color="error">{t(`common.ingestStatus.${statusKey}` as any)}</Tag>
          ) : statusKey === 'processing' ? (
            <Tag color="processing">{t(`common.ingestStatus.${statusKey}` as any)}</Tag>
          ) : (
            <Tag>{t(`common.ingestStatus.${statusKey}` as any)}</Tag>
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
            onClick={(e) => {
              e.stopPropagation()
              toggleLink(record.id)
            }}
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
        width={'70%'}
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
      <Form layout="vertical" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={t('category.allocate.platform')}>
              <Select
                showSearch
                optionFilterProp="label"
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                maxTagPlaceholder={(omitted) => (
                  <Tooltip title={omitted.map((o) => String(o.label)).join(', ')}>
                    <span>+{omitted.length} ...</span>
                  </Tooltip>
                )}
                style={{ width: '100%' }}
                placeholder={t('category.allocate.placeholder.platform')}
                value={searchPlatforms}
                onChange={setSearchPlatforms}
                options={platformOptions}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('category.allocate.categoryName')}>
              <TrimInput
                style={{ width: '100%' }}
                placeholder={t('category.allocate.placeholder.categoryName')}
                value={searchName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchName(e.target.value)}
                onPressEnter={handleFilter}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('category.allocate.categoryType')}>
              <Select
                showSearch
                optionFilterProp="label"
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                maxTagPlaceholder={(omitted) => (
                  <Tooltip title={omitted.map((o) => String(o.label)).join(', ')}>
                    <span>+{omitted.length} ...</span>
                  </Tooltip>
                )}
                style={{ width: '100%' }}
                placeholder={t('category.allocate.placeholder.categoryType')}
                value={searchCategoryTypes}
                onChange={setSearchCategoryTypes}
                options={categoryTypeOptions}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16} align="bottom">
          <Col span={8}>
            <Form.Item label={t('category.allocate.ingestStatus')}>
              <Select
                showSearch
                optionFilterProp="label"
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                maxTagPlaceholder={(omitted) => (
                  <Tooltip title={omitted.map((o) => String(o.label)).join(', ')}>
                    <span>+{omitted.length} ...</span>
                  </Tooltip>
                )}
                style={{ width: '100%' }}
                placeholder={t('category.allocate.placeholder.ingestStatus')}
                value={searchIngestStatuses}
                onChange={setSearchIngestStatuses}
                options={ingestStatusOptions}
              />
            </Form.Item>
          </Col>
          <Col span={16} style={{ textAlign: 'right' }}>
            <Form.Item label=" ">
              <Space>
                <Button onClick={handleReset}>{t('category.allocate.reset')}</Button>
                <Button type="primary" onClick={handleFilter}>
                  {t('category.allocate.filter')}
                </Button>
              </Space>
            </Form.Item>
          </Col>
        </Row>
      </Form>

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
            expandRowByClick: false,
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
