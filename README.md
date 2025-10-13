# Ollama Chat Assistant

Next.js chat application using [assistant-ui](https://github.com/Yonom/assistant-ui) with local LLM integration via Ollama.

## Prerequisites

- **Ollama** must be installed and running locally
- Install from: https://ollama.ai
- Default endpoint: `http://localhost:11434`

## Getting Started

1. **Start Ollama** and pull at least one model:
```bash
ollama pull gemma3:latest
# or any other model
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run development server:**
```bash
npm run dev
```

4. **Open** [http://localhost:3000](http://localhost:3000)

## Features

- 🔄 Dynamic model selection from available Ollama models
- 💬 Multi-thread conversation management
- 🎨 Markdown rendering with syntax highlighting
- 💾 Thread persistence with localStorage
- ⚡ Real-time model switching

## Tech Stack

- Next.js 15.5 (App Router)
- assistant-ui (React chat components)
- Ollama (Local LLM provider)
- Zustand (State management)
- Radix UI + Tailwind CSS
