'use client'

import { useState, useCallback, useRef } from 'react'
import { useStore } from '@/store/useStore'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  clearChat: () => void
}

/**
 * Client-side chat hook that manages conversation state and streams
 * responses from the /api/chat endpoint.
 *
 * Includes:
 * - Streaming token-by-token response rendering
 * - Exponential backoff retry on 429 (rate limit)
 * - Graceful error messages for all failure modes
 * - Abort support to cancel in-flight requests
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const talkStartRef = useRef(0)
  const talkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setTalking = useStore((s) => s.setTalking)

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsStreaming(true)

    // Start talking animation
    if (talkTimerRef.current) clearTimeout(talkTimerRef.current)
    talkStartRef.current = Date.now()
    setTalking(true)

    // Abort any previous in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetchWithRetry(
        '/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages }),
          signal: controller.signal,
        },
        3 // max retries for 429
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          data.error || `Request failed with status ${response.status}`
        )
      }

      // Read the SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let assistantContent = ''

      // Add a placeholder assistant message
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()

          if (payload === '[DONE]') continue

          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) {
              throw new Error(parsed.error)
            }
            if (parsed.text) {
              assistantContent += parsed.text
              // Update the last message (assistant) with accumulated content
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantContent,
                }
                return updated
              })
            }
          } catch (e) {
            // Skip malformed chunks silently unless it's a thrown error
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              throw e
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — not an error
        return
      }

      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'

      setError(message)

      // Remove the empty assistant placeholder if streaming hadn't started
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null

      // Keep talking animation for at least 5s total
      const elapsed = Date.now() - talkStartRef.current
      const MIN_TALK_MS = 5000
      const remaining = MIN_TALK_MS - elapsed
      if (remaining > 0) {
        talkTimerRef.current = setTimeout(() => setTalking(false), remaining)
      } else {
        setTalking(false)
      }
    }
  }, [messages, isStreaming])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setIsStreaming(false)
  }, [])

  return { messages, isStreaming, error, sendMessage, clearChat }
}

// ─── Fetch with exponential backoff on 429 ──────────────────────────────────
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init)

    if (response.status !== 429 || attempt === maxRetries) {
      return response
    }

    // Parse Retry-After header or use exponential backoff
    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null
    const baseDelay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
    const jitter = Math.random() * 500
    const delay = retryAfterSec
      ? Math.min(retryAfterSec * 1000, 30_000)
      : baseDelay + jitter

    await new Promise((r) => setTimeout(r, delay))
  }

  // Should never reach here, but TypeScript needs it
  throw new Error('Max retries exceeded')
}
