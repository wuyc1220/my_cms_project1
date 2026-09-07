import React from 'react'
import { DatePicker, InputNumber, Select, TimePicker } from 'antd'
import dayjs from 'dayjs'
import TrimInput from './TrimInput'
import { parseApiValue } from '../utils/customField'

interface CustomFieldControlProps {
  fieldType: string
  options?: { value: string; label: string }[]
  disabled?: boolean
  placeholder?: string
  value?: unknown
  onChange?: (value: unknown) => void
  style?: React.CSSProperties
}

export default function CustomFieldControl({
  fieldType,
  options,
  disabled,
  placeholder,
  value,
  onChange,
  style,
}: CustomFieldControlProps) {
  const normalizedValue = value == null ? undefined : parseApiValue(fieldType, value) ?? undefined

  if (fieldType === 'DropList') {
    return (
      <Select
        showSearch
        optionFilterProp="label"
        allowClear
        placeholder={placeholder}
        options={options}
        disabled={disabled}
        value={normalizedValue as string | undefined}
        onChange={(val) => onChange?.(val)}
        style={style}
      />
    )
  }

  if (fieldType === 'DropList_multiple' || fieldType === 'multi_select') {
    return (
      <Select
        showSearch
        optionFilterProp="label"
        mode="multiple"
        allowClear
        placeholder={placeholder}
        options={options}
        disabled={disabled}
        value={normalizedValue as string[] | undefined}
        onChange={(val) => onChange?.(val)}
        style={style}
      />
    )
  }

  if (fieldType === 'LongText') {
    return (
      <TrimInput.TextArea
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        value={normalizedValue as string | undefined}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)}
        style={style}
      />
    )
  }

  if (fieldType === 'Integer') {
    return (
      <InputNumber
        style={style ?? { width: '100%' }}
        disabled={disabled}
        step={1}
        placeholder={placeholder}
        value={normalizedValue as number | null | undefined}
        onChange={(val) => onChange?.(val)}
      />
    )
  }

  if (fieldType === 'Decimal') {
    return (
      <InputNumber
        style={style ?? { width: '100%' }}
        disabled={disabled}
        placeholder={placeholder}
        value={normalizedValue as number | null | undefined}
        onChange={(val) => onChange?.(val)}
      />
    )
  }

  if (fieldType === 'Date') {
    return (
      <DatePicker
        style={style ?? { width: '100%' }}
        disabled={disabled}
        placeholder={placeholder}
        value={normalizedValue as dayjs.Dayjs | null | undefined}
        onChange={(date) => onChange?.(date)}
      />
    )
  }

  if (fieldType === 'Time') {
    return (
      <TimePicker
        style={style ?? { width: '100%' }}
        disabled={disabled}
        placeholder={placeholder}
        value={normalizedValue as dayjs.Dayjs | null | undefined}
        onChange={(time) => onChange?.(time)}
      />
    )
  }

  if (fieldType === 'Date+Time') {
    return (
      <DatePicker
        showTime
        style={style ?? { width: '100%' }}
        format="YYYY-MM-DD HH:mm:ss"
        disabled={disabled}
        placeholder={placeholder}
        value={normalizedValue as dayjs.Dayjs | null | undefined}
        onChange={(date) => onChange?.(date)}
      />
    )
  }

  return (
    <TrimInput
      disabled={disabled}
      placeholder={placeholder}
      value={normalizedValue as string | undefined}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
      style={style}
    />
  )
}
