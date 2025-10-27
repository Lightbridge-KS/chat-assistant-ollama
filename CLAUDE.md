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

**Two Build Targets:**

1. **Localhost Build** (`npm run build:localhost`):
```
Static Files (HTML/CSS/JS) at root path /
  ↓ Direct connection
Ollama at http://localhost:11434
```

2. **Hospital Production Build** (`npm run build:prod`):
```
Browser → http://10.6.34.95/radchat
  ↓
Nginx Server (10.6.34.95)
  ├─ /radchat/            → Serve static files
  └─ /radchat/api/ollama/ → Proxy to Ollama
       ↓
Ollama Server (10.6.135.213:80)
```

The production build uses nginx reverse proxy to avoid CORS issues.

### Key Features
- ✅ Pure static export (no Node.js runtime required)
- ✅ Offline-capable (no internet/CDN dependencies)
- ✅ Dynamic model selection dropdown (fetches from Ollama API)
- ✅ Real-time model switching without creating new threads
- ✅ Thread persistence with conversation history
- ✅ Markdown rendering with syntax highlighting
- ✅ Multi-thread management in sidebar
- ✅ Configurable Ollama endpoint via build-time environment variables
- ✅ **Vision/Image Support** - Upload images with text for vision-capable models

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
│   ├── shiki-highlighter.tsx   # Syntax highlighting
│   └── attachment.tsx      # Image attachment UI components
└── ui/
    ├── select.tsx          # Radix Select wrapper
    └── [other shadcn components]

lib/
├── ollama-client.ts        # Ollama browser client (direct API calls)
├── ollama-runtime.ts       # Custom runtime adapter for assistant-ui (with vision support)
├── vision-image-adapter.ts # Attachment adapter for vision-capable models
└── stores/
    └── model-store.ts      # Zustand store for selected model

.env.development                  # Dev: http://localhost:11434
.env.production             # Prod: http://10.6.135.213:80
.env.example                # Documentation for environment variables
```

**Note:** `/app/api/*` routes have been **removed** - all Ollama communication is done browser-side using `ollama/browser` package.

## Static Export / CSR Implementation

### Environment Variables (Build-Time)

**Development** (`.env.development`):
```bash
NEXT_PUBLIC_OLLAMA_BASE_URL=http://localhost:11434
NEXT_PUBLIC_IS_LOCALHOST=true
```

**Production** (`.env.production`):
```bash
# Uses nginx reverse proxy to avoid CORS
# IMPORTANT: Must use absolute URL with full path including basePath
NEXT_PUBLIC_OLLAMA_BASE_URL=http://10.6.34.95/radchat/api/ollama
NEXT_PUBLIC_IS_LOCALHOST=false
```

These are **build-time** variables that get embedded into the static bundle during `npm run build`.

**Important:** The production build uses an **absolute URL** `http://10.6.34.95/radchat/api/ollama` which includes the full path with basePath. This is required because:
1. The `ollama/browser` library needs the complete URL for proper parsing
2. The path must include the basePath (`/radchat`) for correct routing
3. Nginx proxies `/radchat/api/ollama/` to the Ollama server at `http://10.6.135.213:80`
4. Same-origin requests (browser → 10.6.34.95) avoid CORS issues

### Ollama Browser Client

**File:** `/lib/ollama-client.ts`

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

## Vision/Image Support

### Overview

The application supports sending images to vision-capable LLMs (like llava, llama3.2-vision) alongside text messages. Images are processed entirely in the browser using the FileReader API.

### Implementation

**File:** `/lib/vision-image-adapter.ts`

```typescript
import type { AttachmentAdapter } from "@assistant-ui/react";

export class VisionImageAdapter implements AttachmentAdapter {
  accept = "image/jpeg,image/png,image/webp,image/gif";

  async add({ file }: { file: File }) {
    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("Image size exceeds 20MB limit");
    }

    return {
      id: this.generateUUID(), // Uses fallback for HTTP contexts
      type: "image",
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "running", reason: "uploading", progress: 0 },
    };
  }

  async send(attachment: PendingAttachment) {
    // Convert File to base64 data URL
    const base64 = await this.fileToBase64DataURL(attachment.file);

    return {
      ...attachment,
      content: [{ type: "image", image: base64 }],
      status: { type: "complete" },
    };
  }

  // UUID generation with fallback for insecure contexts (HTTP)
  private generateUUID(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID(); // HTTPS or localhost
    }
    // Fallback for HTTP (hospital deployment)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
```

**File:** `/lib/ollama-runtime.ts`

The runtime extracts images from `msg.attachments` (not `msg.content`) and strips the data URL prefix before sending to Ollama:

```typescript
// Extract images from attachments
const attachments = (msg.attachments || []) as MessageAttachment[];
const imageContent = attachments
  .filter((att) => att.type === "image" && att.content)
  .flatMap((att) =>
    att.content
      .filter((c) => c.type === "image" && c.image)
      .map((c) => {
        // Strip "data:image/jpeg;base64," prefix for Ollama
        return c.image.split(",")[1];
      })
  );

// Add to Ollama message
if (imageContent.length > 0) {
  ollamaMsg.images = imageContent; // Array of base64 strings
}
```

### Key Points

1. **Image Location:** Images are in `msg.attachments[].content[]`, NOT `msg.content[]`
2. **Base64 Format:** Ollama expects raw base64 strings, not data URLs
3. **Browser-Only:** All image processing uses FileReader API (no server required)
4. **Vision Models Required:** Regular models ignore images; use llava, llama3.2-vision, etc.
5. **Multi-Image Support:** Can send multiple images per message
6. **HTTP Compatibility:** Uses UUID fallback for insecure contexts (hospital HTTP deployment works)

### Supported Models

Vision-capable models that work with images:
- `llava` (7B) - Fast, good for testing
- `llava:13b` / `llava:34b` - Better quality
- `llama3.2-vision` (11B) - Meta's latest
- `bakllava` - Alternative option

### UI Components

**File:** `/components/assistant-ui/attachment.tsx`

Provides:
- Image upload button (+ icon in composer)
- Thumbnail preview in composer
- Full-size image preview dialog
- Remove attachment button
- Image display in messages

### Usage

1. Select a vision-capable model from dropdown
2. Click + button in message composer
3. Upload image (JPEG, PNG, WebP, GIF)
4. Type your message
5. Send - model will analyze image and respond

## Build and Deployment

### npm Scripts

```bash
# Development with hot reload
npm run dev

# Build for local testing (localhost:11434)
npm run build:localhost

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
// Dynamic basePath based on deployment target
const isLocalhost = process.env.NEXT_PUBLIC_IS_LOCALHOST === 'true';

const nextConfig: NextConfig = {
  output: "export",                    // Static export
  images: { unoptimized: true },       // No image optimization
  trailingSlash: true,                 // Better for static hosting
  basePath: isLocalhost ? '' : '/radchat',  // Dynamic basePath
};
```

**basePath behavior:**
- Localhost build: `''` (root path) for easier local testing
- Hospital build: `'/radchat'` for subpath deployment at `http://10.6.34.95/radchat`

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
- Builds with `npm run build:localhost` (localhost URL)
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
   - **Localhost:** Direct connection to `http://localhost:11434` (no CORS issues)
   - **Hospital:** Absolute URL `http://10.6.34.95/radchat/api/ollama` → nginx reverse proxy → `http://10.6.135.213:80` (avoids CORS)
   - Must use absolute URL with full path including basePath for correct routing
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
   - `npm run build:localhost` works (localhost)
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
   - `build:localhost`, `build:prod`, `serve`, `clean`

6. **Vision/Image Support** ✅
   - Implemented VisionImageAdapter for image attachments
   - Images extracted from msg.attachments (not msg.content)
   - Base64 data URL prefix stripped for Ollama API compatibility
   - Works with vision-capable models (llava, llama3.2-vision, etc.)
   - Full UI support: upload, preview, remove, display in messages

7. **Performance Optimizations** ✅
   - Disabled font preloading to eliminate browser warnings
   - Local fonts load on-demand (very fast, no network request)
   - Removed unused italic font variants from preload
   - Zero Chrome DevTools console warnings

### Testing Checklist:

- ✅ Build completes without errors
- ✅ Static files exported to `/out`
- ✅ Local HTTP server serves app correctly
- ✅ Model list loads from Ollama
- ✅ Chat streaming works
- ✅ Model switching preserves threads
- ✅ Works offline (no internet required)
- ✅ Image upload with vision models works
- ✅ Zero browser console warnings

8. **Hospital Deployment with Nginx Proxy** ✅
   - Implemented nginx reverse proxy configuration
   - Production build uses absolute URL `http://10.6.34.95/radchat/api/ollama` (includes basePath)
   - Eliminates CORS issues for hospital deployment (same-origin requests)
   - Dynamic basePath: root for localhost, `/radchat` for hospital
   - Full deployment guide available in `DEPLOYMENT.md`

### Hospital Deployment

**Production deployment at:** `http://10.6.34.95/radchat`

The hospital production build uses nginx reverse proxy to avoid CORS issues.

**Ollama Server Configuration (10.6.135.213):**
```bash
sudo snap set ollama origins="*"
```

**Nginx Configuration (Location: `/etc/nginx/nginx.conf`):**
```nginx
# Proxy Ollama API requests to the Ollama server
location /radchat/api/ollama/api/chat {
    # Proxy to Ollama server at 10.6.135.213:80
    proxy_pass http://10.6.135.213/api/chat;

    # Essential for streaming responses
    proxy_buffering off;
    proxy_cache off;

    # Headers for proper proxying
    proxy_set_header Host 10.6.135.213;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Support for chunked transfer encoding (streaming)
    chunked_transfer_encoding on;
    proxy_http_version 1.1;
    proxy_set_header Connection "";

    # Timeouts for long-running requests
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
}

location /radchat/api/ollama/api/tags {
    proxy_pass http://10.6.135.213/api/tags;

    # Add the same headers here too
    proxy_set_header Host 10.6.135.213;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Serve static Next.js app at /radchat
location /radchat {
    alias /home/ubuntu/radchat;

    # Try to serve file directly, then directory, then .html, or 404
    try_files $uri $uri/ $uri.html =404;

    # Serve index.html by default
    index index.html;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**See `DEPLOYMENT.md` for complete deployment instructions for hospital IT team.**