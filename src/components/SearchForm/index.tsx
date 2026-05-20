import React, { useMemo } from 'react'
import {
  Form,
  Row,
  Col,
  Button,
  Space,
  Select,
  InputNumber,
  DatePicker,
  TreeSelect,
} from 'antd'
import { UpOutlined, DownOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n/useI18n'
import type { SearchFieldConfig } from '../../types/searchForm'
import TrimInput from '../TrimInput'

const { RangePicker } = DatePicker

export interface SearchFormProps {
  /** 查询字段配置列表 */
  fields: SearchFieldConfig[]
  /** 表单实例（来自 useSearchForm） */
  form: ReturnType<typeof Form.useForm>[0]
  /** 是否展开 */
  expanded?: boolean
  /** 设置展开状态 */
  onExpandChange?: (expanded: boolean) => void
  /** 是否显示展开按钮 */
  showExpand?: boolean
  /** 查询回调 */
  onSearch: () => void | Promise<void>
  /** 重置回调 */
  onReset?: () => void
  /** 额外的操作按钮 */
  extraActions?: React.ReactNode
  /** 是否加载中 */
  loading?: boolean
}
/**
 * #### 支持的字段类型
 * | 类型 | 说明 |
 * |------|------|
 * | `input` | 文本输入 |
 * | `select` | 下拉单选 |
 * | `multiSelect` | 下拉多选 |
 * | `number` | 数字输入 |
 * | `dateRange` | 日期范围 |
 * | `treeSelect` | 树形选择 |

#### 字段配置说明
 * interface SearchFieldConfig {
 * name: string                    // 字段名
 * labelKey?: string               // 国际化 label key（优先）
 * label?: string                  // 直接 label（无国际化时使用）
 * type: SearchFieldType           // 字段类型
 * placeholderKey?: string         // 国际化 placeholder key
 * placeholder?: string            // 直接 placeholder
 * options?: Array<{               // select/multiSelect 选项
 * label: string
 * value: string | number
 * labelKey?: string             // 选项国际化 key
 * }>
 * treeData?: Array<unknown>       // treeSelect 数据
 * min?: number                    // number 最小值
 * max?: number                    // number 最大值
 * defaultValue?: unknown          // 默认值
 * disabled?: boolean              // 是否禁用
 * render?: (field) => ReactNode   // 自定义渲染
 * }

 * 通用查询表单组件
 *
 * @example
 * ```tsx
 * const { form, handleSearch, handleReset, expanded, setExpanded, showExpand } = useSearchForm({
 *   onSearch: (values) => loadList(1, values),
 *   fieldsCount: fields.length,
 * })
 *
 * <SearchForm
 *   fields={fields}
 *   form={form}
 *   expanded={expanded}
 *   onExpandChange={setExpanded}
 *   showExpand={showExpand}
 *   onSearch={handleSearch}
 *   onReset={handleReset}
 * />
 *
 */
function SearchForm({
  fields,
  form,
  expanded = false,
  onExpandChange,
  showExpand = false,
  onSearch,
  onReset,
  extraActions,
  loading = false,
}: SearchFormProps) {
  const { t } = useI18n()

  // 默认显示前 4 个字段（1 行）
  const visibleFields = useMemo(() => {
    if (!showExpand || expanded) return fields
    return fields.slice(0, 4)
  }, [fields, showExpand, expanded])

  // 获取 label
  const getLabel = (field: SearchFieldConfig): string => {
    if (field.labelKey) return t(field.labelKey as 'common.search')
    return field.label || ''
  }

  // 获取 placeholder
  const getPlaceholder = (field: SearchFieldConfig): string | string[] => {
    if (field.placeholderKey) return t(field.placeholderKey as 'common.search')
    if (field.placeholder) return field.placeholder
    const action = field.type === 'input' ? t('common.placeholder.enter') : t('common.placeholder.select')
    const label = getLabel(field)
    return `${action}${label}`
  }

  // 渲染字段
  const renderField = (field: SearchFieldConfig) => {
    if (field.render) return field.render(field)

    const placeholder = getPlaceholder(field)
    const commonStyle = { width: '100%' }

    switch (field.type) {
      case 'input':
        return <TrimInput placeholder={placeholder as string} disabled={field.disabled} style={commonStyle} maxLength={100} />
      case 'select':
        return (
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={placeholder as string}
            options={field.options?.map((opt) => ({
              ...opt,
              label: opt.labelKey ? t(opt.labelKey as 'common.search') : opt.label,
            }))}
            allowClear
            disabled={field.disabled}
            style={commonStyle}
          />
        )
      case 'multiSelect':
        return (
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder={placeholder as string}
            options={field.options?.map((opt) => ({
              ...opt,
              label: opt.labelKey ? t(opt.labelKey as 'common.search') : opt.label,
            }))}
            allowClear
            disabled={field.disabled}
            style={commonStyle}
            maxTagCount="responsive"
          />
        )
      case 'number':
        return (
          <InputNumber
            placeholder={placeholder as string}
            min={field.min}
            max={field.max}
            disabled={field.disabled}
            style={commonStyle}
          />
        )
      case 'dateRange':
        return <RangePicker style={commonStyle} disabled={field.disabled} showTime={field.showTime} placeholder={Array.isArray(placeholder) ? (placeholder as [string, string]) : undefined} />
      case 'treeSelect':
        return (
          <TreeSelect
            placeholder={placeholder as string}
            treeData={field.treeData as any}
            allowClear
            disabled={field.disabled}
            treeDefaultExpandAll
            style={commonStyle}
          />
        )
      default:
        return null
    }
  }

  const handleExpandClick = () => {
    onExpandChange?.(!expanded)
  }

  return (
    <Form form={form} layout="vertical">
      <Row gutter={40}>
        {/* 左侧：表单区 */}
        <Col flex="1">
          <Row gutter={40}>
            {visibleFields.map((field) => (
              <Col key={field.name} span={6}>
                <Form.Item name={field.name} label={getLabel(field)} initialValue={field.defaultValue}>
                  {renderField(field)}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Col>

        {/* 右侧：操作区 */}
        <Col flex="192px">
          <Form.Item label=" ">
            <Space size={16}>
              <Button type="primary" onClick={onSearch} loading={loading}>
                {t('common.search')}
              </Button>
              <Button onClick={onReset} disabled={loading}>
                {t('common.reset')}
              </Button>
              {showExpand && (
                <Button type="link" icon={expanded ? <UpOutlined /> : <DownOutlined />} onClick={handleExpandClick}>
                  {expanded ? t('common.collapse') : t('common.expand')}
                </Button>
              )}
              {extraActions}
            </Space>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  )
}

export default SearchForm
