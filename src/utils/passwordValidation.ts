import type { MessageKey } from '../i18n/messages'

/**
 * 密码强度预校验（提交后端前拦截）
 *
 * 规则与后端 password_validator.py 保持一致：
 * 1. 长度 >= 8（minLength 可配）
 * 2. 大写/小写/数字/特殊符号至少 3 种
 * 3. 禁止连续重复字符（如 aaaaaa、111111）
 * 4. 禁止连续字符序列（如 abcdef、123456，含反向）
 * 5. 禁止与账号相同
 * 6. 禁止键盘序列（行/列走位，含反向，如 qwertyui、1qaz2wsx）
 *
 * 重复字符/连续字符/键盘序列三个阈值统一由 patternMinLen 控制（默认 6，可配置）。
 */

export type PasswordErrorCode =
  | 'PASSWORD_TOO_SHORT'
  | 'PASSWORD_COMPLEXITY'
  | 'PASSWORD_NO_REPEAT'
  | 'PASSWORD_NO_SEQUENCE'
  | 'PASSWORD_NOT_USERNAME'
  | 'PASSWORD_NO_KEYBOARD'

export interface PasswordValidateOptions {
  /** 用户账号，用于校验密码是否与账号相同 */
  username?: string
  /** 最小长度，默认 8 */
  minLength?: number
  /** 重复字符/连续字符/键盘序列触发阈值，默认 6 */
  patternMinLen?: number
}

/** 模式（重复/连续/键盘序列）触发阈值默认值 */
const PATTERN_MIN_LEN_DEFAULT = 6

/** 键盘布局：字母行、数字行、符号行、列组合走位、数字前缀列走位 */
const KEYBOARD_LINES = [
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', '!@#$%^&*()',
  'qazwsx', 'wsxedc', 'edcrfv',
  '1qaz', '2wsx', '3edc', '4rfv', '5tgb', '6yhn', '7ujm',
]

const keyboardSequenceCache = new Map<number, Set<string>>()

function buildKeyboardSequences(minLen: number): Set<string> {
  const cached = keyboardSequenceCache.get(minLen)
  if (cached) return cached
  const sequences = new Set<string>()
  for (const line of KEYBOARD_LINES) {
    for (const s of [line, [...line].reverse().join('')]) {
      for (let n = minLen; n <= s.length; n++) {
        for (let i = 0; i + n <= s.length; i++) {
          sequences.add(s.slice(i, i + n))
        }
      }
    }
  }
  keyboardSequenceCache.set(minLen, sequences)
  return sequences
}

function hasConsecutiveChars(text: string, minLen: number): boolean {
  if (minLen < 2) return true
  for (let i = 0; i + minLen <= text.length; i++) {
    let asc = true
    let desc = true
    for (let k = i; k < i + minLen - 1; k++) {
      const d = text.charCodeAt(k + 1) - text.charCodeAt(k)
      if (d !== 1) asc = false
      if (d !== -1) desc = false
      if (!asc && !desc) break
    }
    if (asc || desc) return true
  }
  return false
}

/** 错误码 → i18n key（复用 changePassword.rules.* 双语文案） */
export const PASSWORD_ERROR_I18N_KEYS: Record<PasswordErrorCode, MessageKey> = {
  PASSWORD_TOO_SHORT: 'changePassword.rules.minLength',
  PASSWORD_COMPLEXITY: 'changePassword.rules.complexity',
  PASSWORD_NO_REPEAT: 'changePassword.rules.noRepeat',
  PASSWORD_NO_SEQUENCE: 'changePassword.rules.noSequence',
  PASSWORD_NOT_USERNAME: 'changePassword.rules.notUsername',
  PASSWORD_NO_KEYBOARD: 'changePassword.rules.notKeyboard',
}

/**
 * 校验密码强度，命中第一条规则即返回对应错误码；通过返回 null。
 */
export function validatePassword(
  password: string,
  options: PasswordValidateOptions = {},
): PasswordErrorCode | null {
  const { username, minLength = 8, patternMinLen = PATTERN_MIN_LEN_DEFAULT } = options

  if (password.length < minLength) {
    return 'PASSWORD_TOO_SHORT'
  }

  let typeCount = 0
  if (/[A-Z]/.test(password)) typeCount++
  if (/[a-z]/.test(password)) typeCount++
  if (/[0-9]/.test(password)) typeCount++
  if (/[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/~`]/.test(password)) typeCount++
  if (typeCount < 3) {
    return 'PASSWORD_COMPLEXITY'
  }

  const repeatRegex = new RegExp(`(.)\\1{${patternMinLen - 1},}`)
  if (repeatRegex.test(password)) {
    return 'PASSWORD_NO_REPEAT'
  }

  const lowerPwd = password.toLowerCase()
  if (hasConsecutiveChars(lowerPwd, patternMinLen)) {
    return 'PASSWORD_NO_SEQUENCE'
  }

  if (username && lowerPwd === username.toLowerCase()) {
    return 'PASSWORD_NOT_USERNAME'
  }

  for (const seq of buildKeyboardSequences(patternMinLen)) {
    if (lowerPwd.includes(seq)) {
      return 'PASSWORD_NO_KEYBOARD'
    }
  }

  return null
}
