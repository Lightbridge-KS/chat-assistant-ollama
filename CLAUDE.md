# About

Experimental Next.js chat application using `assistant-ui` library with local LLM integration via Ollama.

## Architecture

### Core Stack
- **Framework:** Next.js 15.5 (App Router)
- **UI Library:** `@assistant-ui/react` v0.11.28 - Chat interface components
- **AI Integration:** `ollama-ai-provider-v2` - Local LLM provider
- **Streaming:** Vercel AI SDK (`ai` package)
- **State:** Zustand with localStorage persistence
- **UI Components:** Radix UI + Tailwind CSS (light theme)

### Key Features
- Dynamic model selection dropdown (fetches from Ollama API)
- Real-time model switching without creating new threads
- Thread persistence with conversation history
- Markdown rendering with syntax highlighting
- Multi-thread management in sidebar

## Project Structure

```
app/
├── api/
│   ├── chat/route.ts       # Chat API endpoint (streams LLM responses)
│   └── models/route.ts     # Lists available Ollama models
├── page.tsx                # Entry point
├── assistant.tsx           # Main chat component with runtime setup
└── layout.tsx              # Root layout

components/
├── assistant-ui/
│   ├── thread.tsx          # Main thread UI (messages, composer, actions)
│   ├── thread-list.tsx     # Thread management (new/archive)
│   ├── threadlist-sidebar.tsx  # Sidebar wrapper
│   ├── model-selector.tsx  # Model dropdown component
│   └── markdown-text.tsx   # Markdown renderer
└── ui/
    ├── select.tsx          # Radix Select wrapper
    └── [other shadcn components]

lib/
└── stores/
    └── model-store.ts      # Zustand store for selected model
```

## Model Selection Implementation

### How It Works

1. **API Endpoint** (`/app/api/models/route.ts`):
   - Calls `ollama.list()` to fetch available models
   - Returns array with model names

2. **State Management** (`/lib/stores/model-store.ts`):
   - Zustand store with localStorage persistence
   - Default: empty string (auto-selects first model on load)

3. **Model Selector Component** (`/components/assistant-ui/model-selector.tsx`):
   - Fetches models on mount
   - Auto-selects first model if none selected
   - Shows loading skeleton while fetching

4. **Runtime Integration** (`/app/assistant.tsx`):
   - Uses **dynamic body function**: `body: () => ({ model: useModelStore.getState().selectedModel })`
   - This ensures each API call uses the current model from store
   - Provider stays mounted (preserves thread history)
   - Thread component has `key={selectedModel}` (resets current conversation only)

### Key Pattern: Dynamic Body Function

```typescript
const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/api/chat",
    body: () => ({
      model: useModelStore.getState().selectedModel,
    }),
  }),
});
```

This pattern allows model changes without remounting the provider, preserving all thread history.

## Important Notes for Future Development

1. **Model Changes:**
   - Current thread resets when model changes (expected behavior)
   - Previous threads with their conversations are preserved
   - Model switching is immediate (no "New Thread" required)

2. **Loading States:**
   - App shows skeleton until first model is loaded
   - Prevents runtime initialization with empty model

3. **Thread Management:**
   - Threads are managed by `assistant-ui` library
   - Thread list persistence is built-in
   - Each thread can use different models

4. **Ollama Connection:**
   - Default: `http://localhost:11434/api`
   - Configurable in `/app/api/chat/route.ts`
   - Fallback model: "gemma3:latest" (used only if body.model is empty)

## Dependencies

Key dependencies:
- `@assistant-ui/react` - Chat UI framework
- `@assistant-ui/react-ai-sdk` - AI SDK integration
- `ollama-ai-provider-v2` - Ollama provider
- `ollama` - Ollama Node.js client
- `ai` - Vercel AI SDK for streaming
- `zustand` - State management