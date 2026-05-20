export interface IngestHistoryItem {
  id: number
  entity_type: string
  entity_id: number
  entity_name?: string | null
  action: string
  status: string
  create_date?: string | null
  send_date?: string | null
  end_date?: string | null
  ingest_xml_path?: string | null
  result_xml_path?: string | null
  ingest_xml_url?: string | null
  result_xml_url?: string | null
}

export interface IngestHistoryDetailItem {
  id: number
  history_id: number
  entity_type: string
  entity_id: number
  entity_name?: string | null
  action: string
  created_at?: string | null
  trigger_content_id?: number | null
  trigger_content_name?: string | null
  status?: string | null
  create_date?: string | null
  send_date?: string | null
  end_date?: string | null
  ingest_xml_path?: string | null
  result_xml_path?: string | null
  ingest_xml_url?: string | null
  result_xml_url?: string | null
}

export interface IngestHistoryQueryParams {
  entity_type?: string
  entity_id?: number
  action?: string
  status?: string
  page?: number
  page_size?: number
}

export interface IngestHistoryDetailQueryParams {
  entity_type: string
  entity_id: number
  page?: number
  page_size?: number
}
