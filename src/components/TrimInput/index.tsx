import React from 'react'
import { Input } from 'antd'
import type { InputProps, InputRef } from 'antd'

export interface TrimInputProps extends Omit<InputProps, 'onChange'> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const TrimInput = React.forwardRef<InputRef, TrimInputProps>(
  ({ style, onChange, onBlur, value, ...restProps }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const trimmedValue = e.target.value.trimStart()
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: trimmedValue,
        },
      }
      onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const currentValue = e.target.value
      if (typeof currentValue === 'string' && currentValue !== currentValue.trim()) {
        const trimmedValue = currentValue.trim()
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: trimmedValue,
          },
        }
        onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
      }
      onBlur?.(e)
    }

    return (
      <Input
        ref={ref}
        style={{ width: '100%', ...style }}
        value={value}
        {...restProps}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  }
)

TrimInput.displayName = 'TrimInput'

interface TrimTextAreaProps extends Omit<React.ComponentProps<typeof Input.TextArea>, 'onChange'> {
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

const TrimTextArea = React.forwardRef<React.Ref<typeof Input.TextArea>, TrimTextAreaProps>(
  ({ style, onChange, onBlur, value, ...restProps }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const trimmedValue = e.target.value.trimStart()
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: trimmedValue,
        },
      }
      onChange?.(syntheticEvent as React.ChangeEvent<HTMLTextAreaElement>)
    }

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      const currentValue = e.target.value
      if (typeof currentValue === 'string' && currentValue !== currentValue.trim()) {
        const trimmedValue = currentValue.trim()
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: trimmedValue,
          },
        }
        onChange?.(syntheticEvent as React.ChangeEvent<HTMLTextAreaElement>)
      }
      onBlur?.(e)
    }

    return (
      <Input.TextArea
        ref={ref as any}
        style={{ width: '100%', ...style }}
        value={value}
        {...restProps}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  }
)

TrimTextArea.displayName = 'TrimTextArea'

const TrimPassword = React.forwardRef<InputRef, TrimInputProps>(
  ({ style, onChange, onBlur, value, ...restProps }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const trimmedValue = e.target.value.trimStart()
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: trimmedValue,
        },
      }
      onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const currentValue = e.target.value
      if (typeof currentValue === 'string' && currentValue !== currentValue.trim()) {
        const trimmedValue = currentValue.trim()
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: trimmedValue,
          },
        }
        onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
      }
      onBlur?.(e)
    }

    return (
      <Input.Password
        ref={ref}
        style={{ width: '100%', ...style }}
        value={value}
        {...restProps}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  }
)

TrimPassword.displayName = 'TrimPassword'

interface TrimSearchProps extends Omit<React.ComponentProps<typeof Input.Search>, 'onChange'> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const TrimSearch = React.forwardRef<InputRef, TrimSearchProps>(
  ({ style, onChange, onBlur, value, ...restProps }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const trimmedValue = e.target.value.trimStart()
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: trimmedValue,
        },
      }
      onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const currentValue = e.target.value
      if (typeof currentValue === 'string' && currentValue !== currentValue.trim()) {
        const trimmedValue = currentValue.trim()
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: trimmedValue,
          },
        }
        onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
      }
      onBlur?.(e)
    }

    return (
      <Input.Search
        ref={ref}
        style={{ width: '100%', ...style }}
        value={value}
        {...restProps}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  }
)

TrimSearch.displayName = 'TrimSearch'

const TrimInputGroup = (props: React.ComponentProps<typeof Input.Group>) => {
  return <Input.Group {...props} />
}

export default Object.assign(TrimInput, {
  TextArea: TrimTextArea,
  Password: TrimPassword,
  Search: TrimSearch,
  Group: TrimInputGroup,
})
