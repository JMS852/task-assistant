const zh = {
  app: {
    title: '待办助手',
    taskCount: '{count} 个待办',
    settings: '设置',
    emptyTitle: '选择一个任务',
    emptyDesc: '从左侧列表中选择任务查看详情',
    emptyHint: '或使用 AI 助手帮你分析和查询任务',
  },

  chat: {
    title: 'AI 助手',
    placeholder: '问点什么... (Enter 发送)',
    greeting: '你好！我是任务助手，你可以问我任何关于待办事项的问题。\n\n例如："有哪些高优先级的任务"、"张经理派的活"、"今天到期的"、"SSL证书的截止时间是什么"',
    thinking: '思考中...',
    viewTask: '查看任务 →',
    fail: '查询失败',
  },

  briefing: {
    title: '今日简报',
    generating: '正在生成简报...',
    topPriority: '优先处理',
    expiringSoon: '即将过期',
    recentlyDone: '最近完成',
    aiAdvice: 'AI 建议',
    statsPending: '待办',
    statsHigh: '紧急',
    statsToday: '今日到期',
  },

  taskList: {
    title: '待办清单',
    refresh: '刷新',
    searchPlaceholder: '搜索任务或发送者…',
    filterAll: '全部',
    filterHigh: '紧急',
    filterMedium: '普通',
    filterLow: '不急',
    untitled: '(无标题)',
    deadlinePrefix: '📅',
    missingContext: '缺少上下文',
    markComplete: '标记完成',
    noResult: '未找到 "{search}"',
    noTasks: '暂无待办任务',
    noTasksHint: '等待微信/QQ 消息采集…',
    demoBtn: '生成演示数据',
    demoDone: '已生成 {count} 条演示任务',
    filterCompleted: '已完成',
    noCompleted: '暂无已完成任务',
    noCompletedHint: '标记完成的任务会出现在这里',
    clearCompleted: '清空已完成',
    confirmClear: '确定要清空所有已完成任务吗？此操作不可撤销。',
    taskFrom: '来自 {sender}',
    completedCount: '{count} 个已完成',
  },

  taskDetail: {
    untitled: '(无标题)',
    sender: '发送者',
    source: '来源',
    group: '群聊',
    deadline: '截止日期',
    overdue: '已过期 {days} 天',
    remaining: '剩余 {days} 天',
    noDeadline: '无截止日期',
    priority: '优先级',
    aiConfidence: 'AI 置信度',
    description: '📝 任务描述',
    noDescription: '暂无描述',
    contextMissing: '上下文不完整',
    contextMissingHint: '无法获取完整的消息上下文，可能影响 AI 执行效果',
    completeContext: '补全',
    aiAnalyze: 'AI 分析',
    markComplete: '标记完成',
  },

  settings: {
    back: '返回',
    navAI: 'AI 服务',
    navAbout: '关于',
    heading: 'AI 服务配置',
    subtitle: '配置 AI 服务商的 API Key，用于任务识别和智能执行。密钥加密存储在本机，不会上传到任何第三方。',
    saveDone: '✓ 已保存',
    saveBtn: '保存配置',
    showKey: '显示密钥',
    hideKey: '隐藏密钥',
    keyPlaceholder: '输入 {name} API Key…',
    keyPlaceholderHunyuan: '输入 SecretId:SecretKey…',
    usageTitle: '📌 使用说明',
    usage1: '直接在上方输入框中填入 API Key 即可，无需配置系统环境变量',
    usage2: '至少启用并配置一个 AI 服务才能使用智能执行功能',
    usage3: '建议启用 DeepSeek 和通义千问作为基础配置',
    usage4: '密钥保存在本机数据库中，不会上传到任何第三方',
    usage5: '混元需使用 SecretId:SecretKey 格式（用半角冒号分隔）',
    aboutName: '桌面待办助手',
    aboutVersion: 'v1.0.0',
    aboutPath: '数据存储: %APPDATA%\\task-assistant\\',
    language: '语言 / Language',
    langZh: '中文',
    langEn: 'English',
  },

  providers: {
    deepseek: 'DeepSeek',
    qianwen: '通义千问',
    doubao: '豆包',
    hunyuan: '混元',
  },

  addTask: {
    title: '添加待办',
    taskTitle: '任务标题',
    titlePlaceholder: '输入任务标题…',
    description: '描述',
    descPlaceholder: '输入任务详情（可选）…',
    priority: '优先级',
    deadline: '截止日期',
    sender: '创建者',
    senderPlaceholder: '谁交代的任务？（可选）',
    defaultSender: '我',
    cancel: '取消',
    submit: '添加',
  },

  common: {
    priorityHigh: '紧急',
    priorityMedium: '普通',
    priorityLow: '不急',
    statusPending: '待处理',
    statusInProgress: '进行中',
    statusCompleted: '已完成',
    sourceWechat: '微信',
    sourceQQ: 'QQ',
    sourceIconWechat: '💬',
    sourceIconQQ: '🐧',
  },
} as const;

export default zh;

/** Widen literal string/number/boolean types so translations in other languages can differ. */
type WidenLiterals<T> = T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : { [K in keyof T]: WidenLiterals<T[K]> };

export type Translations = WidenLiterals<typeof zh>;
