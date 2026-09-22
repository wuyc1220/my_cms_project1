/**
 * ProcessedHistoryTab — 统一处理历史组件
 *
 * 数据来源:getProcessedHistory(entity_type, entity_id) 或 getContentHistory(content_id)
 * 支持 mode='full'（5列:含 previous_value/updated_value）和 mode='simple'（4列:只有 details）
 *
 * 使用方式:
 *   <ProcessedHistoryTab entityType="license" entityId={id} mode="full" />
 *   <ProcessedHistoryTab contentId={id} mode="full" />
 *   <ProcessedHistoryTab entityType="content" entityId={id} mode="simple" />
 */

import { useEffect, useMemo, useState } from 'react'
import { message, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import ResizableTable from './ResizableTable'
import { getProcessedHistory, getContentHistory } from '../api/operationLogs'
import { getDictChildren, getDictTree } from '../api/dicts'
import { isHandledError } from '../api'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import type { ProcessedHistoryItem } from '../types/trade'
import type { DictNodeListItem } from '../types/dict'
import type { LanguageOption } from '../types/i18n'

// ── 快照字典显示名缓存（bug 32063/31907：movie/physical_channel 快照字典 code → 显示名）──
// 历史日志（尤其旧日志）快照无 *_name 富化字段时，definition/mediaservice 等字段显示原始 code；
// 此处按字典根 code 拉取子项做展示期兜底，与 MaterialsModal 的 getDictName 模式一致。
const DICT_FIELD_TO_DICT: Record<string, string> = {
  definition: 'Definition',
  mediaservice: 'Mediaservice',
  audio_type: 'AudioType',
  screen_format: 'ScreenFormat',
  videoencode: 'Videoencode',
  // series_metadata 旧日志快照缺 metalayout_name 富化（0093 加列时漏配映射），展示期兜底
  metalayout: 'Metalayout',
}
const dictOptionsCache = new Map<string, LanguageOption[]>()
let dictOptionsPromise: Promise<void> | null = null

function loadSnapshotDictOptions(): Promise<void> {
  if (!dictOptionsPromise) {
    dictOptionsPromise = Promise.all(
      Object.values(DICT_FIELD_TO_DICT).map(async (dictCode) => {
        try {
          const opts = await getDictChildren(dictCode)
          // 空结果不缓存：字典根存在但暂无子项/未配置时，下次挂载可重试
          if (opts.length > 0) dictOptionsCache.set(dictCode, opts)
        } catch {
          // 字典加载失败时回退显示原始 code，不打断日志列表渲染
        }
      }),
    ).then(() => undefined)
  }
  return dictOptionsPromise
}

function lookupDictName(key: string, val: string): string | null {
  const dictCode = DICT_FIELD_TO_DICT[key]
  if (!dictCode) return null
  const opts = dictOptionsCache.get(dictCode)
  if (!opts) return null
  return opts.find((o) => o.code === val)?.name ?? null
}

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
  'POSTER_UPLOAD', 'CONTRACT_ATTACHMENT_UPLOAD',
  'PROGRAM_METADATA_CREATE', 'SERIES_METADATA_CREATE', 'MOVIE_CREATE',
  'EPISODE_INJECT', 'SEASON_SERIES_INJECT',
  'CRAWL_TASK_CREATE',
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

const BATCH_TYPES = new Set([
  'USER_BATCH_DELETE', 'USER_BATCH_STATUS',
  'ROLE_BATCH_DELETE', 'ROLE_BATCH_STATUS',
])

// 密码重置类操作（特殊处理，不归入 update）
const RESET_TYPES = new Set(['USER_RESET_PWD'])

// 单条状态变更类操作（启用/禁用）
const STATUS_TYPES = new Set([
  'USER_STATUS', 'ROLE_STATUS', 'DICT_STATUS',
  'METADATA_SOURCE_STATUS', 'SENSITIVE_WORD_STATUS',
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

const ASSIGN_TYPES = new Set([
  'TASK_ASSIGN',
])

const PUBLISHED_TYPES = new Set(['PUBLISH_NOW', 'PUBLISH_BATCH', 'PUBLISH_PLAN_EXECUTE'])
const UNPUBLISHED_TYPES = new Set(['UNPUBLISH_NOW', 'UNPUBLISH_BATCH', 'UNPUBLISH_PLAN_EXECUTE'])
const PLAN_TYPES = new Set(['PUBLISH_PLAN_CREATE', 'PUBLISH_PLAN_UPDATE', 'PUBLISH_PLAN_CANCEL'])
const ARCHIVE_TYPES = new Set(['SCHEDULE_ARCHIVE'])

function getProcessedTypeLabel(key: string, t: (key: string) => string): string {
  if (ADD_TYPES.has(key)) return t('history.type.add')
  if (DELETE_TYPES.has(key)) return t('history.type.delete')
  if (RESET_TYPES.has(key)) return t('history.type.reset')
  if (STATUS_TYPES.has(key)) return t('history.type.status')
  if (BATCH_TYPES.has(key)) return t('history.type.batch')
  if (ATTACHED_TYPES.has(key)) return t('history.type.attached')
  if (REVIEW_TYPES.has(key)) return t('history.type.review')
  if (ASSIGN_TYPES.has(key)) return t('history.type.assign')
  if (PUBLISHED_TYPES.has(key)) return t('history.type.published')
  if (UNPUBLISHED_TYPES.has(key)) return t('history.type.unpublished')
  if (PLAN_TYPES.has(key)) return t('history.type.plan')
  if (ARCHIVE_TYPES.has(key)) return t('history.type.archive')
  return t('history.type.update')
}

function getProcessedTypeColor(key: string): string {
  if (ADD_TYPES.has(key)) return 'green'
  if (DELETE_TYPES.has(key)) return 'red'
  if (RESET_TYPES.has(key)) return 'orange'
  if (STATUS_TYPES.has(key)) return 'orange'
  if (BATCH_TYPES.has(key)) return 'orange'
  if (ATTACHED_TYPES.has(key)) return 'cyan'
  if (REVIEW_TYPES.has(key)) return 'purple'
  if (ASSIGN_TYPES.has(key)) return 'geekblue'
  if (PUBLISHED_TYPES.has(key)) return 'green'
  if (UNPUBLISHED_TYPES.has(key)) return 'red'
  if (PLAN_TYPES.has(key)) return 'blue'
  if (ARCHIVE_TYPES.has(key)) return 'gold'
  return 'blue'
}

const FIELD_LABEL_MAP: Record<string, Record<string, Record<string, string>>> = {
  license: {
    name: { cn: '名称', en: 'Name' },
    start_date: { cn: '开始日期', en: 'Start Date' },
    end_date: { cn: '结束日期', en: 'End Date' },
    service_type_name: { cn: '服务类型', en: 'Service Type' },
    regions: { cn: '授权地区', en: 'Regions' },
    regions_name: { cn: '授权地区', en: 'Regions' },
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
    mediaservice: { cn: '媒体服务', en: 'Media Service' },
    mediaservice_name: { cn: '媒体服务', en: 'Media Service' },
    definition: { cn: '清晰度', en: 'Definition' },
    definition_name: { cn: '清晰度', en: 'Definition' },
    videoencode: { cn: '频道编码', en: 'Video Encode' },
    videoencode_name: { cn: '频道编码', en: 'Video Encode' },
    bitrate: { cn: '频道码率', en: 'Bitrate' },
    deeplink_ch_url: { cn: '深度链接', en: 'Deeplink' },
    shifttime: { cn: '时移时间', en: 'Shift Time' },
    tvod_save_time: { cn: 'TVOD保存时间', en: 'TVOD Save Time' },
    tvod_enable: { cn: 'TVOD启用', en: 'TVOD Enable' },
    tstv_enable: { cn: 'TSTV启用', en: 'TSTV Enable' },
    cutv_enable: { cn: 'CUTV启用', en: 'CUTV Enable' },
    encryption: { cn: '加密', en: 'Encryption' },
  },
  channel_metadata: {
    name: { cn: '名称', en: 'Name' },
    channel_number: { cn: '频道号', en: 'Channel Number' },
    description: { cn: '简介', en: 'Description' },
    channel_type: { cn: '频道类型', en: 'Channel Type' },
    channel_type_name: { cn: '频道类型', en: 'Channel Type' },
    audio_type: { cn: '音频类型', en: 'Audio Type' },
    audio_type_name: { cn: '音频类型', en: 'Audio Type' },
    rating_level: { cn: '分级', en: 'Rating Level' },
    rating_level_name: { cn: '分级', en: 'Rating Level' },
    audio_lang: { cn: '音频语言', en: 'Audio Language' },
    audio_lang_names: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang: { cn: '字幕语言', en: 'Subtitle Language' },
    subtitle_lang_names: { cn: '字幕语言', en: 'Subtitle Language' },
    language: { cn: '频道语言', en: 'Language' },
    language_names: { cn: '频道语言', en: 'Language' },
    ppv_enable: { cn: 'PPV启用', en: 'PPV Enable' },
    npvr_enable: { cn: 'NPVR启用', en: 'NPVR Enable' },
    fingerprint_enable: { cn: '指纹启用', en: 'Fingerprint Enable' },
    watermark_enable: { cn: '水印启用', en: 'Watermark Enable' },
    sections_info: { cn: '章节信息', en: 'Sections Info' },
  },
  content: {
    title: { cn: '名称', en: 'Title' },
    short_name: { cn: '短名称', en: 'Short Name' },
    description: { cn: '简介', en: 'Description' },
    name: { cn: '名称', en: 'Name' },
    external_id: { cn: '外部ID', en: 'External ID' },
    parent_title: { cn: '所属父级', en: 'Parent' },
    series_ordinal: { cn: '季序号', en: 'Season Ordinal' },
    volumn_count: { cn: '集数', en: 'Episode Count' },
    package_names: { cn: '服务包', en: 'Packages' },
    package_name: { cn: '服务包', en: 'Package' },
    content_name: { cn: '内容', en: 'Content' },
    category_names: { cn: '栏目', en: 'Categories' },
    custom_tag_names: { cn: '自定义标签', en: 'Custom Tags' },
    genre_name: { cn: '题材', en: 'Genre' },
    genre_names: { cn: '题材', en: 'Genre' },
    channel_name: { cn: '所属频道', en: 'Channel' },
    channel_id: { cn: '所属频道', en: 'Channel' },
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
    custom_tag_names: { cn: '自定义标签', en: 'Custom Tags' },
    vod_type: { cn: 'VOD类型', en: 'VOD Type' },
    vod_type_names: { cn: 'VOD类型', en: 'VOD Type' },
    type_id: { cn: '类型', en: 'Type' },
    type_name: { cn: '类型', en: 'Type' },
    audio_lang: { cn: '音频语言', en: 'Audio Language' },
    audio_lang_names: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang: { cn: '字幕语言', en: 'Subtitle Language' },
    subtitle_lang_names: { cn: '字幕语言', en: 'Subtitle Language' },
    rating_level: { cn: '分级', en: 'Rating Level' },
    rating_level_name: { cn: '分级', en: 'Rating Level' },
    advice: { cn: '分级建议', en: 'Advice' },
    advice_names: { cn: '分级建议', en: 'Advice' },
    studio: { cn: '制片公司', en: 'Studio' },
    cdr_id: { cn: 'CDR ID', en: 'CDR ID' },
    status_flag: { cn: '状态', en: 'Status' },
    cutv_enable: { cn: 'CUTV启用', en: 'CUTV Enable' },
    program_id: { cn: '关联节目', en: 'Related Program' },
    tstv_enable: { cn: 'TSTV启用', en: 'TSTV Enable' },
    tstv_mode: { cn: 'TSTV模式', en: 'TSTV Mode' },
    npvr_enable: { cn: 'NPVR启用', en: 'NPVR Enable' },
    ppv_enable: { cn: 'PPV启用', en: 'PPV Enable' },
    broadcast_type: { cn: '播出类型', en: 'Broadcast Type' },
    broadcast_type_name: { cn: '播出类型', en: 'Broadcast Type' },
    pre_buffer: { cn: '前缓冲(秒)', en: 'Pre Buffer(s)' },
    post_buffer: { cn: '后缓冲(秒)', en: 'Post Buffer(s)' },
    purchase_begin_time: { cn: '购买开始时间(分钟)', en: 'Purchase Begin Time(min)' },
    purchase_end_time: { cn: '购买结束时间(分钟)', en: 'Purchase End Time(min)' },
    series_type: { cn: '连续剧类型', en: 'Series Type' },
    series_name: { cn: '连续剧名称', en: 'Series Name' },
    series_id: { cn: '连续剧ID', en: 'Series ID' },
    sequence: { cn: '集序号', en: 'Sequence' },
    series_ordinal: { cn: '季序号', en: 'Series Ordinal' },
    show_id: { cn: '剧集ID', en: 'Show ID' },
    show_name: { cn: '剧集名称', en: 'Show Name' },
    package_ids: { cn: '服务包', en: 'Packages' },
    package_names: { cn: '服务包', en: 'Packages' },
    sections_info: { cn: '章节信息', en: 'Sections Info' },
    tag_ids: { cn: '标签', en: 'Tags' },
    tag_names: { cn: '标签', en: 'Tags' },
  },
  cast_role_map: {
    role_name: { cn: '角色名称', en: 'Role Name' },
    cast_name: { cn: '演职人员', en: 'Cast' },
    character_name: { cn: '角色人物', en: 'Character' },
    sort_order: { cn: '排序', en: 'Sort Order' },
  },
  schedule: {
    title: { cn: '名称', en: 'Title' },
    short_name: { cn: '短名称', en: 'Short Name' },
    description: { cn: '简介', en: 'Description' },
    channel_name: { cn: '所属频道', en: 'Channel' },
    channel_id: { cn: '所属频道', en: 'Channel' },
    begin_time: { cn: '开始时间', en: 'Begin Time' },
    end_time: { cn: '结束时间', en: 'End Time' },
    cutv_enable: { cn: 'CUTV启用', en: 'CUTV Enable' },
    is_archived: { cn: '已归档', en: 'Archived' },
    archive_scheduled_time: { cn: '归档计划时间', en: 'Archive Scheduled Time' },
    genre_names: { cn: '题材', en: 'Genre' },
    custom_tag_names: { cn: '自定义标签', en: 'Custom Tags' },
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
    vod_type: { cn: 'VOD类型', en: 'VOD Type' },
    vod_type_names: { cn: 'VOD类型', en: 'VOD Type' },
    type_id: { cn: '类型', en: 'Type' },
    language: { cn: '语言', en: 'Language' },
    rating_level: { cn: '分级', en: 'Rating Level' },
    advice: { cn: '分级建议', en: 'Advice' },
    audio_lang: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang: { cn: '字幕语言', en: 'Subtitle Language' },
    keywords: { cn: '关键词', en: 'Keywords' },
    metalayout: { cn: 'Metalayout', en: 'Metalayout' },
    sections_info: { cn: '章节信息', en: 'Sections Info' },
    metalayout_name: { cn: 'Metalayout', en: 'Metalayout' },
    content_name: { cn: '内容', en: 'Content' },
    tag_ids: { cn: '标签', en: 'Tags' },
    tag_names: { cn: '标签', en: 'Tags' },
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
    vod_type: { cn: 'VOD类型', en: 'VOD Type' },
    vod_type_names: { cn: 'VOD类型', en: 'VOD Type' },
    type_id: { cn: '类型', en: 'Type' },
    language: { cn: '语言', en: 'Language' },
    rating_level: { cn: '分级', en: 'Rating Level' },
    advice: { cn: '分级建议', en: 'Advice' },
    audio_lang: { cn: '音频语言', en: 'Audio Language' },
    subtitle_lang: { cn: '字幕语言', en: 'Subtitle Language' },
    keywords: { cn: '关键词', en: 'Keywords' },
    metalayout: { cn: 'Metalayout', en: 'Metalayout' },
    metalayout_name: { cn: 'Metalayout', en: 'Metalayout' },
    volume_count: { cn: '集/季数量', en: 'Volume Count' },
    series_type: { cn: '连续剧类型', en: 'Series Type' },
    series_ordinal: { cn: '季序号', en: 'Series Ordinal' },
    show_id: { cn: '剧集ID', en: 'Show ID' },
    content_name: { cn: '内容', en: 'Content' },
    sections_info: { cn: '章节信息', en: 'Sections Info' },
    tag_ids: { cn: '标签', en: 'Tags' },
    tag_names: { cn: '标签', en: 'Tags' },
  },
  movie: {
    file_name: { cn: '文件名', en: 'File Name' },
    file_path: { cn: '文件路径', en: 'File Path' },
    file_size: { cn: '文件大小', en: 'File Size' },
    movie_type: { cn: '媒资类型', en: 'Movie Type' },
    audio_type: { cn: '音频类型', en: 'Audio Type' },
    audio_type_name: { cn: '音频类型', en: 'Audio Type' },
    screen_format: { cn: '画面格式', en: 'Screen Format' },
    screen_format_name: { cn: '画面格式', en: 'Screen Format' },
    closed_captioning: { cn: '隐藏字幕', en: 'Closed Captioning' },
    duration: { cn: '时长(分钟)', en: 'Duration(min)' },
    definition: { cn: '清晰度', en: 'Definition' },
    definition_name: { cn: '清晰度', en: 'Definition' },
    encryption: { cn: '加密', en: 'Encryption' },
    publish_flag: { cn: '发布标识', en: 'Publish Flag' },
    deeplink: { cn: '深度链接', en: 'Deeplink' },
    mediaservice: { cn: '媒体服务', en: 'Media Service' },
    mediaservice_name: { cn: '媒体服务', en: 'Media Service' },
    sequence: { cn: '序号', en: 'Sequence' },
    content_name: { cn: '内容', en: 'Content' },
  },
  user: {
    username: { cn: '账号', en: 'Account' },
    display_name: { cn: '显示名称', en: 'Display Name' },
    email: { cn: '邮箱', en: 'Email' },
    phone_number: { cn: '手机号', en: 'Phone Number' },
    status: { cn: '状态', en: 'Status' },
    role_ids: { cn: '角色', en: 'Roles' },
    role_names: { cn: '角色', en: 'Roles' },
  },
  role: {
    name: { cn: '名称', en: 'Name' },
    code: { cn: '编码', en: 'Code' },
    description: { cn: '描述', en: 'Description' },
    status: { cn: '状态', en: 'Status' },
  },
  task: {
    content_name: { cn: '内容名称', en: 'Content Name' },
    task_type: { cn: '任务类型', en: 'Task Type' },
    task_status: { cn: '任务状态', en: 'Task Status' },
    assignee_name: { cn: '分配人', en: 'Assignee' },
    start_time: { cn: '开始时间', en: 'Start Time' },
    end_time: { cn: '结束时间', en: 'End Time' },
  },
  content_auth: {
    role_ids: { cn: '角色', en: 'Roles' },
    user_ids: { cn: '用户', en: 'Users' },
    role_names: { cn: '角色', en: 'Roles' },
    user_names: { cn: '用户', en: 'Users' },
  },
}

const ENRICHED_FIELD_PAIRS: Record<string, Record<string, string>> = {
  user: {
    role_ids: 'role_names',
  },
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
    regions: 'regions_name',
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
    tag_ids: 'tag_names',
  },
  // 节目单快照（ScheduleListItem）：channel_id 为裸数字父级外键，富化后的 channel_name 已可读
  schedule: {
    channel_id: 'channel_name',
  },
  cast_role_map: {
    cast_id: 'cast_name',
  },
  content: {
    custom_tag_ids: 'custom_tag_names',
    // 创建日志快照来自 ContentListItem DTO（含 genre_name 单数字符串），API 层又注入 genre_names 列表，
    // 两者同时存在会重复展示"Genre/Genres"（bug 32653）；genre_names 存在时隐藏 genre_name，
    // 仅有 genre_name 的老日志不受影响，仍正常显示
    genre_name: 'genre_names',
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
    tag_ids: 'tag_names',
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
    metalayout: 'metalayout_name',
    tag_ids: 'tag_names',
  },
  movie: {
    content_id: 'content_name',
    audio_type: 'audio_type_name',
    screen_format: 'screen_format_name',
    definition: 'definition_name',
    mediaservice: 'mediaservice_name',
  },
  task: {
    assignee_id: 'assignee_name',
  },
  content_auth: {
    role_ids: 'role_names',
    user_ids: 'user_names',
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

function formatRegionsValue(val: unknown, regionsMap: Record<string, string>): string {
  const codes = Array.isArray(val) ? val : String(val).split(',')
  return codes
    .map((c) => String(c).trim())
    .filter(Boolean)
    .map((c) => regionsMap[c] ?? c)
    .join(', ')
}

function tryParseJson(str: string | null | undefined): Record<string, unknown> | null {
  if (!str) return null
  try {
    return JSON.parse(str) as Record<string, unknown>
  } catch {
    return null
  }
}

// 批量状态变更（用户/角色）：提取变更前/后状态摘要
// 新日志: {"status": "active"} 或 {"status": ["active", "inactive"]}
// 旧日志: previous_value 为完整数据数组，取各元素 status 去重
function extractBatchStatuses(record: ProcessedHistoryItem, field: 'previous_value' | 'updated_value'): string[] | null {
  const obj = tryParseJson(record[field])
  if (!obj) return null
  if (Array.isArray(obj)) {
    const statuses = [...new Set(obj.map((item) => String((item as Record<string, unknown>)?.status ?? '')).filter(Boolean))]
    return statuses.length ? statuses : null
  }
  const s = obj.status
  if (typeof s === 'string') return s ? [s] : null
  if (Array.isArray(s)) {
    const statuses = s.map(String).filter(Boolean)
    return statuses.length ? statuses : null
  }
  return null
}

// 批量状态变更（用户/角色）：按"状态:启用/禁用"展示变更前后真实状态
function renderBatchStatusDiff(
  record: ProcessedHistoryItem,
  side: 'prev' | 'upd',
  language: string,
  tStr: (key: string) => string,
): React.ReactNode {
  const statuses = extractBatchStatuses(record, side === 'prev' ? 'previous_value' : 'updated_value')
  if (!statuses) return '—'
  const labelMap = (FIELD_LABEL_MAP[record.entity_type ?? 'user'] ?? FIELD_LABEL_MAP.user).status
  const label = labelMap?.[language === 'en' ? 'en' : 'cn'] ?? (language === 'en' ? 'Status' : '状态')
  const sep = language === 'en' ? ', ' : '、'
  const valueStr = statuses
    .map((s) => (s === 'active' ? tStr('common.enabled') : s === 'inactive' ? tStr('common.disabled') : s))
    .join(sep)
  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      <span style={{ fontWeight: 500 }}>{label}</span>:{valueStr}
    </div>
  )
}

function jsonStableStringify(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val !== 'object') return String(val)
  try {
    // 递归排序对象键，保留数组顺序
    // 旧实现使用 Object.keys(val).sort() 作为 replacer 数组，
    // 但对数组而言 Object.keys 返回索引 ['0','1',...]，
    // 导致数组元素的属性被全部剥离（输出 [{}]），diff 检测失效。
    return JSON.stringify(val, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (value as Record<string, unknown>)[k]
          return acc
        }, {})
      }
      return value
    })
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

// 列表型 Tooltip（内容逐行展示、随数据量无限增高）的统一内容区样式：
// 最大高度 400px，超出滚动，避免菜单等大量条目撑爆浮层
const LIST_TOOLTIP_INNER_STYLE: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 400,
  overflowY: 'auto',
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
        return `${platformName}, ${rightsLabel}:${info.prevRights ? yesStr : noStr}`
      case 'add':
        return lang === 'en' ? 'None' : '无'
    }
  } else {
    switch (info.type) {
      case 'remove':
        return `${lang === 'en' ? 'Remove platform' : '删除平台'} ${platformName}`
      case 'add':
        return `${lang === 'en' ? 'Add platform' : '增加平台'}:${platformName}, ${rightsLabel}:${info.newRights ? yesStr : noStr}`
      case 'rights_change':
        return `${platformName}, ${rightsLabel}:${info.newRights ? yesStr : noStr}`
    }
  }
  return ''
}

function isEmptyValue(val: unknown): boolean {
  if (val === null || val === undefined) return true
  if (typeof val === 'string' && val.trim() === '') return true
  if (Array.isArray(val) && val.length === 0) return true
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return true
  return false
}

// 实体级展示剔除表：computeDiff（full/simple 列表 diff 列）与 buildFieldLines（详情字段行）共用，
// 保证同一字段的剔除口径在所有渲染路径一致
const ENTITY_SPECIFIC_SKIP_KEYS: Record<string, string[]> = {
  user: ['status_label_key'],
  // 频道元数据的 status_flag 是布尔开关，展示为"状态:是/否"易与生命周期状态混淆，且为内部技术字段
  channel_metadata: ['status_flag'],
  // 物理频道的 status 同为布尔开关（启用/禁用），与生命周期状态混淆，不具审计价值（与 channel_metadata 同理）
  physical_channel: ['status'],
  // 节目单快照（Content 行）的 parent_id 指向所属频道（内容树层级），裸数字无业务可读性（bug 32418）；
  // status 为 Ingest 枚举（None/WaitingForMaterials/Published），对操作审计无价值
  schedule: ['parent_id', 'status'],
  // content 快照（MOVIE/EPISODE/SERIES/SEASON/CHANNEL/SCHEDULE 七类内容共用）的 status 为 Ingest 枚举，
  // 多由工作流自动流转（审核/发布/编辑后回退），对操作审计无价值（与 schedule 同理）；
  // previous_status 为同族废弃列一并剔除；parent_id 为裸数字父级外键，无业务可读性（与 schedule 同理）。
  // 发布/下架日志 entity_type 为大写 "Content"，不命中此处，publish_task 的任务状态正常展示
  content: ['status', 'previous_status', 'parent_id'],
}

// 仅详情行剔除表：仅 buildFieldLines（新增/删除/详情字段行）消费，computeDiff（编辑 diff 列）不使用。
// 适用于"全量快照中无审计价值的系统默认值/派生统计"，但这些字段的"变更"仍有审计价值
// （如编辑节目单切换 cutv_enable 时 diff 需正常显示），故不能放入共用的 ENTITY_SPECIFIC_SKIP_KEYS。
// content 条目针对 ContentListItem 列表 DTO 快照（POST /contents/ 创建日志）的派生噪音字段；
// external_id 为外部系统映射 ID，裸数字无可读性，对操作审计无价值（编辑 diff 中仍保留）
const DETAIL_ONLY_SKIP_KEYS: Record<string, string[]> = {
  content: ['cutv_enable', 'is_archived', 'external_id', 'license_count', 'license_start', 'license_end', 'task_start_time', 'task_end_time', 'assignee_name'],
  // 节目单快照的发布/归档状态布尔（仅 ScheduleListItem 携带，diff 快照中不存在）
  schedule: ['archive_published', 'is_published'],
}

// 条件联动剔除表：仅 buildFieldLines（详情字段行）消费，computeDiff（编辑 diff 列）不使用。
// PPV 开关关闭时弹窗不渲染这些依赖输入（ScheduleMetadataModal ppvEnable 条件渲染），
// 快照记录的是后端 schema/ORM 默认值（pre_buffer=0、purchase_begin_time=180 等），
// 弹窗中不可见且无审计价值；但 PPV 关→开切换时这些字段的"变更"仍需在 diff 中显示（bug 32430）
const CONDITIONAL_SKIP_KEYS: Record<string, { dep: string; keys: string[] }> = {
  schedule_metadata: {
    dep: 'ppv_enable',
    keys: ['package_ids', 'pre_buffer', 'post_buffer', 'purchase_begin_time', 'purchase_end_time'],
  },
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
    // movie 的文件路径为加密存储 URL，无展示价值，日志仅展示文件名
    if (entityType === 'movie' && key === 'file_path') continue
    // 实体级剔除（与 buildFieldLines 同一口径）：status/parent_id 等无审计价值字段
    if (entityType && ENTITY_SPECIFIC_SKIP_KEYS[entityType]?.includes(key)) continue
    const pv = prevObj?.[key]
    const uv = updObj?.[key]
    if (jsonStableStringify(pv) === jsonStableStringify(uv)) continue
    // 过滤无业务意义的空值变更，如 null ↔ [] ↔ {}
    if (isEmptyValue(pv) && isEmptyValue(uv)) continue

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

  // PPV 关→开特判（bug 32430）：依赖字段（Pre/Post Buffer、Purchase Begin/End、Packages）随开关激活生效。
  // 这些字段在 PPV 关闭时已按 schema 默认值（0/180/-1）入库，关→开即使未填值数据库也无变化，
  // 常规 diff 会因无差异而遗漏；此处强制纳入展示当前生效值。开→关（失效）不展示。
  const conditional = entityType ? CONDITIONAL_SKIP_KEYS[entityType] : undefined
  if (conditional && prevObj && updObj && !prevObj[conditional.dep] && updObj[conditional.dep]) {
    const existing = new Set(diffs.map((d) => d.key))
    for (const key of conditional.keys) {
      if (existing.has(key) || rawFieldsToHide.has(key)) continue
      const pv = prevObj[key]
      const uv = updObj[key]
      if (isEmptyValue(pv) && isEmptyValue(uv)) continue
      const label = labelMap[key]?.[lang === 'en' ? 'en' : 'cn'] ?? key
      diffs.push({ key, label, prevVal: pv, updVal: uv })
    }
  }
  return diffs
}

// 通用时间值格式化：基于值格式判断（不依赖字段名），统一处理 date / time / datetime 三类
// - Date "2026-08-01"          → "YYYY-MM-DD"
// - Time "02:00:00"             → "HH:mm"（去秒，与日期选择器一致）
// - DateTime "2024-01-01 08:00:00" 或 "2024-01-01T08:00:00+00:00" → "YYYY-MM-DD HH:mm:ss"
// 非 时间格式字符串返回 null，由调用方走默认 String(val) 分支
function formatTimeValue(val: unknown): string | null {
  if (typeof val !== 'string' || !val) return null
  // 纯日期
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const d = dayjs(val)
    if (d.isValid()) return d.format('YYYY-MM-DD')
    return null
  }
  // 纯时间 HH:mm:ss → 去秒
  if (/^\d{2}:\d{2}:\d{2}$/.test(val)) {
    return val.substring(0, 5)
  }
  // datetime（含 T 或空格分隔，可能带时区偏移）
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/.test(val)) {
    // 历史日志中 str(datetime) 为空格分隔（"2026-08-29 16:00:00+00:00"），
    // dayjs 对该格式会忽略时区偏移按本地解析导致差 8 小时（bug 32047），
    // 统一规范为 T 分隔的标准 ISO 后解析，保证按偏移转本地时区
    const normalized = val.includes('T') ? val : val.replace(' ', 'T')
    const d = dayjs(normalized)
    if (d.isValid()) return d.format('YYYY-MM-DD HH:mm:ss')
    return null
  }
  return null
}

// 历史日志统一格式化上下文（full / detail 两条渲染路径共用）
interface HistoryFormatContext {
  entityType: string | null | undefined
  lang: string
  platformMap: Record<string, string>
  regionsMap: Record<string, string>
  t: (key: string) => string
}

// 数值型布尔字段（0/1 → 是/否）
const NUM_BOOL_KEYS = new Set([
  'ppv_enable',
  'npvr_enable',
  'fingerprint_enable',
  'watermark_enable',
  'tvod_enable',
  'tstv_enable',
  'cutv_enable',
  'encryption',
  'status_flag',
])

// 枚举字段语义映射（与元数据编辑弹窗选项文案保持一致）
function enumValueMap(key: string, lang: string): Record<string, string> | undefined {
  switch (key) {
    case 'series_type':
      return {
        '0': lang === 'en' ? 'No' : '否',
        '1': lang === 'en' ? 'Series' : '连续剧',
        '2': lang === 'en' ? 'Season Series' : '季连续剧',
      }
    case 'movie_type':
      return {
        '1': lang === 'en' ? 'Movie' : '正片',
        '2': lang === 'en' ? 'Trailer' : '预告片',
        '3': lang === 'en' ? 'Subtitle' : '字幕',
      }
    case 'task_type':
      return { publish: lang === 'en' ? 'Publish' : '发布', unpublish: lang === 'en' ? 'Unpublish' : '下架' }
    case 'execution_mode':
      return { now: lang === 'en' ? 'Immediate' : '立即', plan: lang === 'en' ? 'Scheduled' : '计划' }
    default:
      return undefined
  }
}

// file_size 字节 → 可读大小（B/KB/MB/GB），非有限数字/负数返回 null 走通用兜底（bug 32063）
// 精度与页面 Materials/详情页 formatFileSize 一致：KB/MB 保留 1 位小数（bug 32428）
function formatFileSizeValue(val: unknown): string | null {
  const n = typeof val === 'number' ? val : typeof val === 'string' && val.trim() !== '' ? Number(val) : NaN
  if (!Number.isFinite(n) || n < 0) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// sections_info 章节条目 → 单行可读文本
function formatSectionsInfoItem(item: Record<string, unknown>): string {
  const typeMap: Record<string, string> = { '1': '1:intro', '2': '2:ad', '3': '3:chapter' }
  const actionMap: Record<string, string> = { '0': '0:no skip', '1': '1:skip' }
  const type = typeMap[String(item.type)] ?? String(item.type ?? '—')
  const action = actionMap[String(item.action)] ?? String(item.action ?? '—')
  const tag = item.tag !== undefined && item.tag !== null && String(item.tag) !== '' ? String(item.tag) : '—'
  return `${type}, ${action}, ${tag}, ${item.start ?? '—'}-${item.end ?? '—'}s`
}

// 历史日志值统一格式化核心：字段语义注册 → 类型驱动兜底，任何对象数组自动正确展示
function formatHistoryValue(key: string, val: unknown, ctx: HistoryFormatContext): string {
  const { entityType, lang, platformMap, regionsMap, t } = ctx
  if (val === undefined || val === null) return '—'
  if (key.endsWith('_label_key') && typeof val === 'string') {
    const translated = t(val)
    return translated !== val ? translated : val
  }
  if (typeof val === 'boolean') return val ? t('common.yes') : t('common.no')
  // 文件名：历史数据可能存了完整存储路径（materials/202609/xxx.xlsx），仅展示纯文件名
  if (key === 'file_name' && typeof val === 'string' && val.includes('/')) {
    return val.split('/').pop() ?? val
  }
  if (key === 'platforms') {
    return formatPlatformValue(val, entityType, lang, platformMap, t)
  }
  // 地区字段：旧日志未富化名称时，展示期按字典兜底将编码转名称
  if (key === 'regions' || key === 'regions_name') {
    return formatRegionsValue(val, regionsMap)
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const eMap = enumValueMap(key, lang)
    if (eMap) return eMap[String(val)] ?? String(val)
  }
  // 字典 code → 显示名（movie/physical_channel 快照的 definition/mediaservice 等，bug 32063/31907）
  if (typeof val === 'string') {
    const dictName = lookupDictName(key, val)
    if (dictName) return dictName
  }
  // 文件大小：字节 → B/KB/MB/GB 可读格式（bug 32063）
  if (key === 'file_size' && (typeof val === 'number' || typeof val === 'string')) {
    const sizeStr = formatFileSizeValue(val)
    if (sizeStr) return sizeStr
  }
  // keywords 双下拉（[独占类型, HDR]）：code → 弹窗选项文本，避免 "0, 1" 原始码展示
  if (key === 'keywords' && Array.isArray(val)) {
    const exclusiveMap: Record<string, string> = { '0': 'Non-platform exclusive', '1': 'Only Tivibu' }
    const hdrMap: Record<string, string> = { '0': 'Non-HDR content', '1': 'HDR content' }
    const parts: string[] = []
    if (val[0] !== undefined && val[0] !== null && val[0] !== '') {
      parts.push(`${t('content.metadata.keywords.exclusive')}:${exclusiveMap[String(val[0])] ?? String(val[0])}`)
    }
    if (val[1] !== undefined && val[1] !== null && val[1] !== '') {
      parts.push(`${t('content.metadata.keywords.hdr')}:${hdrMap[String(val[1])] ?? String(val[1])}`)
    }
    return parts.join(', ') || '—'
  }
  if (typeof val === 'number') {
    if (NUM_BOOL_KEYS.has(key)) return val ? t('common.yes') : t('common.no')
    return String(val)
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '—'
    const hasObject = val.some((item) => typeof item === 'object' && item !== null)
    // 对象数组（如 sections_info / platforms 兜底）：逐项展示，避免 [object Object]
    if (hasObject) {
      if (key === 'sections_info') {
        return val.map((item) => formatSectionsInfoItem(item as Record<string, unknown>)).join('\n')
      }
      return val
        .map((item) => {
          // 优先提取可读字段（如海报发布的 pictures 展示文件名），避免整段 JSON
          if (item !== null && typeof item === 'object') {
            const obj = item as Record<string, unknown>
            const readable = obj.file_name ?? obj.name ?? obj.title ?? obj.poster_name
            if (readable !== undefined && readable !== null) return String(readable)
          }
          try {
            return JSON.stringify(item)
          } catch {
            return String(item)
          }
        })
        .join('\n')
    }
    return val.join(', ')
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }
  if (key === 'scheduled_time' && typeof val === 'string') {
    const d = dayjs(val)
    if (d.isValid()) return d.format('YYYY-MM-DD HH:mm')
  }
  // 时间字段统一格式化（date / time / datetime）
  const timeStr = formatTimeValue(val)
  if (timeStr) return timeStr
  return String(val)
}

function formatValue(
  key: string,
  val: unknown,
  entityType: string | null | undefined,
  lang: string,
  platformMap: Record<string, string>,
  regionsMap: Record<string, string>,
  t: (key: string) => string,
): string {
  return formatHistoryValue(key, val, { entityType, lang, platformMap, regionsMap, t })
}

function renderDiffColumn(
  diffs: DiffEntry[],
  side: 'prev' | 'upd',
  entityType: string | null | undefined,
  lang: string,
  platformMap: Record<string, string>,
  regionsMap: Record<string, string>,
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
          <span style={{ fontWeight: 500 }}>{d.label}</span>:{valStr}
        </div>
      )
    }
    const val = side === 'prev' ? d.prevVal : d.updVal
    const valStr = formatValue(d.key, val, entityType, lang, platformMap, regionsMap, t)
    return (
      <div key={d.key} style={i > 0 ? { marginTop: 4 } : undefined}>
        <span style={{ fontWeight: 500 }}>{d.label}</span>:{valStr}
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
      <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: 400 }} overlayInnerStyle={LIST_TOOLTIP_INNER_STYLE}>
        <span style={{ color: '#1677ff', cursor: 'pointer' }}>
          +{hiddenDiffs.length} {t('common.more')}
        </span>
      </Tooltip>
    </div>
  )
}

function renderDataAuthDiff(
  record: ProcessedHistoryItem,
  side: 'prev' | 'upd',
  language: string,
): React.ReactNode {
  const prevObj = tryParseJson(record.previous_value)
  const updObj = tryParseJson(record.updated_value)

  const prevRoleNames: string[] = (prevObj?.role_names as string[]) || []
  const newRoleNames: string[] = (updObj?.role_names as string[]) || []
  const prevUserNames: string[] = (prevObj?.user_names as string[]) || []
  const newUserNames: string[] = (updObj?.user_names as string[]) || []

  const prevRoleSet = new Set(prevRoleNames)
  const newRoleSet = new Set(newRoleNames)
  const prevUserSet = new Set(prevUserNames)
  const newUserSet = new Set(newUserNames)

  const addedRoles = newRoleNames.filter((n) => !prevRoleSet.has(n))
  const removedRoles = prevRoleNames.filter((n) => !newRoleSet.has(n))
  const addedUsers = newUserNames.filter((n) => !prevUserSet.has(n))
  const removedUsers = prevUserNames.filter((n) => !newUserSet.has(n))

  const elements: React.ReactNode[] = []

  if (side === 'prev') {
    if (removedRoles.length > 0) {
      elements.push(
        <div key="removedRoles" style={{ marginTop: 2 }}>
          <span style={{ fontWeight: 500 }}>{language === 'en' ? 'Role Authorization' : '角色授权'}:</span>
          <Tag color="red" style={{ marginRight: 4 }}>{language === 'en' ? 'Remove' : '取消'}</Tag>
          {removedRoles.join('、')}
        </div>
      )
    }
    if (removedUsers.length > 0) {
      elements.push(
        <div key="removedUsers" style={{ marginTop: 2 }}>
          <span style={{ fontWeight: 500 }}>{language === 'en' ? 'User Authorization' : '用户授权'}:</span>
          <Tag color="red" style={{ marginRight: 4 }}>{language === 'en' ? 'Remove' : '取消'}</Tag>
          {removedUsers.join('、')}
        </div>
      )
    }
  } else {
    if (addedRoles.length > 0) {
      elements.push(
        <div key="addedRoles" style={{ marginTop: 2 }}>
          <span style={{ fontWeight: 500 }}>{language === 'en' ? 'Role Authorization' : '角色授权'}:</span>
          <Tag color="green" style={{ marginRight: 4 }}>{language === 'en' ? 'Add' : '新增'}</Tag>
          {addedRoles.join('、')}
        </div>
      )
    }
    if (addedUsers.length > 0) {
      elements.push(
        <div key="addedUsers" style={{ marginTop: 2 }}>
          <span style={{ fontWeight: 500 }}>{language === 'en' ? 'User Authorization' : '用户授权'}:</span>
          <Tag color="green" style={{ marginRight: 4 }}>{language === 'en' ? 'Add' : '新增'}</Tag>
          {addedUsers.join('、')}
        </div>
      )
    }
  }

  if (elements.length > 0) return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{elements}</div>
  return '—'
}

function renderMenuAssignDiff(
  record: ProcessedHistoryItem,
  side: 'prev' | 'upd',
  language: string,
  t: (key: string) => string,
): React.ReactNode {
  // 与编辑类操作展示一致：Previous 列显示变更前的值，Updated 列显示变更后的值（纯文本）
  const obj = tryParseJson(side === 'prev' ? record.previous_value : record.updated_value)
  const menus: string[] = (obj?.menu_names as string[]) || []
  if (menus.length === 0) return '—'

  // 与列表型展示（如 CAST_ROLE_MAP_LINK）风格一致：每行一项，前2项可见，超出显示 "+n more..."
  const prefix = language === 'en' ? 'Menus:' : '菜单:'
  const MAX_VISIBLE = 2
  const visibleMenus = menus.slice(0, MAX_VISIBLE)
  const hiddenMenus = menus.slice(MAX_VISIBLE)

  return (
    <div>
      <div>{prefix}</div>
      {visibleMenus.map((menu, i) => (
        <div key={i} style={{ marginTop: 4, paddingLeft: 8 }}>{menu}</div>
      ))}
      {hiddenMenus.length > 0 && (
        <Tooltip title={menus.join('\n')} overlayInnerStyle={LIST_TOOLTIP_INNER_STYLE}>
          <span style={{ color: '#1677ff', cursor: 'pointer', paddingLeft: 8 }}>
            +{hiddenMenus.length} {t('common.more')}
          </span>
        </Tooltip>
      )}
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
  const [regionsMap, setRegionsMap] = useState<Record<string, string>>({})
  // 字典加载完成后 bump 触发重渲染，使快照中的字典 code 展示为显示名
  const [, setDictVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    void loadSnapshotDictOptions().then(() => {
      if (!cancelled) setDictVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
        const regionsRoot = dicts.find((d: DictNodeListItem) => d.code === 'Regions')
        const rMap: Record<string, string> = {}
        for (const child of regionsRoot?.children ?? []) {
          rMap[child.code] = child.name
        }
        setRegionsMap(rMap)
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
      const updObj = tryParseJson(record.updated_value) ?? tryParseJson(record.updated_value_json)
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
      width: 250,
      render: (_: unknown, record: ProcessedHistoryItem) => {
        const display = record.processed_by_display_name
        const username = record.processed_by
        if (display && username) return `${display}(${username})`
        return display || username || '—'
      },
    },
    {
      title: t('history.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 200,
      render: (v?: string, record?: ProcessedHistoryItem) => {
        if (!v) return '—'
        if (v === 'DATA_AUTH_AUTHORIZE') {
          const prevObj = tryParseJson(record?.previous_value)
          const updObj = tryParseJson(record?.updated_value)
          const prevRoleSet = new Set((prevObj?.role_names as string[]) || [])
          const newRoleSet = new Set((updObj?.role_names as string[]) || [])
          const prevUserSet = new Set((prevObj?.user_names as string[]) || [])
          const newUserSet = new Set((updObj?.user_names as string[]) || [])
          const hasRemoved = [...prevRoleSet].some((n) => !newRoleSet.has(n)) || [...prevUserSet].some((n) => !newUserSet.has(n))
          const hasAdded = [...newRoleSet].some((n) => !prevRoleSet.has(n)) || [...newUserSet].some((n) => !prevUserSet.has(n))
          if (hasAdded && !hasRemoved) return <Tag color="green">{tStr('history.type.add')}</Tag>
          return <Tag color="blue">{tStr('history.type.update')}</Tag>
        }
        if (v === 'DATA_AUTH_CLEAR') {
          return <Tag color="blue">{tStr('history.type.update')}</Tag>
        }
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
      width: 380,
      render: (_: unknown, record: ProcessedHistoryItem) => {
        if (record.processed_type === 'CONTRACT_ATTACHMENT_DELETE') {
          const prevObj = tryParseJson(record.previous_value)
          const name = (prevObj?.file_name as string) || ''
          return name ? (language === 'en' ? `Attachment: ${name}` : `附件:${name}`) : '—'
        }
        if (record.processed_type === 'POSTER_DELETE') {
          const prevObj = tryParseJson(record.previous_value)
          const name = (prevObj?.poster_name as string) || (prevObj?.file_name as string) || ''
          return name ? (language === 'en' ? `Poster: ${name}` : `海报:${name}`) : '—'
        }
        if (ADD_TYPES.has(record.processed_type ?? '')) return '—'
        if (record.processed_type === 'DATA_AUTH_AUTHORIZE' || record.processed_type === 'DATA_AUTH_CLEAR') {
          return renderDataAuthDiff(record, 'prev', language)
        }
        if (record.processed_type === 'MENU_ASSIGN') {
          return renderMenuAssignDiff(record, 'prev', language, tStr)
        }
        if (RESET_TYPES.has(record.processed_type ?? '')) {
          return '-'
        }
        if (BATCH_TYPES.has(record.processed_type ?? '')) {
          const type = record.processed_type ?? ''
          if (type === 'USER_BATCH_DELETE') return language === 'en' ? 'Delete Account' : '删除账号'
          // 单条状态变更（USER_STATUS 等）与批量状态变更写入相同的 {"status": "..."} 差值，统一走状态渲染以翻译 active/inactive
          if (type === 'USER_BATCH_STATUS' || type === 'USER_STATUS' || type === 'DICT_STATUS') {
            return renderBatchStatusDiff(record, 'prev', language, tStr)
          }
          if (type === 'ROLE_BATCH_DELETE') return language === 'en' ? 'Delete Role' : '删除角色'
          if (type === 'ROLE_BATCH_STATUS' || type === 'ROLE_STATUS') return renderBatchStatusDiff(record, 'prev', language, tStr)
        }
        const diffs = diffCache.get(record.id) ?? []
        return renderDiffColumn(diffs, 'prev', record.entity_type, language, platformMap, regionsMap, tStr)
      },
    },
    {
      title: t('history.col.updatedValue'),
      dataIndex: 'updated_value',
      key: 'updated_value',
      width: 380,
      render: (_: unknown, record: ProcessedHistoryItem) => {
        if (record.processed_type === 'CONTRACT_ATTACHMENT_UPLOAD') {
          const updObj = tryParseJson(record.updated_value)
          const name = (updObj?.file_name as string) || ''
          return name ? (language === 'en' ? `Attachment: ${name}` : `附件:${name}`) : '—'
        }
        if (record.processed_type === 'POSTER_UPLOAD') {
          const updObj = tryParseJson(record.updated_value)
          const name = (updObj?.poster_name as string) || (updObj?.file_name as string) || ''
          return name ? (language === 'en' ? `Poster: ${name}` : `海报:${name}`) : '—'
        }
        if (ADD_TYPES.has(record.processed_type ?? '')) {
          const updObj = tryParseJson(record.updated_value) ?? tryParseJson(record.updated_value_json)
          const lines = buildFieldLines(record, updObj)
          if (lines.length === 0) return '—'
          const MAX_VISIBLE = 2
          const visible = lines.slice(0, MAX_VISIBLE)
          const hidden = lines.slice(MAX_VISIBLE)
          const renderLines = (items: { label: string; value: string }[]) =>
            items.map((item, i) => (
              <div key={i} style={{ marginTop: i > 0 ? 4 : 0 }}>
                <span style={{ fontWeight: 500 }}>{item.label}:</span>
                <Tooltip title={item.value}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 280, verticalAlign: 'bottom' }}>{item.value}</span>
                </Tooltip>
              </div>
            ))
          if (hidden.length === 0) {
            return <div>{renderLines(visible)}</div>
          }
          return (
            <div>
              {renderLines(visible)}
              <Tooltip title={lines.map((item) => `${item.label}:${item.value}`).join('\n')} overlayInnerStyle={LIST_TOOLTIP_INNER_STYLE}>
                <span style={{ color: '#1677ff', cursor: 'pointer' }}>+{hidden.length} {tStr('common.more')}</span>
              </Tooltip>
            </div>
          )
        }
        if (record.processed_type === 'DATA_AUTH_AUTHORIZE' || record.processed_type === 'DATA_AUTH_CLEAR') {
          return renderDataAuthDiff(record, 'upd', language)
        }
        if (record.processed_type === 'MENU_ASSIGN') {
          return renderMenuAssignDiff(record, 'upd', language, tStr)
        }
        if (RESET_TYPES.has(record.processed_type ?? '')) {
          return tStr('history.pwd.upd')
        }
        if (BATCH_TYPES.has(record.processed_type ?? '')) {
          const type = record.processed_type ?? ''
          if (type === 'USER_BATCH_DELETE') return language === 'en' ? 'Delete Account' : '删除账号'
          if (type === 'USER_BATCH_STATUS' || type === 'USER_STATUS' || type === 'DICT_STATUS') {
            return renderBatchStatusDiff(record, 'upd', language, tStr)
          }
          if (type === 'ROLE_BATCH_DELETE') return language === 'en' ? 'Delete Role' : '删除角色'
          if (type === 'ROLE_BATCH_STATUS' || type === 'ROLE_STATUS') return renderBatchStatusDiff(record, 'upd', language, tStr)
        }
        const diffs = diffCache.get(record.id) ?? []
        return renderDiffColumn(diffs, 'upd', record.entity_type, language, platformMap, regionsMap, tStr)
      },
    },
  ]

  const simpleColumns: ColumnsType<ProcessedHistoryItem> = [
    ...baseColumns,
    {
      title: t('history.col.details'),
      dataIndex: 'details',
      key: 'details',
      width: 380,
      ellipsis: { showTitle: false },
      render: (v?: string) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{v}</span>
          </Tooltip>
        ) : (
          '—'
        ),
    },
  ]

  // 与 full 模式 renderDiffColumn 共用统一格式化核心，保证同一数据两种视图展示一致
  function formatFieldValue(entityType: string | null | undefined, key: string, val: unknown): string {
    return formatHistoryValue(key, val, {
      entityType,
      lang: language,
      platformMap,
      regionsMap,
      t: tStr,
    })
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
    // 快照技术/系统维护字段剔除（bug 32085/32049）：仅剔除"弹窗中不可见 + 系统维护"字段，
    // 业务字段（file_path/deeplink/cdr_id/program_id/package_ids 等）均保留
    const skipKeys = new Set([
      // 标识/关联内部键
      'id', 'entity_id', 'entity_type', 'entity_name', 'content_type', 'content_id', 'channel_id', 'correlate_id',
      // 审计与系统维护（操作时间以"操作时间"列为准，快照内不再重复展示）
      'created_by', 'updated_by', 'created_at', 'updated_at', 'is_deleted', 'is_discarded', 'ingest_status',
      // 系统存储/流程路径与错误信息（xml_path/soap_success 为海报发布日志技术字段，bug 31920）
      'xml_path', 'soap_success', 'ingest_xml_path', 'result_xml_path', 'error_message', 'relative_path',
      // movie 的文件路径为加密存储 URL，无展示价值，日志仅展示文件名
      'file_path',
      // 系统维护的业务冗余字段（界面不展示）
      'series_flag', 'rating_type', 'rating_id', 'volume_count',
      // 已由富化/其他维度展示的集合键
      'custom_tag_ids', 'tag_ids', 'genre_ids',
    ])
    // 部分实体不需要展示 status_label_key 这类内部富化字段（与 computeDiff 共用同一剔除表）
    const extraSkipKeys = new Set(
      record.entity_type ? ENTITY_SPECIFIC_SKIP_KEYS[record.entity_type] ?? [] : [],
    )
    // 详情行专用剔除（编辑 diff 不受影响）：系统默认值/派生统计噪音
    if (record.entity_type) {
      for (const k of DETAIL_ONLY_SKIP_KEYS[record.entity_type] ?? []) extraSkipKeys.add(k)
    }
    // 条件联动剔除（编辑 diff 不受影响）：依赖开关关闭时，弹窗隐藏字段的默认值不展示（bug 32430）
    const conditional = record.entity_type ? CONDITIONAL_SKIP_KEYS[record.entity_type] : undefined
    if (conditional && !obj[conditional.dep]) {
      for (const k of conditional.keys) extraSkipKeys.add(k)
    }
    const lines: { label: string; value: string }[] = []
    for (const [key, val] of Object.entries(obj)) {
      if (rawFieldsToHide.has(key)) continue
      if (skipKeys.has(key)) continue
      if (extraSkipKeys.has(key)) continue
      // 空值字段不渲染（与 full 模式 computeDiff 的空值过滤语义一致；
      // bug 32056：schedule_metadata 全量快照的 sections_info: null 等噪音行）；
      // false/0 是合法业务值，保留展示
      if (isEmptyValue(val)) continue
      const label = (labels as Record<string, Record<string, string>>)[key]?.[language === 'en' ? 'en' : 'cn'] ?? key
      lines.push({ label, value: formatFieldValue(record.entity_type, key, val) })
    }
    return lines
  }

  // log.* 操作内容编码翻译：基础编码统一走 i18n（与操作日志页面共用 system.ts），
  // 冒号参数变体（历史遗留格式）在此拆解拼接。
  // 新日志已由后端 sentinel 规范在读时翻译，此处仅兜底历史数据。
  function translateLogContent(key: string): string {
    if (key.startsWith('log.i18n.edit:')) {
      const langCode = key.substring('log.i18n.edit:'.length)
      return language === 'en' ? `Multi-language Edit (${langCode})` : `多语言编辑（${langCode}）`
    }
    if (key.startsWith('log.field.edit:')) {
      // 多语言自定义字段日志带语言标识，区分各语言页签的变更（bug 32055）
      const langCode = key.substring('log.field.edit:'.length)
      return language === 'en' ? `Custom Fields Edit (${langCode})` : `自定义字段编辑（${langCode}）`
    }
    if (key.startsWith('log.review.reject:')) {
      const reason = key.substring('log.review.reject:'.length)
      return `${tStr('log.review.reject')}:${reason}`
    }
    if (key.startsWith('log.episode.inject:')) {
      const title = key.substring('log.episode.inject:'.length)
      return `${tStr('log.episode.inject')}:${title}`
    }
    if (key.startsWith('log.episode.remove:')) {
      const title = key.substring('log.episode.remove:'.length)
      return `${tStr('log.episode.remove')}:${title}`
    }
    if (key.startsWith('log.movie.create:') || key.startsWith('log.movie.edit:') || key.startsWith('log.movie.delete:')) {
      const colonIdx = key.indexOf(':')
      const movieType = key.substring(colonIdx + 1)
      const baseKey = key.substring(0, colonIdx)
      return `${tStr(baseKey)}-${tStr(`log.movie.type.${movieType}`)}`
    }
    return tStr(key)
  }

  function renderDetailContent(record: ProcessedHistoryItem): React.ReactNode {
    const type = record.processed_type ?? ''
    const updObj = tryParseJson(record.updated_value) ?? tryParseJson(record.updated_value_json)
    const prevObj = tryParseJson(record.previous_value)
    const opDesc = translateLogContent(record.details || '')

    if (BATCH_TYPES.has(type)) {
      if (type === 'USER_BATCH_DELETE') {
        return language === 'en' ? 'Delete Account' : '删除账号'
      }
      if (type === 'USER_BATCH_STATUS') {
        const details = record.details || ''
        if (details.includes('启用')) return language === 'en' ? 'Enable Account' : '启用账号'
        if (details.includes('禁用')) return language === 'en' ? 'Disable Account' : '禁用账号'
        if (details.includes('删除')) return language === 'en' ? 'Delete Account' : '删除账号'
        return language === 'en' ? 'Batch Status Change' : '批量状态变更'
      }
      if (type === 'ROLE_BATCH_DELETE') {
        return language === 'en' ? 'Delete Role' : '删除角色'
      }
      if (type === 'ROLE_BATCH_STATUS') {
        const details = record.details || ''
        if (details.includes('启用')) return language === 'en' ? 'Enable Role' : '启用角色'
        if (details.includes('禁用')) return language === 'en' ? 'Disable Role' : '禁用角色'
        if (details.includes('删除')) return language === 'en' ? 'Delete Role' : '删除角色'
        return language === 'en' ? 'Batch Status Change' : '批量状态变更'
      }
    }

    let lines: { label: string; value: string }[] = []

    if (type === 'DATA_AUTH_AUTHORIZE' || type === 'DATA_AUTH_CLEAR') {
      const prevObjLocal = tryParseJson(record.previous_value)
      const updObjLocal = tryParseJson(record.updated_value)

      const prevRoleNames: string[] = (prevObjLocal?.role_names as string[]) || []
      const newRoleNames: string[] = (updObjLocal?.role_names as string[]) || []
      const prevUserNames: string[] = (prevObjLocal?.user_names as string[]) || []
      const newUserNames: string[] = (updObjLocal?.user_names as string[]) || []

      const prevRoleSet = new Set(prevRoleNames)
      const newRoleSet = new Set(newRoleNames)
      const prevUserSet = new Set(prevUserNames)
      const newUserSet = new Set(newUserNames)

      const addedRoles = newRoleNames.filter((n) => !prevRoleSet.has(n))
      const removedRoles = prevRoleNames.filter((n) => !newRoleSet.has(n))
      const addedUsers = newUserNames.filter((n) => !prevUserSet.has(n))
      const removedUsers = prevUserNames.filter((n) => !newUserSet.has(n))

      const elements: React.ReactNode[] = []

      if (addedRoles.length > 0) {
        elements.push(
          <div key="addedRoles" style={{ marginTop: 2 }}>
            <span style={{ fontWeight: 500 }}>{language === 'en' ? 'Role Authorization' : '角色授权'}:</span>
            <Tag color="green" style={{ marginRight: 4 }}>{language === 'en' ? 'Add' : '新增'}</Tag>
            {addedRoles.join('、')}
          </div>
        )
      }
      if (removedRoles.length > 0) {
        elements.push(
          <div key="removedRoles" style={{ marginTop: 2 }}>
            <span style={{ fontWeight: 500 }}>{language === 'en' ? 'Role Authorization' : '角色授权'}:</span>
            <Tag color="red" style={{ marginRight: 4 }}>{language === 'en' ? 'Remove' : '取消'}</Tag>
            {removedRoles.join('、')}
          </div>
        )
      }
      if (addedUsers.length > 0) {
        elements.push(
          <div key="addedUsers" style={{ marginTop: 2 }}>
            <span style={{ fontWeight: 500 }}>{language === 'en' ? 'User Authorization' : '用户授权'}:</span>
            <Tag color="green" style={{ marginRight: 4 }}>{language === 'en' ? 'Add' : '新增'}</Tag>
            {addedUsers.join('、')}
          </div>
        )
      }
      if (removedUsers.length > 0) {
        elements.push(
          <div key="removedUsers" style={{ marginTop: 2 }}>
            <span style={{ fontWeight: 500 }}>{language === 'en' ? 'User Authorization' : '用户授权'}:</span>
            <Tag color="red" style={{ marginRight: 4 }}>{language === 'en' ? 'Remove' : '取消'}</Tag>
            {removedUsers.join('、')}
          </div>
        )
      }

      if (elements.length > 0) {
        // 单行省略展示，悬浮 Tooltip 展示完整授权变更内容
        const previewLines: string[] = []
        if (addedRoles.length > 0) previewLines.push(`${language === 'en' ? 'Role Authorization' : '角色授权'}: ${language === 'en' ? 'Add' : '新增'} ${addedRoles.join('、')}`)
        if (removedRoles.length > 0) previewLines.push(`${language === 'en' ? 'Role Authorization' : '角色授权'}: ${language === 'en' ? 'Remove' : '取消'} ${removedRoles.join('、')}`)
        if (addedUsers.length > 0) previewLines.push(`${language === 'en' ? 'User Authorization' : '用户授权'}: ${language === 'en' ? 'Add' : '新增'} ${addedUsers.join('、')}`)
        if (removedUsers.length > 0) previewLines.push(`${language === 'en' ? 'User Authorization' : '用户授权'}: ${language === 'en' ? 'Remove' : '取消'} ${removedUsers.join('、')}`)
        return (
          <Tooltip
            title={<div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{elements}</div>}
            overlayStyle={{ maxWidth: 480 }}
            overlayInnerStyle={LIST_TOOLTIP_INNER_STYLE}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {previewLines.join('；')}
            </span>
          </Tooltip>
        )
      }
      return opDesc || '—'
    }

    if (type === 'POSTER_UPLOAD') {
      const name = (updObj?.poster_name as string) || (updObj?.file_name as string) || ''
      return name ? (language === 'en' ? `Poster: ${name}` : `海报:${name}`) : '—'
    }
    if (type === 'POSTER_DELETE') {
      const name = (prevObj?.poster_name as string) || (prevObj?.file_name as string) || ''
      return name ? (language === 'en' ? `Poster: ${name}` : `海报:${name}`) : '—'
    }
    if (type === 'MOVIE_DELETE') {
      const fileName = prevObj?.file_name as string | undefined
      const fileSize = prevObj?.file_size as number | undefined
      const movieLabels = FIELD_LABEL_MAP.movie ?? {}
      const labelName = (movieLabels.file_name as Record<string, string> | undefined)?.[language === 'en' ? 'en' : 'cn'] ?? 'file_name'
      const labelSize = (movieLabels.file_size as Record<string, string> | undefined)?.[language === 'en' ? 'en' : 'cn'] ?? 'file_size'
      const sizeStr = fileSize !== undefined && fileSize !== null ? formatFileSizeValue(fileSize) ?? String(fileSize) : '—'
      const items = [
        { label: labelName, value: fileName ?? '—' },
        { label: labelSize, value: sizeStr },
      ]
      return (
        <div>
          {opDesc ? <div>{opDesc}</div> : null}
          {items.map((item, i) => (
            <div key={i} style={{ marginTop: 2 }}>
              <span style={{ fontWeight: 500 }}>{item.label}:</span>
              <Tooltip title={item.value}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 280, verticalAlign: 'bottom' }}>{item.value}</span>
              </Tooltip>
            </div>
          ))}
        </div>
      )
    }
    if (type === 'EPISODE_INJECT' || type === 'EPISODE_REMOVE') {
      return opDesc || '—'
    }
    if (type === 'CHANNEL_FIELD_UPDATE' || type === 'CHANNEL_I18N_UPDATE' || type === 'SCHEDULE_FIELD_UPDATE' || type === 'SCHEDULE_I18N_UPDATE' || type === 'VOD_FIELD_UPDATE' || type === 'VOD_I18N_UPDATE' || type === 'MOVIE_FIELD_UPDATE' || type === 'MOVIE_I18N_UPDATE' || type === 'CAST_ROLE_MAP_UPDATE' || type === 'CAST_ROLE_MAP_FIELD_UPDATE' || type === 'CAST_ROLE_MAP_I18N_UPDATE') {
      lines = buildFieldLines(record, updObj)
      if (lines.length === 0) return opDesc || '—'
      const renderLines = (items: { label: string; value: string }[]) =>
        items.map((item, i) => (
          <div key={i} style={{ marginTop: 2 }}>
            <span style={{ fontWeight: 500 }}>{item.label}:</span>
            <Tooltip title={item.value}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 280, verticalAlign: 'bottom' }}>{item.value}</span>
            </Tooltip>
          </div>
        ))
      const descElement = opDesc ? <div>{opDesc}</div> : null
      // Cast Role Map 人物编辑（Main/Custom Fields/Multi Languages）日志字段较多，全部展示不做 +N more 截断
      if (type.startsWith('CAST_ROLE_MAP_')) {
        return <div>{descElement}{renderLines(lines)}</div>
      }
      const MAX_VISIBLE = 2
      const visible = lines.slice(0, MAX_VISIBLE)
      const hidden = lines.slice(MAX_VISIBLE)
      return (
        <div>
          {descElement}
          {renderLines(visible)}
          <Tooltip
            title={lines.map((item) => `${item.label}:${item.value}`).join('\n')}
            overlayInnerStyle={LIST_TOOLTIP_INNER_STYLE}
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
        ? (language === 'en' ? `Link License: ${licenseName}` : `关联许可证:${licenseName}`)
        : (language === 'en' ? 'Link License' : '关联许可证')
    } else if (type === 'LICENSE_CONTENT_REMOVE') {
      const licenseName = (prevObj?.license_name as string) || ''
      return licenseName
        ? (language === 'en' ? `Unlink License: ${licenseName}` : `取消关联许可证:${licenseName}`)
        : (language === 'en' ? 'Unlink License' : '取消关联许可证')
    } else if (type === 'CAST_ROLE_MAP_LINK' || type === 'CAST_ROLE_MAP_UNLINK') {
      const roles = updObj?.roles as string[] | undefined
      const prefix = type === 'CAST_ROLE_MAP_LINK'
        ? (language === 'en' ? 'Link Cast:' : '关联人物:')
        : (language === 'en' ? 'Unlink Cast:' : '取消关联人物:')
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
                overlayInnerStyle={LIST_TOOLTIP_INNER_STYLE}
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
        return opDesc ? (
          <Tooltip title={opDesc}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{opDesc}</span>
          </Tooltip>
        ) : '—'
      }
      const levelMap: Record<string, string> = language === 'en'
        ? { L1: 'Level 1 Review', L2: 'Level 2 Review', L3: 'Level 3 Review' }
        : { L1: '一级审核', L2: '二级审核', L3: '三级审核' }
      const reviewLevel = String(updObj?.review_level ?? '')
      const reviewType = updObj?.review_type as string | undefined
      const reason = updObj?.reason as string | undefined
      const description = updObj?.description as string | undefined
      const levelStr = levelMap[reviewLevel] || reviewLevel
      let text = opDesc || '—'
      if (reviewType === 'approve') {
        text = description ? `${levelStr}:${language === 'en' ? 'Approved' : '通过'}-${description}` : `${levelStr}:${language === 'en' ? 'Approved' : '通过'}`
      } else if (reviewType === 'reject') {
        const rejectStr = language === 'en' ? 'Rejected' : '拒绝'
        text = reason ? `${levelStr}:${rejectStr}-${reason}` : `${levelStr}:${rejectStr}`
      }
      if (text === '—') return text
      return (
        <Tooltip title={text}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{text}</span>
        </Tooltip>
      )
    } else if (PUBLISHED_TYPES.has(type) || UNPUBLISHED_TYPES.has(type)) {
      return opDesc || '—'
    } else if (PLAN_TYPES.has(type)) {
      const obj = updObj || prevObj
      const scheduledTime = obj?.scheduled_time as string | undefined
      const formattedTime = scheduledTime ? dayjs(scheduledTime).format('YYYY-MM-DD HH:mm') : ''
      if (type === 'PUBLISH_PLAN_CANCEL') {
        return opDesc || '—'
      }
      if (formattedTime) {
        return `${opDesc}:${formattedTime}`
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
          <span style={{ fontWeight: 500 }}>{item.label}:</span>
          <Tooltip title={item.value}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 280, verticalAlign: 'bottom' }}>{item.value}</span>
          </Tooltip>
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
          title={lines.map((item) => `${item.label}:${item.value}`).join('\n')}
          overlayInnerStyle={LIST_TOOLTIP_INNER_STYLE}
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
      width: 200,
      render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('history.col.processedBy'),
      dataIndex: 'processed_by',
      key: 'processed_by',
      width: 220,
      render: (_: unknown, record: ProcessedHistoryItem) => {
        const display = record.processed_by_display_name
        const username = record.processed_by
        if (display && username) return `${display}(${username})`
        return display || username || '—'
      },
    },
    {
      title: t('history.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 200,
      render: (v?: string) => {
        if (!v) return '—'
        return <Tag color={getProcessedTypeColor(v)}>{getProcessedTypeLabel(v, tStr)}</Tag>
      },
    },
    {
      title: t('history.col.details'),
      dataIndex: 'details',
      key: 'details',
      width: 350,
      ellipsis: { showTitle: false },
      render: (_: unknown, record: ProcessedHistoryItem) => renderDetailContent(record),
    },
  ]

  const columns = mode === 'full'
    ? fullColumns
    : mode === 'detail'
      ? detailColumns
      : simpleColumns

  return (
    <ResizableTable<ProcessedHistoryItem>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={data}
      scroll={{ x: 1060 }}
      pagination={{ pageSize: 10, showQuickJumper: true , placement: ['bottomCenter'] }}
      locale={{ emptyText: t('history.empty') }}
    />
  )
}
