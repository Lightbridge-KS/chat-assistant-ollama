# TODO: Persistence Fixes

## High Priority Issues

### 2. **Model Sync on Active Thread** (Low Priority)

**Issue:**
- Changing model on **active thread** → refresh → model reverts to default
- Changing model on **non-active thread** → refresh → model persists correctly

**Root Cause:**
Model sync effect only triggers on `currentThreadId` change, not when model changes on active thread.

**Current behavior:**
```typescript
// Only syncs when switching threads
useEffect(() => {
  const thread = chatStore.getCurrentThread();
  if (thread?.model) {
    setSelectedModel(thread.model);
  }
}, [chatStore.currentThreadId]);  // <-- Only triggers on thread switch
```

**Solution:**
Update model in chat-store immediately when model selector changes:

```typescript
// In model-selector.tsx or ollama-external-runtime.tsx
useEffect(() => {
  if (selectedModel) {
    // Update current thread's model immediately
    const thread = chatStore.getCurrentThread();
    if (thread && thread.model !== selectedModel) {
      chatStore.updateThreadModel(chatStore.currentThreadId, selectedModel);
    }
  }
}, [selectedModel]);
```

**Files to modify:**
- `lib/ollama-external-runtime.tsx` or `components/assistant-ui/model-selector.tsx`

