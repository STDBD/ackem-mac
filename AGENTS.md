# AGENTS.md

Electron 33 + React 18 + electron-vite 桌面应用。本地优先 AI 伴侣，支持 Windows x64 和 macOS arm64。

## 构建命令

```bash
npm install                # postinstall 自动跑 electron-builder install-app-deps 重建原生模块
npm run dev                # 开发（Windows）
npm run dev:mac            # 开发（macOS）
npm run build              # 编译 → out/（Windows 专用 set NODE_OPTIONS 语法）
npm run build:mac          # 编译 → out/（macOS POSIX 语法）
npm run dist:mac           # build:mac + electron-builder --mac --arm64 → dist/*.dmg
npm run dist:green         # Windows 绿色版构建
npm run dist:setup         # Windows NSIS 安装包
```

- Windows 脚本用 `set NODE_OPTIONS=...`（cmd 语法），macOS 脚本用 `NODE_OPTIONS=...`（POSIX）。跨平台时选对脚本。
- `postinstall` 会重建 `better-sqlite3` 和 `onnxruntime-node` 的原生 `.node` 到当前架构。换架构后必须重跑 `npm install`。
- `.npmrc` 配了 electron 镜像（中国 CDN）。国外环境可注释掉。

## 类型检查

```bash
npm run typecheck          # 只查 renderer（tsconfig.web.json）
npx tsc --noEmit -p tsconfig.node.json   # 查 main + preload + shared（不在 npm scripts 里）
```

- **`tsconfig.node.json` 排除了 `src/main/extensions/`** —— 扩展子系统的 TS 文件不参与类型检查，但会被 electron-vite 打包。
- `electron-vite build` 用 esbuild 转译，**不做类型检查**——typecheck 有错不影响 build。
- 项目有 ~62 个预存类型错误（主要在 extensions 子系统），不是你引入的。

## 项目结构

```
src/
  main/          Electron 主进程（index.ts 入口）
    platform/    平台抽象层——所有 OS 判断的唯一入口（isMac/isWin/capabilities）
    canon/       Ackem 身份常量 + 初识约束 + 特殊日注入
    engine/      对话编排核心（orchestrator.ts 是中枢）
    memory/      事实提取、SQLite 存储、知识图谱、文档导入
    extensions/  插件系统（typecheck 排除；运行时动态 import）
    i18n/        zh.ts + en.ts 双语资源
  preload/       3 个 preload 脚本（index/surface/updater），输出 CJS
  renderer/      React 前端，4 个 HTML 入口（index/startup/pet/updater）
  shared/        主进程与渲染进程共享的类型和工具
```

- **MC bot 依赖**（mineflayer 等）在 `electron.vite.config.ts` 的 `external` 里，不参与 Vite 打包，运行时动态 import。
- 渲染进程用 `@renderer` 路径别名指向 `src/renderer/src/`。
- 主进程没有路径别名，全用相对路径。

## 平台抽象

所有 OS 判断走 `src/main/platform/`：

- `platform.ts`：`isMac`/`isWin`/`isLinux`/`isArm64` —— 原始检测
- `capabilities.ts`：声明式能力开关（`desktopAgent`/`perception`/`updater`/`releaseShortcuts`）—— 子系统守卫用 `has('xxx')` 或 `capabilities.xxx`，不要直接写 `process.platform === '...'`

数据目录：macOS → `app.getPath('userData')`（`~/Library/Application Support/Ackem/`）；Windows → `%LOCALAPPDATA%\Ackem` 或便携 `{exe}/data`。见 `paths.ts:resolveDataRoot`。

## 原生模块

`better-sqlite3`（SQLite）和 `onnxruntime-node`（本地 embedding）是原生 `.node` 模块：

- `electron-builder.yml` 的 `asarUnpack` 必须包含这两个——否则打包后 `.node` 在 asar 内无法加载。
- onnxruntime-node 用 NAPI 预构建二进制，不需要 electron-rebuild（ABI 稳定）。
- better-sqlite3 需要 electron-rebuild（绑 Electron ABI），`install-app-deps` 自动处理。
- macOS 打包后 `.app` 未签名（`identity: null`），用户首次需右键→打开。

## LLM 请求

所有 LLM 请求（流式 + 非流式，OpenAI + Anthropic 路径）走 `src/main/llmRetry.ts:fetchWithRetry`：

- 20 次重试：前 5 次固定 3s，第 6 次起指数退避（3×2ⁿ，封顶 30s）
- 重试条件：429、5xx、超时、网络错误
- 外部 `AbortSignal` 可中断重试延迟（`abortableDelay`）
- 流式请求只在连接建立阶段重试，流开始后不重试

## 测试

```bash
npx vitest run                    # 跑全部 4 个测试文件
npx vitest run src/path/to/test   # 跑单个文件
```

- 没有 `vitest.config.ts`，用默认配置。
- 测试文件在 `src/main/extensions/` 和 `src/main/companion/` 下（`*.test.ts`）。

## Canon 身份系统

`src/main/canon/ackemCanon.ts` 定义 Ackem 的不可覆盖身份：

- `ACKEM_CANON = { name: 'Ackem', birthDate: '2026-06-20' }`
- `buildAckemCanonBlock()` 每轮注入 psycheBlock（名字、生日、实例隔离、用户优先）
- 初识约束（`shouldInjectStrangerGuard`）：轮次 <20 且相识 <3 天时禁止编造共同历史
- 特殊日注入：Ackem 生日、相识纪念日强制写入 psyche

## 注意事项

- **不要升级 Electron**（当前 33.4.11）——会导致 better-sqlite3 ABI 变化 + mineflayer/electron-vite 兼容性风险。
- `src/main/extensions/` 的代码不在 typecheck 范围内——改了那里的代码不会报类型错，但会影响运行时。
- `buildAckemCanonBlock` 的 `relationshipStage` 参数当前未使用，保留是为不破坏调用方签名。
- Windows 专属功能（desktop-agent PowerShell、感知层 SMTC/Focus、Go launcher 更新器）在 macOS 上通过 `capabilities` 守卫优雅降级。
