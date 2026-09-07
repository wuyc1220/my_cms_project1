import { useEffect, useMemo, useState } from 'react'
import { Button, Switch, Table, Tooltip } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getDictTree } from '../api/dicts'
import { getCustomFields } from '../api/customFields'
import { getMultiLanguageOptions } from '../api/i18n'
import { useI18n } from '../i18n/useI18n'
import type { PhysicalChannelListItem } from '../types/live'
import type { DictNodeListItem } from '../types/dict'
import type { CustomFieldListItem } from '../types/basic'
import type { LanguageOption } from '../types/i18n'

interface PhysicalChannelTableProps {
  channelId: number
  dataSource: PhysicalChannelListItem[]
  loading?: boolean
  paginationProps: Record<string, unknown>
  onTableChange: (...args: unknown[]) => void
  locale?: { emptyText: string }
  showDelete?: boolean
  onDelete?: (id: number) => void
}

function buildNameMap(tree: DictNodeListItem[], code: string): Record<string, string> {
  const root = tree.find((d) => d.code === code)
  const map: Record<string, string> = {}
  if (root?.children) {
    root.children.forEach((c) => { map[c.code] = c.name })
  }
  return map
}

export default function PhysicalChannelTable({
  channelId,
  dataSource,
  loading = false,
  paginationProps,
  onTableChange,
  locale,
  showDelete = false,
  onDelete,
}: PhysicalChannelTableProps) {
  const { t } = useI18n()

  const [mediaserviceNameMap, setMediaserviceNameMap] = useState<Record<string, string>>({})
  const [definitionNameMap, setDefinitionNameMap] = useState<Record<string, string>>({})
  const [videoencodeNameMap, setVideoencodeNameMap] = useState<Record<string, string>>({})
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const [dicts, cfRes, langs] = await Promise.all([
          getDictTree(),
          getCustomFields({ page_size: 1000 }),
          getMultiLanguageOptions(),
        ])
        setMediaserviceNameMap(buildNameMap(dicts, 'Mediaservice'))
        setDefinitionNameMap(buildNameMap(dicts, 'Definition'))
        setVideoencodeNameMap(buildNameMap(dicts, 'Videoencode'))
        const fields = cfRes.items.filter(
          (f) => f.belongings.includes('ALL') || f.belongings.includes('PhysicalChannel')
        )
        setCustomFields(fields)
        setLanguageOptions(langs)
      } catch {
        // ignore
      }
    })()
  }, [channelId])

  const columns: ColumnsType<PhysicalChannelListItem> = useMemo(() => {
    const base: ColumnsType<PhysicalChannelListItem> = [
      {
        title: t('physicalChannel.col.mediaservice'),
        dataIndex: 'mediaservice_name',
        key: 'mediaservice',
        width: 120,
        ellipsis: { showTitle: false },
        render: (v?: string, record?: PhysicalChannelListItem) => {
          const text = v ?? mediaserviceNameMap[record?.mediaservice ?? ''] ?? record?.mediaservice ?? '—'
          return <Tooltip title={text}><span>{text}</span></Tooltip>
        },
      },
      {
        title: t('physicalChannel.col.definition'),
        dataIndex: 'definition_name',
        key: 'definition',
        width: 100,
        ellipsis: { showTitle: false },
        render: (v?: string, record?: PhysicalChannelListItem) => {
          const text = v ?? definitionNameMap[record?.definition ?? ''] ?? record?.definition ?? '—'
          return <Tooltip title={text}><span>{text}</span></Tooltip>
        },
      },
      {
        title: t('physicalChannel.col.videoencode'),
        dataIndex: 'videoencode_name',
        key: 'videoencode',
        width: 120,
        ellipsis: { showTitle: false },
        render: (v?: string, record?: PhysicalChannelListItem) => {
          const text = v ?? videoencodeNameMap[record?.videoencode ?? ''] ?? record?.videoencode ?? '—'
          return <Tooltip title={text}><span>{text}</span></Tooltip>
        },
      },
      {
        title: t('physicalChannel.col.bitrate'),
        dataIndex: 'bitrate',
        key: 'bitrate',
        width: 100,
        ellipsis: { showTitle: false },
        render: (v?: string) => {
          const text = v ?? '—'
          return <Tooltip title={text}><span>{text}</span></Tooltip>
        },
      },
      {
        title: t('physicalChannel.col.deeplinkChUrl'),
        dataIndex: 'deeplink_ch_url',
        key: 'deeplink_ch_url',
        width: 160,
        ellipsis: { showTitle: false },
        render: (v?: string) => {
          const text = v ?? '—'
          return <Tooltip title={text}><span>{text}</span></Tooltip>
        },
      },
      {
        title: t('physicalChannel.col.shifttime'),
        dataIndex: 'shifttime',
        key: 'shifttime',
        width: 100,
        render: (v?: number) => v ?? '—',
      },
      {
        title: t('physicalChannel.col.tvodSaveTime'),
        dataIndex: 'tvod_save_time',
        key: 'tvod_save_time',
        width: 120,
        render: (v?: number) => v ?? '—',
      },
      {
        title: t('physicalChannel.col.tvodEnable'),
        dataIndex: 'tvod_enable',
        key: 'tvod_enable',
        width: 100,
        align: 'center',
        render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
      },
      {
        title: t('physicalChannel.col.tstvEnable'),
        dataIndex: 'tstv_enable',
        key: 'tstv_enable',
        width: 100,
        align: 'center',
        render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
      },
      {
        title: t('physicalChannel.col.cutvEnable'),
        dataIndex: 'cutv_enable',
        key: 'cutv_enable',
        width: 100,
        align: 'center',
        render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
      },
      {
        title: t('physicalChannel.col.encryption'),
        dataIndex: 'encryption',
        key: 'encryption',
        width: 100,
        align: 'center',
        render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
      },
      ...customFields.map((field) => ({
        title: field.field_name,
        key: field.field_code,
        width: 120,
        ellipsis: { showTitle: false },
        render: (_: unknown, record: PhysicalChannelListItem) => {
          const raw = record.field_values?.[field.field_code]
          if (raw === undefined || raw === null || raw === '') {
            return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>—</span>
          }

          // 下拉类型：将编码转换为选项名称显示（按主语言）
          const isSelect = field.field_type === 'DropList' || field.field_type === 'DropList_multiple' || field.field_type === 'multi_select'
          if (isSelect && field.options?.length) {
            const defaultLang = languageOptions[0]?.code ?? ''
            const langOrder = languageOptions.map((l) => l.code)
            const optionMap = new Map(
              field.options.map((opt) => {
                let label = opt.names?.[defaultLang]
                if (!label && langOrder.length) {
                  for (const lang of langOrder) {
                    if (lang === defaultLang) continue
                    if (opt.names?.[lang]) { label = opt.names[lang]; break }
                  }
                }
                if (!label) label = Object.values(opt.names ?? {})[0] ?? opt.code
                return [opt.code, label]
              })
            )
            const codes = String(raw).split(',').map((s) => s.trim()).filter(Boolean)
            const names = codes.map((code) => optionMap.get(code) ?? code)
            const text = names.join(', ') || '—'
            return <Tooltip title={text}><span>{text}</span></Tooltip>
          }

          const text = String(raw)
          return <Tooltip title={text}><span>{text}</span></Tooltip>
        },
      })),
    ]

    if (showDelete && onDelete) {
      base.push({
        title: t('common.action'),
        key: 'action',
        width: 80,
        fixed: 'right' as const,
        render: (_: unknown, record: PhysicalChannelListItem) => (
          <Tooltip title={t('common.delete')}>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete(record.id)}
            />
          </Tooltip>
        ),
      })
    }

    return base
  }, [t, mediaserviceNameMap, definitionNameMap, videoencodeNameMap, customFields, languageOptions, showDelete, onDelete])

  return (
    <Table<PhysicalChannelListItem>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={dataSource}
      scroll={{ x: 1200 }}
      pagination={paginationProps}
      onChange={onTableChange as never}
      locale={locale}
    />
  )
}
