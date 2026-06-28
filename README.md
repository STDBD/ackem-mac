# Ackem

**Ackem v1.0.0** — A local-first AI companion for Windows.

> **Source code**: Repository root `Ackem-v0.0.0/` (pushed to [JasonLiu0826/Ackem](https://github.com/JasonLiu0826/Ackem))  
> **Windows build**: `dist/release/Ackem-1.0.0-win-x64/`  
> Path reference: [docs/CODEBASE-PATHS.md](./docs/CODEBASE-PATHS.md)

[中文文档](./README.zh.md) · [中文用户文档](./docs/privacy-and-data.zh.md)

---

## What is Ackem?

Ackem is **not** a web chat box. It's a **local-first** Windows desktop application: you bring your own LLM API key (or run a local inference server), and Ackem handles the rest — **conversation, memory, emotion & relationship state, desktop pet companionship** — all while keeping your data on **your own hard drive**.

### What you can do with it

- **Chat like you would with a person** — supports any OpenAI-compatible API (cloud or local Ollama / LM Studio). Configure it in **Settings → Model & API**.
- **It remembers what you talk about** — conversations are written into structured memory. Search, browse timelines, explore the knowledge graph, or **import** your own `.txt` / `.md` files as long-term memory.
- **Continuous companionship** — Ackem maintains trust, mood, relationship stage, and more. Switch between personality presets. Your companion writes its own **diary** and may reach out to chat at the right moment.
- **Not just a window** — minimize to the **system tray**, or open the **desktop pet** window that sits on your screen (currently a geometric orb with Live2D preview).
- **Optional capabilities** — **voice** recognition & TTS, **WeChat** bridge (reply from your phone while the brain runs on your PC), and an **Extension Center** with built-in tools and reminders. **Plan · OpenForU** is an experimental workspace for creating your own extensions.
- **Game mode** — experimental. Play supported games (e.g., Minecraft) alongside your companion, depending on enabled extensions.

### Where your data lives

In portable mode (default for the green release), all personal data goes into the **`data/`** folder next to `Ackem.exe`: chat history, memories, diaries, API keys in settings — **none of it ships with the installer**, and **there is no default telemetry uploading to an Ackem server**. The official zip contains only the application and model resources; an empty `data/` directory is created locally on first launch.

For backup, migration, or full deletion, see [docs/memory-format.md](./docs/memory-format.md) and [docs/distribution-windows.md](./docs/distribution-windows.md).

### What you need

1. A Windows 10/11 64-bit PC  
2. An LLM API key (or a local inference server address)  
3. Extract the green release and wait ~10–30 seconds on first launch (the local embedding model for memory retrieval auto-extracts)

No Node.js or coding skills required.

### For developers

See the **「Developers」** section below, the [architecture docs](#six-system-architecture) and the [document index](#documentation).

---

## Quick Start (End Users)

For: **downloaded the official Release**, no Node.js needed.

### Privacy (please read)

| The official release **does not include** | After first run, **exists only on your machine** |
|-------------------------------------------|--------------------------------------------------|
| Your memories, chats, or imported files | `data/` (portable mode, next to exe) |
| API keys or model credentials | Settings, stored in local userData |
| Any maintainer or third-party private data | What you configure and write yourself |

See [docs/distribution-windows.md](./docs/distribution-windows.md) for details.

### Steps

1. **Download** — Get `Ackem-v1.0.0-win-x64.zip` from [GitHub Releases](https://github.com/JasonLiu0826/Ackem/releases)
2. **Extract** — Unzip fully to an SSD directory (do not run from inside the zip)
3. **Launch** — Double-click `Ackem.exe` or `启动 Ackem.bat`. First launch takes ~10–30 seconds
4. **Configure model** — Enter Base URL, API Key (required for cloud), and Model ID in **Settings**
5. **First chat** — Send a message to confirm the reply. Optionally import `.txt`/`.md` memories

---

## Developers

> Ackem is an **Electron app**. The renderer process depends on `window.ackem` (preload IPC).  
> Always use **`npm run dev`** to start Electron; do not open the Vite address in a browser alone.

### Prerequisites

- Windows 10/11
- Node.js **20+**
- `npm ci`

### Daily development

```bash
cd Ackem-v0.0.0
npm install
npm run dev
```

During development, `data/` lives in the working directory, independent from the green release's `data/` next to `Ackem.exe`.

### Build & Package

```bash
npm run build          # Compile → out/
npm run dist:green     # Green release → dist/release/
npm run dist:setup     # Optional NSIS installer
```

### Testing

```bash
npm run typecheck
npm test
npm run test:renderer
```

---

## Seven-System Architecture

| # | System | Description | Docs |
|---|--------|-------------|------|
| ① | Overall | Electron shell, orchestrator, conversation lifecycle | [00-overall-system.md](./docs/developer/architecture/00-overall-system.md) |
| ② | Brain | L0 understanding + L4 memory retrieval & decay | [01-brain-system.md](./docs/developer/architecture/01-brain-system.md) |
| ③ | Heart | L1 relationship + L2 emotion + L3 expression | [02-heart-system.md](./docs/developer/architecture/02-heart-system.md) |
| ④ | Mouth | Prompt assembly + LLM calling | [03-mouth-system.md](./docs/developer/architecture/03-mouth-system.md) |
| ⑤ | Neural | Embedding / vector retrieval | [04-neural-system.md](./docs/developer/architecture/04-neural-system.md) |
| ⑥ | Extension | Skill/Plugin/Dispatch/OpenForU | [05-extension-system.md](./docs/developer/architecture/05-extension-system.md) |
| ⑦ | Time | Temporal awareness, circadian rhythm, reunion, reflection | [06-time-system.md](./docs/developer/architecture/06-time-system.md) |
| — | Data Layer | SQLite schema, Repository pattern, migrations | [07-data-layer.md](./docs/developer/architecture/07-data-layer.md) |
| — | IPC API | window.ackem.\* preload bridge, push events | [08-ipc-api.md](./docs/developer/architecture/08-ipc-api.md) |

Index: [docs/developer/architecture/README.md](./docs/developer/architecture/README.md)

---

## Documentation

| Purpose | EN | 中文 |
|---------|----|------|
| Repo paths & build artifacts | [docs/CODEBASE-PATHS.md](./docs/CODEBASE-PATHS.md) | — |
| Open-source doc map | [docs/OPEN-SOURCE-DOC-MAP.md](./docs/OPEN-SOURCE-DOC-MAP.md) | — |
| Extension developer protocol | [docs/developer/DEVELOPER-EXTENSION-PROTOCOL.md](./docs/developer/DEVELOPER-EXTENSION-PROTOCOL.md) | — |
| Developer setup guide | [docs/developer/dev-setup.md](./docs/developer/dev-setup.md) | — |
| Data directory format | [docs/memory-format.md](./docs/memory-format.md) | [docs/memory-format.zh.md](./docs/memory-format.zh.md) |
| AI context & retrieval policy | [docs/ai-context-and-retrieval-policy.md](./docs/ai-context-and-retrieval-policy.md) | [docs/ai-context-and-retrieval-policy.zh.md](./docs/ai-context-and-retrieval-policy.zh.md) |
| Privacy & data handling | [docs/privacy-and-data.md](./docs/privacy-and-data.md) | [docs/privacy-and-data.zh.md](./docs/privacy-and-data.zh.md) |
| Local models setup | [docs/local-models-windows.md](./docs/local-models-windows.md) | [docs/local-models-windows.zh.md](./docs/local-models-windows.zh.md) |
| Adult mode & safety policy | [docs/adult-and-safety-policy.md](./docs/adult-and-safety-policy.md) | [docs/adult-and-safety-policy.zh.md](./docs/adult-and-safety-policy.zh.md) |
| Perception capabilities | [docs/perception-layer.md](./docs/perception-layer.md) | [docs/perception-layer.zh.md](./docs/perception-layer.zh.md) |
| Sensitive capabilities | [docs/sensitive-capabilities.md](./docs/sensitive-capabilities.md) | [docs/sensitive-capabilities.zh.md](./docs/sensitive-capabilities.zh.md) |
| Windows distribution | [docs/distribution-windows.md](./docs/distribution-windows.md) | [docs/distribution-windows.zh.md](./docs/distribution-windows.zh.md) |
| Indexing & scale | [docs/indexing-and-scale.md](./docs/indexing-and-scale.md) | — |
| Security policy | [SECURITY.md](./SECURITY.md) | [SECURITY.zh.md](./SECURITY.zh.md) |
| Contributing guide | [CONTRIBUTING.md](./CONTRIBUTING.md) | [CONTRIBUTING.zh.md](./CONTRIBUTING.zh.md) |
| Code of Conduct | [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | [CODE_OF_CONDUCT.zh.md](./CODE_OF_CONDUCT.zh.md) |

---

## License

This project is open-sourced under the [AGPL-3.0](./LICENSE) license.

| Use case | Allowed |
|----------|---------|
| Personal learning & research | ✅ Yes |
| Open-source project integration (must remain AGPL-3.0) | ✅ Yes |
| Academic research & citation | ✅ Yes |
| Closed-source commercial product | ❌ Commercial license required |
| SaaS service (source code not provided to users) | ❌ Commercial license required |
| Enterprise private deployment (not open-sourced) | ❌ Commercial license required |
| Closed-source API usage (no modification of source) | ⚠️ Gray area, consult us |

### Commercial Licensing

For commercial use, contact: **jasonliu_lyf_2005@qq.com**

### Contributor Agreement

By submitting a contribution to this project, you agree to the [Contributor License Agreement (CLA)](./CLA.md).

Copyright (C) 2026 Jason Liu (JasonLiu0826)

---

*The open-source edition focuses on local `.txt`/`.md` memory and auditable retrieval. For closed-source commercial deployment or SaaS scenarios, see the commercial licensing terms in [LICENSE](./LICENSE).*
