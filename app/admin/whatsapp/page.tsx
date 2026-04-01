'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Send,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  User,
  Bot,
  Headphones,
  ChevronLeft,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { setUserRole } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string
  mobile: string
  customerName: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  isResolved: boolean
  _count: { messages: number }
}

interface Message {
  id: string
  waMessageId: string | null
  direction: 'inbound' | 'outbound'
  senderType: 'user' | 'agent' | 'system'
  body: string
  messageType: string
  status: string
  templateName: string | null
  refType: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Group messages by date
function groupByDate(messages: Message[]): Array<{ date: string; messages: Message[] }> {
  const groups: Record<string, Message[]> = {}
  for (const msg of messages) {
    const key = new Date(msg.createdAt).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(msg)
  }
  return Object.entries(groups).map(([, msgs]) => ({
    date: msgs[0].createdAt,
    messages: msgs,
  }))
}

// Status icon for outbound messages
function StatusIcon({ status }: { status: string }) {
  if (status === 'pending') return <Clock size={11} className="text-white/30" />
  if (status === 'failed') return <AlertCircle size={11} className="text-red-400" />
  if (status === 'sent') return <Check size={11} className="text-white/40" />
  if (status === 'delivered') return <CheckCheck size={11} className="text-white/40" />
  if (status === 'read') return <CheckCheck size={11} className="text-blue-400" />
  return null
}

// Sender badge for system messages
function SenderBadge({ senderType }: { senderType: string }) {
  if (senderType === 'system')
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-gold/70 font-sans tracking-wide bg-gold/10 rounded px-1 py-0.5 mb-1">
        <Bot size={9} /> Auto
      </span>
    )
  if (senderType === 'agent')
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400/70 font-sans tracking-wide bg-blue-400/10 rounded px-1 py-0.5 mb-1">
        <Headphones size={9} /> Agent
      </span>
    )
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WhatsAppInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesTopRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Mobile: show list or chat
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')

  useEffect(() => {
    setUserRole('ADMIN')
  }, [])

  // ── Fetch conversation list ──────────────────────────────────────────────

  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingConvs(true)
    try {
      const params = new URLSearchParams({ q: searchQuery })
      if (showResolved) params.set('resolved', 'true')
      else params.set('resolved', 'false')
      const res = await fetch(`/api/admin/whatsapp/conversations?${params}`)
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {
      // ignore
    } finally {
      if (!silent) setLoadingConvs(false)
    }
  }, [searchQuery, showResolved])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Poll every 15s for new conversations
  useEffect(() => {
    const interval = setInterval(() => fetchConversations(true), 15000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  // ── Load messages for selected conversation ──────────────────────────────

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${convId}/messages`)
      const data = await res.json()
      setMessages(data.messages || [])
      setHasMore(data.hasMore || false)
    } finally {
      setLoadingMsgs(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedConv) return
    loadMessages(selectedConv.id)
    // Clear unread in local state
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConv.id ? { ...c, unreadCount: 0 } : c))
    )
  }, [selectedConv, loadMessages])

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loadingMsgs && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [loadingMsgs])

  // Poll for new messages in open conversation every 10s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!selectedConv) return

    pollRef.current = setInterval(async () => {
      const res = await fetch(
        `/api/admin/whatsapp/conversations/${selectedConv.id}/messages`
      )
      const data = await res.json()
      const newMsgs: Message[] = data.messages || []
      setMessages((prev) => {
        if (newMsgs.length === 0) return prev
        const existingIds = new Set(prev.map((m) => m.id))
        const added = newMsgs.filter((m) => !existingIds.has(m.id))
        if (added.length === 0) return prev.map((m) => {
          // Update statuses on existing messages
          const updated = newMsgs.find((n) => n.id === m.id)
          return updated ? { ...m, status: updated.status } : m
        })
        return [...prev, ...added]
      })
      // Scroll to bottom only if new messages arrived
    }, 10000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [selectedConv])

  // ── Load more (older messages) ───────────────────────────────────────────

  const loadMore = async () => {
    if (!selectedConv || messages.length === 0) return
    setLoadingMore(true)
    const cursor = messages[0].id
    try {
      const res = await fetch(
        `/api/admin/whatsapp/conversations/${selectedConv.id}/messages?cursor=${cursor}`
      )
      const data = await res.json()
      const older: Message[] = data.messages || []
      setMessages((prev) => [...older, ...prev])
      setHasMore(data.hasMore || false)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedConv || !replyText.trim() || sending) return
    const text = replyText.trim()
    setReplyText('')
    setSending(true)

    // Optimistic UI
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      waMessageId: null,
      direction: 'outbound',
      senderType: 'agent',
      body: text,
      messageType: 'text',
      status: 'pending',
      templateName: null,
      refType: null,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMsg])
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

    try {
      const res = await fetch(
        `/api/admin/whatsapp/conversations/${selectedConv.id}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'text', message: text }),
        }
      )
      const data = await res.json()

      if (res.ok && data.messageId) {
        // Refresh to get real message from DB
        await loadMessages(selectedConv.id)
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      } else {
        // Mark temp as failed
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
        )
      }

      // Update conversation preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConv.id
            ? { ...c, lastMessagePreview: text, lastMessageAt: new Date().toISOString() }
            : c
        )
      )
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Toggle resolved ───────────────────────────────────────────────────────

  const toggleResolved = async () => {
    if (!selectedConv) return
    const newState = !selectedConv.isResolved
    await fetch(`/api/admin/whatsapp/conversations/${selectedConv.id}/send`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isResolved: newState }),
    })
    setSelectedConv((prev) => (prev ? { ...prev, isResolved: newState } : prev))
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConv.id ? { ...c, isResolved: newState } : c))
    )
    if (!showResolved) fetchConversations()
  }

  // ─── Select conversation ──────────────────────────────────────────────────

  const selectConv = (conv: Conversation) => {
    setSelectedConv(conv)
    setMessages([])
    setMobileView('chat')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const displayName = (conv: Conversation) =>
    conv.customerName || conv.mobile.replace(/^91/, '')

  return (
    <div className="flex h-screen bg-charcoal-dark overflow-hidden">
      {/* ── Left: Conversation List ─────────────────────────────────────────── */}
      <div
        className={`${
          mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
        } w-full lg:w-80 xl:w-96 border-r border-white/5 flex-col shrink-0`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-serif text-white text-xl font-light tracking-wide">WhatsApp</h1>
            <button
              type="button"
              onClick={() => fetchConversations()}
              className="text-white/30 hover:text-white/70 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-charcoal border border-white/8 rounded-xl pl-8 pr-3 py-2 text-white text-sm font-sans placeholder:text-white/25 focus:outline-none focus:border-gold/30"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowResolved(false)}
              className={`text-[9px] tracking-widest uppercase font-sans px-2.5 py-1 rounded-full transition-colors ${
                !showResolved ? 'bg-gold text-charcoal-dark' : 'text-white/40 hover:text-white'
              }`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setShowResolved(true)}
              className={`text-[9px] tracking-widest uppercase font-sans px-2.5 py-1 rounded-full transition-colors ${
                showResolved ? 'bg-gold text-charcoal-dark' : 'text-white/40 hover:text-white'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12 text-white/20 text-sm font-sans">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/20">
              <MessageSquare size={28} className="mb-3" />
              <p className="text-sm font-sans">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => selectConv(conv)}
                className={`w-full text-left px-5 py-3.5 border-b border-white/3 transition-colors flex items-start gap-3 ${
                  selectedConv?.id === conv.id ? 'bg-gold/8' : 'hover:bg-white/3'
                }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={16} className="text-white/40" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white text-sm font-sans font-medium truncate">
                      {displayName(conv)}
                    </span>
                    <span className="text-white/30 text-[10px] font-sans shrink-0">
                      {timeAgo(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-white/40 text-xs font-sans truncate">
                      {conv.lastMessagePreview || 'No messages yet'}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-gold flex items-center justify-center text-[9px] font-bold text-charcoal-dark font-sans">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Chat Window ──────────────────────────────────────────────── */}
      <div
        className={`${
          mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        } flex-1 flex-col min-w-0`}
      >
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <MessageSquare size={40} className="mb-4" />
            <p className="font-serif text-lg font-light">Select a conversation</p>
            <p className="text-sm font-sans mt-1">Pick a chat from the left to start messaging</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="lg:hidden text-white/40 hover:text-white mr-1"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <User size={15} className="text-white/40" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-sans font-medium truncate">
                  {displayName(selectedConv)}
                </p>
                <p className="text-white/30 text-[10px] font-sans">
                  +{selectedConv.mobile}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleResolved}
                className={`flex items-center gap-1.5 text-[9px] tracking-widest uppercase font-sans px-3 py-1.5 rounded-full border transition-colors ${
                  selectedConv.isResolved
                    ? 'border-green-500/30 text-green-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                    : 'border-white/10 text-white/40 hover:text-green-400 hover:border-green-500/30'
                }`}
                title={selectedConv.isResolved ? 'Mark as open' : 'Mark as resolved'}
              >
                {selectedConv.isResolved ? (
                  <><CheckCircle2 size={11} /> Resolved</>
                ) : (
                  <><Circle size={11} /> Open</>
                )}
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1" ref={messagesTopRef}>
              {/* Load more button */}
              {hasMore && (
                <div className="flex justify-center mb-4">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-[10px] tracking-widest uppercase font-sans text-white/40 hover:text-white border border-white/10 hover:border-white/20 rounded-full px-4 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load older messages'}
                  </button>
                </div>
              )}

              {loadingMsgs ? (
                <div className="flex items-center justify-center py-16 text-white/20 text-sm font-sans">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/20">
                  <MessageSquare size={28} className="mb-3" />
                  <p className="text-sm font-sans">No messages yet</p>
                </div>
              ) : (
                groupByDate(messages).map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-white/25 text-[10px] font-sans tracking-wide">
                        {formatDate(group.date)}
                      </span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {group.messages.map((msg) => {
                      const isInbound = msg.direction === 'inbound'

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isInbound ? 'justify-start' : 'justify-end'} mb-1.5`}
                        >
                          <div
                            className={`max-w-[75%] ${
                              isInbound
                                ? 'bg-charcoal border border-white/8'
                                : msg.senderType === 'system'
                                ? 'bg-gold/15 border border-gold/20'
                                : 'bg-blue-600/30 border border-blue-500/20'
                            } rounded-2xl px-3.5 py-2.5`}
                          >
                            {!isInbound && <SenderBadge senderType={msg.senderType} />}

                            <p className="text-white text-sm font-sans leading-relaxed whitespace-pre-wrap break-words">
                              {msg.body}
                            </p>

                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-white/25 text-[9px] font-sans">
                                {formatTime(msg.createdAt)}
                              </span>
                              {!isInbound && <StatusIcon status={msg.status} />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-4 py-3 border-t border-white/5 flex items-end gap-3">
              <textarea
                ref={textareaRef}
                rows={1}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value)
                  // Auto-grow
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                className="flex-1 bg-charcoal border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm font-sans placeholder:text-white/25 focus:outline-none focus:border-gold/40 resize-none overflow-hidden min-h-[42px]"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !replyText.trim()}
                className="w-10 h-10 bg-gold hover:bg-gold-dark disabled:opacity-40 disabled:cursor-not-allowed text-charcoal-dark rounded-full flex items-center justify-center transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
