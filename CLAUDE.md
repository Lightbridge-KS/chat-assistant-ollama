# About

Next.js chat application using `assistant-ui` library with local LLM integration via Ollama.

**Deployment Target:** Pure CSR/SPA static export for offline hospital intranet deployment.

## Architecture

### Core Stack
- **Framework:** Next.js 15.5 (Static Export / CSR/SPA)
- **UI Library:** `@assistant-ui/react` v0.11.28 - Chat interface components
- **AI Integration:** `ollama/browser` - Direct browser-to-Ollama API calls
- **State:** Zustand with localStorage persistence
- **UI Components:** Radix UI + Tailwind CSS (light theme)
- **Fonts:** Local Geist fonts (no CDN dependencies)

### Deployment Model
```
Static Files (HTML/CSS/JS)
  ↓
Nginx/HTTP Server
  ↓ (Direct connection)
Ollama Server (configurable endpoint)
```

### Key Features
- ✅ Pure static export (no Node.js runtime required)
- ✅ Offline-capable (no internet/CDN dependencies)
- ✅ Dynamic model selection dropdown (fetches from Ollama API)
- ✅ Real-time model switching without creating new threads
- ✅ Thread persistence with conversation history
- ✅ Markdown rendering with syntax highlighting
- ✅ Multi-thread management in sidebar
- ✅ Configurable Ollama endpoint via build-time environment variables

## Project Structure

```
app/
├── fonts/                  # Local Geist font files (no CDN)
│   ├── Geist/
│   │   ├── Geist[wght].woff2
│   │   └── Geist-Italic[wght].woff2
│   └── GeistMono/
│       ├── GeistMono[wght].woff2
│       └── GeistMono-Italic[wght].woff2
├── page.tsx                # Entry point
├── assistant.tsx           # Main chat component with custom Ollama runtime
└── layout.tsx              # Root layout (uses local fonts)

components/
├── assistant-ui/
│   ├── thread.tsx          # Main thread UI (messages, composer, actions)
│   ├── thread-list.tsx     # Thread management (new/archive)
│   ├── threadlist-sidebar.tsx  # Sidebar wrapper
│   ├── model-selector.tsx  # Model dropdown (uses ollama/browser)
│   ├── markdown-text.tsx   # Markdown renderer
│   └── shiki-highlighter.tsx   # Syntax highlighting
└── ui/
    ├── select.tsx          # Radix Select wrapper
    └── [other shadcn components]

lib/
├── ollama-client.ts        # Ollama browser client (direct API calls)
├── ollama-runtime.ts       # Custom runtime adapter for assistant-ui
└── stores/
    └── model-store.ts      # Zustand store for selected model

.env.local                  # Dev: http://localhost:11434
.env.production             # Prod: http://10.6.135.213:80
.env.example                # Documentation for environment variables
```

**Note:** `/app/api/*` routes have been **removed** - all Ollama communication is done browser-side using `ollama/browser` package.

## Static Export / CSR Implementation

### Environment Variables (Build-Time)

**Development** (`.env.local`):
```bash
NEXT_PUBLIC_OLLAMA_BASE_URL=http://localhost:11434
```

**Production** (`.env.production`):
```bash
NEXT_PUBLIC_OLLAMA_BASE_URL=http://10.6.135.213:80
```

These are **build-time** variables that get embedded into the static bundle during `npm run build`.

### Ollama Browser Client

**File:** `/lib/ollama-client.ts`

```typescript
import { Ollama } from 'ollama/browser'

const baseUrl = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434'

export const ollamaClient = new Ollama({
  host: baseUrl,
})
```

- Uses official `ollama/browser` package for browser-compatible API calls
- Configurable endpoint via environment variable
- Direct HTTP calls to Ollama server (no API routes needed)

### Custom Runtime Adapter

**File:** `/lib/ollama-runtime.ts`

```typescript
import { useLocalRuntime } from "@assistant-ui/react";
import type { ChatModelAdapter } from "@assistant-ui/react";
import { ollamaClient } from "./ollama-client";

export function useOllamaRuntime() {
  const adapter: ChatModelAdapter = {
    async *run({ messages, abortSignal }) {
      const model = useModelStore.getState().selectedModel;

      const response = await ollamaClient.chat({
        model,
        messages: /* converted messages */,
        stream: true,
      });

      for await (const chunk of response) {
        yield { type: "text-delta", textDelta: chunk.message.content };
      }
    },
  };

  return useLocalRuntime(adapter);
}
```

- Custom adapter integrates `ollama/browser` with `assistant-ui`
- Streams responses directly from Ollama
- Reads current model from Zustand store dynamically

### Model Selection Implementation

**File:** `/components/assistant-ui/model-selector.tsx`

```typescript
// Uses ollama browser client directly (no API route)
const response = await ollamaClient.list();
const modelList = response.models.map((m) => ({
  name: m.name,
  model: m.model,
}));
```

**File:** `/app/assistant.tsx`

```typescript
// Uses custom Ollama runtime
const runtime = useOllamaRuntime();
```

- Model selector fetches directly from Ollama API
- Runtime adapter handles streaming chat
- No Next.js API routes involved

## Build and Deployment

### npm Scripts

```bash
# Development with hot reload
npm run dev

# Build for local testing (localhost:11434)
npm run build:local

# Build for production deployment (hospital IP)
npm run build:prod

# Serve static build locally
npm run serve

# Clean build artifacts
npm run clean
```

### Building for Production

```bash
# Option 1: Use npm script (recommended)
npm run build:prod

# Option 2: Manual with environment variable
NEXT_PUBLIC_OLLAMA_BASE_URL=http://10.6.135.213:80 npm run build

# Output: /out directory (static HTML/CSS/JS)
```

### Build Configuration

**File:** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  output: "export",           // Static export
  images: { unoptimized: true },  // No image optimization
  trailingSlash: true,         // Better for static hosting
};
```

### Local Testing

```bash
# Option 1: Python HTTP server
cd out
python3 -m http.server 8000

# Option 2: npx serve
npx serve out

# Open: http://localhost:8000
```

### GitHub Actions Workflows

Two separate workflows for automated builds:

**Local Build** (`.github/workflows/build-and-release-local.yml`):
- Builds with `npm run build:local` (localhost URL)
- Creates artifact: `ollama-chat-localhost-{version}.zip`
- Triggers: Push to main (excluding `*.md`), Release creation
- Node.js 24, npm ci, build verification

**Production Build** (`.github/workflows/build-and-release-prod.yml`):
- Builds with `npm run build:prod` (hospital IP)
- Creates artifact: `ollama-chat-{version}.zip`
- Triggers: Push to main (excluding `*.md`), Release creation
- Node.js 24, npm ci, build verification

**Version Naming:**
- Release: Uses Git tag (e.g., `v1.0.0`)
- Push: Uses commit SHA (e.g., `dev-c66471f`)

**Artifact Management:**
- Uploaded to GitHub Actions (30-day retention)
- Uploaded to GitHub Release page (on release events)

## Important Notes for Future Development

1. **Model Changes:**
   - Current thread resets when model changes (expected behavior)
   - Previous threads with their conversations are preserved
   - Model switching is immediate (no "New Thread" required)

2. **Loading States (⚠️ Critical Fix):**
   - **Chicken-and-Egg Bug**: ModelSelector must render even when no model is selected
   - In `app/assistant.tsx`, ModelSelector is rendered hidden during loading skeleton
   - This allows it to fetch models and auto-select the first one
   - Without this, app would be stuck in loading state forever

   ```tsx
   if (!selectedModel) {
     return (
       <div className="flex h-screen flex-col items-center justify-center gap-4">
         <Skeleton className="h-10 w-64" />
         {/* CRITICAL: Render hidden to fetch models */}
         <div className="hidden">
           <ModelSelector />
         </div>
       </div>
     );
   }
   ```

3. **Thread Management:**
   - Threads are managed by `assistant-ui` library
   - Thread list persistence is built-in (localStorage)
   - Each thread can use different models

4. **Ollama Connection:**
   - Configured via `NEXT_PUBLIC_OLLAMA_BASE_URL` at build time
   - Direct browser-to-Ollama communication
   - **CORS Note:** Ollama server needs CORS enabled for browser access
   - Fallback model: "gemma3:latest" (if selected model not available)

5. **Offline Deployment:**
   - No internet connection required
   - All assets bundled (fonts, CSS, JS)
   - Only needs HTTP server + Ollama server on local network

6. **TypeScript Adapter Types:**
   - `ChatModelAdapter` from assistant-ui expects `content` array with `TextMessagePart`
   - Must accumulate streaming text and yield complete content array
   - Cannot use simple delta streaming (type incompatibility)

## Dependencies

Key dependencies:
- `@assistant-ui/react` v0.11.28 - Chat UI framework
- `ollama` v0.6.0 - Ollama client (browser mode: `ollama/browser`)
- `zustand` v5.0.8 - State management
- `next` v15.5.4 - Framework (static export mode)
- Local fonts (Geist, GeistMono) - No CDN

**Removed dependencies** (from previous API route implementation):
- ❌ `@assistant-ui/react-ai-sdk` - No longer needed
- ❌ `ollama-ai-provider-v2` - Replaced by `ollama/browser`
- ❌ `ai` (Vercel AI SDK) - Not needed for browser client

## Implementation Status

### Current Status: ✅ **COMPLETE**

All phases completed successfully. The CSR/SPA static export is fully functional and tested.

### Completed Work:

1. **TypeScript Compilation** ✅
   - Fixed type errors in `lib/ollama-runtime.ts`
   - Verified `ChatModelAdapter` interface compatibility
   - Streaming works correctly with assistant-ui
   - Uses accumulation pattern instead of delta streaming

2. **Static Build** ✅
   - `npm run build:local` works (localhost)
   - `npm run build:prod` works (hospital IP)
   - Static export generates `/out` directory successfully
   - All assets bundled (fonts, CSS, JS)

3. **Browser Functionality** ✅
   - `ollama/browser` works correctly in browser
   - Direct API calls to Ollama successful
   - Streaming responses work
   - Model list fetches and auto-selects first model
   - Fixed chicken-and-egg bug with ModelSelector

4. **Offline Testing** ✅
   - Tested with Python HTTP server
   - Works completely offline (no internet required)
   - All features functional in static export

5. **Build Automation** ✅
   - Added npm scripts for different build targets
   - `build:local`, `build:prod`, `serve`, `clean`

### Testing Checklist:

- ✅ Build completes without errors
- ✅ Static files exported to `/out`
- ✅ Local HTTP server serves app correctly
- ✅ Model list loads from Ollama
- ✅ Chat streaming works
- ✅ Model switching preserves threads
- ✅ Works offline (no internet required)

### Future Enhancement (Optional)

**Phase 4 - Nginx Reverse Proxy** (not yet implemented):
- Configure nginx to proxy `/api/ollama` → `http://10.6.135.213:80`
- Would eliminate CORS concerns
- Useful if direct browser-to-Ollama connection has issues

```nginx
location /api/ollama {
    proxy_pass http://10.6.135.213:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```