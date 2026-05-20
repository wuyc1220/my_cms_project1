/* 元数据扩展类型定义 — 按原型 3.6.2.1 ~ 3.6.2.4 对齐 */

export interface SectionInfoItem {
  type: number
  action: number
  tag: string
  start: number
  end: number
}

/* ── Program 元数据 (MOVIE / EPISODE) ── */

export interface ContentMetadataItem {
  id: number
  content_id: number
  name: string
  vod_type?: string[] | null
  sort_name?: string | null
  original_name?: string | null
  original_country?: string | null
  short_title?: string | null
  language?: string | null
  release_year?: number | null
  description?: string | null
  type_id?: number | null
  tag_ids?: number[] | null
  rating_level?: string | null
  advice?: string[] | null
  rating?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  studio?: string | null
  cdr_id: string
  series_flag: number
  begin_duration?: number | null
  end_duration?: number | null
  status_flag: boolean
  keywords?: string[] | null
  sections_info?: SectionInfoItem[] | null
  created_at?: string | null
  updated_at?: string | null
  metalayout: string
}

export interface ContentMetadataCreate {
  content_id: number
  name: string
  vod_type?: string[] | null
  sort_name?: string | null
  original_name?: string | null
  original_country?: string | null
  short_title?: string | null
  language?: string | null
  release_year?: number | null
  description?: string | null
  type_id?: number | null
  tag_ids?: number[] | null
  rating_level?: string | null
  advice?: string[] | null
  rating?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  studio?: string | null
  cdr_id: string
  series_flag?: number | null
  begin_duration?: number | null
  end_duration?: number | null
  status_flag?: boolean | null
  keywords?: string[] | null
  sections_info?: SectionInfoItem[] | null
  metalayout?: string | null
}

export interface ContentMetadataUpdate {
  name?: string | null
  vod_type?: string[] | null
  sort_name?: string | null
  original_name?: string | null
  original_country?: string | null
  short_title?: string | null
  language?: string | null
  release_year?: number | null
  description?: string | null
  type_id?: number | null
  tag_ids?: number[] | null
  rating_level?: string | null
  advice?: string[] | null
  rating?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  studio?: string | null
  cdr_id?: string | null
  series_flag?: number | null
  begin_duration?: number | null
  end_duration?: number | null
  status_flag?: boolean | null
  keywords?: string[] | null
  sections_info?: SectionInfoItem[] | null
  metalayout?: string | null
}

/* ── Series 元数据 (SERIES / SEASON) ── */

export interface SeriesMetadataItem {
  id: number
  content_id: number
  name: string
  vod_type?: string[] | null
  sort_name?: string | null
  original_name?: string | null
  original_country?: string | null
  short_title?: string | null
  language?: string | null
  release_year?: number | null
  description?: string | null
  type_id?: number | null
  tag_ids?: number[] | null
  rating_level?: string | null
  advice?: string[] | null
  rating?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  studio?: string | null
  cdr_id: string
  begin_duration?: number | null
  end_duration?: number | null
  status_flag: boolean
  keywords?: string[] | null
  sections_info?: SectionInfoItem[] | null
  volume_count?: number | null
  series_type?: number | null
  series_ordinal?: number | null
  show_id?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface SeriesMetadataCreate {
  content_id: number
  name: string
  vod_type?: string[] | null
  sort_name?: string | null
  original_name?: string | null
  original_country?: string | null
  short_title?: string | null
  language?: string | null
  release_year?: number | null
  description?: string | null
  type_id?: number | null
  tag_ids?: number[] | null
  rating_level?: string | null
  advice?: string[] | null
  rating?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  studio?: string | null
  cdr_id: string
  begin_duration?: number | null
  end_duration?: number | null
  status_flag?: boolean | null
  keywords?: string[] | null
  sections_info?: SectionInfoItem[] | null
  volume_count?: number | null
  series_type?: number | null
  series_ordinal?: number | null
  show_id?: number | null
}

export interface SeriesMetadataUpdate {
  name?: string | null
  vod_type?: string[] | null
  sort_name?: string | null
  original_name?: string | null
  original_country?: string | null
  short_title?: string | null
  language?: string | null
  release_year?: number | null
  description?: string | null
  type_id?: number | null
  tag_ids?: number[] | null
  rating_level?: string | null
  advice?: string[] | null
  rating?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  studio?: string | null
  cdr_id?: string | null
  begin_duration?: number | null
  end_duration?: number | null
  status_flag?: boolean | null
  keywords?: string[] | null
  sections_info?: SectionInfoItem[] | null
  volume_count?: number | null
  series_type?: number | null
  series_ordinal?: number | null
  show_id?: number | null
  update_childs_main?: boolean | null
  update_childs_custom_fields?: boolean | null
  update_childs_i18n?: boolean | null
}

/* ── Channel 元数据 (CHANNEL) ── */

export interface ChannelMetadataItem {
  id: number
  content_id: number
  name: string
  channel_number?: number | null
  description?: string | null
  channel_type?: string | null
  status_flag: boolean
  type?: string | null
  audio_type?: string | null
  rating_level?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  tag_ids?: number[] | null
  ppv_enable?: boolean | number | null
  npvr_enable?: boolean | number | null
  fingerprint_enable?: boolean | number | null
  watermark_enable?: boolean | number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ChannelMetadataCreate {
  content_id: number
  name: string
  channel_number?: number | null
  description?: string | null
  channel_type?: string | null
  audio_type?: string | null
  rating_level?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  status_flag?: boolean | null
  type?: string | null
  tag_ids?: number[] | null
  ppv_enable?: boolean | number | null
  npvr_enable?: boolean | number | null
  fingerprint_enable?: boolean | number | null
  watermark_enable?: boolean | number | null
}

export interface ChannelMetadataUpdate {
  name?: string | null
  channel_number?: number | null
  description?: string | null
  channel_type?: string | null
  audio_type?: string | null
  rating_level?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  status_flag?: boolean | null
  type?: string | null
  tag_ids?: number[] | null
  ppv_enable?: boolean | number | null
  npvr_enable?: boolean | number | null
  fingerprint_enable?: boolean | number | null
  watermark_enable?: boolean | number | null
}

/* ── Schedule 元数据 (SCHEDULE) ── */

export interface ScheduleMetadataItem {
  id: number
  content_id: number
  name: string
  vod_type?: string[] | null
  type_id?: number | null
  description?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  rating_level?: string | null
  advice?: string[] | null
  studio?: string | null
  cdr_id?: string | null
  tag_ids?: number[] | null
  status_flag: boolean
  sections_info?: SectionInfoItem[] | null
  // Schedule 专属字段
  cutv_enable?: boolean | null
  program_id?: string | null
  broadcast_type?: string | null
  tstv_enable?: boolean | null
  tstv_mode?: boolean | null
  npvr_enable?: boolean | null
  ppv_enable?: boolean | null
  package_ids?: number[] | null
  pre_buffer?: number | null
  post_buffer?: number | null
  purchase_begin_time?: number | null
  purchase_end_time?: number | null
  series_type?: number | null
  series_name?: string | null
  series_id?: string | null
  volume_count?: number | null
  sequence?: number | null
  series_ordinal?: number | null
  show_id?: string | null
  show_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ScheduleMetadataCreate {
  content_id: number
  name: string
  vod_type?: string[] | null
  type_id?: number | null
  description?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  rating_level?: string | null
  advice?: string[] | null
  studio?: string | null
  cdr_id?: string | null
  tag_ids?: number[] | null
  status_flag?: boolean | null
  sections_info?: SectionInfoItem[] | null
  // Schedule 专属字段
  cutv_enable?: boolean | null
  program_id?: string | null
  broadcast_type?: string | null
  tstv_enable?: boolean | null
  tstv_mode?: boolean | null
  npvr_enable?: boolean | null
  ppv_enable?: boolean | null
  package_ids?: number[] | null
  pre_buffer?: number | null
  post_buffer?: number | null
  purchase_begin_time?: number | null
  purchase_end_time?: number | null
  series_type?: number | null
  series_name?: string | null
  series_id?: string | null
  volume_count?: number | null
  sequence?: number | null
  series_ordinal?: number | null
  show_id?: string | null
  show_name?: string | null
}

export interface ScheduleMetadataUpdate {
  name?: string | null
  vod_type?: string[] | null
  type_id?: number | null
  description?: string | null
  audio_lang?: string[] | null
  subtitle_lang?: string[] | null
  rating_level?: string | null
  advice?: string[] | null
  studio?: string | null
  cdr_id?: string | null
  tag_ids?: number[] | null
  status_flag?: boolean | null
  sections_info?: SectionInfoItem[] | null
  // Schedule 专属字段
  cutv_enable?: boolean | null
  program_id?: string | null
  broadcast_type?: string | null
  tstv_enable?: boolean | null
  tstv_mode?: boolean | null
  npvr_enable?: boolean | null
  ppv_enable?: boolean | null
  package_ids?: number[] | null
  pre_buffer?: number | null
  post_buffer?: number | null
  purchase_begin_time?: number | null
  purchase_end_time?: number | null
  series_type?: number | null
  series_name?: string | null
  series_id?: string | null
  volume_count?: number | null
  sequence?: number | null
  series_ordinal?: number | null
  show_id?: string | null
  show_name?: string | null
}

/* ── 统一查询响应 ── */

export interface MovieItem {
  id: number
  content_id: number
  file_name: string
  file_path?: string
  movie_type: string
  file_size: string
  sequence?: number | null
  audio_type: string
  screen_format: string
  closed_captioning: boolean
  duration: string
  definition: string
  mediaservice?: string | null
  encryption: boolean
  publish_flag: boolean
  deeplink: string
  created_at?: string
}

export interface MovieHistoryItem {
  id: number
  file_name: string
  movie_type: string
  file_size: string
  created_at?: string
  processed_by?: string
  processed_type?: string
}

export interface MetadataDetailItem {
  content_type: string
  content_name: string
  content_id: number
  program?: ContentMetadataItem | null
  series?: SeriesMetadataItem | null
  channel?: ChannelMetadataItem | null
  schedule?: ScheduleMetadataItem | null
}
