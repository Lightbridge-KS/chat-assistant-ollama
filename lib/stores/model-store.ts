import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ModelStore {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      selectedModel: "",
      setSelectedModel: (model) => set({ selectedModel: model }),
    }),
    {
      name: "ollama-model-storage",
    }
  )
);
