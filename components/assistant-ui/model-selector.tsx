"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelStore } from "@/lib/stores/model-store";
import { Skeleton } from "@/components/ui/skeleton";

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
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error("Failed to fetch models");
        }
        const data = await response.json();
        setModels(data);

        // Auto-select first model if no model is selected or selected model doesn't exist
        if (data.length > 0) {
          const modelExists = data.some((m: OllamaModel) => m.name === selectedModel);
          if (!selectedModel || !modelExists) {
            setSelectedModel(data[0].name);
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
    return (
      <div className="text-sm text-muted-foreground">No models available</div>
    );
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
