"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { OLLAMA_BASE_URL } from "@/lib/ollama-client";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  // Get current settings from store
  const {
    ollamaHostUrl,
    systemPrompt,
    appearance,
    setOllamaHostUrl,
    setSystemPrompt,
    setAppearance,
  } = useSettingsStore();

  // Get theme setter from next-themes
  const { setTheme } = useTheme();

  // Local form state for Ollama settings (draft until saved)
  const [draftUrl, setDraftUrl] = useState(ollamaHostUrl);
  const [draftPrompt, setDraftPrompt] = useState(systemPrompt);
  const [isOllamaSaved, setIsOllamaSaved] = useState(false);

  // Local form state for App settings (draft until saved)
  const [draftAppearance, setDraftAppearance] = useState(appearance);
  const [isAppSaved, setIsAppSaved] = useState(false);

  // Handle save button for Ollama settings
  const handleSaveOllama = () => {
    setOllamaHostUrl(draftUrl);
    setSystemPrompt(draftPrompt);
    setIsOllamaSaved(true);

    // Clear success message after 3 seconds
    setTimeout(() => {
      setIsOllamaSaved(false);
    }, 3000);
  };

  // Handle save button for App settings
  const handleSaveApp = () => {
    setAppearance(draftAppearance);
    setTheme(draftAppearance); // Apply theme immediately
    setIsAppSaved(true);

    // Clear success message after 3 seconds
    setTimeout(() => {
      setIsAppSaved(false);
    }, 3000);
  };

  // Check if changes were made for Ollama settings
  const hasOllamaChanges =
    draftUrl !== ollamaHostUrl || draftPrompt !== systemPrompt;

  // Check if changes were made for App settings
  const hasAppChanges = draftAppearance !== appearance;

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Chat
          </Link>
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
      </header>

      <main className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ollama</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="ollama-url">Ollama Host URL</Label>
                <Input
                  id="ollama-url"
                  type="url"
                  placeholder={OLLAMA_BASE_URL}
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The default localhost Ollama API is http://localhost:11434
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  placeholder="You are a helpful assistance."
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  rows={10}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Your preferences will apply to all conversations
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveOllama} disabled={!hasOllamaChanges}>
                  Save Settings
                </Button>
                {isOllamaSaved && (
                  <span className="text-sm text-green-600 dark:text-green-500">
                    Settings saved successfully!
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>App</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="appearance">
                    Appearance
                  </Label>
                  <Select
                    value={draftAppearance}
                    onValueChange={(value) =>
                      setDraftAppearance(value as "system" | "light" | "dark")
                    }
                  >
                    <SelectTrigger id="appearance" className="w-30">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose how the app looks.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveApp} disabled={!hasAppChanges}>
                  Save Settings
                </Button>
                {isAppSaved && (
                  <span className="text-sm text-green-600 dark:text-green-500">
                    Settings saved successfully!
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
