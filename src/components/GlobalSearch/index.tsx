import { useState, useCallback } from 'react'
import { Dropdown, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import TrimInput from '../TrimInput'
import { getContents } from '../../api/contents'
import { useI18n } from '../../i18n/useI18n'
import type { ContentListItem } from '../../types/content'
import type { MenuProps } from 'antd'

interface GlobalSearchProps {
  style?: React.CSSProperties
}

export default function GlobalSearch({ style }: GlobalSearchProps) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ContentListItem[]>([])
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const navigate = useNavigate()
  const { t } = useI18n()

  const handleSearch = useCallback(async (value: string) => {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return
    }

    setLoading(true)

    try {
      const isIdSearch = /^\d+$/.test(trimmedValue)
      const params = isIdSearch
        ? { content_id: Number(trimmedValue), title: trimmedValue, page_size: 10 }
        : { title: trimmedValue, page_size: 10 }

      const response = await getContents(params)
      const items = response.items || []

      setResults(items)

      if (items.length === 1) {
        navigate(`/contents/${items[0].id}`)
        setKeyword('')
      } else if (items.length === 0) {
        message.info(t('header.search.noResult'))
      } else {
        setDropdownVisible(true)
      }
    } catch {
      message.error(t('common.msg.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [navigate, t])

  const handleSelect = useCallback((contentId: number) => {
    navigate(`/contents/${contentId}`)
    setKeyword('')
    setDropdownVisible(false)
    setResults([])
  }, [navigate])

  const dropdownItems: MenuProps['items'] = results.map((item) => ({
    key: item.id,
    label: (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          minWidth: 400,
          padding: '4px 0',
        }}
      >
        <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </span>
        <span style={{ color: '#999', fontSize: 12, flexShrink: 0 }}>
          ID: {item.id}
        </span>
        <span style={{ color: '#1890ff', fontSize: 12, flexShrink: 0 }}>
          {item.content_type}
        </span>
      </div>
    ),
    onClick: () => handleSelect(item.id),
  }))

  return (
    <Dropdown
      menu={{ items: dropdownItems }}
      open={dropdownVisible && results.length > 1}
      trigger={['click']}
      destroyPopupOnHide
      onOpenChange={(open) => {
        if (!open) {
          setDropdownVisible(false)
        }
      }}
    >
      <TrimInput.Search
        placeholder={t('header.globalSearchPlaceholder')}
        enterButton={t('header.search')}
        allowClear
        loading={loading}
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value)
          if (dropdownVisible) {
            setDropdownVisible(false)
          }
        }}
        onSearch={handleSearch}
        style={{ maxWidth: 520, width: '100%', ...style }}
      />
    </Dropdown>
  )
}
