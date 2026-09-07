/**
 * ResizableTable — 支持列宽拖拽的 antd Table 通用封装
 *
 * - 接口与 antd Table 完全一致，额外增加可选 `tableKey` 用于列宽持久化（localStorage）
 * - 通过 onHeaderCell + components.header.cell 注入拖拽手柄，业务页面无需修改 columns 定义
 * - 选择列 / 滚动条占位列自动跳过（未注入拖拽属性的原样渲染）
 * - 双击拖拽手柄重置该列宽度
 * - 列宽拖大时自动放大 scroll.x，避免挤压
 *
 * 试点页面：VodContents / ChannelManagement
 */

import { useCallback, useMemo, useRef, useState } from 'react'
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

const DEFAULT_MIN_WIDTH = 60
const DEFAULT_MAX_WIDTH = 1200

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
    return columns.map((col) => {
      // 分组列（含 children）不支持拖拽
      if ('children' in col && col.children) return col
      const rawKey = col.key ?? ('dataIndex' in col
        ? (Array.isArray(col.dataIndex) ? col.dataIndex.join('.') : col.dataIndex)
        : undefined)
      if (rawKey === undefined) return col
      const colKey = String(rawKey)

      const minWidth = (col as ResizableColumn<T>).minWidth ?? DEFAULT_MIN_WIDTH
      const maxWidth = (col as ResizableColumn<T>).maxWidth ?? DEFAULT_MAX_WIDTH

      // 仅数字宽度可拖拽（百分比宽度跳过）；已有拖拽覆盖值时以覆盖值为准
      const baseWidth = 'width' in col && typeof col.width === 'number' ? col.width : undefined
      const overridden = widthOverrides[colKey]
      const width = overridden !== undefined ? overridden : baseWidth
      if (width === undefined) return col

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
  }, [columns, widthOverrides, handleWidthChange])

  // 拖大列后总宽超出 scroll.x 时自动放大，避免被压缩
  const mergedScroll = useMemo(() => {
    if (!scroll?.x || typeof scroll.x !== 'number') return scroll
    const sum = (mergedColumns ?? []).reduce(
      (acc, col) => acc + ('width' in col && typeof col.width === 'number' ? col.width : 0),
      0,
    )
    return sum > scroll.x ? { ...scroll, x: sum } : scroll
  }, [scroll, mergedColumns])

  return (
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
  )
}
