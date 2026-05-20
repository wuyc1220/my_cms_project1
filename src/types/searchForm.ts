/** 查询字段类型 */
export type SearchFieldType =
  | 'input'
  | 'select'
  | 'multiSelect'
  | 'number'
  | 'dateRange'
  | 'treeSelect'

/** 查询字段配置 */
export interface SearchFieldConfig {
  /** 字段名 */
  name: string
  /** 国际化 label key（优先） */
  labelKey?: string
  /** 直接 label（无国际化时使用） */
  label?: string
  /** 字段类型 */
  type: SearchFieldType
  /** 国际化 placeholder key */
  placeholderKey?: string
  /** 直接 placeholder */
  placeholder?: string | string[]
  /** 选项（用于 select/multiSelect） */
  options?: Array<{ label: string; value: string | number | boolean; labelKey?: string }>
  /** 树形数据（用于 treeSelect） */
  treeData?: Array<unknown>
  /** 数字输入最小值 */
  min?: number
  /** 数字输入最大值 */
  max?: number
  /** 默认值 */
  defaultValue?: unknown
  /** 是否禁用 */
  disabled?: boolean
  /** 日期范围是否包含时间选择（用于 dateRange） */
  showTime?: boolean
  /** 自定义渲染 */
  render?: (field: SearchFieldConfig) => React.ReactNode
}

/** useSearchForm Hook 返回值 */
export interface UseSearchFormReturn<T> {
  /** 表单实例 */
  form: ReturnType<typeof import('antd').Form.useForm>[0]
  /** 当前筛选条件 */
  filters: T
  /** 设置筛选条件 */
  setFilters: React.Dispatch<React.SetStateAction<T>>
  /** 是否展开 */
  expanded: boolean
  /** 设置展开状态 */
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>
  /** 是否显示展开按钮 */
  showExpand: boolean
  /** 处理查询 */
  handleSearch: () => Promise<void>
  /** 处理重置 */
  handleReset: () => void
  /** 重置并回调 */
  handleResetWithCallback: (callback?: () => void) => void
}

/** useSearchForm Hook 参数 */
export interface UseSearchFormOptions<T> {
  /** 默认值 */
  defaultValues?: Partial<T>
  /** 查询回调 */
  onSearch?: (values: T) => void | Promise<void>
  /** 重置回调 */
  onReset?: () => void | Promise<void>
  /** 字段数量（用于判断是否显示展开按钮） */
  fieldsCount?: number
  /** 默认展开 */
  defaultExpanded?: boolean
}
