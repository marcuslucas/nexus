# Phase 1 Plan — Core Platform Scaffold

**Phase:** 1
**Goal:** A running Electron application that spawns Flask, serves a React UI, and has a working health check. No modules. No features. Pure infrastructure.
**Depends on:** Phase 0 (docs complete) ✅
**Status:** Ready to begin

---

## Success Criteria (Definition of Done)

Every item below must be true before Phase 1 is considered complete.

- [ ] `npm start` launches Electron window
- [ ] Electron spawns Flask as child process automatically
- [ ] React UI loads in window — shows AppShell with empty nav
- [ ] `GET /api/health` returns `{ data: { status: "ok", version: "1.0.0" }, error: null, timestamp }`
- [ ] Flask can also be started independently: `cd core/server && python run.py`
- [ ] Quitting the app terminates Flask cleanly — no zombie process
- [ ] Port conflict on startup shows a clear error, not a silent hang
- [ ] `NEXUS_PRODUCT` env var is read — logged on Flask startup

---

## File Build Order

Build in this order. Each item should work before moving to the next.

### Step 1 — Python foundation
```
core/server/app/config.py
core/server/app/db.py
core/server/app/routes/health.py
core/server/app/__init__.py
core/server/run.py
requirements.txt
```
**Test:** `python run.py` → Flask starts, GET /api/health returns 200

### Step 2 — Electron main process
```
package.json
core/electron/main.js
core/electron/preload.js
core/electron/ipc/server.js
core/electron/ipc/shell.js
```
**Test:** `npm start` → Electron window opens, Flask spawned, health check passes via IPC

### Step 3 — React shell
```
core/renderer/styles/tokens.css
core/renderer/components/ (Button, Modal stubs)
core/renderer/hooks/useApi.js
core/renderer/hooks/apiClient.js
core/renderer/layouts/AppShell.jsx
core/renderer/App.jsx
```
**Test:** App loads, AppShell renders with empty nav sidebar, no console errors

---

## Implementation Notes

### main.js — critical requirements
1. Flask spawn: `python run.py` from `core/server/` directory
2. Pass env vars to Flask child process (FLASK_PORT, NEXUS_PRODUCT, all DB paths)
3. Health check poll before showing window: retry GET /api/health up to 10 times, 500ms apart
4. On `before-quit`: `flaskProcess.kill()` and wait for exit before allowing quit
5. On `will-quit`: same — belt and suspenders
6. Track PID on startup. If port is already in use, check if it's a zombie from a previous session and kill it.

### preload.js — minimal surface
Only expose what's actually needed in Phase 1:
```javascript
window.nexus = {
  checkHealth: () => ipcRenderer.invoke('server:health'),
  getConfig:   () => ipcRenderer.invoke('shell:getConfig'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
}
```
Do not add anything else until it's needed.

### AppShell.jsx — structure only
Phase 1 AppShell renders:
- Left sidebar (empty nav, just the container)
- Top bar (app name, version)
- Main content area (empty, ready for routes)
No actual routes yet — those come in Phase 2.

### config.py — environment loading
```python
class Config:
    FLASK_PORT = int(os.environ.get('FLASK_PORT', 5199))
    NEXUS_PRODUCT = os.environ.get('NEXUS_PRODUCT', 'unknown')
    CORE_DB_PATH = os.environ.get('CORE_DB_PATH')
    # Module DB paths — None if not set (module will error gracefully if accessed without config)
    WEB_MANAGER_DB_PATH = os.environ.get('WEB_MANAGER_DB_PATH')
    SOL_QUOTER_DB_PATH = os.environ.get('SOL_QUOTER_DB_PATH')
    PRODUCT_DB_PATH = os.environ.get('PRODUCT_DB_PATH')
```

---

## What NOT to Build in Phase 1

- No module loading logic (Phase 2)
- No nav items from manifests (Phase 2)
- No actual routes beyond /api/health
- No database schema creation beyond core
- No UI screens beyond the shell layout
- No drag-to-reorder, no image upload, nothing feature-level

Phase 1 is infrastructure only. If it feels like too little to show — good. The discipline of building the platform before the features is the entire point.

---

## Risks

1. **Zombie process on Windows.** On Windows, `process.kill()` behaves differently than Unix. Test on Windows specifically. May need `taskkill /PID` via a shell command instead of the Node kill signal.

2. **Flask startup timing.** Flask may take 1–3 seconds to start. The health check retry loop handles this, but the window must not show until the first successful health check. Show a loading screen, not a blank window.

3. **Python not in PATH.** In packaged builds, Python won't be in PATH — PyInstaller handles this. In dev, the developer's Python must be accessible. Document the Python version requirement clearly in README.

---

## Phase 1 Complete → Go to Phase 2

When all success criteria are checked, update:
- `claude.md` → Active Development State: "Phase 1 complete. Starting Phase 2."
- `docs/roadmap.md` → Mark Phase 1 tasks complete
- `docs/decisions.md` → Append any new decisions made during Phase 1
