/**
 * 图标名称到 Ant Design React 组件的映射
 * 数据库中存储图标名字符串（如 "ShoppingOutlined"），
 * 前端通过此映射表动态渲染为 React 组件。
 */
import React from 'react'
import {
  DashboardOutlined,
  ShoppingOutlined,
  TeamOutlined,
  FileProtectOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  PlayCircleOutlined,
  NotificationOutlined,
  ScheduleOutlined,
  InboxOutlined,
  VideoCameraOutlined,
  PlaySquareOutlined,
  DatabaseOutlined,
  TagsOutlined,
  UserOutlined,
  ProfileOutlined,
  TagOutlined,
  FolderOutlined,
  PictureOutlined,
  ToolOutlined,
  GiftOutlined,
  CheckSquareOutlined,
  SendOutlined,
  SettingOutlined,
  UserSwitchOutlined,
  ApartmentOutlined,
  BookOutlined,
  SlidersOutlined,
  FileSearchOutlined,
  MonitorOutlined,
  DesktopOutlined,
  ClockCircleOutlined,
  SaveOutlined,
  ControlOutlined,
  StopOutlined,
  MenuOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  GlobalOutlined,
  HomeOutlined,
  BarChartOutlined,
  WarningOutlined,
  CloudOutlined,
  SafetyOutlined,
  RocketOutlined,
  ApiOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons'

const ICON_MAP: Record<string, React.ComponentType> = {
  DashboardOutlined,
  ShoppingOutlined,
  TeamOutlined,
  FileProtectOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  PlayCircleOutlined,
  NotificationOutlined,
  ScheduleOutlined,
  InboxOutlined,
  VideoCameraOutlined,
  PlaySquareOutlined,
  DatabaseOutlined,
  TagsOutlined,
  UserOutlined,
  ProfileOutlined,
  TagOutlined,
  FolderOutlined,
  PictureOutlined,
  ToolOutlined,
  GiftOutlined,
  CheckSquareOutlined,
  SendOutlined,
  SettingOutlined,
  UserSwitchOutlined,
  ApartmentOutlined,
  BookOutlined,
  SlidersOutlined,
  FileSearchOutlined,
  MonitorOutlined,
  DesktopOutlined,
  ClockCircleOutlined,
  SaveOutlined,
  ControlOutlined,
  StopOutlined,
  MenuOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  GlobalOutlined,
  HomeOutlined,
  BarChartOutlined,
  WarningOutlined,
  CloudOutlined,
  SafetyOutlined,
  RocketOutlined,
  ApiOutlined,
  CloudDownloadOutlined,
}

/** 根据图标名称字符串获取对应的 React 图标组件 */
export function getIcon(name: string | null | undefined): React.ReactNode {
  if (!name) return null
  const IconComponent = ICON_MAP[name]
  if (!IconComponent) return null
  return React.createElement(IconComponent)
}

/** 获取所有可用的图标名称列表（用于菜单管理页面的图标选择器） */
export function getAvailableIconNames(): string[] {
  return Object.keys(ICON_MAP)
}

export default ICON_MAP
