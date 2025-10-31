import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OLLAMA_BASE_URL } from "@/lib/ollama-client";

interface SettingsStore {
  ollamaHostUrl: string;
  systemPrompt: string;
  appearance: "system" | "light" | "dark";
  setOllamaHostUrl: (url: string) => void;
  setSystemPrompt: (prompt: string) => void;
  setAppearance: (appearance: "system" | "light" | "dark") => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Default from build-time environment variable
      ollamaHostUrl: OLLAMA_BASE_URL,
      systemPrompt: "You are a helpful assistance.",
      appearance: "system",
      setOllamaHostUrl: (url) => set({ ollamaHostUrl: url }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      name: "ollama-settings-storage",
    }
  )
);
