/**
 * ResizableTable — 支持列宽拖拽的 antd Table 通用封装
 *
 * - 接口与 antd Table 完全一致，业务页面只改 import 和组件名
 * - 通过 onHeaderCell + components.header.cell 注入拖拽手柄，业务页面无需修改 columns 定义
 * - 选择列 / 滚动条占位列自动跳过（未注入拖拽属性的原样渲染）
 * - 双击拖拽手柄重置该列宽度
 * - 列宽拖大时自动放大 scroll.x，避免挤压
 * - 流式布局防挤压：表格总宽小于容器时，富余宽度集中给最后一个非固定列（flex 列），
 *   而不是被 antd 按比例摊给所有列——保证拖宽任何列都不会压缩邻居列
 * - 自动列感知：rowSelection 选择列 / expandedRowRender 展开列不在 columns 中，
 *   组件按 antd 默认宽度预留，保证 slack 计算与 scroll.x 总宽准确，初始不出现滚动条
 *
 * 试点页面：VodContents / ChannelManagement
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Table } from 'antd'
import type { TableProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import './index.css'

/** 列级宽度约束（挂在 columns 元素上，可选） */
export type ResizableColumn<T> = {
  minWidth?: number
  maxWidth?: number
} & ColumnsType<T>[number]

/** 注入到表头单元格的拖拽属性 */
interface ResizableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: number
  'data-col-min'?: number
  'data-col-max'?: number
  /** 传入新宽度（undefined 表示重置为默认） */
  onResize?: (width?: number) => void
}

const DEFAULT_MIN_WIDTH = 80
const DEFAULT_MAX_WIDTH = 1200
/** 无数字宽度的业务列在 table-layout:fixed 下的自然最小宽度预留 */
const AUTO_COL_MIN_WIDTH = 32
/** 选择列默认宽度：antd token selectionColumnWidth = controlHeight（默认 32），可通过 rowSelection.columnWidth 覆盖 */
const SELECTION_COL_WIDTH = 32
/** 展开列（expandedRowRender）未指定 columnWidth 时的预留宽度 */
const EXPAND_COL_WIDTH = 48

/** 测量浏览器滚动条宽度（scroll.y 表格的纵向滚动条会占去 body 可用宽度） */
let cachedScrollbarWidth: number | null = null
function getScrollbarWidth(): number {
  if (cachedScrollbarWidth !== null) return cachedScrollbarWidth
  if (typeof document === 'undefined' || !document.body) return 0
  const div = document.createElement('div')
  div.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;'
  document.body.appendChild(div)
  cachedScrollbarWidth = div.offsetWidth - div.clientWidth
  document.body.removeChild(div)
  return cachedScrollbarWidth
}

interface ResizableTableProps<T extends object> extends Omit<TableProps<T>, 'columns'> {
  columns?: ColumnsType<T>
}

// ─── 可拖拽表头单元格 ────────────────────────────────────────────────────────

function ResizableHeaderCell({
  onResize,
  style,
  children,
  ...restProps
}: ResizableHeaderCellProps) {
  const thRef = useRef<HTMLTableCellElement | null>(null)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!onResize) return
    e.stopPropagation()
    e.preventDefault()
    const startWidth =
      typeof restProps.width === 'number'
        ? restProps.width
        : thRef.current?.offsetWidth ?? DEFAULT_MIN_WIDTH
    dragRef.current = { startX: e.clientX, startWidth }
    setDragging(true)
    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current
    if (!drag || !onResize) return
    const minWidth = restProps['data-col-min'] ?? DEFAULT_MIN_WIDTH
    const maxWidth = restProps['data-col-max'] ?? DEFAULT_MAX_WIDTH
    const next = Math.min(maxWidth, Math.max(minWidth, drag.startWidth + e.clientX - drag.startX))
    onResize(next)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    document.body.style.userSelect = ''
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // 未注入拖拽属性的表头（选择列 / 滚动条占位列）原样渲染
  if (!onResize) {
    return <th {...restProps} style={style}>{children}</th>
  }

  return (
    <th {...restProps} style={style} ref={thRef}>
      {children}
      <span
        className={`col-resize-handle${dragging ? ' dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        // 阻断 click 冒泡，避免误触列表头排序
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation()
          // 双击手柄重置该列宽度
          onResize(undefined)
        }}
      />
    </th>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function ResizableTable<T extends object>({
  columns,
  components,
  scroll,
  ...restProps
}: ResizableTableProps<T>) {
  const [widthOverrides, setWidthOverrides] = useState<Record<string, number>>({})
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [containerW, setContainerW] = useState(0)

  // 监测表格容器宽度（用于流式布局下分配 flex 列）
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => setContainerW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 自动生成的列不在 columns 中（选择列 / row 型展开列），按 antd 实际行为预留宽度
  const autoColWidth = useMemo(() => {
    let w = 0
    const rs = restProps.rowSelection
    if (rs) {
      w += typeof rs.columnWidth === 'number' ? rs.columnWidth : SELECTION_COL_WIDTH
    }
    const ex = restProps.expandable
    if (ex?.expandedRowRender) {
      w += typeof ex.columnWidth === 'number' ? ex.columnWidth : EXPAND_COL_WIDTH
    }
    return w
  }, [restProps.rowSelection, restProps.expandable])

  // 需要预留的额外列宽 = 自动列（选择列/展开列）+ 无数字宽度的业务列（含无 key 列）
  const autoReserve = useMemo(() => {
    let w = autoColWidth
    for (const col of columns ?? []) {
      // 分组列（含 children）不支持拖拽，跳过；有数字宽度的列真实占位，无需预留
      if ('children' in col && col.children) continue
      if (!('width' in col && typeof col.width === 'number')) {
        w += AUTO_COL_MIN_WIDTH
      }
    }
    return w
  }, [columns, autoColWidth])

  const handleWidthChange = useCallback((colKey: string, width?: number) => {
    setWidthOverrides((prev) => {
      const next = { ...prev }
      if (width === undefined) {
        delete next[colKey]
      } else {
        next[colKey] = width
      }
      return next
    })
  }, [])

  const mergedColumns = useMemo(() => {
    if (!columns) return columns

    // 第一遍：计算各列有效宽度（覆盖值优先），并找出 flex 列（最后一个非固定、无覆盖、可计宽的列）
    type Eff = { colKey: string; width: number; hasOverride: boolean }
    const effs = new Map<string, Eff>()
    let flexColKey: string | null = null
    let keylessWidthTotal = 0
    for (const col of columns) {
      // 分组列（含 children）不支持拖拽
      if ('children' in col && col.children) continue
      const baseWidth = 'width' in col && typeof col.width === 'number' ? col.width : undefined
      const rawKey = col.key ?? ('dataIndex' in col
        ? (Array.isArray(col.dataIndex) ? col.dataIndex.join('.') : col.dataIndex)
        : undefined)
      if (rawKey === undefined) {
        // 无 key/dataIndex 的列（常见于未写 key 的操作列）：无法拖拽，
        // 但有数字宽度时真实占位，必须计入总宽，否则 slack/scroll.x 虚大
        if (baseWidth !== undefined) keylessWidthTotal += baseWidth
        continue
      }
      const colKey = String(rawKey)
      const overridden = widthOverrides[colKey]
      if (baseWidth === undefined && overridden === undefined) {
        // 无数字宽度的业务列：预留空间见 autoReserve
        continue
      }
      effs.set(colKey, {
        colKey,
        width: overridden !== undefined ? overridden : (baseWidth as number),
        hasOverride: overridden !== undefined,
      })
      if (!col.fixed && overridden === undefined) {
        flexColKey = colKey
      }
    }

    // 第二遍：生成 merged columns，flex 列吸收容器富余宽度，防止拖宽挤压邻居列
    // scroll.y 时纵向滚动条占去 body 一部分宽度，需一并预留
    const vScrollbar = scroll?.y ? getScrollbarWidth() : 0
    const total = keylessWidthTotal + [...effs.values()].reduce((acc, e) => acc + e.width, 0)
    const slack = containerW > 0 && flexColKey
      ? Math.max(0, containerW - vScrollbar - total - autoReserve)
      : 0

    return columns.map((col) => {
      if ('children' in col && col.children) return col
      const rawKey = col.key ?? ('dataIndex' in col
        ? (Array.isArray(col.dataIndex) ? col.dataIndex.join('.') : col.dataIndex)
        : undefined)
      if (rawKey === undefined) return col
      const colKey = String(rawKey)
      const eff = effs.get(colKey)
      if (!eff) return col

      const isFlex = slack > 0 && colKey === flexColKey
      const width = isFlex ? eff.width + slack : eff.width

      const minWidth = (col as ResizableColumn<T>).minWidth ?? DEFAULT_MIN_WIDTH
      const maxWidth = (col as ResizableColumn<T>).maxWidth ?? DEFAULT_MAX_WIDTH

      return {
        ...col,
        width,
        onHeaderCell: (column: ColumnsType<T>[number]) => {
          const extra = col.onHeaderCell?.(column as never) ?? {}
          return {
            ...extra,
            style: col.fixed
              ? extra.style
              // 非固定列兜底 relative 作为拖拽手柄定位锚点；固定列必须保留 antd 的 sticky，禁止覆盖
              : { position: 'relative', ...(extra.style ?? {}) },
            width,
            'data-col-min': minWidth,
            'data-col-max': maxWidth,
            onResize: (w?: number) => handleWidthChange(colKey, w),
          } as ResizableHeaderCellProps
        },
      }
    })
  }, [columns, widthOverrides, containerW, autoReserve, scroll, handleWidthChange])

  // 拖大列后总宽超出 scroll.x 时自动放大，避免被压缩；sum 计入自动列预留，保证与实际表格宽度一致
  const mergedScroll = useMemo(() => {
    if (!scroll?.x || typeof scroll.x !== 'number') return scroll
    const sum = (mergedColumns ?? []).reduce(
      (acc, col) => acc + ('width' in col && typeof col.width === 'number' ? col.width : 0),
      0,
    ) + autoReserve
    return sum > scroll.x ? { ...scroll, x: sum } : scroll
  }, [scroll, mergedColumns, autoReserve])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <Table<T>
        {...restProps}
        columns={mergedColumns}
        scroll={mergedScroll}
        components={{
          ...components,
          header: {
            ...components?.header,
            cell: ResizableHeaderCell,
          },
        }}
      />
    </div>
  )
}
