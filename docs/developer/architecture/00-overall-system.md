# Overall System

> **Language:** English · [中文](./00-overall-system.zh.md)

> **Scope:** Application shell + orchestration + data layer + process boundaries  
> **Core question:** How is Ackem’s code organized? What does a message go through from input to reply?

---

## 1. Design Goals

| Goal | Implementation |
|------|----------------|
| **Local-first** | All data lives on the user’s disk; no mandatory cloud sync |
| **BYOK** | Users supply their own LLM API keys; Ackem does not bundle any model |
| **Offline-capable** | Chat and memory retrieval still work after Embedding degrades |
| **Auditable privacy** | Data stored as plain JSON/Markdown; users can read and delete it |
| **Extensible** | Extensions decouple from the engine via protocol boundaries without breaking core |

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Desktop shell | **Electron 33** | Native Windows experience; direct filesystem and SQLite access |
| Main process | **Node.js 20+ / TypeScript** | All engine logic, IPC, DB, and LLM calls |
| Renderer process | **React 18 + TypeScript** | UI layer; communicates with main process via IPC bridge |
| Build | **electron-vite** | Unified build for main, renderer, and preload |
| Styling | **Tailwind CSS** | Fast UI development |
| Persistence | **better-sqlite3** | Synchronous SQLite; zero config; high performance |
| Local ML | **onnxruntime-node** | Optional dependency for Embedding inference |
| Packaging | **electron-builder** | NSIS installer + portable directory build |

---

## 3. Process Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Renderer Process (React)                     │
│                                                                   │
│  ┌───────────┐ ┌──────────────┐ ┌────────────────┐              │
│  │ ChatPage  │ │ SettingsPage │ │ ExtensionCenter │  ...         │
│  └─────┬─────┘ └──────┬───────┘ └───────┬────────┘              │
│        │              │                  │                       │
│  ┌─────┴──────────────┴──────────────────┴──────────────────┐   │
│  │                  window.ackem.* API                       │   │
│  │  chat.send() / memory.search() / settings.get() / ...    │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │ preload IPC bridge                  │
├────────────────────────────┼────────────────────────────────────┤
│                     Main Process (Node.js)                       │
│                            │                                     │
│  ┌─────────────────────────┴────────────────────────────────┐   │
│  │                    index.ts                                │   │
│  │  Window creation · registerIpc() · extension boot · data init │
│  └────┬──────────┬──────────┬──────────┬─────────────────────┘   │
│       │          │          │          │                         │
│  ┌────┴───┐ ┌───┴────┐ ┌──┴─────┐ ┌──┴──────────────┐          │
│  │ ipc/   │ │engine/ │ │memory/ │ │ extensions/     │          │
│  │ chat   │ │orch.   │ │ memory │ │ coordinator/    │          │
│  │settings│ │brain+  │ │retrieve│ │ Dispatch        │          │
│  │ memory │ │ heart  │ │ ingest │ │ Skill/Plugin    │          │
│  └────────┘ └────────┘ └────────┘ │ OpenForU        │          │
│       │          │          │     └─────────────────┘          │
│  ┌────┴───┐ ┌───┴────┐ ┌──┴─────┐ ┌──┴──────────────┐          │
│  │ db/    │ │prompt/ │ │context/│ │ embedding/      │          │
│  │ SQLite │ │ mouth  │ │runtime │ │ readiness mgmt  │          │
│  │ repos  │ │templates│ │context │ │                 │          │
│  └────────┘ └────────┘ └────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Process Boundary Rules

| Rule | Reason |
|------|--------|
| Renderer **must not** read `data/` or call LLM directly | Security: IPC layer enforces permissions and validation |
| Renderer calls IPC via `window.ackem.*` | Architecture: preload exposes a limited API |
| Extensions **must not** `import` `engine/` or `memory/` internals | Decoupling: communication only through interfaces in `protocols.ts` |
| Development must start Electron with `npm run dev` | Renderer depends on preload-injected `window.ackem` |

### Why Electron Instead of Alternatives?

Ackem needs **direct filesystem access** (read/write `data/`), **synchronous SQLite writes**, **system tray**, and **subprocess management** (voice services). Electron’s main-process Node.js environment provides these, and the React ecosystem makes UI development efficient. The trade-off is a larger installer (~200MB base runtime), which is acceptable for a desktop app.

---

## 4. Startup Sequence

```
electron-vite dev / Ackem.exe
    │
    ▼
① index.ts entry
    │  ├─ app.whenReady()
    │  ├─ Create BrowserWindow (load renderer)
    │  ├─ registerIpc() — register all IPC handlers
    │  │   ├─ chat.ts      — message send and streaming receive
    │  │   ├─ settings.ts  — read/write ackem-app-settings.json
    │  │   ├─ memory.ts    — memory search/import/export
    │  │   ├─ extensions/  — extension management
    │  │   └─ companion/   — companion settings
    │  ├─ layout.ensureDataLayout() — initialize data/ directory structure
    │  └─ extensions/coordinator.boot() — load extensions
    │
    ▼
② Background async init (non-blocking UI)
    │  ├─ embedding/index.ts → warmupEmbeddingAtStartup()
    │  │   ├─ Check if onnxProvider is available
    │  │   ├─ Extract bundled models bootstrapBundledModels()
    │  │   └─ Set embeddingReadiness state
    │  ├─ memory/retriever warmup (load index snapshot)
    │  └─ companion proactive message scheduler starts
    │
    ▼
③ UI ready; waiting for user input
```

---

## 5. Full Journey of One Conversation Turn

This is Ackem’s core data flow. Each step maps to one or more source files:

```
Step 1: User input
───────────────
User types and sends → renderer ChatPage
  → store.sendMessage() → window.ackem.chat.send(text)
  → preload → ipcRenderer.invoke('chat:send')
  → main process: ipc/chat.ts handler

Step 2: Dispatch routing
───────────────
ipc/chat.ts → extensions/dispatch/router.ts
  Decide whether the user message triggers extension dispatch:
    plan / ask_plan     → OpenForU workspace creation
    auto_invoke         → Skill.execute (e.g. web-search)
    invoke_surface      → Plugin UI window opens
    open_surface        → Open Surface
    chat                → Enter normal conversation flow

Step 3: Pre-LLM orchestration
───────────────
orchestrator.ts → runPreLlmTurn()
  Execute in strict order:
  [L0]   interpretInput()            → Event type + hint
  [L0.5] interpretInputWithEmbedding → Semantic fallback (optional)
         detectDndIntent()           → Do-not-disturb mode
         detectMemoryIntent()        → Explicit memory operations
         detectUserVerbosity()       → User verbosity detection
  [L1]   updateRelationship()        → Trust/stage/mood
  [L1]   augmentL1FromMemory()       → Memory-augmented relationship input
  [L2]   emotionStep()               → aff/sec/aro/dom propagation
  [L3]   evaluateEmergence()         → Long-chat emergence detection
  [L3]   buildPsycheBlock()          → Psyche block + expression hints
  [L4]   retriever.retrieve()        → Multi-path recall → tierBBlock
         temporalAwareness/          → Time/special-day signals
         strategy/injectionPolicy    → Slot competition decisions
         strategy/topicSelector      → Topic selection
         activeRecall                → Active recall

Step 4: Context assembly
───────────────
context.ts → assembleChatContext()
  Merge all blocks into system prompt + messages array:
    Tier A:   Companion snapshot (self.md + state.md)
    Canon:    Ackem persona, stranger guard
    psyche:   Emotion/relationship psyche block [Heart system output]
    Tier B:   Retrieved memory snippets [Brain system output]
    Extension injection: extension contextInjection [Extension system output]
    Time:     Time-of-day / special-day hints
    System:   Personality + fusion + guardrails + capability list
    Messages: Recent conversation history

Step 5: LLM call
───────────────
ipc/chat.ts → OpenAI-compatible HTTP/SSE client
  Stream tokens back → preload → renderer store → UI typewriter effect

Step 6: Post-LLM
───────────────
orchestrator.runPostLlm() + MemoryIngestPipeline.afterTurnAsync()
  Write path:
    Lightweight extraction (sync): emotion context, rule facts, time anchors
    LLM extraction (async): fact extraction, episode extraction, triple extraction
    State persistence: FullState → SQLite + companion files
    Extension callback: afterAssistantMessage hook

Step 7: Proactive behavior check
───────────────
companion module checks whether to proactively initiate a message
  Timer + event driven; rate limited by proactiveGate
```

---

## 6. Main-Process Layered Architecture (Bottom to Top)

| Layer | Responsibility | Key paths | Dependencies |
|-------|----------------|-----------|--------------|
| **Protocol boundary** | Extension read-only snapshots, event callbacks | `extensions/protocols.ts` | None |
| **Core engine** | Brain + Heart orchestration | `engine/orchestrator.ts` | `types.ts`, `ackemParams.ts` |
| **Memory** | Facts, episodes, retrieval, ingestion | `memory/` | `engine/types.ts`, `db/` |
| **Runtime awareness** | Time of day, foreground, habits | `context/`, `temporalAwareness/` | `engine/types.ts` |
| **Extensions** | Skill/Plugin/Dispatch/OpenForU | `extensions/` | `protocols.ts`, `snapshot.ts` |
| **Application shell** | Window, IPC, settings, logging | `index.ts`, `ipc/`, `settings.ts` | All lower layers |

---

## 7. `src/main/` Directory Map

```
src/main/
├── index.ts                  # App entry, window creation, IPC registration
├── settings.ts               # Settings read/write (ackem-app-settings.json)
├── paths.ts                  # Path utilities
├── layout.ts                 # data/ directory structure initialization
├── personalityPresets.ts     # 29 personality presets (TISOR five dimensions)
├── logger.ts                 # Logging utilities
│
├── ipc/                      # Renderer API implementation
│   ├── chat.ts               #   Message send/streaming receive IPC
│   ├── settings.ts           #   Settings read/write
│   ├── memory.ts             #   Memory search/import/export
│   ├── companion.ts          #   Companion/desktop pet control
│   ├── extensions/           #   Extension management
│   └── ...                   #   Other IPC handlers
│
├── engine/                   # Brain + Heart system core
│   ├── orchestrator.ts       #   Pre-LLM full pipeline orchestration
│   ├── interpreter.ts        #   L0 event interpretation (keyword rules)
│   ├── relationship.ts       #   L1 relationship FSM + trust
│   ├── emotion.ts            #   L2 four-dimensional emotion model
│   ├── psyche.ts             #   L3 psyche block assembly
│   ├── emotionalEmergence.ts #   Long-chat emergence
│   ├── desire.ts             #   Desire/motivation stack
│   ├── rhythmEngine.ts       #   Reply rhythm decisions
│   ├── reunion.ts            #   Offline reunion
│   ├── mirror.ts             #   User emotion mirroring
│   ├── user-profiler.ts      #   User profile inference
│   ├── user-dimension-inferrer.ts # Six-dimensional profile
│   ├── tracer.ts             #   Per-turn trace debugging
│   ├── state-persistence.ts  #   State persistence
│   ├── ackemParams.ts        #   All parameter constants (single source)
│   ├── types.ts              #   Event, FullState, and other core types
│   ├── temporalAwareness/    #   Temporal awareness
│   └── strategy/             #   Strategy layer (topic selection/injection slots)
│
├── memory/                   # L4 memory system
│   ├── factStore.ts          #   Fact CRUD
│   ├── retriever.ts          #   Multi-path retrieval → tierBBlock
│   ├── ingest.ts             #   Memory ingestion pipeline
│   ├── factExtractor.ts      #   LLM fact extraction
│   ├── episodeExtractor.ts   #   Episode extraction
│   ├── consolidator.ts       #   Merge and deduplicate
│   ├── vectorStore.ts        #   Vector index
│   ├── knowledgeGraph.ts     #   Knowledge graph
│   ├── associationColdStart.ts # Association cold start
│   ├── documentImport/       #   Document import
│   └── embedding/            #   Neural system providers live here
│
├── prompt/                   # Mouth system
│   ├── main-chat.ts          #   Main chat system prompt
│   ├── personality.ts / .en.ts  # Personality preset copy
│   ├── emotion-fusion.ts     #   Emotion fusion block
│   ├── adult-mode.ts         #   Adult mode prompt
│   ├── memory-*.ts           #   Memory extraction/merge prompts
│   ├── diary.ts              #   Diary generation
│   ├── openforu-*.ts         #   OpenForU-specific prompts
│   └── index.ts              #   Unified exports
│
├── context.ts                # Runtime context assembly
│
├── extensions/               # Extension system
│   ├── coordinator.ts        #   Master coordinator
│   ├── protocols.ts          #   Protocol type definitions
│   ├── snapshot.ts           #   EngineSnapshot construction
│   ├── dispatch/             #   Dispatch routing
│   ├── skills/               #   Skill registration and builtins
│   ├── plugins/              #   Plugin registration and builtins
│   ├── openforu/             #   User extensions (sandbox + permissions)
│   ├── ecosystem/            #   Community package format (currently disabled)
│   ├── gamemode/             #   Game mode
│   └── policy/               #   Proactive/intensity policy
│
├── canon/                    # Ackem core persona
│   └── ackemCanon.ts         #   Immutable persona
│
├── companion/                # Companion mode
│   ├── proactiveScheduler.ts #   Proactive message scheduling
│   └── harassmentGuard.ts    #   Harassment detection
│
├── db/                       # SQLite layer
│   ├── database.ts           #   Database connection
│   ├── schema.ts             #   Schema definitions
│   ├── repos/                #   Repository pattern
│   └── paths.ts              #   Database paths
│
├── embedding/                # Global readiness management
│   └── embeddingReadiness.ts
│
├── i18n/                     # Internationalization
│   ├── zh.ts                 #   Chinese
│   └── en.ts                 #   English
│
├── channels/                 # External channels
│   └── weixin/               #   WeChat bridge
│
├── desktop-agent/            # Experimental: desktop agent
│
├── paperCard/                # Cards/visualization
├── planDocument/             # OpenForU documents
└── taskFrame/                # Task framework
```

---

## 8. Data Storage Design

### Why SQLite + Files?

Ackem uses two storage approaches, each for what it does best:

| Storage | Contents | Rationale |
|---------|----------|-----------|
| **SQLite** (`ackem.db`) | Structured state (relationship/emotion/settings), extension registry, FTS index | Transactional writes; efficient queries |
| **JSON files** (`facts.v2.json`) | Memory facts, knowledge graph | Human-readable; Git-diffable; directly backup-able |
| **Markdown files** (`*.md`) | Diaries, companion state, imported documents | Users can read and edit directly |
| **Derived indexes** (`_derived/`) | Vector indexes, caches | Can be deleted and rebuilt without losing core data |

### `data/` Directory Structure

```
data/
├── ackem.db              # SQLite database
├── memory/
│   ├── facts.v2.json     # Structured memory facts
│   └── archive/          # Human-readable memory archive
├── companion/
│   ├── self.md           # Companion first-person state
│   ├── state.md          # Companion snapshot
│   └── chat-history-*.json
├── diary/*.md            # Diaries
├── imports/              # User-imported files
├── openforu/             # User extensions
├── _derived/             # Rebuildable derived indexes
├── models/               # Embedding model cache
└── logs/                 # Runtime logs
```

---

## 9. Error Handling and Resilience Patterns

| Scenario | Behavior |
|----------|----------|
| LLM API unavailable | Chat returns an error message; conversation context is preserved |
| Embedding model load failure | Degrades to TF-IDF keyword retrieval; UI shows degraded |
| SQLite write failure | State kept in memory; retry on next write |
| Extension crash | Sandbox isolation; does not affect main process |
| Data directory corruption | `ensureDataLayout()` rebuilds missing directory structure |
| Missing model files | Automatically triggers `downloadModel()` |

---

## 10. Related Documentation

| Document | Link |
|----------|------|
| Brain system (L0 + L4) | [01-brain-system.md](./01-brain-system.md) |
| Heart system (L1–L3) | [02-heart-system.md](./02-heart-system.md) |
| Mouth system (Prompt + LLM) | [03-mouth-system.md](./03-mouth-system.md) |
| Neural system (Embedding) | [04-neural-system.md](./04-neural-system.md) |
| Extension system | [05-extension-system.md](./05-extension-system.md) |
| Time system | [06-time-system.md](./06-time-system.md) |
| Memory injection policy | [ai-context-and-retrieval-policy.md](../../ai-context-and-retrieval-policy.md) |
| Data directory format | [memory-format.md](../../memory-format.md) |

*Overall System · Ackem v1.0.0 · 2026-06*
