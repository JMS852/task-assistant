# 待办助手 (Task Assistant)

Windows 桌面待办助手 —— 自动监听微信/QQ 消息，AI 识别并提取任务，智能执行。

> 🖥️ Electron + React + Python 混合架构

## ✨ 功能

- **🔍 实时消息监听** — 自动捕获微信/QQ 聊天消息和通知弹窗
- **🧠 AI 任务识别** — 启发式 + 大模型双引擎识别任务意图
- **📋 智能任务提取** — 自动提取标题、优先级、截止时间
- **🚀 智能执行** — 多 AI 并行 + 沙箱验证，支持 L1/L2/L3 三级深度
- **📥 历史扫描** — 回溯 7 天聊天记录，OCR + 剪贴板双通路读取
- **🌐 多语言** — 中文/English 双语界面
- **🔌 多 AI 支持** — DeepSeek / 通义千问 / 豆包 / 混元

## 📋 前置依赖

| 依赖 | 用途 | 安装方式 |
|------|------|----------|
| **Node.js** (>=18) | Electron + React 前端 | `winget install OpenJS.NodeJS.LTS` |
| **Python** (>=3.11) | AI 识别 / 消息监听后端 | `winget install Python.Python.3.12` |
| **Tesseract OCR** (可选) | OCR 文字识别（历史扫描） | `winget install UB-Mannheim.TesseractOCR` |

可选 Python 包（历史扫描增强）：
```bash
pip install easyocr pyperclip pillow pytesseract
```

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/task-assistant.git
cd task-assistant

# 2. 安装 Node.js 依赖
npm install

# 3. 安装 Python 依赖
pip install -r requirements.txt

# 4. 启动开发模式
npm run dev

# 或使用桌面快捷方式（Windows）
# 双击 launch.vbs
```

## ⚙️ 配置 AI 服务

1. 启动应用后，点击 ⚙ 进入设置页面
2. 填入对应 AI 服务的 API Key：
   - **DeepSeek** — [platform.deepseek.com](https://platform.deepseek.com)
   - **通义千问** — [dashscope.aliyun.com](https://dashscope.aliyun.com)
   - **豆包** — [console.volcengine.com](https://console.volcengine.com)
   - **混元** — [console.cloud.tencent.com](https://console.cloud.tencent.com)
3. API Key 仅存储在本地 SQLite 数据库中，不会上传

## 🏗️ 架构

```
task-assistant/
├── electron/            # Electron 主进程
│   ├── main.ts          # 窗口管理 + IPC 处理
│   ├── preload.ts       # contextBridge API
│   ├── services/        # DB, Python 桥接
│   └── api/             # REST API (端口 3001)
├── src/                 # React 渲染进程
│   ├── components/      # UI 组件
│   ├── hooks/           # React hooks + API 调用
│   └── i18n/            # 国际化
├── python/              # Python 后端
│   ├── collector/       # 消息采集 (UIA + Win32)
│   ├── engine/          # 识别 + 提取
│   ├── smart/           # AI 编排 + 沙箱执行
│   └── main.py          # stdin/stdout JSON 事件循环
└── test/                # 测试
```

- **Electron ↔ Python**：通过 `spawn` 子进程 + stdin/stdout JSON 协议通信
- **Electron ↔ Renderer**：通过 IPC（contextBridge）和 REST API（端口 3001）
- **Python ↔ AI**：通过 OpenAI 兼容接口调用各 AI 服务

## 🛠️ 构建

```bash
npm run build    # 构建安装包到 release/
```

## 📄 许可

MIT License — 详见 [LICENSE](LICENSE)
