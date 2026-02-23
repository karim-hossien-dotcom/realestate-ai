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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        if (data.ok) setConversations(data.conversations || []);
      })
      .catch(() => showToast('Failed to load conversations', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  // Load messages when conversation selected
  const loadMessages = useCallback(async (leadId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/conversations?leadId=${leadId}`);
      const data = await res.json();
      if (data.ok) {
        setMessages(data.conversations || data.messages || []);
      }
    } catch {
      showToast('Failed to load messages', 'error');
    } finally {
      setMessagesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

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
        {/* Search */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-900"
            />
          </div>
        </div>

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
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    isActive ? 'bg-blue-50' : ''
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
                        <p className="text-xs text-gray-500 truncate">
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
      <div className={`${mobileView === 'thread' || selectedId ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-gray-50 min-w-0`}>
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
                      <div className="animate-pulse bg-gray-200 rounded-lg h-12 w-48"></div>
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

            {/* Compose (disabled for v1) */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2.5">
                <i className="fas fa-lock text-gray-400 text-sm"></i>
                <span className="text-sm text-gray-400">Direct messaging coming soon — use Campaigns to send outreach</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Panel 3: Context Sidebar */}
      {selectedConvo && showContext && (
        <div className="hidden lg:flex flex-col w-80 border-l border-gray-200 bg-white dark:bg-gray-800 flex-shrink-0 overflow-y-auto">
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
                <div className="flex items-center gap-2 text-gray-600">
                  <i className="fas fa-phone w-4 text-center text-gray-400"></i>
                  {selectedConvo.phone}
                </div>
              )}
              {selectedConvo.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <i className="fas fa-envelope w-4 text-center text-gray-400"></i>
                  {selectedConvo.email}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <StatusBadge status={selectedConvo.status} />
            </div>

            {/* Property Info */}
            {selectedConvo.property_interest && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Property Interest</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedConvo.property_interest}</p>
              </div>
            )}
            {(selectedConvo.budget_min || selectedConvo.budget_max) && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Budget</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedConvo.budget_min ? `$${selectedConvo.budget_min.toLocaleString()}` : '?'}
                  {' — '}
                  {selectedConvo.budget_max ? `$${selectedConvo.budget_max.toLocaleString()}` : '?'}
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <button
                onClick={() => window.location.href = `/prototype/leads`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <i className="fas fa-user"></i>View Full Profile
              </button>
              <button
                onClick={() => window.location.href = `/prototype/campaigns`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
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
