# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize backend Rust and frontend SolidJS for faster startup and better runtime performance

**Architecture:** Parallelize blocking I/O, remove artificial delays, memoize expensive computations

**Tech Stack:** Rust (tokio), SolidJS (createMemo)

---

## Task 1: Backend - Parallelize Process Checks

**Files:**
- Modify: `src-tauri/src/commands/process.rs:369-397`

- [ ] **Step 1: Read current process check implementation**

```rust
// Current: sequential blocking calls
let openssl_available = openssl_cmd.output().unwrap_or(false);
let mkcert_available = mkcert_cmd.output().unwrap_or(false);
```

- [ ] **Step 2: Create spawn_blocking helper functions**

```rust
fn check_openssl_internal() -> bool {
    std::process::Command::new("openssl")
        .arg("version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn check_mkcert_internal() -> bool {
    std::process::Command::new("mkcert")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
```

- [ ] **Step 3: Update check_cert_tools_available to use tokio::join!**

```rust
let (openssl_available, mkcert_available) = tokio::join!(
    tokio::task::spawn_blocking(check_openssl_internal),
    tokio::task::spawn_blocking(check_mkcert_internal)
);
```

---

## Task 2: Backend - Parallelize GitHub API Calls

**Files:**
- Modify: `src-tauri/src/commands/github.rs:518-550`

- [ ] **Step 1: Read current check_binary_update function**

- [ ] **Step 2: Parallelize the async HTTP calls using tokio::join!**

```rust
let ((latest_binary, latest_webvault), current_binary, current_webvault) = tokio::join!(
    async {
        let latest = get_latest_binary_version().await.ok();
        let webvault = get_latest_webvault_version().await.ok().map(|v| v.version);
        (latest, webvault)
    },
    async { get_binary_version().ok() },
    async { get_webvault_version().ok() }
);
```

---

## Task 3: Backend - Remove Artificial Delays

**Files:**
- Modify: `src-tauri/src/commands/background.rs`

- [ ] **Step 1: Remove sleep in check_cert_tools (line 33-34)**

```rust
// REMOVE: sleep(Duration::from_secs(2)).await;
```

- [ ] **Step 2: Remove sleep in check_versions (line 54-55)**

```rust
// REMOVE: sleep(Duration::from_secs(3)).await;
```

---

## Task 4: Frontend - Memoize StatusBar Computations

**Files:**
- Modify: `src/stores/StatusBar.tsx`

- [ ] **Step 1: Import createMemo**

```typescript
import { Component, Show, createMemo } from "solid-js";
```

- [ ] **Step 2: Wrap canGenerateCerts with createMemo**

```typescript
const canGenerateCerts = createMemo(() => {
    const status = store.certToolsStatus();
    const tool = store.certTool();
    if (tool === 'openssl') return status?.openssl_available ?? false;
    if (tool === 'mkcert') return status?.mkcert_available ?? false;
    return false;
});
```

- [ ] **Step 3: Wrap getMkcertStatusText with createMemo**

```typescript
const getMkcertStatusText = createMemo(() => {
    const status = store.certToolsStatus();
    if (!status) return "";
    if (!status.mkcert_available) return t("env.mkcertNotInstalled");
    if (!status.mkcert_ca_installed) return t("env.mkcertCaNotInstalled");
    return t("env.mkcertCaInstalled");
});
```

- [ ] **Step 4: Wrap isMkcertReady with createMemo**

```typescript
const isMkcertReady = createMemo(() => {
    const status = store.certToolsStatus();
    return status?.mkcert_available && status?.mkcert_ca_installed;
});
```

---

## Task 5: Frontend - Optimize Log Array Updates

**Files:**
- Modify: `src/stores/appStore.ts:391`

- [ ] **Step 1: Read current addLog implementation**

- [ ] **Step 2: Optimize to avoid double array allocation**

```typescript
const addLog = (level: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => {
        const newLogs = prev.concat({ timestamp, level, message });
        return newLogs.length > 500 ? newLogs.slice(-500) : newLogs;
    });
};
```

---

## Task 6: Frontend - Parallelize initAndStart

**Files:**
- Modify: `src/stores/appStore.ts:715-718`

- [ ] **Step 1: Update initAndStart to use Promise.all**

```typescript
const initAndStart = async () => {
    await Promise.all([
        setupListeners(),
        loadConfig()
    ]);
};
```

---

## Task 7: Build Verification

- [ ] Run `npm run build` to verify frontend
- [ ] Verify no TypeScript errors
- [ ] Verify no Rust compilation errors (if possible)

---

## Task 8: Commit and Push

- [ ] Commit with message: "perf: optimize startup and runtime performance"
- [ ] Push to remote
