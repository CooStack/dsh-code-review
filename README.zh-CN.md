# dsh-code-review

[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4f7cff)](https://github.com/topics/dsh-plugin)
[![License: GPL-3.0-only](https://img.shields.io/github/license/CooStack/dsh-code-review)](LICENSE)

[English](README.md) | [简体中文](README.zh-CN.md)

面向 DeepSeek Harness Web 的社区插件，用于逐回合查看代码变更。它提供类似 Codex 的变更摘要、可调整大小的变更侧栏、工作区相对路径文件树、语法高亮，以及适用于共享工作区的保护性撤销能力。

这是独立的社区插件，不是 DeepSeek 官方产品，也不代表 DeepSeek 的认可或背书。

## 功能

- **逐回合审查**：查看新增和删除行数，从会话中打开已完成回合，并在不离开聊天页面的情况下切换变更文件。
- **代码与文件树并排**：左侧查看选中文件的统一 diff，右侧查看可搜索的工作区相对路径文件树。内部分隔线可以单独拖动，宽度会持久化。
- **更大的实用侧栏**：变更侧栏可以超过宿主原本的 520px 限制进行调整。窄窗口需要空间时会自动收起左侧导航，关闭审查后恢复。
- **聚合父子会话变更**：普通子代理和 workflow 子代理记录的变更会投影到父会话审查中。所有代理立即写入同一个工作区，不引入人为的合并步骤。
- **语法感知 diff**：插件使用 Shiki 先对完整的旧文件和新文件进行 token 化，再映射回 diff 行，因此多行注释和字符串可以保留正确的语法状态。
- **亮色和暗色配色**：可以分别配置亮色和暗色主题下的语法、diff、行号栏和省略行颜色。
- **不会误应用的字体选择**：输入字体名称时，只会把最匹配的候选项移动到菜单顶部。只有点击候选项或按 Enter 后才会应用字体。系统字体可以通过 Chromium Local Font Access 按需加载。
- **保护性撤销**：撤销使用记录中的修改前后快照、解析后的沙箱策略、文件系统版本保护和精确的同文件内容链。对于有歧义、已过期或仍由代理使用的变更，插件会拒绝覆盖。
- **原生 DSH 集成**：使用 DSH 的会话节点、会话工具栏 slot、设置插件卡片、主题事件和 `Menu` 原语，不替换宿主 Shell。

## 安装

仓库已经包含预构建的客户端 bundle，可以直接从 GitHub 源码安装：

```bash
dsh plugin --profile web add github:CooStack/dsh-code-review#main
```

安装后重启 DSH Web profile，使 Host 和 Client 插件图重新构建。

开发本地 checkout 时，可以使用：

```bash
git clone https://github.com/CooStack/dsh-code-review.git
dsh plugin --profile web add file:./dsh-code-review
```

profile 命令会把包转交给该 profile 使用的包管理器。卸载命令：

```bash
dsh plugin --profile web remove dsh-code-review
```

## 使用

重启 DSH Web 后，带有已记录变更的完成回合会在会话标题工具区显示 `变更`。打开它即可查看选中回合、搜索文件树、检查统一 diff，或在工作区中打开源文件。

会话中的变更摘要节点也会列出变更文件。点击文件后，会在变更侧栏中打开对应的回合和路径。

## 设置

打开：

```text
设置 -> 插件 -> 插件配置 -> dsh-code-review
```

插件卡片默认折叠，展开后包含两组设置：

- **字体**：加载系统字体，输入内容重新排序候选项，然后点击候选项或按 Enter 应用。输入和清空草稿都不会改变当前已应用字体。
- **代码高亮**：分别编辑亮色和暗色配色，恢复当前方案或全部恢复默认，并在返回 diff 前预览颜色效果。

插件只会把代码字体应用到自己的 diff 渲染器。偏好设置会保存在插件自己的 DSH 浏览器存储命名空间中。

## 撤销安全规则

撤销功能遵循保守策略：

- 父代理或任一拥有该变更的子代理运行时，不会执行撤销。
- 每个文件写入前都会与记录中的最终内容进行预检。
- 已存在文件使用文件系统 provider 的版本保护。
- 同文件并发写入通过精确的 `before -> after` 内容链排序，而不是依赖回调时间戳。
- 内容链断裂、同一基线存在歧义写入、文件被外部修改或快照过期时，返回冲突且不会覆盖更新内容。
- 安装插件前产生的历史结果，如果包含持久化 diff 元数据，仍可以展示；但缺少完整文件快照时不能撤销。

可撤销快照保存在：

```text
${DSH_HOME:-~/.dsh}/code-review/
```

## 开发

```bash
npm install
npm test
npm run build
```

`npm test` 覆盖 Host 侧变更聚合与撤销安全、Client 注册和布局行为，以及详细的高亮 token 类别。`npm run build` 会重新生成 DSH Web Client 使用的 `lib/client.bundle.js`。

## 范围与隐私

插件不添加遥测客户端、凭据流程或后台网络服务。Host 侧通过 DSH 服务记录审查元数据和快照；Client 侧使用当前 DSH 主题，并在用户请求时调用浏览器的本地字体枚举 API。

## 许可证

Copyright (C) 2026 CooStack。

本项目使用 [GNU General Public License v3.0](LICENSE)（`GPL-3.0-only`）授权。
