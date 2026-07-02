# Ackem · macOS Distribution

> **Language:** English

> **Product version:** Ackem **v1.0.0**
> **Target:** macOS 12+ · Apple Silicon (arm64)
> **Build output:** `dist/Ackem-1.0.0-mac-arm64.dmg`

---

## What is and is not in the package

### Included

| Item | Location (inside `Ackem.app`) | Description |
|------|-------------------------------|-------------|
| `Ackem` | `Contents/MacOS/Ackem` | Electron main executable (arm64 Mach-O) |
| `app.asar` | `Contents/Resources/app.asar` | Compiled application code |
| `app.asar.unpacked/` | `Contents/Resources/app.asar.unpacked/` | Native modules (better-sqlite3, onnxruntime-node) |
| `models/` | `Contents/Resources/models/` | Embedding models (bge-small-zh/en, ONNX zips) |
| `voice-service/` | `Contents/Resources/voice-service/` | Voice runtime Python source (optional, best-effort) |
| `icon.icns` | — | App / Dock icon |

### Never included

| Item | Description |
|------|-------------|
| User `data/` | Memory, chat, imports — created at runtime in `~/Library/Application Support/Ackem/` |
| API keys | Entered in Settings after first run |
| `.env` / dev secrets | Excluded at build time |

---

## Build (developer)

### Prerequisites

- macOS on Apple Silicon (arm64)
- Node.js 22 LTS
- Xcode Command Line Tools (`xcode-select --install`)
- `npm install` (rebuilds native modules for arm64 via `electron-builder install-app-deps`)

### Build the DMG

```bash
npm install
npm run dist:mac
```

Output:

```
dist/Ackem-1.0.0-mac-arm64.dmg
dist/mac-arm64/Ackem.app          # unpacked app bundle
```

---

## Install (end user)

The DMG is **unsigned** (no Apple Developer certificate). macOS Gatekeeper
will warn on first launch.

### Option A — Right-click → Open (recommended)

1. Open `Ackem-1.0.0-mac-arm64.dmg`
2. Drag **Ackem** into **Applications**
3. In Finder, **right-click** Ackem → **Open** → confirm the dialog
4. First launch ~10–30 s (embedding model extracts once into `~/Library/Application Support/Ackem/`)

### Option B — Terminal (remove quarantine)

```bash
xattr -dr com.apple.quarantine /Applications/Ackem.app
open /Applications/Ackem.app
```

> **macOS Sequoia (15)+** is stricter with unsigned apps. The right-click → Open
> method still works; if it doesn't, use the `xattr` command above.

---

## Data directory

| Path | `~/Library/Application Support/Ackem/` |
|------|----------------------------------------|
| Writable | Yes (per-user, persists across launches) |
| Contents | `ackem.db` (SQLite) · `models/` (extracted embeddings) · memory · logs |

Layout: [memory-format.md](./memory-format.md).

---

## Uninstall

- Drag **Ackem** from Applications to Trash
- To wipe local memory: `rm -rf ~/Library/Application\ Support/Ackem`

---

## Platform notes

- **Desktop agent** (open/close/focus apps), **media session**, **focus-assist**,
  and **in-app auto-updater** are Windows-only and disabled on macOS (the app
  runs normally without them).
- **Voice service** is best-effort: it requires a local `python3` with the
  dependencies in `voice-service/requirements.txt`. If unavailable, voice
  features are skipped (no crash).
- **Local embeddings** (ONNX) work natively on Apple Silicon.
- **Code signing / notarization:** not included in this build. For public
  distribution, configure Apple Developer ID (`CSC_LINK`, `CSC_KEY_PASSWORD`)
  and Apple API keys (`APPLE_API_KEY`, `APPLE_API_KEY_ID`,
  `APPLE_API_ISSUER`), then set `mac.identity` / `mac.notarize: true` in
  `electron-builder.yml` and rebuild.

---

## Source vs release

| | Source repo | Release |
|---|-------------|---------|
| Path | Repository root | `dist/mac-arm64/Ackem.app` + `dist/*.dmg` |
| Contents | `src/` TypeScript | `app.asar` compiled output |
| Node.js required | Yes (development) | No (end users) |

Build reference (Windows): [distribution-windows.md](./distribution-windows.md)
Path map: [CODEBASE-PATHS.md](./CODEBASE-PATHS.md)

*distribution-macos · Ackem v1.0.0*
