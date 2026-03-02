'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message } from '@/app/lib/supabase/types';
import { useToast } from '@/app/components/ToastProvider';
import StatusBadge from '@/app/components/StatusBadge';
import ScoreBadge from '@/app/components/ScoreBadge';
import EmptyState from '@/app/components/EmptyState';
import { SkeletonText, SkeletonAvatar } from '@/app/components/Skeleton';

type Conversation = {
  id: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  score_category: string;
  last_contacted: string | null;
  last_response: string | null;
  property_interest: string | null;
  budget_min: number | null;
  budget_max: number | null;
  lastMessage?: {
    id: string;
    body: string;
    direction: string;
    created_at: string;
    channel: string;
  };
  unreadCount: number;
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: 'fa-brands fa-whatsapp text-green-600',
  sms: 'fa-sms text-blue-600',
  email: 'fa-envelope text-purple-600',
};

const POLL_INTERVAL = 15000; // 15 seconds

export default function ConversationsPage() {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showContext, setShowContext] = useState(true);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendChannel, setSendChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConvosRef = useRef<string>('');
  const prevMessagesRef = useRef<string>('');
  const selectedIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Fetch conversation list
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.ok) {
        const newConvos = data.conversations || [];
        const newSignature = JSON.stringify(newConvos.map((c: Conversation) => ({
          id: c.id,
          lastMsg: c.lastMessage?.id,
          unread: c.unreadCount,
        })));

        if (silent && prevConvosRef.current && newSignature !== prevConvosRef.current) {
          setHasNewMessages(true);
        }
        prevConvosRef.current = newSignature;
        setConversations(newConvos);
      }
    } catch {
      if (!silent) showToast('Failed to load conversations', 'error');
    }
  }, [showToast]);

  // Initial load
  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  // Poll conversations every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Load messages when conversation selected
  const loadMessages = useCallback(async (leadId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const res = await fetch(`/api/conversations?leadId=${leadId}`);
      const data = await res.json();
      if (data.ok) {
        const newMsgs = data.conversations || data.messages || [];
        const newSignature = JSON.stringify(newMsgs.map((m: Message) => m.id));

        if (silent && prevMessagesRef.current && newSignature !== prevMessagesRef.current) {
          // New messages in active thread — auto-scroll
          setMessages(newMsgs);
        } else {
          setMessages(newMsgs);
        }
        prevMessagesRef.current = newSignature;
      }
    } catch {
      if (!silent) showToast('Failed to load messages', 'error');
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedId) {
      prevMessagesRef.current = '';
      loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);

  // Poll active thread messages every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      const currentId = selectedIdRef.current;
      if (currentId) {
        loadMessages(currentId, true);
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check URL params for leadId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get('leadId');
    if (leadId) {
      setSelectedId(leadId);
      setMobileView('thread');
    }
  }, []);

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    setHasNewMessages(false);
    await fetchConversations();
    if (selectedId) await loadMessages(selectedId);
    setRefreshing(false);
  };

  // Send message handler
  const handleSendMessage = async () => {
    if (!composeText.trim() || !selectedId || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedId,
          message: composeText.trim(),
          channel: sendChannel,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Message sent!', 'success');
        setComposeText('');
        // Refresh messages to show the sent message
        await loadMessages(selectedId);
        await fetchConversations(true);
      } else {
        showToast(data.error || 'Failed to send message', 'error');
      }
    } catch {
      showToast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const selectedConvo = conversations.find(c => c.id === selectedId);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.owner_name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-0px)] overflow-hidden">
      {/* Panel 1: Conversation List */}
      <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 border-r border-gray-200 bg-white dark:bg-gray-800 flex-shrink-0`}>
        {/* Search + Refresh */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
              title="Refresh"
            >
              <i className={`fas fa-sync-alt text-sm ${refreshing ? 'animate-spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* New messages banner */}
        {hasNewMessages && (
          <button
            onClick={() => {
              setHasNewMessages(false);
              fetchConversations();
            }}
            className="mx-3 mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <i className="fas fa-arrow-up text-xs"></i>
            New messages available — tap to refresh
          </button>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <SkeletonAvatar size={10} />
                  <div className="flex-1"><SkeletonText lines={2} /></div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {conversations.length === 0 ? 'No conversations yet' : 'No matching conversations'}
              </p>
            </div>
          ) : (
            filteredConversations.map((convo) => {
              const isActive = convo.id === selectedId;
              const initial = (convo.owner_name || '?').charAt(0).toUpperCase();
              return (
                <button
                  key={convo.id}
                  onClick={() => {
                    setSelectedId(convo.id);
                    setMobileView('thread');
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{convo.owner_name || 'Unknown'}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {timeAgo(convo.lastMessage?.created_at || convo.last_contacted)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {convo.lastMessage?.channel && (
                          <i className={`fas ${CHANNEL_ICONS[convo.lastMessage.channel] || 'fa-comment text-gray-400'} text-xs`}></i>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {convo.lastMessage?.direction === 'outbound' && <span className="text-gray-400">You: </span>}
                          {convo.lastMessage?.body || 'No messages'}
                        </p>
                      </div>
                    </div>
                    {convo.unreadCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Panel 2: Message Thread */}
      <div className={`${mobileView === 'thread' || selectedId ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-gray-50 dark:bg-gray-900 min-w-0`}>
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon="fa-comments"
              title="Select a Conversation"
              description="Choose a conversation from the list to view messages"
            />
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => { setMobileView('list'); setSelectedId(null); }}
                className="md:hidden p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-300"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {(selectedConvo?.owner_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedConvo?.owner_name || 'Unknown'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedConvo?.phone || selectedConvo?.email || ''}</p>
              </div>
              {selectedConvo && <StatusBadge status={selectedConvo.status} />}
              <button
                onClick={() => setShowContext(!showContext)}
                className="hidden md:block p-2 text-gray-400 hover:text-gray-600"
                title="Toggle context panel"
              >
                <i className="fas fa-info-circle"></i>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="space-y-4 py-8">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-12 w-48"></div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No messages in this conversation</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
                      msg.direction === 'outbound'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      <div className={`flex items-center gap-1.5 mt-1 text-xs ${
                        msg.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        <i className={`fas ${CHANNEL_ICONS[msg.channel]?.split(' ')[0] || 'fa-comment'}`}></i>
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.direction === 'outbound' && (
                          <i className={`fas ${msg.status === 'sent' ? 'fa-check-double' : msg.status === 'failed' ? 'fa-times' : 'fa-check'}`}></i>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Channel toggle */}
                <button
                  onClick={() => setSendChannel(sendChannel === 'whatsapp' ? 'sms' : sendChannel === 'sms' ? 'email' : 'whatsapp')}
                  className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                    sendChannel === 'whatsapp'
                      ? 'text-green-600 bg-green-50 dark:bg-green-900/30'
                      : sendChannel === 'sms'
                      ? 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30'
                      : 'text-purple-600 bg-purple-50 dark:bg-purple-900/30'
                  }`}
                  title={`Sending via ${sendChannel.toUpperCase()} — click to switch`}
                >
                  <i className={`fas ${sendChannel === 'whatsapp' ? 'fa-brands fa-whatsapp' : sendChannel === 'sms' ? 'fa-sms' : 'fa-envelope'} text-lg`}></i>
                </button>
                {/* Text input */}
                <input
                  type="text"
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder={`Type a message via ${sendChannel}...`}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                />
                {/* Send button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!composeText.trim() || sending}
                  className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title="Send message"
                >
                  {sending ? (
                    <i className="fas fa-spinner fa-spin text-sm"></i>
                  ) : (
                    <i className="fas fa-paper-plane text-sm"></i>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Panel 3: Context Sidebar */}
      {selectedConvo && showContext && (
        <div className="hidden lg:flex flex-col w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lead Details</h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Avatar + Name */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-semibold mx-auto mb-2">
                {(selectedConvo.owner_name || '?').charAt(0).toUpperCase()}
              </div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedConvo.owner_name || 'Unknown'}</p>
              <div className="mt-1">
                <ScoreBadge score={0} category={selectedConvo.score_category} />
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-2 text-sm">
              {selectedConvo.phone && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <i className="fas fa-phone w-4 text-center text-gray-400"></i>
                  {selectedConvo.phone}
                </div>
              )}
              {selectedConvo.email && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <i className="fas fa-envelope w-4 text-center text-gray-400"></i>
                  {selectedConvo.email}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
              <StatusBadge status={selectedConvo.status} />
            </div>

            {/* Property Info */}
            {selectedConvo.property_interest && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Property Interest</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedConvo.property_interest}</p>
              </div>
            )}
            {(selectedConvo.budget_min || selectedConvo.budget_max) && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Budget</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedConvo.budget_min ? `$${selectedConvo.budget_min.toLocaleString()}` : '?'}
                  {' — '}
                  {selectedConvo.budget_max ? `$${selectedConvo.budget_max.toLocaleString()}` : '?'}
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <button
                onClick={() => window.location.href = `/prototype/leads`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <i className="fas fa-user"></i>View Full Profile
              </button>
              <button
                onClick={() => window.location.href = `/prototype/campaigns`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
              >
                <i className="fas fa-paper-plane"></i>Send Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
