"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { OLLAMA_BASE_URL } from "@/lib/ollama-client";

export default function SettingsPage() {
  // Get current settings from store
  const { ollamaHostUrl, systemPrompt, setOllamaHostUrl, setSystemPrompt } =
    useSettingsStore();

  // Local form state (draft until saved)
  const [draftUrl, setDraftUrl] = useState(ollamaHostUrl);
  const [draftPrompt, setDraftPrompt] = useState(systemPrompt);
  const [isSaved, setIsSaved] = useState(false);

  // Handle save button
  const handleSave = () => {
    setOllamaHostUrl(draftUrl);
    setSystemPrompt(draftPrompt);
    setIsSaved(true);

    // Clear success message after 3 seconds
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  // Check if changes were made
  const hasChanges = draftUrl !== ollamaHostUrl || draftPrompt !== systemPrompt;

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
        <div className="mx-auto max-w-4xl">
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
                <Button onClick={handleSave} disabled={!hasChanges}>
                  Save Settings
                </Button>
                {isSaved && (
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
