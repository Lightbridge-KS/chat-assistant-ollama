/**
 * Ollama Browser Client
 *
 * Uses the official ollama/browser package for direct connection to Ollama API.
 * The base URL is configured via NEXT_PUBLIC_OLLAMA_BASE_URL environment variable
 * at build time.
 */

import { Ollama } from 'ollama/browser'

// Get base URL from build-time environment variable
const baseUrl = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434'

export const ollamaClient = new Ollama({
  host: baseUrl,
})

// Export base URL for debugging/display purposes
export const OLLAMA_BASE_URL = baseUrl
