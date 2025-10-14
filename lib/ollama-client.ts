/**
 * Ollama Browser Client
 *
 * Uses the official ollama/browser package for direct connection to Ollama API.
 * The base URL is configured via NEXT_PUBLIC_OLLAMA_BASE_URL environment variable
 * at build time.
 */

import { Ollama } from 'ollama/browser'

// Is build for localhost deployment
const isLocalHost: boolean = process.env.NEXT_PUBLIC_IS_LOCALHOST === "true";
const baseUrlLocalHost: string = 'http://localhost:11434';

// Get base URL from build-time environment variable
const baseUrl: string = isLocalHost ? baseUrlLocalHost : (process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || baseUrlLocalHost);

export const ollamaClient = new Ollama({
  host: baseUrl,
})

// Export base URL for debugging/display purposes
export const OLLAMA_BASE_URL = baseUrl
