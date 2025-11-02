# TODO: Persistence Fixes

## High Priority Issues

### 1. **Copy & Reload Buttons Not Working** (CRITICAL)

**Error:** `Runtime does not support reloading messages.`

**Root Cause:**
- ExternalStoreRuntime requires `onReload` and explicit copy handler to be implemented
- Current implementation only has `onNew` handler
- Missing: `onReload`, `onEdit`, proper message copy functionality

**Solution:**
Implement missing runtime handlers in `lib/ollama-external-runtime.tsx`:

```typescript
const runtime = useExternalStoreRuntime({
  messages,
  isRunning: chatStore.isRunning,
  onNew,
  convertMessage,

  // ADD THESE:
  onReload: async (parentId, runConfig) => {
    // 1. Find message by parentId
    // 2. Remove all messages after it
    // 3. Trigger new response from Ollama
  },

  onEdit: async (message) => {
    // 1. Update message in chat-store
    // 2. Remove subsequent messages
    // 3. Trigger new response if needed
  },

  adapters: {
    attachments: new VisionImageAdapter(),
    threadList: threadListAdapter(),
  },
});
```

**Files to modify:**
- `lib/ollama-external-runtime.tsx` - Add onReload and onEdit handlers

**Implementation steps:**
1. Add `onReload` handler that:
   - Finds parent message by ID
   - Removes all assistant messages after it
   - Creates new assistant message
   - Streams new response from Ollama

2. Add `onEdit` handler that:
   - Updates the edited message in chat-store
   - Removes all subsequent messages
   - If user message was edited, triggers new response

3. Test:
   - Click Reload button on assistant message → regenerates response
   - Click Copy button → copies message text
   - Edit user message → updates and regenerates

**Estimated time:** 1-2 hours

---

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

**Estimated time:** 30 minutes

---

## Cleanup Tasks

### 3. **Delete Old Persistence Files**

Now that refactor is complete and tested, remove old unused files:

**Files to delete:**
- ❌ `lib/ollama-runtime.ts` - Replaced by ollama-external-runtime.tsx
- ❌ `lib/hooks/use-persist-threads.ts` - No longer needed
- ❌ `lib/storage/thread-storage.ts` - Replaced by chat-store.ts
- ❌ `components/persistence-manager.tsx` - No longer needed
- ❌ `components/restore-session-dialog.tsx` - No longer needed

**Verification before deletion:**
- [x] No imports of these files in codebase
- [x] All functionality replaced by ExternalStoreRuntime
- [x] Settings page updated to use chat-store functions

**Estimated time:** 15 minutes

---

## Testing Checklist (After Fixes)

### Core Functionality
- [ ] Send message → auto-saves
- [ ] Refresh page → full restoration (text + images)
- [ ] Change model → send message → refresh → model persists
- [ ] Create new thread → works without errors
- [ ] Switch between threads → each shows correct model
- [ ] Thread list management (archive/delete) works

### Message Actions (After Fix #1)
- [ ] Click **Copy** button → copies message text
- [ ] Click **Reload** button → regenerates response
- [ ] Edit user message → updates and triggers new response
- [ ] Edit message in branched conversation → handles correctly

### Multi-Thread with Different Models (After Fix #2)
- [ ] Thread 1 with llama3.2:3b
- [ ] Thread 2 with gemma3:latest
- [ ] Switch between → model selector updates
- [ ] Refresh → both threads keep their models
- [ ] Send messages in both → correct model used

### Settings Page Data Management
- [ ] Storage usage shows correct value (> 0%)
- [ ] Export Data → downloads JSON file
- [ ] Delete All Conversations → clears storage
- [ ] After delete → new thread created automatically

---

## Implementation Order (Next Session)

1. **Fix #1: Copy/Reload handlers** (1-2 hours)
   - Highest priority - user-facing functionality broken
   - Implement onReload handler
   - Implement onEdit handler (if needed)
   - Test all message action buttons

2. **Fix #2: Model sync on active thread** (30 min)
   - Lower priority but good to fix
   - Add immediate model update effect
   - Test model persistence

3. **Cleanup #3: Delete old files** (15 min)
   - Safe to do after testing
   - Verify no remaining imports
   - Delete 5 old files

**Total estimated time:** 2-3 hours

---

## Notes

- ExternalStoreRuntime is more complex but gives full control
- All handlers (onNew, onReload, onEdit) must update chat-store
- Chat-store automatically persists changes via Zustand middleware
- Thread list adapter is working well - no changes needed
- Vision/image support works correctly - no changes needed

---

## Success Criteria

After implementing all fixes:
- ✅ All message action buttons work (Copy, Reload, Edit)
- ✅ Model persistence works for both active and inactive threads
- ✅ No old unused files in codebase
- ✅ Full conversation restoration with correct models
- ✅ Settings page data management fully functional
- ✅ Zero console errors or warnings
