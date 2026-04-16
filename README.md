<div align="center">

# WeCut

**基于 [EcoPaste](https://github.com/EcoPasteHub/EcoPaste) 二次开发的开源跨平台剪贴板增强工具**


</div>

---

## 项目简介

WeCut 是基于 [EcoPaste](https://github.com/EcoPasteHub/EcoPaste)二次开发的开源跨平台剪贴板管理工具，在保留原有剪贴板管理核心功能的基础上，新增了Wegent AI 集成、截图标注、Dock模式等实用功能。

> 感谢 [EcoPaste](https://github.com/EcoPasteHub/EcoPaste) 项目及其贡献者提供的优秀基础。

---

## ✨ 新增功能（相较于原版 EcoPaste）

### 🤖 Wegent AI 集成
> [Wegent](https://github.com/wecode-ai/wegent)是开源的企业级AI应用平台，提供AI对话、编码、知识库、Agent集成等能力
- **Work Queue**：将内容推送到 Wegent Work Queue，支持设置标题、备注、优先级、来源信息
- 支持为为Wegent配置独立快捷键
- 截图完成后可直接发送到 Wegent

### 📸 截图与标注

- 全局快捷键（默认 `Ctrl/Cmd+Shift+X`）一键截图
- 区域框选，支持多显示器
- 丰富的标注工具：矩形、椭圆、箭头、画笔、文字、马赛克
- 颜色选择器 & 线宽/字号调节
- 撤销操作（`Cmd+Z`）
- **OCR 文字提取**：一键识别截图中的文字
- **钉住截图**：将截图固定在屏幕上方便参考
- 截图保存（PNG / JPG）或复制到剪贴板
- 截图自动保存到剪贴板历史（可配置）

### ⌨️ Dock 模式增强

- 数字键 `1-9` 快速选中对应条目
- 方向键 `←/→` 导航，`Home/End` 跳转首尾
- 任意可打印字符直接触发搜索（支持中文输入法）
- `Enter` 键粘贴，`Esc` 分层退出（失焦 → 清空搜索 → 关闭）

---

## 🚀 原有核心功能

- 🎉 基于 **Tauri v2** 开发，轻量高效，跨平台体验一致
- 💻 支持 **Windows、macOS 和 Linux（x11）**
- ✨ 简洁直观的用户界面，开箱即用
- 📋 支持纯文本、富文本、HTML、图片和文件类型的剪贴板内容
- 🔒 数据本地存储，隐私安全，完全掌控
- 📝 备注功能，轻松分类管理
- ⚙️ 丰富的个性化设置

---

## 🛠️ 技术栈

| 技术 | 说明 |
|------|------|
| [Tauri v2](https://tauri.app/) | 跨平台桌面应用框架 |
| [React 18](https://react.dev/) | 前端 UI 框架 |
| [Ant Design 5](https://ant.design/) | UI 组件库 |
| [Valtio](https://valtio.dev/) | 状态管理 |
| [Kysely](https://kysely.dev/) | 类型安全 SQL 查询构建器 |
| [UnoCSS](https://unocss.dev/) | 原子化 CSS |
| [TypeScript](https://www.typescriptlang.org/) | 类型安全 |

---

## 📦 安装与构建

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/) (stable)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

### 开发运行

```bash
# 克隆仓库
git clone <your-repo-url>
cd wecut

# 安装依赖
pnpm install

# 启动开发服务器
pnpm tauri dev
```

### 构建发布包

```bash
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录，支持 `dmg`、`app`、`nsis`、`deb`、`rpm`、`AppImage` 等格式。

---

## ⚙️ 配置说明

### Wegent AI Chat 配置

在偏好设置 → **Wegent 集成** → AI Chat 中填写：

| 字段 | 说明 |
|------|------|
| Base URL | AI 服务地址（需兼容 OpenAI Responses API） |
| API Key | 鉴权密钥 |
| Model | 模型名称（默认 `default#wegent-chat`） |
| 自定义 Headers | 可选，附加请求头 |

### Wegent Work Queue 配置

在偏好设置 → **Wegent 集成** → Work Queue 中填写：

| 字段 | 说明 |
|------|------|
| Base URL | Wegent 服务地址 |
| API Token | 鉴权 Token |
| Queue Name | 目标队列名称 |

### 截图配置

在偏好设置 → **截图** 中可配置：

- 截图完成后的默认动作（显示菜单 / 直接复制 / 直接保存）
- 保存格式（PNG / JPG）
- 是否自动保存到剪贴板历史

---

## 🗂️ 项目结构

```
wecut/
├── src/                    # 前端源码（React + TypeScript）
│   ├── pages/
│   │   ├── Main/           # 主窗口（标准模式 & Dock 模式）
│   │   ├── Screenshot/     # 截图与标注模块
│   │   ├── Preference/     # 偏好设置
│   │   └── SendModal/      # Wegent 发送弹窗
│   ├── stores/             # 全局状态（Valtio）
│   ├── hooks/              # 自定义 Hooks
│   └── components/         # 公共组件
├── src-tauri/              # Rust 后端（Tauri）
│   ├── src/                # Rust 源码
│   └── tauri.conf.json     # Tauri 配置
└── package.json
```

---

## 📄 开源协议

本项目基于 [EcoPaste](https://github.com/EcoPasteHub/EcoPaste) 二次开发，遵循原项目的开源协议( Apache License-2.0)。详见 [LICENSE](./LICENSE)。

---

## 🙏 致谢

- [EcoPaste](https://github.com/EcoPasteHub/EcoPaste) — 本项目的基础，感谢所有贡献者
- [Tauri](https://tauri.app/) — 优秀的跨平台桌面应用框架
- [Ant Design](https://ant.design/) — 完善的 React UI 组件库
