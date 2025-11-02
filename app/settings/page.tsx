"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
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
import {
  useChatStore,
  getChatStorageStats,
  exportChatData,
} from "@/lib/stores/chat-store";

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

  // Storage stats state
  const [storageStats, setStorageStats] = useState({
    usedMB: 0,
    limitMB: 5,
    usagePercent: 0,
    threadCount: 0,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Load storage stats on mount and when chat store changes
  useEffect(() => {
    const stats = getChatStorageStats();
    setStorageStats(stats);
  }, []);

  // Handle export conversations
  const handleExport = () => {
    setIsExporting(true);
    try {
      exportChatData();
      // Refresh stats after export (though it shouldn't change stats)
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
    } catch (error) {
      console.error("Export failed:", error);
      setIsExporting(false);
    }
  };

  // Handle delete all conversations
  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      // Clear all threads using chat store
      useChatStore.getState().clearAllThreads();

      // Refresh stats
      const stats = getChatStorageStats();
      setStorageStats(stats);
      setShowDeleteConfirm(false);

      setTimeout(() => {
        setIsDeleting(false);
      }, 500);
    } catch (error) {
      console.error("Delete failed:", error);
      setIsDeleting(false);
    }
  };

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

          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Storage Usage</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {storageStats.usedMB.toFixed(2)} MB / {storageStats.limitMB} MB
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(storageStats.usagePercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {storageStats.threadCount} conversation{storageStats.threadCount !== 1 ? "s" : ""} saved
                  {storageStats.usagePercent > 80 && (
                    <span className="text-orange-600 dark:text-orange-500">
                      {" "}• Storage almost full
                    </span>
                  )}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={isExporting || storageStats.threadCount === 0}
                    className="gap-2"
                  >
                    <Download className="size-4" />
                    {isExporting ? "Exporting..." : "Export Data"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Download conversations as JSON backup
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting || storageStats.threadCount === 0}
                    className="gap-2"
                  >
                    <Trash2 className="size-4" />
                    {showDeleteConfirm
                      ? "Click again to confirm"
                      : isDeleting
                        ? "Deleting..."
                        : "Delete All Conversations"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {showDeleteConfirm ? (
                      <span className="text-destructive font-medium">
                        This will permanently delete all saved conversations
                      </span>
                    ) : (
                      "Clear all saved conversation history"
                    )}
                  </p>
                </div>

                {showDeleteConfirm && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
