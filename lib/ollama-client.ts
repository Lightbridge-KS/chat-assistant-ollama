/**
 * Ollama Browser Client
 *
 * Uses the official ollama/browser package for connection to Ollama API.
 * The base URL is configured via NEXT_PUBLIC_OLLAMA_BASE_URL environment variable
 * at build time.
 *
 * Two deployment modes:
 *
 * 1. Localhost (NEXT_PUBLIC_IS_LOCALHOST=true):
 *    - Direct connection to http://localhost:11434
 *    - No CORS issues (same origin)
 *    - For local testing and development
 *
 * 2. Hospital Production (NEXT_PUBLIC_IS_LOCALHOST=false):
 *    - Uses nginx reverse proxy: /api/ollama -> http://10.6.135.213:80
 *    - Relative path avoids CORS issues
 *    - Deployed at http://10.6.34.95/radchat
 */

import { Ollama } from 'ollama/browser'

// Is build for localhost deployment
const isLocalHost: boolean = process.env.NEXT_PUBLIC_IS_LOCALHOST === "true";
const baseUrlLocalHost: string = 'http://localhost:11434';

// Get base URL from build-time environment variable
// For localhost: direct connection to http://localhost:11434
// For hospital: relative path /api/ollama (proxied by nginx)
const baseUrl: string = isLocalHost ? baseUrlLocalHost : (process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || baseUrlLocalHost);

export const ollamaClient = new Ollama({
  host: baseUrl,
})

// Export base URL for debugging/display purposes
export const OLLAMA_BASE_URL = baseUrl
