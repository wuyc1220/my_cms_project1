/**
 * 平台颜色配置
 * 用于统一管理数据字典 Platform 的标签颜色
 */

/**
 * 平台颜色映射
 * key: 字典编码 (dict.code)
 * value: Ant Design Tag 预设颜色
 */
export const PLATFORM_COLORS: Record<string, string> = {
  '1': 'blue',      // STB - 机顶盒
  '2': 'green',     // mobile - 移动端
  '4': 'cyan',      // PC - 电脑端
  '8': 'lime',      // PAD - 平板端
  '16': 'purple',   // smarttv - 智能电视
  '32': 'magenta',  // VR终端
  '64': 'geekblue', // 8K终端
  '128': 'orange',  // AR终端
  '256': 'gold',    // DVB/DTH
}

/**
 * 获取平台颜色
 * @param platform 平台编码
 * @returns Ant Design Tag 颜色值
 */
export const getPlatformColor = (platform: string): string => {
  return PLATFORM_COLORS[platform] ?? 'default'
}
