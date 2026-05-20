export const cnDashboard = {
  'dashboard.title': '系统看板',
  'dashboard.vodCount': 'VOD 内容总数',
  'dashboard.liveChannelCount': '直播频道数',
  'dashboard.validLicenses': '有效许可证',
  'dashboard.pendingTasks': '待处理任务',
  'dashboard.tip': '系统初始化完成，请从左侧菜单开始使用',
  'placeholder.inDevelopment': '功能开发中，敬请期待',

  // 看板模块
  'dashboard.contentPublishedStats': 'Vod内容发布统计',
  'dashboard.contentStatusCount': '按状态统计Vod内容数量',
  'dashboard.genreStatusTable': '按题材x状态的矩阵统计表',
  'dashboard.assignedToMe': '分配给当前用户的任务列表',
  'dashboard.taskCompletionStats': '任务完成统计',
  'dashboard.taskStatusCount': '任务状态数量统计',
  'dashboard.taskAssignedTable': '任务分配与状态矩阵',
  'dashboard.notAssignedTasks': '未分配任务列表',

  // 按钮
  'dashboard.customize': '自定义',
  'dashboard.reset': '重置',
  'dashboard.save': '保存',
  'dashboard.cancel': '取消',

  // 自定义弹窗
  'dashboard.customizeTitle': '自定义看板',
  'dashboard.moduleConfig': '模块配置',
  'dashboard.statusConfig': '状态配置',
  'dashboard.genreConfig': '题材配置',
  'dashboard.visible': '显示',
  'dashboard.sortOrder': '排序',
  'dashboard.moduleName': '模块名称',
  'dashboard.statusName': '状态名称',
  'dashboard.genreName': '题材名称',
  'dashboard.action': '操作',
  'dashboard.moveUp': '上移',
  'dashboard.moveDown': '下移',

  // 状态
  'dashboard.status.waitingForMaterials': '缺失材料',
  'dashboard.status.inProgress': '内容处理中',
  'dashboard.status.readyForPublish': '准备发布',
  'dashboard.status.publishing': '发布中',
  'dashboard.status.published': '已发布',
  'dashboard.status.publishFailed': '发布失败',
  'dashboard.status.noActiveLicense': '无有效授权',
  'dashboard.status.expired': '内容已过期',
  'dashboard.status.nearExpiry': '临近过期',
  'dashboard.status.closed': '已下架',
  'dashboard.status.none': '无状态',

  // 任务状态
  'dashboard.taskStatus.pending': '待处理',
  'dashboard.taskStatus.completed': '已完成',
  'dashboard.taskStatus.notAssigned': '未分配',

  // 任务类型
  'dashboard.taskType.arrangement': '编排',
  'dashboard.taskType.reviewL1': '审核 L1',
  'dashboard.taskType.reviewL2': '审核 L2',
  'dashboard.taskType.reviewL3': '审核 L3',

  // 表格列
  'dashboard.column.contentName': '内容名称',
  'dashboard.column.contentType': '内容类型',
  'dashboard.column.ingestStatus': '注入状态',
  'dashboard.column.taskType': '任务类型',
  'dashboard.column.taskStatus': '任务状态',
  'dashboard.column.startTime': '开始时间',
  'dashboard.column.userName': '用户名称',
  'dashboard.column.arrangementPending': '编排待处理',
  'dashboard.column.reviewL1Pending': '审核 L1 待处理',
  'dashboard.column.reviewL2Pending': '审核 L2 待处理',
  'dashboard.column.reviewL3Pending': '审核 L3 待处理',
  'dashboard.column.arrangementCompleted': '编排已完成',
  'dashboard.column.reviewCompleted': '审核已完成',
  'dashboard.column.completionRate': '完成率',
  'dashboard.column.genreStatus': '题材 / 状态',

  // 内容类型
  'dashboard.contentType.MOVIE': '电影',
  'dashboard.contentType.SERIES': '剧集',
  'dashboard.contentType.SEASON': '季',
  'dashboard.contentType.EPISODE': '集',
  'dashboard.contentType.CHANNEL': '频道',
  'dashboard.contentType.SCHEDULE': '节目单',

  // 饼图标题
  'dashboard.pie.byPlatform': '按平台',
  'dashboard.pie.byContentType': '按内容类型',
  'dashboard.pie.byGenre': '按题材',
  'dashboard.pie.byIngestStatus': '按注入状态',
  'dashboard.pie.arrangement': '编排任务',
  'dashboard.pie.reviewL1': '审核 L1 任务',
  'dashboard.pie.reviewL2': '审核 L2 任务',
  'dashboard.pie.reviewL3': '审核 L3 任务',

  // 提示信息
  'dashboard.saveSuccess': '保存成功',
  'dashboard.saveFailed': '保存失败',
  'dashboard.resetSuccess': '重置成功',
  'dashboard.resetConfirm': '确定要重置为默认配置吗？',
  'dashboard.loadFailed': '加载看板数据失败',
  'dashboard.loadConfigFailed': '加载配置失败',
  'dashboard.dragSortHint': '支持拖拽排序',

  // 分配任务
  'dashboard.assign': '分配',
  'dashboard.assignTask': '分配任务',
  'dashboard.assignSuccess': '任务分配成功',
  'dashboard.assignFailed': '任务分配失败',
  'dashboard.selectUser': '选择用户',
  'dashboard.selectUserRequired': '请选择用户',
  'dashboard.selectUserPlaceholder': '请选择要分配的用户',
  'dashboard.loadUsersFailed': '加载用户列表失败',

  // 权限管理（待开发）
  'dashboard.permissionManagement': '权限管理（待开发）',
} as const

export const enDashboard = {
  'dashboard.title': 'System Dashboard',
  'dashboard.vodCount': 'Total VOD Contents',
  'dashboard.liveChannelCount': 'Live Channels',
  'dashboard.validLicenses': 'Valid Licenses',
  'dashboard.pendingTasks': 'Pending Tasks',
  'dashboard.tip': 'System initialization completed. Please start from the left menu.',
  'placeholder.inDevelopment': 'This feature is under development. Stay tuned.',

  // Dashboard Modules
  'dashboard.contentPublishedStats': 'Content Published Statistics',
  'dashboard.contentStatusCount': 'Content Status Count',
  'dashboard.genreStatusTable': 'Content Genre/Status Table',
  'dashboard.assignedToMe': 'Assigned To Me',
  'dashboard.taskCompletionStats': 'Task Completion Statistics',
  'dashboard.taskStatusCount': 'Task Status Count',
  'dashboard.taskAssignedTable': 'Task Assigned/Status Table',
  'dashboard.notAssignedTasks': 'Not Assigned Tasks',

  // Buttons
  'dashboard.customize': 'Customize',
  'dashboard.reset': 'Reset',
  'dashboard.save': 'Save',
  'dashboard.cancel': 'Cancel',

  // Customize Modal
  'dashboard.customizeTitle': 'Customize Dashboard',
  'dashboard.moduleConfig': 'Module Configuration',
  'dashboard.statusConfig': 'Status Configuration',
  'dashboard.genreConfig': 'Genre Configuration',
  'dashboard.visible': 'Visible',
  'dashboard.sortOrder': 'Sort Order',
  'dashboard.moduleName': 'Module Name',
  'dashboard.statusName': 'Status Name',
  'dashboard.genreName': 'Genre Name',
  'dashboard.action': 'Action',
  'dashboard.moveUp': 'Move Up',
  'dashboard.moveDown': 'Move Down',

  // Status
  'dashboard.status.waitingForMaterials': 'Waiting For Materials',
  'dashboard.status.inProgress': 'In Progress',
  'dashboard.status.readyForPublish': 'Ready For Publish',
  'dashboard.status.publishing': 'Publishing',
  'dashboard.status.published': 'Published',
  'dashboard.status.publishFailed': 'Publish Failed',
  'dashboard.status.noActiveLicense': 'No Active License',
  'dashboard.status.expired': 'Expired',
  'dashboard.status.nearExpiry': 'Near Expiry',
  'dashboard.status.closed': 'Closed',
  'dashboard.status.none': 'None',

  // Task Status
  'dashboard.taskStatus.pending': 'Pending',
  'dashboard.taskStatus.completed': 'Completed',
  'dashboard.taskStatus.notAssigned': 'Not Assigned',

  // Task Type
  'dashboard.taskType.arrangement': 'Arrangement',
  'dashboard.taskType.reviewL1': 'Review L1',
  'dashboard.taskType.reviewL2': 'Review L2',
  'dashboard.taskType.reviewL3': 'Review L3',

  // Table Columns
  'dashboard.column.contentName': 'Content Name',
  'dashboard.column.contentType': 'Content Type',
  'dashboard.column.ingestStatus': 'Ingest Status',
  'dashboard.column.taskType': 'Task Type',
  'dashboard.column.taskStatus': 'Task Status',
  'dashboard.column.startTime': 'Start Time',
  'dashboard.column.userName': 'User Name',
  'dashboard.column.arrangementPending': 'Arrangement Pending',
  'dashboard.column.reviewL1Pending': 'Review L1 Pending',
  'dashboard.column.reviewL2Pending': 'Review L2 Pending',
  'dashboard.column.reviewL3Pending': 'Review L3 Pending',
  'dashboard.column.arrangementCompleted': 'Arrangement Completed',
  'dashboard.column.reviewCompleted': 'Review Completed',
  'dashboard.column.completionRate': 'Completion Rate',
  'dashboard.column.genreStatus': 'Genre / Status',

  // Content Type
  'dashboard.contentType.MOVIE': 'Movie',
  'dashboard.contentType.SERIES': 'Series',
  'dashboard.contentType.SEASON': 'Season',
  'dashboard.contentType.EPISODE': 'Episode',
  'dashboard.contentType.CHANNEL': 'Channel',
  'dashboard.contentType.SCHEDULE': 'Schedule',

  // Pie Chart Titles
  'dashboard.pie.byPlatform': 'By Platform',
  'dashboard.pie.byContentType': 'By Content Type',
  'dashboard.pie.byGenre': 'By Genre',
  'dashboard.pie.byIngestStatus': 'By Ingest Status',
  'dashboard.pie.arrangement': 'Arrangement Task',
  'dashboard.pie.reviewL1': 'Review L1 Task',
  'dashboard.pie.reviewL2': 'Review L2 Task',
  'dashboard.pie.reviewL3': 'Review L3 Task',

  // Messages
  'dashboard.saveSuccess': 'Save successful',
  'dashboard.saveFailed': 'Save failed',
  'dashboard.resetSuccess': 'Reset successful',
  'dashboard.resetConfirm': 'Are you sure you want to reset to default configuration?',
  'dashboard.loadFailed': 'Failed to load dashboard data',
  'dashboard.loadConfigFailed': 'Failed to load configuration',
  'dashboard.dragSortHint': 'Drag to sort',

  // Assign Task
  'dashboard.assign': 'Assign',
  'dashboard.assignTask': 'Assign Task',
  'dashboard.assignSuccess': 'Task assigned successfully',
  'dashboard.assignFailed': 'Failed to assign task',
  'dashboard.selectUser': 'Select User',
  'dashboard.selectUserRequired': 'Please select a user',
  'dashboard.selectUserPlaceholder': 'Please select a user to assign',
  'dashboard.loadUsersFailed': 'Failed to load user list',

  // Permission Management (To be developed)
  'dashboard.permissionManagement': 'Permission Management (To be developed)',
} as const
