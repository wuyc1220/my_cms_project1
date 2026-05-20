/**
 * ProcessedHistoryTab — 统一处理历史组件
 *
 * 数据来源：getProcessedHistory(entity_type, entity_id) 或 getContentHistory(content_id)
 * 支持 mode='full'（5列：含 previous_value/updated_value）和 mode='simple'（4列：只有 details）
 *
 * 使用方式：
 *   <ProcessedHistoryTab entityType="license" entityId={id} mode="full" />
 *   <ProcessedHistoryTab contentId={id} mode="full" />
 *   <ProcessedHistoryTab entityType="content" entityId={id} mode="simple" />
 */

import { useEffect, useMemo, useState } from 'react'
import { message, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getProcessedHistory, getContentHistory } from '../api/operationLogs'
import { getDictTree } from '../api/dicts'
import { isHandledError } from '../api'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import type { ProcessedHistoryItem } from '../types/trade'
import type { DictNodeListItem } from '../types/dict'

const ADD_TYPES = new Set([
  'PROVIDER_CREATE', 'CONTRACT_CREATE', 'LICENSE_CREATE',
  'CONTENT_CREATE', 'USER_CREATE', 'ROLE_CREATE',
  'DICT_CREATE', 'CONFIG_CREATE', 'PACKAGE_CREATE',
  'SCHEDULE_CREATE', 'CAST_CREATE', 'CATEGORY_CREATE',
  'GENRE_CREATE', 'TAG_CREATE', 'CUSTOM_TAG_CREATE',
  'CONTENT_TYPE_CREATE', 'POSTER_SIZE_CREATE', 'CUSTOM_FIELD_CREATE',
  'SENSITIVE_WORD_CREATE', 'METADATA_SOURCE_CREATE', 'CRAWL_TASK_CREATE',
  'PACKAGE_CONTENT_ADD',
  'PHYSICAL_CHANNEL_CREATE', 'CHANNEL_METADATA_CREATE',
  'SCHEDULE_METADATA_CREATE', 'CAST_ROLE_MAP_CREATE',
  'POSTER_UPLOAD',
  'PROGRAM_METADATA_CREATE', 'SERIES_METADATA_CREATE', 'MOVIE_CREATE',
  'EPISODE_INJECT',
])

const DELETE_TYPES = new Set([
  'PROVIDER_DELETE', 'CONTRACT_DELETE', 'LICENSE_DELETE',
  'CONTENT_DELETE', 'USER_DELETE', 'ROLE_DELETE',
  'DICT_DELETE', 'CONFIG_DELETE', 'PACKAGE_DELETE',
  'SCHEDULE_DELETE', 'CAST_DELETE', 'CATEGORY_DELETE',
  'GENRE_DELETE', 'TAG_DELETE', 'CUSTOM_TAG_DELETE',
  'CONTENT_TYPE_DELETE', 'POSTER_SIZE_DELETE', 'CUSTOM_FIELD_DELETE',
  'SENSITIVE_WORD_DELETE', 'METADATA_SOURCE_DELETE', 'CRAWL_TASK_DELETE',
  'CONTRACT_ATTACHMENT_DELETE', 'PACKAGE_CONTENT_REMOVE',
  'PHYSICAL_CHANNEL_DELETE', 'CHANNEL_METADATA_DELETE',
  'SCHEDULE_METADATA_DELETE', 'CAST_ROLE_MAP_DELETE',
  'POSTER_DELETE',
  'PROGRAM_METADATA_DELETE', 'SERIES_METADATA_DELETE', 'MOVIE_DELETE',
  'EPISODE_REMOVE',
])

const ATTACHED_TYPES = new Set([
  'CONTENT_PACKAGE_LINK', 'CONTENT_PACKAGE_UNLINK',
  'CONTENT_CATEGORY_LINK', 'CONTENT_CATEGORY_UNLINK',
  'LICENSE_CONTENT_ADD', 'LICENSE_CONTENT_REMOVE',
  'CAST_ROLE_MAP_LINK', 'CAST_ROLE_MAP_UNLINK',
])

const REVIEW_TYPES = new Set([
  'CONTENT_REVIEW_INITIATE', 'CONTENT_REVIEW_APPROVE', 'CONTENT_REVIEW_REJECT',
])

const PUBLISHED_TYPES = new Set(['PUBLISH_NOW', 'PUBLISH_BATCH'])
const UNPUBLISHED_TYPES = new Set(['UNPUBLISH_NOW', 'UNPUBLISH_BATCH'])
const PLAN_TYPES = new Set(['PUBLISH_PLAN_CREATE', 'PUBLISH_PLAN_UPDATE', 'PUBLISH_PLAN_CANCEL'])

function getProcessedTypeLabel(key: string, t: (key: string) => string): string {
  if (ADD_TYPES.has(key)) return t('history.type.add')
  if (DELETE_TYPES.has(key)) return t('history.type.delete')
  if (ATTACHED_TYPES.has(key)) return t('history.type.attached')
  if (REVIEW_TYPES.has(key)) return t('history.type.review')
  if (PUBLISHED_TYPES.has(key)) return t('history.type.published')
  if (UNPUBLISHED_TYPES.has(key)) return t('history.type.unpublished')
  if (PLAN_TYPES.has(key)) return t('history.type.plan')
  return t('history.type.update')
}

function getProcessedTypeColor(key: string): string {
  if (ADD_TYPES.has(key)) return 'green'
  if (DELETE_TYPES.has(key)) return 'red'
  if (ATTACHED_TYPES.has(key)) return 'cyan'
  if (REVIEW_TYPES.has(key)) return 'purple'
  if (PUBLISHED_TYPES.has(key)) return 'green'
  if (UNPUBLISHED_TYPES.has(key)) return 'red'
  if (PLAN_TYPES.has(key)) return 'blue'
  return 'blue'
}

const FIELD_LABEL_MAP: Record<string, Record<string, Record<string, string>>> = {
  license: {
    name: { cn: '名称', en: 'Name' },
    start_date: { cn: '开始日期', en: 'Start Date' },
    end_date: { cn: '结束日期', en: 'End Date' },
    service_type_name: { cn: '服务类型', en: 'Service Type' },
    regions: { cn: '授权地区', en: 'Regions' },
    platforms: { cn: '平台', en: 'Platforms' },
    mobile_download: { cn: '移动端下载', en: 'Mobile Download' },
    download_duration: { cn: '下载有效天数', en: 'Download Duration' },
    mobile_preview: { cn: '移动端预览', en: 'Mobile Preview' },
    preview_begin_time: { cn: '预览开始时间', en: 'Preview Begin Time' },
    preview_end_time: { cn: '预览结束时间', en: 'Preview End Time' },
    notes: { cn: '备注', en: 'Notes' },
    contract_name: { cn: '合同', en: 'Contract' },
    status_label_key: { cn: '状态', en: 'Status' },
  },
  contract: {
    name: { cn: '名称', en: 'Name' },
    start_date: { cn: '开始日期', en: 'Start Date' },
    end_date: { cn: '结束日期', en: 'End Date' },
    notes: { cn: '备注', en: 'Notes' },
    provider_name: { cn: '供应商', en: 'Provider' },
    platforms: { cn: '平台', en: 'Platforms' },
  },
  provider: {
    name: { cn: '名称', en: 'Name' },
    country_name: { cn: '国家/地区', en: 'Country' },
    code: { cn: '编码', en: 'Code' },
    provider_code: { cn: '供应商编码', en: 'Provider Code' },
    review_level_name: { cn: '审核层级', en: 'Review Level' },
    l1_assignee_name: { cn: 'L1分配人', en: 'L1 Assignee' },
    l2_assignee_name: { cn: 'L2分配人', en: 'L2 Assignee' },
    l3_assignee_name: { cn: 'L3分配人', en: 'L3 Assignee' },
    notes: { cn: '备注', en: 'Notes' },
  },
  physical_channel: {
    name: { cn: '名称', en: 'Name' },
    channel_number: { cn: '频道号', en: 'Channel Number' },
    mediaservice_name: { cn: '媒体服务', en: 'Media Service' },
    definition_name: { cn: '清晰度', en: 'Definition' },
    videoencode_name: { cn: '频道编码', en: 'Video Encode' },
    bitrate: { cn: '频道码率', en: 'Bitrate' },
    shifttime: { cn: '时移时间', en: 'Shift Time' },
    tvod_save_time: { cn: 'TVOD保存时间', en: 'TVOD Save Time' },
    tvod_enable: { cn: 'TVOD启用', en: 'TVOD Enable' },
    tstv_enable: { cn: 'TSTV启用', en: 'TSTV Enable' },
    cutv_enable: { cn: 'CUTV启用', en: 'CUTV Enable' },
    encryption: { cn: '加密', en: 'Encryption' },
    status: { cn: '状态', en: 'Status' },
  },
  channel_metadata: {
    name: { cn: '名称', en: 'Name' },
    channel_number: { cn: '频道号', en: 'Channel Number' },
    description: { cn: '简介', en: 'Description' },
    channel_type_name: { cn: '频道类型', en: 'Channel Type' },
    audio_type_name: { cn: '音频类型', en: 'Audio Type' },
    rating_level_name: { cn: '分级', en: 'Rating Level' },
    audio_lang_names: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang_names: { cn: '字幕语言', en: 'Subtitle Language' },
    language_names: { cn: '频道语言', en: 'Language' },
    status_flag: { cn: '状态', en: 'Status' },
    ppv_enable: { cn: 'PPV启用', en: 'PPV Enable' },
    npvr_enable: { cn: 'NPVR启用', en: 'NPVR Enable' },
    fingerprint_enable: { cn: '指纹启用', en: 'Fingerprint Enable' },
    watermark_enable: { cn: '水印启用', en: 'Watermark Enable' },
  },
  content: {
    title: { cn: '名称', en: 'Title' },
    short_name: { cn: '短名称', en: 'Short Name' },
    description: { cn: '简介', en: 'Description' },
    name: { cn: '名称', en: 'Name' },
    package_names: { cn: '服务包', en: 'Packages' },
    category_names: { cn: '栏目', en: 'Categories' },
    custom_tag_names: { cn: '自定义标签', en: 'Custom Tags' },
    genre_name: { cn: '题材', en: 'Genre' },
    '标签': { cn: '标签', en: 'Tags' },
    '题材': { cn: '题材', en: 'Genres' },
    task_type: { cn: '任务类型', en: 'Task Type' },
    execution_mode: { cn: '执行方式', en: 'Execution Mode' },
    scheduled_time: { cn: '计划时间', en: 'Scheduled Time' },
    status: { cn: '状态', en: 'Status' },
    publish_status: { cn: '发布状态', en: 'Publish Status' },
  },
  publish_task: {
    task_type: { cn: '任务类型', en: 'Task Type' },
    execution_mode: { cn: '执行方式', en: 'Execution Mode' },
    scheduled_time: { cn: '计划时间', en: 'Scheduled Time' },
    status: { cn: '状态', en: 'Status' },
    publish_status: { cn: '发布状态', en: 'Publish Status' },
  },
  publish_plan: {
    task_type: { cn: '任务类型', en: 'Task Type' },
    execution_mode: { cn: '执行方式', en: 'Execution Mode' },
    scheduled_time: { cn: '计划时间', en: 'Scheduled Time' },
    status: { cn: '状态', en: 'Status' },
    publish_status: { cn: '发布状态', en: 'Publish Status' },
  },
  schedule_metadata: {
    name: { cn: '名称', en: 'Name' },
    description: { cn: '简介', en: 'Description' },
    vod_type_names: { cn: 'VOD类型', en: 'VOD Type' },
    type_name: { cn: '类型', en: 'Type' },
    audio_lang_names: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang_names: { cn: '字幕语言', en: 'Subtitle Language' },
    rating_level_name: { cn: '分级', en: 'Rating Level' },
    advice_names: { cn: '分级建议', en: 'Advice' },
    studio: { cn: '制片公司', en: 'Studio' },
    cdr_id: { cn: 'CDR ID', en: 'CDR ID' },
    status_flag: { cn: '状态', en: 'Status' },
    cutv_enable: { cn: 'CUTV启用', en: 'CUTV Enable' },
    tstv_enable: { cn: 'TSTV启用', en: 'TSTV Enable' },
    tstv_mode: { cn: 'TSTV模式', en: 'TSTV Mode' },
    npvr_enable: { cn: 'NPVR启用', en: 'NPVR Enable' },
    ppv_enable: { cn: 'PPV启用', en: 'PPV Enable' },
    broadcast_type_name: { cn: '播出类型', en: 'Broadcast Type' },
    pre_buffer: { cn: '前缓冲(秒)', en: 'Pre Buffer(s)' },
    post_buffer: { cn: '后缓冲(秒)', en: 'Post Buffer(s)' },
    purchase_begin_time: { cn: '购买开始时间(分钟)', en: 'Purchase Begin Time(min)' },
    purchase_end_time: { cn: '购买结束时间(分钟)', en: 'Purchase End Time(min)' },
    series_type: { cn: '连续剧类型', en: 'Series Type' },
    series_name: { cn: '连续剧名称', en: 'Series Name' },
    series_id: { cn: '连续剧ID', en: 'Series ID' },
    volume_count: { cn: '集/季数量', en: 'Volume Count' },
    sequence: { cn: '集序号', en: 'Sequence' },
    series_ordinal: { cn: '季序号', en: 'Series Ordinal' },
    show_id: { cn: '剧集ID', en: 'Show ID' },
    show_name: { cn: '剧集名称', en: 'Show Name' },
    package_names: { cn: '服务包', en: 'Packages' },
  },
  cast_role_map: {
    role_name: { cn: '角色名称', en: 'Role Name' },
    role_code: { cn: '角色编码', en: 'Role Code' },
    cast_name: { cn: '演职人员', en: 'Cast' },
    character_name: { cn: '角色人物', en: 'Character' },
    sort_order: { cn: '排序', en: 'Sort Order' },
  },
  schedule: {
    title: { cn: '名称', en: 'Title' },
    short_name: { cn: '短名称', en: 'Short Name' },
    description: { cn: '简介', en: 'Description' },
  },
  program_metadata: {
    name: { cn: '名称', en: 'Name' },
    sort_name: { cn: '排序名', en: 'Sort Name' },
    original_name: { cn: '原名', en: 'Original Name' },
    original_country: { cn: '原产地', en: 'Original Country' },
    short_title: { cn: '短标题', en: 'Short Title' },
    language_name: { cn: '语言', en: 'Language' },
    release_year: { cn: '发行年份', en: 'Release Year' },
    description: { cn: '简介', en: 'Description' },
    type_name: { cn: '类型', en: 'Type' },
    rating_level_name: { cn: '分级', en: 'Rating Level' },
    advice_names: { cn: '分级建议', en: 'Advice' },
    rating: { cn: '评分', en: 'Rating' },
    audio_lang_names: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang_names: { cn: '字幕语言', en: 'Subtitle Language' },
    studio: { cn: '制片公司', en: 'Studio' },
    cdr_id: { cn: 'CDR ID', en: 'CDR ID' },
    series_flag: { cn: '连续剧标识', en: 'Series Flag' },
    begin_duration: { cn: '片头时长(秒)', en: 'Begin Duration(s)' },
    end_duration: { cn: '片尾时长(秒)', en: 'End Duration(s)' },
    status_flag: { cn: '状态', en: 'Status' },
    vod_type_names: { cn: 'VOD类型', en: 'VOD Type' },
    metalayout_name: { cn: 'Metalayout', en: 'Metalayout' },
    content_name: { cn: '内容', en: 'Content' },
  },
  series_metadata: {
    name: { cn: '名称', en: 'Name' },
    sort_name: { cn: '排序名', en: 'Sort Name' },
    original_name: { cn: '原名', en: 'Original Name' },
    original_country: { cn: '原产地', en: 'Original Country' },
    short_title: { cn: '短标题', en: 'Short Title' },
    language_name: { cn: '语言', en: 'Language' },
    release_year: { cn: '发行年份', en: 'Release Year' },
    description: { cn: '简介', en: 'Description' },
    type_name: { cn: '类型', en: 'Type' },
    rating_level_name: { cn: '分级', en: 'Rating Level' },
    advice_names: { cn: '分级建议', en: 'Advice' },
    rating: { cn: '评分', en: 'Rating' },
    audio_lang_names: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang_names: { cn: '字幕语言', en: 'Subtitle Language' },
    studio: { cn: '制片公司', en: 'Studio' },
    cdr_id: { cn: 'CDR ID', en: 'CDR ID' },
    begin_duration: { cn: '片头时长(秒)', en: 'Begin Duration(s)' },
    end_duration: { cn: '片尾时长(秒)', en: 'End Duration(s)' },
    status_flag: { cn: '状态', en: 'Status' },
    vod_type_names: { cn: 'VOD类型', en: 'VOD Type' },
    volume_count: { cn: '集/季数量', en: 'Volume Count' },
    series_type: { cn: '连续剧类型', en: 'Series Type' },
    series_ordinal: { cn: '季序号', en: 'Series Ordinal' },
    show_id: { cn: '剧集ID', en: 'Show ID' },
    content_name: { cn: '内容', en: 'Content' },
  },
  movie: {
    file_name: { cn: '文件名', en: 'File Name' },
    file_path: { cn: '文件路径', en: 'File Path' },
    file_size: { cn: '文件大小', en: 'File Size' },
    movie_type: { cn: '媒资类型', en: 'Movie Type' },
    audio_type_name: { cn: '音频类型', en: 'Audio Type' },
    screen_format_name: { cn: '画面格式', en: 'Screen Format' },
    closed_captioning: { cn: '隐藏字幕', en: 'Closed Captioning' },
    duration: { cn: '时长(分钟)', en: 'Duration(min)' },
    definition_name: { cn: '清晰度', en: 'Definition' },
    encryption: { cn: '加密', en: 'Encryption' },
    publish_flag: { cn: '发布标识', en: 'Publish Flag' },
    deeplink: { cn: '深度链接', en: 'Deeplink' },
    mediaservice_name: { cn: '媒体服务', en: 'Media Service' },
    sequence: { cn: '序号', en: 'Sequence' },
    content_name: { cn: '内容', en: 'Content' },
  },
}

const ENRICHED_FIELD_PAIRS: Record<string, Record<string, string>> = {
  provider: {
    l1_assignee_id: 'l1_assignee_name',
    l2_assignee_id: 'l2_assignee_name',
    l3_assignee_id: 'l3_assignee_name',
    country: 'country_name',
    review_level: 'review_level_name',
  },
  contract: {
    provider_id: 'provider_name',
  },
  license: {
    contract_id: 'contract_name',
    service_type: 'service_type_name',
    status: 'status_label_key',
  },
  physical_channel: {
    mediaservice: 'mediaservice_name',
    definition: 'definition_name',
    videoencode: 'videoencode_name',
  },
  channel_metadata: {
    content_id: 'content_name',
    channel_type: 'channel_type_name',
    audio_type: 'audio_type_name',
    rating_level: 'rating_level_name',
    audio_lang: 'audio_lang_names',
    subtitle_lang: 'subtitle_lang_names',
    language: 'language_names',
  },
  schedule_metadata: {
    content_id: 'content_name',
    type_id: 'type_name',
    vod_type: 'vod_type_names',
    audio_lang: 'audio_lang_names',
    subtitle_lang: 'subtitle_lang_names',
    rating_level: 'rating_level_name',
    advice: 'advice_names',
    broadcast_type: 'broadcast_type_name',
    series_id: 'series_name',
    show_id: 'show_name',
    package_ids: 'package_names',
  },
  cast_role_map: {
    cast_id: 'cast_name',
  },
  content: {
    custom_tag_ids: 'custom_tag_names',
    genre_id: 'genre_name',
  },
  program_metadata: {
    content_id: 'content_name',
    type_id: 'type_name',
    vod_type: 'vod_type_names',
    language: 'language_name',
    audio_lang: 'audio_lang_names',
    subtitle_lang: 'subtitle_lang_names',
    rating_level: 'rating_level_name',
    advice: 'advice_names',
    metalayout: 'metalayout_name',
  },
  series_metadata: {
    content_id: 'content_name',
    type_id: 'type_name',
    vod_type: 'vod_type_names',
    language: 'language_name',
    audio_lang: 'audio_lang_names',
    subtitle_lang: 'subtitle_lang_names',
    rating_level: 'rating_level_name',
    advice: 'advice_names',
  },
  movie: {
    content_id: 'content_name',
    audio_type: 'audio_type_name',
    screen_format: 'screen_format_name',
    definition: 'definition_name',
    mediaservice: 'mediaservice_name',
  },
}

function formatPlatformValue(
  val: unknown,
  entityType: string | null | undefined,
  lang: string,
  platformMap: Record<string, string>,
  t: (key: string) => string,
): string {
  if (!Array.isArray(val)) return JSON.stringify(val)
  const rightsKey = entityType === 'license' ? 'ad_rights' : 'commercial_rights'
  const rightsLabel = entityType === 'license'
    ? (lang === 'en' ? 'Ad Rights' : '广告权利')
    : (lang === 'en' ? 'Commercial Rights' : '商业授权')
  const yesStr = t('common.yes')
  const noStr = t('common.no')
  return val.map((item: Record<string, unknown>) => {
    const code = String(item.platform ?? '')
    const name = platformMap[code] ?? code
    const rights = item[rightsKey]
    const rightsStr = typeof rights === 'boolean' ? (rights ? yesStr : noStr) : String(rights)
    return `${name} - ${rightsLabel}: ${rightsStr}`
  }).join('\n')
}

function tryParseJson(str: string | null | undefined): Record<string, unknown> | null {
  if (!str) return null
  try {
    return JSON.parse(str) as Record<string, unknown>
  } catch {
    return null
  }
}

function jsonStableStringify(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val !== 'object') return String(val)
  try {
    return JSON.stringify(val, Object.keys(val as Record<string, unknown>).sort())
  } catch {
    return String(val)
  }
}

interface DiffEntry {
  key: string
  label: string
  prevVal: unknown
  updVal: unknown
  _platformChangeInfo?: PlatformChangeInfo
}

type PlatformChangeInfo =
  | { type: 'add'; platform: string; prevRights: null; newRights: boolean }
  | { type: 'remove'; platform: string; prevRights: boolean; newRights: null }
  | { type: 'rights_change'; platform: string; prevRights: boolean; newRights: boolean }

function computePlatformChanges(
  prevVal: unknown,
  updVal: unknown,
): PlatformChangeInfo[] {
  const prevArr = Array.isArray(prevVal) ? (prevVal as Array<Record<string, unknown>>) : []
  const updArr = Array.isArray(updVal) ? (updVal as Array<Record<string, unknown>>) : []

  const getKey = (item: Record<string, unknown>) => String(item.platform ?? '')
  const getRights = (item: Record<string, unknown>) => {
    if ('commercial_rights' in item) return Boolean(item.commercial_rights)
    if ('ad_rights' in item) return Boolean(item.ad_rights)
    return false
  }

  const prevMap = new Map<string, boolean>()
  for (const p of prevArr) prevMap.set(getKey(p), getRights(p))

  const updMap = new Map<string, boolean>()
  for (const p of updArr) updMap.set(getKey(p), getRights(p))

  const changes: PlatformChangeInfo[] = []

  for (const [platform, rights] of prevMap) {
    if (!updMap.has(platform)) {
      changes.push({ type: 'remove', platform, prevRights: rights, newRights: null })
    }
  }

  for (const [platform, rights] of updMap) {
    if (!prevMap.has(platform)) {
      changes.push({ type: 'add', platform, prevRights: null, newRights: rights })
    }
  }

  for (const [platform, rights] of updMap) {
    if (prevMap.has(platform) && prevMap.get(platform) !== rights) {
      changes.push({ type: 'rights_change', platform, prevRights: prevMap.get(platform)!, newRights: rights })
    }
  }

  return changes
}

function formatPlatformChangeDisplay(
  info: PlatformChangeInfo,
  side: 'prev' | 'upd',
  platformMap: Record<string, string>,
  t: (key: string) => string,
  lang: string,
  entityType: string | null | undefined,
): string {
  const rightsLabel = entityType === 'license'
    ? (lang === 'en' ? 'Ad Rights' : '广告权利')
    : (lang === 'en' ? 'Commercial Rights' : '商业授权')
  const yesStr = t('common.yes')
  const noStr = t('common.no')
  const platformName = platformMap[info.platform] ?? info.platform

  if (side === 'prev') {
    switch (info.type) {
      case 'remove':
      case 'rights_change':
        return `${platformName}-${rightsLabel}：${info.prevRights ? yesStr : noStr}`
      case 'add':
        return lang === 'en' ? 'None' : '无'
    }
  } else {
    switch (info.type) {
      case 'remove':
        return `${lang === 'en' ? 'Remove platform' : '删除平台'} ${platformName}）`
      case 'add':
        return `${lang === 'en' ? 'Add platform' : '增加平台'}：${platformName}-${rightsLabel}：${info.newRights ? yesStr : noStr}）`
      case 'rights_change':
        return `${platformName}-${rightsLabel}：${info.newRights ? yesStr : noStr}）`
    }
  }
  return ''
}

function computeDiff(
  prevObj: Record<string, unknown> | null,
  updObj: Record<string, unknown> | null,
  entityType: string | null | undefined,
  lang: string,
): DiffEntry[] {
  const labels = (entityType && FIELD_LABEL_MAP[entityType]) ?? {}
  const labelMap = labels as Record<string, Record<string, string>>
  const allKeys = new Set<string>()
  if (prevObj) Object.keys(prevObj).forEach((k) => allKeys.add(k))
  if (updObj) Object.keys(updObj).forEach((k) => allKeys.add(k))

  const enrichedPairs = (entityType && ENRICHED_FIELD_PAIRS[entityType]) ?? {}
  const rawFieldsToHide = new Set<string>()
  for (const [rawField, enrichedField] of Object.entries(enrichedPairs)) {
    if (allKeys.has(enrichedField)) {
      rawFieldsToHide.add(rawField)
    }
  }

  const diffs: DiffEntry[] = []
  for (const key of allKeys) {
    if (rawFieldsToHide.has(key)) continue
    const pv = prevObj?.[key]
    const uv = updObj?.[key]
    if (jsonStableStringify(pv) === jsonStableStringify(uv)) continue

    if (key === 'platforms') {
      const changes = computePlatformChanges(pv, uv)
      for (const change of changes) {
        const label = labelMap[key]?.[lang === 'en' ? 'en' : 'cn'] ?? key
        diffs.push({
          key: `platforms-${change.type}-${change.platform}`,
          label,
          prevVal: change,
          updVal: change,
          _platformChangeInfo: change,
        })
      }
      continue
    }

    const label = labelMap[key]?.[lang === 'en' ? 'en' : 'cn'] ?? key
    diffs.push({ key, label, prevVal: pv, updVal: uv })
  }
  return diffs
}

function formatValue(
  key: string,
  val: unknown,
  entityType: string | null | undefined,
  lang: string,
  platformMap: Record<string, string>,
  t: (key: string) => string,
): string {
  if (val === undefined || val === null) return '—'
  if (key.endsWith('_label_key') && typeof val === 'string') {
    const translated = t(val as MessageKey)
    return translated !== val ? translated : val
  }
  if (key === 'platforms' && Array.isArray(val)) {
    return formatPlatformValue(val, entityType, lang, platformMap, t)
  }
  if (typeof val === 'boolean') return val ? t('common.yes') : t('common.no')
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }
  return String(val)
}

function renderDiffColumn(
  diffs: DiffEntry[],
  side: 'prev' | 'upd',
  entityType: string | null | undefined,
  lang: string,
  platformMap: Record<string, string>,
  t: (key: string) => string,
): React.ReactNode {
  if (diffs.length === 0) return '—'

  const MAX_VISIBLE = 2
  const visibleDiffs = diffs.slice(0, MAX_VISIBLE)
  const hiddenDiffs = diffs.slice(MAX_VISIBLE)

  const renderDiffItem = (d: DiffEntry, i: number) => {
    if (d._platformChangeInfo) {
      const valStr = formatPlatformChangeDisplay(d._platformChangeInfo, side, platformMap, t, lang, entityType)
      return (
        <div key={d.key} style={i > 0 ? { marginTop: 4 } : undefined}>
          <span style={{ fontWeight: 500 }}>{d.label}</span>：{valStr}
        </div>
      )
    }
    const val = side === 'prev' ? d.prevVal : d.updVal
    const valStr = formatValue(d.key, val, entityType, lang, platformMap, t)
    return (
      <div key={d.key} style={i > 0 ? { marginTop: 4 } : undefined}>
        <span style={{ fontWeight: 500 }}>{d.label}</span>：{valStr}
      </div>
    )
  }

  const renderAllDiffs = (items: DiffEntry[]) =>
    items.map((d, i) => renderDiffItem(d, i))

  if (hiddenDiffs.length === 0) {
    return (
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {renderAllDiffs(visibleDiffs)}
      </div>
    )
  }

  const tooltipContent = (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {renderAllDiffs(diffs)}
    </div>
  )

  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {renderAllDiffs(visibleDiffs)}
      <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: 400 }}>
        <span style={{ color: '#1677ff', cursor: 'pointer' }}>
          +{hiddenDiffs.length} {t('common.more')}
        </span>
      </Tooltip>
    </div>
  )
}

interface ProcessedHistoryTabProps {
  entityType?: string
  entityId?: number
  contentId?: number
  mode?: 'full' | 'simple' | 'detail'
  refreshVersion?: number
  excludeTypes?: string[]
}

export default function ProcessedHistoryTab({
  entityType,
  entityId,
  contentId,
  mode = 'full',
  refreshVersion,
  excludeTypes,
}: ProcessedHistoryTabProps) {
  const { t, language } = useI18n()
  const tStr = (key: string) => t(key as MessageKey)
  const [data, setData] = useState<ProcessedHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [platformMap, setPlatformMap] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    getDictTree()
      .then((dicts) => {
        if (cancelled) return
        const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        const map: Record<string, string> = {}
        for (const child of platformRoot?.children ?? []) {
          map[child.code] = child.name
        }
        setPlatformMap(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const fetcher = contentId
      ? getContentHistory({ content_id: contentId })
      : entityType && entityId
        ? getProcessedHistory({ entity_type: entityType, entity_id: entityId })
        : Promise.resolve([])
    fetcher
      .then((result) => {
        if (cancelled) return
        const filteredData = excludeTypes && excludeTypes.length > 0
          ? result.filter((item) => !excludeTypes.includes(item.processed_type ?? ''))
          : result
        setData(filteredData)
      })
      .catch((err) => {
        if (!cancelled && !isHandledError(err)) void message.error(t('history.msg.loadFailed'), 5)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [entityType, entityId, contentId, t, refreshVersion, excludeTypes])

  const diffCache = useMemo(() => {
    const cache = new Map<number, DiffEntry[]>()
    for (const record of data) {
      const prevObj = tryParseJson(record.previous_value)
      const updObj = tryParseJson(record.updated_value)
      cache.set(record.id, computeDiff(prevObj, updObj, record.entity_type, language))
    }
    return cache
  }, [data, language])

  const baseColumns: ColumnsType<ProcessedHistoryItem> = [
    {
      title: t('history.col.processedAt'),
      dataIndex: 'processed_at',
      key: 'processed_at',
      width: 180,
      render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: t('history.col.processedBy'),
      dataIndex: 'processed_by',
      key: 'processed_by',
      width: 160,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('history.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 140,
      render: (v?: string) => {
        if (!v) return '—'
        return <Tag color={getProcessedTypeColor(v)}>{getProcessedTypeLabel(v, tStr)}</Tag>
      },
    },
  ]

  const fullColumns: ColumnsType<ProcessedHistoryItem> = [
    ...baseColumns,
    {
      title: t('history.col.previousValue'),
      dataIndex: 'previous_value',
      key: 'previous_value',
      width: 280,
      render: (_: unknown, record: ProcessedHistoryItem) => {
        if (ADD_TYPES.has(record.processed_type ?? '')) return '—'
        const diffs = diffCache.get(record.id) ?? []
        return renderDiffColumn(diffs, 'prev', record.entity_type, language, platformMap, tStr)
      },
    },
    {
      title: t('history.col.updatedValue'),
      dataIndex: 'updated_value',
      key: 'updated_value',
      width: 280,
      render: (_: unknown, record: ProcessedHistoryItem) => {
        if (ADD_TYPES.has(record.processed_type ?? '')) return '—'
        const diffs = diffCache.get(record.id) ?? []
        return renderDiffColumn(diffs, 'upd', record.entity_type, language, platformMap, tStr)
      },
    },
  ]

  const simpleColumns: ColumnsType<ProcessedHistoryItem> = [
    ...baseColumns,
    {
      title: t('history.col.details'),
      dataIndex: 'details',
      key: 'details',
      ellipsis: { showTitle: false },
      render: (v?: string) =>
        v ? (
          <Tooltip title={v}>
            <span>{v}</span>
          </Tooltip>
        ) : (
          '—'
        ),
    },
  ]

  function formatFieldValue(key: string, val: unknown): string {
    if (val === undefined || val === null) return '—'
    if (typeof val === 'boolean') return val ? t('common.yes') : t('common.no')
    if (key === 'series_type') {
      const map: Record<string, string> = { '0': language === 'en' ? 'No' : '否', '1': language === 'en' ? 'Series' : '连续剧', '2': language === 'en' ? 'Season Series' : '季连续剧' }
      return map[String(val)] || String(val)
    }
    if (key === 'movie_type') {
      const map: Record<string, string> = { '1': language === 'en' ? 'Movie' : '正片', '2': language === 'en' ? 'Trailer' : '预告片', '3': language === 'en' ? 'Subtitle' : '字幕' }
      return map[String(val)] || String(val)
    }
    if (typeof val === 'number') {
      const boolKeys = ['ppv_enable', 'npvr_enable', 'fingerprint_enable', 'watermark_enable', 'tvod_enable', 'tstv_enable', 'cutv_enable', 'encryption', 'status_flag']
      if (boolKeys.includes(key)) return val ? t('common.yes') : t('common.no')
      return String(val)
    }
    if (Array.isArray(val)) return val.join(', ')
    if (key === 'task_type') {
      const map: Record<string, string> = { publish: language === 'en' ? 'Publish' : '发布', unpublish: language === 'en' ? 'Unpublish' : '下架' }
      return map[String(val)] || String(val)
    }
    if (key === 'execution_mode') {
      const map: Record<string, string> = { now: language === 'en' ? 'Immediate' : '立即', plan: language === 'en' ? 'Scheduled' : '计划' }
      return map[String(val)] || String(val)
    }
    if (key === 'scheduled_time' && typeof val === 'string') {
      return val.replace('T', ' ').substring(0, 16)
    }
    return String(val)
  }

  function buildFieldLines(
    record: ProcessedHistoryItem,
    obj: Record<string, unknown> | null,
  ): { label: string; value: string }[] {
    if (!obj) return []
    const labels = (record.entity_type && FIELD_LABEL_MAP[record.entity_type]) ?? {}
    const enrichedPairs = (record.entity_type && ENRICHED_FIELD_PAIRS[record.entity_type]) ?? {}
    const rawFieldsToHide = new Set<string>()
    for (const [rawField, enrichedField] of Object.entries(enrichedPairs)) {
      if (obj[enrichedField] !== undefined) {
        rawFieldsToHide.add(rawField)
      }
    }
    const skipKeys = new Set(['id', 'entity_id', 'entity_type', 'entity_name', 'content_type', 'created_by', 'updated_by', 'is_deleted', 'correlate_id', 'ingest_xml_path', 'result_xml_path', 'error_message', 'custom_tag_ids', 'tag_ids', 'genre_ids'])
    const lines: { label: string; value: string }[] = []
    for (const [key, val] of Object.entries(obj)) {
      if (rawFieldsToHide.has(key)) continue
      if (skipKeys.has(key)) continue
      const label = (labels as Record<string, Record<string, string>>)[key]?.[language === 'en' ? 'en' : 'cn'] ?? key
      lines.push({ label, value: formatFieldValue(key, val) })
    }
    return lines
  }

  const LOG_CONTENT_MAP: Record<string, Record<string, string>> = {
    'log.channel.edit': { cn: '频道编辑', en: 'Channel Edit' },
    'log.physicalChannel.create': { cn: '物理频道新增', en: 'Physical Channel Created' },
    'log.physicalChannel.delete': { cn: '物理频道删除', en: 'Physical Channel Deleted' },
    'log.package.link': { cn: '关联服务包', en: 'Link Package' },
    'log.package.unlink': { cn: '取消关联服务包', en: 'Unlink Package' },
    'log.category.link': { cn: '关联栏目', en: 'Link Category' },
    'log.category.unlink': { cn: '取消关联栏目', en: 'Unlink Category' },
    'log.license.link': { cn: '关联许可证', en: 'Link License' },
    'log.license.unlink': { cn: '取消关联许可证', en: 'Unlink License' },
    'log.cast.link': { cn: '关联演职人员', en: 'Link Cast' },
    'log.cast.unlink': { cn: '取消关联演职人员', en: 'Unlink Cast' },
    'log.review.initiate': { cn: '发起审核', en: 'Review Initiated' },
    'log.review.approve': { cn: '审核通过', en: 'Review Approved' },
    'log.review.reject': { cn: '审核拒绝', en: 'Review Rejected' },
    'log.poster.upload': { cn: '上传海报', en: 'Upload Poster' },
    'log.poster.delete': { cn: '删除海报', en: 'Delete Poster' },
    'log.field.edit': { cn: '自定义字段编辑', en: 'Custom Fields Edit' },
    'log.i18n.edit': { cn: '多语言编辑', en: 'Multi-language Edit' },
    'log.metadata.create': { cn: '元数据新增', en: 'Metadata Created' },
    'log.metadata.edit': { cn: '元数据编辑', en: 'Metadata Updated' },
    'log.metadata.delete': { cn: '元数据删除', en: 'Metadata Deleted' },
    'log.movie.create': { cn: '媒资新增', en: 'Movie Created' },
    'log.movie.edit': { cn: '媒资编辑', en: 'Movie Updated' },
    'log.movie.delete': { cn: '媒资删除', en: 'Movie Deleted' },
    'log.movie.type.1': { cn: '正片', en: 'Movie' },
    'log.movie.type.2': { cn: '预告片', en: 'Trailer' },
    'log.movie.type.3': { cn: '字幕', en: 'Subtitle' },
    'log.episode.inject': { cn: '新增单集注入', en: 'Episode Injected' },
    'log.episode.remove': { cn: '删除单集注入', en: 'Episode Removed' },
    'log.publish.now': { cn: '立即发布', en: 'Publish Now' },
    'log.unpublish.now': { cn: '立即下架', en: 'Unpublish Now' },
    'log.publish.plan.create': { cn: '设置发布计划', en: 'Create Publish Plan' },
    'log.publish.plan.update': { cn: '修改发布计划', en: 'Update Publish Plan' },
    'log.publish.plan.cancel': { cn: '取消发布计划', en: 'Cancel Publish Plan' },
  }

  function translateLogContent(key: string): string {
    const lang = language === 'en' ? 'en' : 'cn'
    if (key.startsWith('log.i18n.edit:')) {
      const langCode = key.substring('log.i18n.edit:'.length)
      return lang === 'en' ? `Multi-language Edit (${langCode})` : `多语言编辑（${langCode}）`
    }
    if (key.startsWith('log.review.reject:')) {
      const reason = key.substring('log.review.reject:'.length)
      const base = LOG_CONTENT_MAP['log.review.reject']?.[lang] ?? '审核拒绝'
      return `${base}：${reason}`
    }
    if (key.startsWith('log.episode.inject:')) {
      const title = key.substring('log.episode.inject:'.length)
      const base = LOG_CONTENT_MAP['log.episode.inject']?.[lang] ?? '新增单集注入'
      return `${base}：${title}`
    }
    if (key.startsWith('log.episode.remove:')) {
      const title = key.substring('log.episode.remove:'.length)
      const base = LOG_CONTENT_MAP['log.episode.remove']?.[lang] ?? '删除单集注入'
      return `${base}：${title}`
    }
    if (key.startsWith('log.movie.create:') || key.startsWith('log.movie.edit:') || key.startsWith('log.movie.delete:')) {
      const colonIdx = key.indexOf(':')
      const movieType = key.substring(colonIdx + 1)
      const baseKey = key.substring(0, colonIdx)
      const base = LOG_CONTENT_MAP[baseKey]?.[lang] ?? baseKey
      const typeLabel = LOG_CONTENT_MAP[`log.movie.type.${movieType}`]?.[lang] ?? movieType
      return `${base}-${typeLabel}`
    }
    return LOG_CONTENT_MAP[key]?.[lang] ?? key
  }

  function renderDetailContent(record: ProcessedHistoryItem): React.ReactNode {
    const type = record.processed_type ?? ''
    const updObj = tryParseJson(record.updated_value)
    const prevObj = tryParseJson(record.previous_value)
    const opDesc = translateLogContent(record.details || '')

    let lines: { label: string; value: string }[] = []

    if (type === 'POSTER_UPLOAD') {
      const name = (updObj?.poster_name as string) || (updObj?.file_name as string) || ''
      return name ? (language === 'en' ? `Poster: ${name}` : `海报：${name}`) : '—'
    }
    if (type === 'POSTER_DELETE') {
      const name = (prevObj?.poster_name as string) || (prevObj?.file_name as string) || ''
      return name ? (language === 'en' ? `Poster: ${name}` : `海报：${name}`) : '—'
    }
    if (type === 'EPISODE_INJECT' || type === 'EPISODE_REMOVE') {
      return opDesc || '—'
    }
    if (type === 'CHANNEL_FIELD_UPDATE' || type === 'CHANNEL_I18N_UPDATE' || type === 'SCHEDULE_FIELD_UPDATE' || type === 'SCHEDULE_I18N_UPDATE' || type === 'VOD_FIELD_UPDATE' || type === 'VOD_I18N_UPDATE') {
      lines = buildFieldLines(record, updObj)
      if (lines.length === 0) return opDesc || '—'
      const MAX_VISIBLE = 2
      const visible = lines.slice(0, MAX_VISIBLE)
      const hidden = lines.slice(MAX_VISIBLE)
      const renderLines = (items: { label: string; value: string }[]) =>
        items.map((item, i) => (
          <div key={i} style={{ marginTop: 2 }}>
            <span style={{ fontWeight: 500 }}>{item.label}：</span>{item.value}
          </div>
        ))
      const descElement = opDesc ? <div>{opDesc}</div> : null
      if (hidden.length === 0) {
        return <div>{descElement}{renderLines(visible)}</div>
      }
      return (
        <div>
          {descElement}
          {renderLines(visible)}
          <Tooltip
            title={lines.map((item) => `${item.label}：${item.value}`).join('\n')}
            overlayStyle={{ whiteSpace: 'pre-wrap' }}
          >
            <span style={{ color: '#1677ff', cursor: 'pointer' }}>
              +{hidden.length} {language === 'en' ? 'more...' : '更多...'}
            </span>
          </Tooltip>
        </div>
      )
    } else if (type === 'LICENSE_CONTENT_ADD') {
      const licenseName = (updObj?.license_name as string) || ''
      return licenseName
        ? (language === 'en' ? `Link License: ${licenseName}` : `关联许可证：${licenseName}`)
        : (language === 'en' ? 'Link License' : '关联许可证')
    } else if (type === 'LICENSE_CONTENT_REMOVE') {
      const licenseName = (prevObj?.license_name as string) || ''
      return licenseName
        ? (language === 'en' ? `Unlink License: ${licenseName}` : `取消关联许可证：${licenseName}`)
        : (language === 'en' ? 'Unlink License' : '取消关联许可证')
    } else if (type === 'CAST_ROLE_MAP_LINK' || type === 'CAST_ROLE_MAP_UNLINK') {
      const roles = updObj?.roles as string[] | undefined
      const prefix = type === 'CAST_ROLE_MAP_LINK'
        ? (language === 'en' ? 'Link Cast:' : '关联人物：')
        : (language === 'en' ? 'Unlink Cast:' : '取消关联人物：')
      if (roles && roles.length > 0) {
        const MAX_VISIBLE = 2
        const visibleRoles = roles.slice(0, MAX_VISIBLE)
        const hiddenRoles = roles.slice(MAX_VISIBLE)
        return (
          <div>
            <div>{prefix}</div>
            {visibleRoles.map((role, i) => (
              <div key={i} style={{ marginTop: 4, paddingLeft: 8 }}>{role}</div>
            ))}
            {hiddenRoles.length > 0 && (
              <Tooltip
                title={roles.map((role) => role).join('\n')}
                overlayStyle={{ whiteSpace: 'pre-wrap' }}
              >
                <span style={{ color: '#1677ff', cursor: 'pointer', paddingLeft: 8 }}>
                  +{hiddenRoles.length} {language === 'en' ? 'more...' : '更多...'}
                </span>
              </Tooltip>
            )}
          </div>
        )
      }
      return opDesc || '—'
    } else if (ADD_TYPES.has(type)) {
      lines = buildFieldLines(record, updObj)
    } else if (DELETE_TYPES.has(type)) {
      lines = buildFieldLines(record, prevObj)
    } else if (ATTACHED_TYPES.has(type)) {
      const obj = type.includes('UNLINK') ? prevObj : updObj
      lines = buildFieldLines(record, obj)
    } else if (REVIEW_TYPES.has(type)) {
      if (type === 'CONTENT_REVIEW_INITIATE') {
        return opDesc || '—'
      }
      const levelMap: Record<string, string> = language === 'en'
        ? { L1: 'Level 1 Review', L2: 'Level 2 Review', L3: 'Level 3 Review' }
        : { L1: '一级审核', L2: '二级审核', L3: '三级审核' }
      const reviewLevel = String(updObj?.review_level ?? '')
      const reviewType = updObj?.review_type as string | undefined
      const reason = updObj?.reason as string | undefined
      const levelStr = levelMap[reviewLevel] || reviewLevel
      if (reviewType === 'approve') {
        return `${levelStr}：${language === 'en' ? 'Approved' : '通过'}`
      }
      if (reviewType === 'reject') {
        const rejectStr = language === 'en' ? 'Rejected' : '拒绝'
        return reason ? `${levelStr}：${rejectStr}-${reason}` : `${levelStr}：${rejectStr}`
      }
      return opDesc || '—'
    } else if (PUBLISHED_TYPES.has(type) || UNPUBLISHED_TYPES.has(type)) {
      return opDesc || '—'
    } else if (PLAN_TYPES.has(type)) {
      const obj = updObj || prevObj
      const scheduledTime = obj?.scheduled_time as string | undefined
      const formattedTime = scheduledTime ? scheduledTime.replace('T', ' ').substring(0, 16) : ''
      if (type === 'PUBLISH_PLAN_CANCEL') {
        return opDesc || '—'
      }
      if (formattedTime) {
        return `${opDesc}：${formattedTime}`
      }
      return opDesc || '—'
    } else if (updObj) {
      lines = buildFieldLines(record, updObj)
    } else {
      return opDesc || '—'
    }

    if (lines.length === 0) return opDesc || '—'

    const MAX_VISIBLE = 2
    const visible = lines.slice(0, MAX_VISIBLE)
    const hidden = lines.slice(MAX_VISIBLE)

    const renderLines = (items: { label: string; value: string }[]) =>
      items.map((item, i) => (
        <div key={i} style={{ marginTop: 2 }}>
          <span style={{ fontWeight: 500 }}>{item.label}：</span>{item.value}
        </div>
      ))

    const descElement = opDesc ? <div>{opDesc}</div> : null

    if (hidden.length === 0) {
      return <div>{descElement}{renderLines(visible)}</div>
    }

    return (
      <div>
        {descElement}
        {renderLines(visible)}
        <Tooltip
          title={lines.map((item) => `${item.label}：${item.value}`).join('\n')}
          overlayStyle={{ whiteSpace: 'pre-wrap' }}
        >
          <span style={{ color: '#1677ff', cursor: 'pointer' }}>
            +{hidden.length} {language === 'en' ? 'more...' : '更多...'}
          </span>
        </Tooltip>
      </div>
    )
  }

  const detailColumns: ColumnsType<ProcessedHistoryItem> = [
    {
      title: t('history.col.processedAt'),
      dataIndex: 'processed_at',
      key: 'processed_at',
      width: 160,
      render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('history.col.processedBy'),
      dataIndex: 'processed_by',
      key: 'processed_by',
      width: 120,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('history.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 120,
      render: (v?: string) => {
        if (!v) return '—'
        return <Tag color={getProcessedTypeColor(v)}>{getProcessedTypeLabel(v, tStr)}</Tag>
      },
    },
    {
      title: t('history.col.details'),
      dataIndex: 'details',
      key: 'details',
      render: (_: unknown, record: ProcessedHistoryItem) => renderDetailContent(record),
    },
  ]

  const columns = mode === 'full'
    ? fullColumns
    : mode === 'detail'
      ? detailColumns
      : simpleColumns

  return (
    <Table<ProcessedHistoryItem>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={data}
      pagination={{ pageSize: 10, showQuickJumper: true, position: ['bottomCenter'] }}
      locale={{ emptyText: t('history.empty') }}
    />
  )
}
