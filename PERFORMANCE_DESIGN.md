# Performance Optimization Design

**Date**: 2026-03-30
**Project**: Vaultwarden Manager
**Scope**: Backend (Rust) + Frontend (SolidJS) High-Priority Performance Issues

---

## 1. Problem Statement

The application has several high-severity performance issues causing:
- Slow startup (~5 seconds due to artificial delays and sequential operations)
- UI lag from unmemoized computed values
- Unnecessary memory allocations in hot paths

---

## 2. Backend (Rust) Issues

### 2.1 Blocking Process Checks
**Location**: `src-tauri/src/commands/process.rs:369-397`
**Fix**: Parallelize using `tokio::join!`

### 2.2 Sequential GitHub API Calls  
**Location**: `src-tauri/src/commands/github.rs:518-550`
**Fix**: Use `tokio::join!` for parallel HTTP requests

### 2.3 Artificial Delays (2s + 3s)
**Location**: `src-tauri/src/commands/background.rs:33-34, 54-55`
**Fix**: Remove artificial sleep delays

### 2.4 Unbounded Status Polling Loop
**Location**: `src-tauri/src/commands/background.rs:73-80`
**Fix**: Add shutdown signal via `oneshot` channel

---

## 3. Frontend (SolidJS) Issues

### 3.1 Unmemoized Functions in StatusBar
**Location**: `src/components/StatusBar.tsx:10-55`
**Fix**: Use `createMemo` for computed values

### 3.2 Inefficient Log Array Updates
**Location**: `src/stores/appStore.ts:391`
**Fix**: Optimize array management

### 3.3 Sequential Initialization
**Location**: `src/stores/appStore.ts:715-718`
**Fix**: Use `Promise.all()` for parallel execution

---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `src-tauri/src/commands/process.rs` | Parallelize process checks |
| `src-tauri/src/commands/github.rs` | Parallelize API calls |
| `src-tauri/src/commands/background.rs` | Remove delays, add cancellation |
| `src/stores/appStore.ts` | Parallelize init, optimize logs |
| `src/components/StatusBar.tsx` | Add createMemo |

---

## 5. Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Startup delay | ~5s | ~0s |
| StatusBar renders | O(n) recalc | O(1) memoized |
| API calls | Sequential | Parallel |
