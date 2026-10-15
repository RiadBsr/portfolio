import { GoogleGenAI } from '@google/genai'
import { SYSTEM_PROMPT } from '@/lib/systemPrompt'

// ─── Rate limiter (in-memory, per-instance) ──────────────────────────────────
// Gemini 2.5 Flash-Lite free tier: 15 RPM, 1000 RPD.
// We enforce slightly below to leave headroom.
const RATE_LIMIT = {
  maxPerMinute: 12,   // stay under 15 RPM
  maxPerDay: 900,     // stay under 1000 RPD
  windowMs: 60_000,
}

interface RateBucket {
  timestamps: number[]  // request timestamps within the current minute window
  dailyCount: number
  dailyReset: number    // epoch ms when the daily counter resets (midnight PT)
}

const bucket: RateBucket = {
  timestamps: [],
  dailyCount: 0,
  dailyReset: getNextMidnightPT(),
}

function getNextMidnightPT(): number {
  // Gemini daily quota resets at midnight Pacific Time
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  pt.setHours(24, 0, 0, 0)
  // Convert back to UTC epoch
  const diff = pt.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getTime()
  return now.getTime() + diff
}

function checkRateLimit(): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()

  // Reset daily counter if past midnight PT
  if (now >= bucket.dailyReset) {
    bucket.dailyCount = 0
    bucket.dailyReset = getNextMidnightPT()
  }

  // Prune timestamps older than the 1-minute window
  bucket.timestamps = bucket.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT.windowMs
  )

  // Check daily limit
  if (bucket.dailyCount >= RATE_LIMIT.maxPerDay) {
    return { allowed: false, retryAfterMs: bucket.dailyReset - now }
  }

  // Check per-minute limit
  if (bucket.timestamps.length >= RATE_LIMIT.maxPerMinute) {
    const oldestInWindow = bucket.timestamps[0]
    const retryAfterMs = RATE_LIMIT.windowMs - (now - oldestInWindow)
    return { allowed: false, retryAfterMs }
  }

  // Allow — record this request
  bucket.timestamps.push(now)
  bucket.dailyCount++
  return { allowed: true }
}

// ─── Gemini client ───────────────────────────────────────────────────────────
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  return new GoogleGenAI({ apiKey })
}

// ─── Route handler ───────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json().catch(() => null)
    if (
      !body ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      return Response.json(
        { error: 'Invalid request body. Expected { messages: [...] }' },
        { status: 400 }
      )
    }

    // Validate message structure
    for (const msg of body.messages) {
      if (
        !msg.role ||
        !msg.content ||
        typeof msg.content !== 'string' ||
        !['user', 'assistant'].includes(msg.role)
      ) {
        return Response.json(
          { error: 'Each message must have a role ("user" | "assistant") and a content string.' },
          { status: 400 }
        )
      }
    }

    // Rate limit check
    const rateCheck = checkRateLimit()
    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.retryAfterMs ?? 60_000) / 1000)
      return Response.json(
        {
          error: "I'm getting a lot of questions right now! Please try again in a moment.",
          retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      )
    }

    // Build Gemini contents array from message history
    const contents = body.messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    )

    // Call Gemini with streaming
    const ai = getClient()
    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 1024,
        temperature: 0.7,
        topP: 0.9,
      },
    })

    // Stream the response as SSE-like text chunks
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text ?? ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Stream interrupted'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[chat/route] Error:', err)

    // Handle specific Gemini API errors
    if (err instanceof Error) {
      if (err.message.includes('GEMINI_API_KEY')) {
        return Response.json(
          { error: 'Chat is not configured yet. Please set up the API key.' },
          { status: 503 }
        )
      }
      if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
        // Upstream rate limit from Google — back off the client
        return Response.json(
          {
            error: "I'm getting a lot of questions right now! Please try again in a moment.",
            retryAfter: 30,
          },
          { status: 429, headers: { 'Retry-After': '30' } }
        )
      }
      if (err.message.includes('403') || err.message.includes('PERMISSION_DENIED')) {
        return Response.json(
          { error: 'API key is invalid or does not have access to this model.' },
          { status: 403 }
        )
      }
    }

    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
