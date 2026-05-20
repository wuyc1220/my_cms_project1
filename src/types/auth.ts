export interface LoginResponse {
  access_token: string
  token_type: string
  display_name: string
  username: string
  force_change_password?: boolean
}

export interface UserInfo {
  id: number
  username: string
  display_name: string | null
  status: string
  role_codes: string[]
  force_change_password?: boolean
}
