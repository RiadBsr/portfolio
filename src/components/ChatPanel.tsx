'use client'

import { useState, useRef, useEffect, type CSSProperties, type KeyboardEvent } from 'react'
import { useStore } from '@/store/useStore'
import { useChat, type ChatMessage } from '@/hooks/useChat'

// ─── Suggested prompts ──────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  'Tell me about yourself',
  'What did you do at GoPro?',
  'Tell me about the hackathon win',
  'Are you available for hire?',
]

// ─── Styles ──────────────────────────────────────────────────────────────────
const mono: CSSProperties = {
  fontFamily: 'var(--font-space-mono, monospace)',
}

const dmSans: CSSProperties = {
  fontFamily: 'var(--font-dm-sans, sans-serif)',
}

/**
 * ChatPanel — A placeholder 2D overlay chat interface.
 *
 * This will eventually be replaced by a 3D tablet component (Phase 3).
 * For now it renders as a fixed panel in the bottom-right corner.
 */
export function ChatPanel() {
  const chatMode = useStore((s) => s.chatMode)
  const setChatMode = useStore((s) => s.setChatMode)
  const { messages, isStreaming, error, sendMessage, clearChat } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (chatMode) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [chatMode])

  // ESC key closes chat
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && chatMode) {
        setChatMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chatMode, setChatMode])

  if (!chatMode) return null

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePromptClick = (prompt: string) => {
    sendMessage(prompt)
  }

  const handleClose = () => {
    setChatMode(false)
  }

  return (
    <div
      ref={panelRef}
      onTouchMove={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 'min(420px, calc(100vw - 40px))',
        height: 'min(600px, calc(100vh - 100px))',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(8, 8, 8, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        animation: 'chatPanelIn 0.3s ease-out',
        touchAction: 'none',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              boxShadow: '0 0 8px rgba(74, 222, 128, 0.4)',
            }}
          />
          <span
            style={{
              ...mono,
              fontSize: '9px',
              letterSpacing: '0.22em',
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
            }}
          >
            ASK RIAD — AI CLONE
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {messages.length > 0 && (
            <button
              onClick={() => clearChat()}
              style={{
                ...mono,
                fontSize: '8px',
                letterSpacing: '0.12em',
                color: 'rgba(255, 255, 255, 0.25)',
                background: 'none',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              CLEAR
            </button>
          )}
          <button
            onClick={handleClose}
            style={{
              ...mono,
              fontSize: '8px',
              letterSpacing: '0.12em',
              color: 'rgba(255, 255, 255, 0.3)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            ESC
          </button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Suggested prompts — only shown when no messages */}
        {messages.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: '16px',
              padding: '20px 0',
            }}
          >
            <p
              style={{
                ...dmSans,
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.3)',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Hi! I&apos;m Riad&apos;s AI clone. Ask me anything about his work, skills, or experience.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
                maxWidth: '340px',
              }}
            >
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  style={{
                    ...mono,
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.45)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} isLatest={i === messages.length - 1 && msg.role === 'assistant'} isStreaming={isStreaming} />
        ))}

        {/* Error display */}
        {error && (
          <div
            style={{
              ...dmSans,
              fontSize: '12px',
              color: '#f87171',
              background: 'rgba(248, 113, 113, 0.08)',
              border: '1px solid rgba(248, 113, 113, 0.15)',
              borderRadius: '8px',
              padding: '10px 14px',
            }}
          >
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'Thinking...' : 'Ask me anything...'}
          disabled={isStreaming}
          style={{
            ...dmSans,
            flex: 1,
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.85)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '10px 14px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          style={{
            ...mono,
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: !input.trim() || isStreaming
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.8)',
            background: !input.trim() || isStreaming
              ? 'rgba(255, 255, 255, 0.03)'
              : 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: !input.trim() || isStreaming ? 'default' : 'pointer',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          {isStreaming ? (
            <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
              ···
            </span>
          ) : (
            'SEND'
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Message bubble sub-component ────────────────────────────────────────────
function MessageBubble({
  message,
  isLatest,
  isStreaming,
}: {
  message: ChatMessage
  isLatest: boolean
  isStreaming: boolean
}) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          ...dmSans,
          maxWidth: '85%',
          fontSize: '13px',
          lineHeight: 1.6,
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.02)',
          color: isUser
            ? 'rgba(255, 255, 255, 0.85)'
            : 'rgba(255, 255, 255, 0.75)',
          borderLeft: isUser ? 'none' : '2px solid rgba(255, 255, 255, 0.1)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        {isLatest && isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '14px',
              background: 'rgba(255, 255, 255, 0.5)',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>
    </div>
  )
}
