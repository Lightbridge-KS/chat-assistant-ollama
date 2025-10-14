# How to Build a CSR/SPA Next.js App with Local Ollama (No CDN, Offline-Capable)

**Target Deployment:** Pure static export for offline intranet deployment (hospital, corporate network, air-gapped environments)

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Critical Caveats](#critical-caveats)
6. [Build and Deployment](#build-and-deployment)
7. [Troubleshooting](#troubleshooting)
8. [Testing](#testing)

---

## Overview

### Goals

-  Pure Client-Side Rendering (CSR/SPA)
-  Static export (HTML/CSS/JS only)
-  No Node.js runtime required in production
-  No CDN dependencies (all assets bundled)
-  Works completely offline
-  Direct browser-to-Ollama API connection
-  Configurable endpoints via build-time environment variables

### What You'll Build

```
Browser (Static HTML/CSS/JS)
   (Direct HTTP calls)
Ollama API Server
  
Local LLM Models
```

**No server-side code. No API routes. Pure static files.**

---

## Architecture

### Tech Stack

- **Framework:** Next.js 15+ (Static Export mode)
- **UI Library:** @assistant-ui/react (chat interface)
- **AI Client:** ollama/browser (official browser-compatible client)
- **State Management:** Zustand (localStorage persistence)
- **Styling:** Tailwind CSS + Radix UI
- **Fonts:** Local .woff2 files (no Google Fonts CDN)

### Key Components

```
lib/
 ollama-client.ts        # Browser Ollama client
 ollama-runtime.ts       # Custom adapter for assistant-ui
 stores/
     model-store.ts      # Zustand store

components/
 assistant-ui/
     model-selector.tsx  # Dynamic model dropdown

app/
 fonts/                  # Local font files
 assistant.tsx           # Main chat component
```

---

## Prerequisites

1. **Next.js 15+** with static export enabled
2. **Ollama server** running and accessible
3. **Local fonts** downloaded (Geist, GeistMono, or your choice)
4. **TypeScript** (recommended)

---

## Step-by-Step Implementation

### Step 1: Configure Next.js for Static Export

**File:** `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",           // Enable static export
  images: { unoptimized: true }, // No image optimization
  trailingSlash: true,         // Better for static hosting
};

export default nextConfig;
```

**Why:**
- `output: "export"` generates pure static files (no server required)
- `images.unoptimized` avoids Next.js image optimization (requires server)
- `trailingSlash: true` works better with static file servers

---

### Step 2: Set Up Environment Variables

Create **build-time** environment variables for Ollama endpoints:

**File:** `.env.development` (Development)

```bash
NEXT_PUBLIC_OLLAMA_BASE_URL=http://localhost:11434
```

**File:** `.env.production` (Production)

```bash
NEXT_PUBLIC_OLLAMA_BASE_URL=http://10.6.135.213:80
```

**File:** `.env.example` (Documentation)

```bash
# Ollama API Base URL (build-time variable)
# Development: http://localhost:11434
# Production: http://YOUR_HOSPITAL_IP:PORT
NEXT_PUBLIC_OLLAMA_BASE_URL=http://localhost:11434
```

**Important:**
- Must use `NEXT_PUBLIC_` prefix for browser access
- These are **build-time** variables (embedded into static bundle)
- Change requires rebuild: `npm run build`

---

### Step 3: Create Ollama Browser Client

**File:** `lib/ollama-client.ts`

```typescript
import { Ollama } from 'ollama/browser'

// Get base URL from build-time environment variable
const baseUrl = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434'

export const ollamaClient = new Ollama({
  host: baseUrl,
})

export const OLLAMA_BASE_URL = baseUrl
```

**Why `ollama/browser`:**
- Official browser-compatible client
- Direct HTTP calls from browser
- No CORS proxy needed (if Ollama CORS enabled)
- Alternative to writing custom fetch code

---

### Step 4: Create Zustand Store for Model Selection

**File:** `lib/stores/model-store.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ModelStore {
  selectedModel: string
  setSelectedModel: (model: string) => void
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      selectedModel: '', // Empty initially
      setSelectedModel: (model) => set({ selectedModel: model }),
    }),
    {
      name: 'ollama-model-storage',
    }
  )
)
```

**Why:**
- Persists selected model to localStorage
- Survives page refreshes
- Starts empty (important for chicken-and-egg fix, see Caveats)

---

### Step 5: Create Custom Runtime Adapter

**File:** `lib/ollama-runtime.ts`

```typescript
import { useLocalRuntime } from "@assistant-ui/react";
import type { ChatModelAdapter } from "@assistant-ui/react";
import { ollamaClient } from "./ollama-client";
import { useModelStore } from "./stores/model-store";

// Type for text content
type TextContent = {
  type: "text";
  text: string;
};

export function useOllamaRuntime() {
  const adapter: ChatModelAdapter = {
    async *run({ messages, abortSignal }) {
      // Get current model from store
      const model = useModelStore.getState().selectedModel || "gemma3:latest";

      // Convert messages to Ollama format
      const ollamaMessages = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content:
          msg.content
            .filter((c): c is TextContent => c.type === "text")
            .map((c) => c.text)
            .join("") || "",
      }));

      try {
        // Accumulate text for streaming
        let accumulatedText = "";

        // Stream chat from Ollama
        const response = await ollamaClient.chat({
          model,
          messages: ollamaMessages,
          stream: true,
        });

        // Stream chunks
        for await (const chunk of response) {
          if (abortSignal?.aborted) break;

          const delta = chunk.message.content;
          accumulatedText += delta;

          //  CRITICAL: Must yield full content array, not deltas
          yield {
            content: [
              {
                type: "text" as const,
                text: accumulatedText,
              },
            ],
          };
        }
      } catch (error) {
        console.error("Ollama runtime error:", error);

        // Yield error status
        yield {
          content: [
            {
              type: "text" as const,
              text: "",
            },
          ],
          status: {
            type: "incomplete" as const,
            reason: "error" as const,
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  };

  return useLocalRuntime(adapter);
}
```

** Critical Points:**
- Must **accumulate text** and yield full `content` array
- Cannot use simple `{ type: "text-delta", textDelta: delta }` (type mismatch)
- `ChatModelAdapter` expects `{ content: TextMessagePart[] }`
- Type guard `(c): c is TextContent` avoids `any` type errors

---

### Step 6: Create Model Selector Component

**File:** `components/assistant-ui/model-selector.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useModelStore } from "@/lib/stores/model-store";
import { Skeleton } from "@/components/ui/skeleton";
import { ollamaClient } from "@/lib/ollama-client";

interface OllamaModel {
  name: string;
  model: string;
}

export function ModelSelector() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { selectedModel, setSelectedModel } = useModelStore();

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsLoading(true);

        //  Direct browser call (no API route)
        const response = await ollamaClient.list();

        const modelList = response.models.map((m) => ({
          name: m.name,
          model: m.model,
        }));

        setModels(modelList);

        // Auto-select first model if none selected
        if (modelList.length > 0) {
          const modelExists = modelList.some((m) => m.name === selectedModel);
          if (!selectedModel || !modelExists) {
            setSelectedModel(modelList[0].name);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [selectedModel, setSelectedModel]);

  if (isLoading) {
    return <Skeleton className="h-10 w-[180px]" />;
  }

  if (error || models.length === 0) {
    return <div className="text-sm text-muted-foreground">No models available</div>;
  }

  return (
    <Select value={selectedModel} onValueChange={setSelectedModel}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.name} value={model.name}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Why:**
- Fetches models directly from Ollama (no API route)
- Auto-selects first model on initial load
- Persists selection to localStorage via Zustand

---

### Step 7: Integrate Runtime in Main Component

**File:** `app/assistant.tsx`

```typescript
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { useModelStore } from "@/lib/stores/model-store";
import { Skeleton } from "@/components/ui/skeleton";
import { useOllamaRuntime } from "@/lib/ollama-runtime";

export const Assistant = () => {
  const selectedModel = useModelStore((state) => state.selectedModel);

  // Use custom Ollama runtime
  const runtime = useOllamaRuntime();

  //  CRITICAL FIX: Chicken-and-Egg Bug
  // Must render ModelSelector even when no model selected
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

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Your chat UI here */}
      <header>
        <ModelSelector />
      </header>
      <Thread key={selectedModel} />
    </AssistantRuntimeProvider>
  );
};
```

** See [Caveat #1](#caveat-1-chicken-and-egg-bug-with-modelselector) for why this is critical!**

---

### Step 8: Add Local Fonts (No CDN)

Download fonts and place in `app/fonts/`:

```
app/fonts/
 Geist/
    Geist[wght].woff2
    Geist-Italic[wght].woff2
 GeistMono/
     GeistMono[wght].woff2
     GeistMono-Italic[wght].woff2
```

**File:** `app/layout.tsx`

```typescript
import localFont from "next/font/local";

const geistSans = localFont({
  src: [
    { path: "./fonts/Geist/Geist[wght].woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/Geist/Geist-Italic[wght].woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "./fonts/GeistMono/GeistMono[wght].woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/GeistMono/GeistMono-Italic[wght].woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
```

**Why:**
- No Google Fonts CDN required
- Works completely offline
- Fonts bundled in static export

---

### Step 9: Configure npm Scripts

**File:** `package.json`

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "build:local": "NEXT_PUBLIC_OLLAMA_BASE_URL=http://localhost:11434 next build",
    "build:prod": "NEXT_PUBLIC_OLLAMA_BASE_URL=http://10.6.135.213:80 next build",
    "serve": "cd out && python3 -m http.server 8000",
    "clean": "rm -rf out .next"
  }
}
```

**Usage:**
```bash
# Development
npm run dev

# Build for local testing
npm run build:local

# Build for production
npm run build:prod

# Serve static build
npm run serve

# Clean artifacts
npm run clean
```

---

## Critical Caveats

### Caveat #1: Chicken-and-Egg Bug with ModelSelector

**Problem:**
- App shows skeleton until model is selected
- ModelSelector (which fetches models) is inside component that only renders after model exists
- Result: **Infinite loading screen** =

**Solution:**
Render ModelSelector **hidden** during loading:

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

**Why it works:**
- ModelSelector mounts and fetches models
- Auto-selects first model
- Component re-renders with model selected
- App loads normally

**Don't:**
```tsx
// L WRONG: ModelSelector never renders
if (!selectedModel) {
  return <Skeleton />;
}

return (
  <div>
    <ModelSelector /> {/* Too late! */}
  </div>
);
```

---

### Caveat #2: TypeScript ChatModelAdapter Types

**Problem:**
```typescript
// L WRONG: Type error!
yield {
  type: "text-delta",
  textDelta: delta,
};
```

**Error:**
```
Type '{ type: "text-delta"; textDelta: string; }' is not assignable to type 'ChatModelRunResult'
```

**Root Cause:**
- `ChatModelAdapter` expects `{ content: TextMessagePart[] }`
- Not `{ type: "text-delta", textDelta: string }`

**Solution:**
Accumulate text and yield full content array:

```typescript
let accumulatedText = "";

for await (const chunk of response) {
  accumulatedText += chunk.message.content;

  //  CORRECT: Yield full content array
  yield {
    content: [
      {
        type: "text" as const,
        text: accumulatedText,
      },
    ],
  };
}
```

**Why:**
- `assistant-ui` expects complete content on each yield
- Not delta streaming
- Must accumulate and send full text each time

---

### Caveat #3: Type Guard for Content Filtering

**Problem:**
```typescript
// L WRONG: ESLint error "no-explicit-any"
.map((c: any) => c.text)
```

**Solution:**
Use type guard:

```typescript
//  CORRECT: Type guard avoids 'any'
type TextContent = {
  type: "text";
  text: string;
};

msg.content
  .filter((c): c is TextContent => c.type === "text")
  .map((c) => c.text)
  .join("")
```

**Why:**
- Type guard `(c): c is TextContent` narrows type
- No `any` needed
- Type-safe access to `c.text`

---

### Caveat #4: Build-Time Environment Variables

**Problem:**
Environment variables don't update without rebuild.

**Why:**
- `NEXT_PUBLIC_*` variables are **embedded during build**
- Not read at runtime
- Static files have hardcoded URLs

**Solution:**
Rebuild for different environments:

```bash
# For localhost testing
npm run build:local

# For production deployment
npm run build:prod
```

**Don't:**
```bash
# L WRONG: Won't work!
NEXT_PUBLIC_OLLAMA_BASE_URL=http://new-url npm run serve
```

---

### Caveat #5: CORS Configuration

**Problem:**
Browser blocks Ollama API calls with CORS error.

**Why:**
- Browser security policy
- Direct browser  Ollama calls need CORS headers

**Solution:**
Enable CORS on Ollama server:

```bash
# Option 1: Environment variable
OLLAMA_ORIGINS=* ollama serve

# Option 2: Systemd service
# Edit /etc/systemd/system/ollama.service
Environment="OLLAMA_ORIGINS=*"
```

**Alternative:**
Use nginx reverse proxy (avoids CORS):

```nginx
location /api/ollama {
    proxy_pass http://10.6.135.213:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Then build with:
```bash
NEXT_PUBLIC_OLLAMA_BASE_URL=/api/ollama npm run build
```

---

### Caveat #6: Empty Model Store Default

**Problem:**
Store starts with default model `"gemma3:latest"`, but it might not exist.

**Solution:**
Start with empty string, let ModelSelector auto-select first available model:

```typescript
//  CORRECT
selectedModel: '', // Empty initially

// ModelSelector will auto-select first model
if (!selectedModel || !modelExists) {
  setSelectedModel(modelList[0].name);
}
```

**Why:**
- Flexible: works with any Ollama setup
- Auto-detects available models
- No hardcoded model names

---

## Build and Deployment

### Development Build

```bash
npm run dev
```

**Uses:** `.env.development` (localhost:11434)

### Production Build

```bash
# Build for hospital deployment
npm run build:prod

# Or manually
NEXT_PUBLIC_OLLAMA_BASE_URL=http://10.6.135.213:80 npm run build
```

**Output:** `/out` directory with static files

### Local Testing

```bash
# Serve static build
npm run serve

# Or manually
cd out
python3 -m http.server 8000

# Open: http://localhost:8000
```

### Deploy to Server

1. Copy `/out` directory to server
2. Serve with nginx/Apache/Python HTTP server
3. Ensure Ollama server is accessible from browser

**Example nginx config:**

```nginx
server {
    listen 80;
    server_name chat.hospital.local;

    root /var/www/ollama-chat/out;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Troubleshooting

### Issue: Blank Screen, No Errors

**Symptoms:**
- Browser shows blank page
- No console errors
- Network tab shows all files loaded (200 OK)

**Cause:**
Chicken-and-egg bug (ModelSelector not rendering)

**Fix:**
Check `app/assistant.tsx` has hidden ModelSelector:

```tsx
if (!selectedModel) {
  return (
    <div className="...">
      <Skeleton />
      <div className="hidden">
        <ModelSelector /> {/*  Must be here! */}
      </div>
    </div>
  );
}
```

---

### Issue: CORS Error

**Symptoms:**
```
Access to fetch at 'http://10.6.135.213:80/api/tags' from origin 'http://localhost:8000' has been blocked by CORS policy
```

**Fix:**
Enable CORS on Ollama server:

```bash
OLLAMA_ORIGINS=* ollama serve
```

Or use nginx reverse proxy.

---

### Issue: Wrong Ollama URL

**Symptoms:**
- App tries to connect to wrong IP
- 404 or connection refused errors

**Cause:**
Environment variable embedded during build.

**Fix:**
Rebuild with correct URL:

```bash
npm run build:local   # For localhost
npm run build:prod    # For production
```

---

### Issue: TypeScript Errors

**Symptoms:**
```
Type '{ type: "text-delta"; textDelta: string; }' is not assignable to type 'ChatModelRunResult'
```

**Fix:**
Use accumulation pattern (see [Caveat #2](#caveat-2-typescript-chatmodeladapter-types))

---

### Issue: Models Not Loading

**Symptoms:**
- Dropdown shows "No models available"
- Ollama server running but not responding

**Checklist:**
1.  Ollama server running: `curl http://localhost:11434/api/tags`
2.  Correct URL in build: Check browser Network tab
3.  CORS enabled on Ollama
4.  Firewall allows connection

---

## Testing

### Test Checklist

- [ ] `npm run dev` works (development mode)
- [ ] `npm run build:local` completes without errors
- [ ] Static files generated in `/out`
- [ ] `npm run serve` serves app correctly
- [ ] Model dropdown loads and shows models
- [ ] Can select different models
- [ ] Chat streaming works
- [ ] Messages persist in thread
- [ ] Works completely offline (disconnect internet)
- [ ] `npm run build:prod` works with production URL

### Manual Testing Steps

1. **Build and serve:**
   ```bash
   npm run build:local
   npm run serve
   ```

2. **Open browser:** http://localhost:8000

3. **Check model dropdown:**
   - Should load models from Ollama
   - Auto-selects first model

4. **Send test message:**
   - Type message
   - Press send
   - Should see streaming response

5. **Test offline:**
   - Disconnect internet
   - Refresh page
   - Should still work (fonts, assets load locally)

6. **Test model switching:**
   - Change model in dropdown
   - Send message
   - Should use new model

---

## Best Practices

1. **Always use type guards** instead of `any`
2. **Start with empty model** in store (not hardcoded default)
3. **Render ModelSelector hidden** during loading
4. **Use accumulation pattern** for streaming (not deltas)
5. **Test offline** before deployment
6. **Document environment variables** in `.env.example`
7. **Use npm scripts** for different build targets
8. **Test with Python HTTP server** before deploying to nginx

---

## Summary

**Key Takeaways:**

1.  Use `ollama/browser` for direct browser calls
2.  Render ModelSelector hidden to avoid chicken-and-egg bug
3.  Accumulate streaming text (don't use deltas)
4.  Build-time environment variables (requires rebuild)
5.  Enable CORS on Ollama or use nginx proxy
6.  Bundle local fonts (no CDN)
7.  Test offline thoroughly

**Architecture Benefits:**

- No Node.js runtime in production
- No API routes
- Works completely offline
- Simple deployment (static files)
- Fast loading (no SSR overhead)

**This implementation has been tested and verified working in a hospital intranet environment.**

---

## Additional Resources

- [Next.js Static Export Docs](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Ollama JavaScript Library](https://github.com/ollama/ollama-js)
- [assistant-ui Documentation](https://www.assistant-ui.com/docs)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)

---

**Last Updated:** October 2025
**Status:** Production-ready 
