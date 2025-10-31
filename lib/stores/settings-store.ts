import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OLLAMA_BASE_URL } from "@/lib/ollama-client";

interface SettingsStore {
  ollamaHostUrl: string;
  systemPrompt: string;
  setOllamaHostUrl: (url: string) => void;
  setSystemPrompt: (prompt: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Default from build-time environment variable
      ollamaHostUrl: OLLAMA_BASE_URL,
      systemPrompt: "You are a helpful assistance.",
      setOllamaHostUrl: (url) => set({ ollamaHostUrl: url }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
    }),
    {
      name: "ollama-settings-storage",
    }
  )
);
