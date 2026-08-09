'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Send, 
  Briefcase, 
  Package, 
  Check, 
  CornerUpLeft, 
  User, 
  AlertCircle, 
  ChevronRight,
  ExternalLink,
  Loader2,
  Clock,
  Sparkles,
  Inbox,
  Star,
  Archive,
  Trash2,
  Paperclip,
  SquarePen,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { supabase } from '@/lib/supabase';
import { authHeader } from '@/lib/api-client';

interface Attachment {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface Message {
  id: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  attachments?: Attachment[];
}

interface Thread {
  id: string;
  subject: string;
  snippet: string;
  from?: string;
  lastMessageDate: string;
  unread: boolean;
  starred?: boolean;
  hasAttachments?: boolean;
  label: string;
  labelColor: string;
  messages?: Message[];
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Sanitize an email HTML body before rendering it. Message bodies come from
// arbitrary senders, so DOMPurify strips <script>, event handlers, and
// javascript: URLs while keeping ordinary rich-text formatting and links.
// Anchors are forced to open in a new tab with noopener to avoid tab-nabbing.
function sanitizeEmailHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|cid):/i,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['srcset'],
  });
  return clean.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

// Gmail's standard inbox tabs, mirrored 1:1 by the API route.
const MAIL_CATEGORIES = [
  { key: 'primary', label: 'Primary' },
  { key: 'social', label: 'Social' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'updates', label: 'Updates' },
] as const;
type MailCategory = (typeof MAIL_CATEGORIES)[number]['key'];

export default function InboxWidget() {
  const [userId, setUserId] = useState<string | null>(null);
  const [category, setCategory] = useState<MailCategory>('primary');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);

  // Compose-new-email modal
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [currentThread, setCurrentThread] = useState<Thread | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // Link-to-job picker
  const [linkableJobs, setLinkableJobs] = useState<{ id: string; title: string; client_name?: string }[]>([]);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [jobPickerSearch, setJobPickerSearch] = useState('');

  // Quick Reply Templates
  const REPLY_TEMPLATES = [
    {
      title: 'Confirm Schedule',
      subject: 'Call Time Confirmation - Zipline Media',
      body: 'Hi there,\n\nConfirming the schedule for our upcoming production. The call time is set for 8:00 AM on set. Please make sure to review the briefing document attached to your Slate project.\n\nSee you on set!\n\nBest,\nMatt | Zipline Media'
    },
    {
      title: 'Gear Manifest Ready',
      subject: 'Gear manifest list - Zipline Media',
      body: 'Hi team,\n\nThe gear build manifest has been finalized and packed. All camera bodies, primes, and wireless transmitters are verified. I\'ve linked the final PDF build to your dashboard.\n\nLet me know if we need any last-minute additions.\n\nBest,\nMatt | Zipline Media'
    },
    {
      title: 'Edit Review V3',
      subject: 'Broadway B-Roll Reveal V3 - Ready for Review',
      body: 'Hi Claude,\n\nThe V3 cut of the Broadway B-Roll Reveal is uploaded and ready for review. I extended the transitions, boosted the audio mix stems, and color graded the opening night shots.\n\nPlease review and let me know if we have full approval.\n\nBest,\nMatt | Zipline Media'
    }
  ];

  // Fetch session user on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch threads once we have a userId, and refetch when switching Gmail tabs
  useEffect(() => {
    if (userId) {
      fetchThreads();
    }
  }, [userId, category]);

  // Mailbox-wide search, like Gmail's search bar: debounce keystrokes, then
  // ask the server (which passes the query through to Gmail). Sandbox mode
  // keeps the instant client-side filter instead.
  useEffect(() => {
    if (!userId || !isLive) return;
    const t = setTimeout(() => fetchThreads(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Quiet background refresh so new mail shows up without touching anything.
  // Skipped mid-search so it can't stomp on search results.
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      if (!searchQuery.trim()) fetchThreads({ silent: true });
    }, 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, category, searchQuery]);

  // Fetch thread details when thread selection changes
  useEffect(() => {
    if (userId && selectedThreadId) {
      fetchThreadDetail(selectedThreadId);
    }
  }, [userId, selectedThreadId]);

  const fetchThreads = async (opts?: { silent?: boolean; append?: boolean }) => {
    if (!userId) return;
    const append = !!opts?.append;
    if (append) setIsLoadingMore(true);
    else if (!opts?.silent) setIsLoadingList(true);
    try {
      const params = new URLSearchParams({ action: 'list', category });
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (append && nextPageToken) params.set('pageToken', nextPageToken);
      const res = await fetch(`/api/integrations/mail?${params.toString()}`, { headers: await authHeader() });
      const data = await res.json();
      if (data.threads) {
        setThreads(prev => (append ? [...prev, ...data.threads] : data.threads));
        setNextPageToken(data.nextPageToken || null);
        // Falling from live Gmail into the mock fallback mid-session means the
        // Gmail call failed server-side — flag it instead of silently showing
        // stale sandbox data.
        setRefreshFailed(isLive && data.isLive === false);
        setIsLive(data.isLive);
        setLastRefreshAt(new Date());
        if (data.accountEmail) setAccountEmail(data.accountEmail);
      }
    } catch (e) {
      console.error('Error fetching threads:', e);
      setRefreshFailed(true);
    } finally {
      if (append) setIsLoadingMore(false);
      else setIsLoadingList(false);
    }
  };

  // Is this message from the connected account? Drives the "me" styling and
  // reply targeting. Falls back to the sandbox identity when offline.
  const isMe = (from: string) =>
    accountEmail ? from.toLowerCase().includes(accountEmail.toLowerCase()) : from.includes('matt@zipline.media');

  // Gmail-style thread actions with optimistic UI; the server call runs the
  // matching label operation (archive/trash/star/unread) against Gmail.
  const threadAction = async (threadId: string, op: 'archive' | 'trash' | 'markUnread' | 'star' | 'unstar') => {
    if (op === 'archive' || op === 'trash') {
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setCurrentThread(null);
      }
      triggerToast(op === 'archive' ? 'Conversation archived' : 'Conversation moved to Trash');
    } else if (op === 'markUnread') {
      setThreads(prev => prev.map(t => (t.id === threadId ? { ...t, unread: true } : t)));
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setCurrentThread(null);
      }
    } else {
      setThreads(prev => prev.map(t => (t.id === threadId ? { ...t, starred: op === 'star' } : t)));
    }

    try {
      const res = await fetch('/api/integrations/mail', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ threadId, op }),
      });
      if (!res.ok) throw new Error();
    } catch {
      triggerToast('Action may not have synced — refresh to verify.');
    }
  };

  const downloadAttachment = async (att: Attachment) => {
    try {
      const params = new URLSearchParams({
        action: 'attachment',
        messageId: att.messageId,
        attachmentId: att.attachmentId,
        filename: att.filename,
        mime: att.mimeType,
      });
      const res = await fetch(`/api/integrations/mail?${params.toString()}`, { headers: await authHeader() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      triggerToast('Could not download attachment.');
    }
  };

  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeBody.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/integrations/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim() || '(No subject)',
          body: composeBody.replace(/\n/g, '<br>'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Email sent!');
        setShowCompose(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
      } else {
        triggerToast(data.error || 'Failed to send email.');
      }
    } catch {
      triggerToast('Error sending email.');
    } finally {
      setIsSending(false);
    }
  };

  const fetchThreadDetail = async (threadId: string) => {
    if (!userId) return;
    setIsLoadingThread(true);
    try {
      const res = await fetch(`/api/integrations/mail?action=thread&threadId=${threadId}`, { headers: await authHeader() });
      const data = await res.json();
      if (data.messages) {
        setCurrentThread(data);
        // Mark as read in list view locally
        setThreads(prev => 
          prev.map(t => t.id === threadId ? { ...t, unread: false } : t)
        );
      }
    } catch (e) {
      console.error('Error fetching thread details:', e);
    } finally {
      setIsLoadingThread(false);
    }
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !currentThread || !replyBody.trim()) return;

    setIsSending(true);
    try {
      const activeMsg = currentThread.messages?.[currentThread.messages.length - 1];
      const recipient = activeMsg && isMe(activeMsg.from)
        ? currentThread.messages?.find(m => !isMe(m.from))?.from || currentThread.messages?.[0]?.from
        : activeMsg?.from;

      const cleanRecipient = recipient?.match(/<([^>]+)>/)?.[1] || recipient || '';

      const res = await fetch(`/api/integrations/mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          to: cleanRecipient || 'productions@zipline.media',
          subject: currentThread.subject.startsWith('Re:') ? currentThread.subject : `Re: ${currentThread.subject}`,
          body: replyBody.replace(/\n/g, '<br>'),
          threadId: currentThread.id
        })
      });

      const data = await res.json();
      if (data.success) {
        triggerToast('Reply sent successfully!');
        // Update thread UI locally
        const newMsg: Message = {
          id: data.messageId || `msg_${Date.now()}`,
          from: accountEmail ? `Me <${accountEmail}>` : 'Matt <matt@zipline.media>',
          to: recipient || 'Unknown',
          date: new Date().toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          snippet: replyBody.slice(0, 100),
          body: `<p>${replyBody.replace(/\n/g, '<br>')}</p>`
        };

        setCurrentThread(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...(prev.messages || []), newMsg]
          };
        });

        // Update list view snippet
        setThreads(prev =>
          prev.map(t => t.id === currentThread.id ? { ...t, snippet: replyBody, lastMessageDate: 'Just now' } : t)
        );

        setReplyBody('');
        setShowTemplates(false);
      } else {
        triggerToast(data.error || 'Failed to send email.');
      }
    } catch (e) {
      triggerToast('Error sending reply.');
    } finally {
      setIsSending(false);
    }
  };

  // Extract the counterparty email (the non-Zipline sender) from the thread
  const extractCounterpartyEmail = (): string | null => {
    const msgs = currentThread?.messages || [];
    for (const m of msgs) {
      const match = m.from.match(/<([^>]+)>/) || m.from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      const email = match ? (match[1] || match[0]) : null;
      if (email && !email.includes('matt@zipline.media') && !email.includes('@zipline.media')) {
        return email;
      }
    }
    // fall back to the first sender if everything is internal
    const first = msgs[0]?.from.match(/<([^>]+)>/) || msgs[0]?.from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    return first ? (first[1] || first[0]) : null;
  };

  const handleLinkToSlate = async () => {
    if (!currentThread) return;
    // Load active jobs for the picker
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, client_name')
        .neq('job_status', 'Cancelled')
        .order('shoot_date', { ascending: false });
      if (error) throw error;
      setLinkableJobs((data as any) || []);
      setJobPickerSearch('');
      setShowJobPicker(true);
    } catch (err: any) {
      triggerToast(`Could not load jobs: ${err.message}`);
    }
  };

  const linkThreadToJob = async (jobId: string, jobTitle: string) => {
    if (!currentThread) return;
    const email = extractCounterpartyEmail();
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          email_thread_id: currentThread.id,
          email_thread_subject: currentThread.subject,
          ...(email ? { contact_email: email } : {}),
        })
        .eq('id', jobId);
      if (error) throw error;
      setShowJobPicker(false);
      triggerToast(`Linked to "${jobTitle}"${email ? ` · ${email}` : ''}`);
    } catch (err: any) {
      triggerToast(`Link failed: ${err.message}`);
    }
  };

  const handleConvertToTask = () => {
    triggerToast('Created production schedule task from email content!');
  };

  const handleApplyTemplate = (body: string) => {
    setReplyBody(body);
    setShowTemplates(false);
    triggerToast('Template applied to composer.');
  };

  // Live mode searches server-side (whole mailbox); the client filter only
  // remains for the offline sandbox where there's no Gmail to ask.
  const filteredThreads = isLive
    ? threads
    : threads.filter(t =>
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.label.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="flex-grow flex flex-col h-full bg-zinc-950/20 text-white min-h-[450px] relative select-text">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-accent border border-white/20 px-4 py-3 rounded-xl shadow-2xl z-[120] flex items-center gap-2.5 text-xs font-semibold tracking-wider text-white shadow-accent/20"
          >
            <Check className="w-4 h-4 text-white" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Mode Bar */}
      {!isLive && (
        <div className="bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border-b border-yellow-500/20 px-6 py-2.5 flex items-center justify-between gap-4 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-[11px] md:text-[9px] font-semibold uppercase tracking-wider text-yellow-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Offline Sandbox mode
            </span>
            <span className="text-[11px] md:text-[8px] font-semibold text-white/40 uppercase tracking-wide hidden sm:inline">— showing simulated studio inbox feeds</span>
          </div>
          <button 
            onClick={() => {
              // Trigger click on Calendar Sync button in parent page.tsx
              const syncBtn = document.querySelector('button[title="Reconnect Account"]') || document.querySelector('button.bg-gradient-to-r.from-accent\\/20');
              if (syncBtn) (syncBtn as any).click();
            }}
            className="px-2.5 py-1 bg-yellow-500/15 hover:bg-yellow-500/35 border border-yellow-500/30 rounded-lg text-[11px] md:text-[8px] font-semibold uppercase tracking-wider text-yellow-400 hover:text-white transition-all cursor-pointer"
          >
            Connect Gmail Account
          </button>
        </div>
      )}

      {/* Main Panel Content Split */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Left Pane: Email Thread List */}
        {/* On phones the list and the conversation take turns (Gmail-style);
            side-by-side from md up. */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-white/5 flex-col shrink-0 min-h-0 bg-black/20 ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
          
          {/* Gmail category tabs (Primary / Social / Promotions / Updates) */}
          {isLive && (
            <div className="flex items-center gap-1 px-3 pt-3 select-none shrink-0 flex-wrap">
              {MAIL_CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] md:text-[9px] font-semibold uppercase tracking-wider transition-all ${
                    category === c.key
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'text-white/40 border border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {/* Freshness: quiet timestamp normally, loud when refresh breaks */}
              <span className="ml-auto pr-1">
                {refreshFailed ? (
                  <span className="flex items-center gap-1 text-[11px] md:text-[8px] font-bold uppercase tracking-wider text-red-400" title="The last refresh could not reach Gmail — retrying automatically.">
                    <AlertCircle className="w-3 h-3" /> Refresh failed
                  </span>
                ) : lastRefreshAt ? (
                  <span className="text-[11px] md:text-[8px] font-semibold uppercase tracking-wider text-white/20 select-none" title="Refreshes automatically every 60 seconds">
                    Updated {lastRefreshAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                ) : null}
              </span>
            </div>
          )}

          {/* List Search Header */}
          <div className="p-4 border-b border-white/5 flex items-center gap-2 select-none shrink-0">
            <div className="flex-grow bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 focus-within:border-accent transition-colors">
              <Search className="w-3.5 h-3.5 text-white/30" />
              <input 
                type="text" 
                placeholder="Search inbox..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-xs font-medium tracking-wide placeholder:opacity-30 text-white"
              />
            </div>
            <button
              onClick={() => fetchThreads()}
              disabled={isLoadingList}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/60 hover:text-white cursor-pointer disabled:opacity-40"
              title="Refresh Mail List"
            >
              {isLoadingList ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setShowCompose(true)}
              className="p-2.5 bg-accent/15 hover:bg-accent/30 border border-accent/30 rounded-xl transition-all text-accent hover:text-white cursor-pointer"
              title="Compose New Email"
            >
              <SquarePen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {isLoadingList ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center p-6 text-center select-none">
                <Inbox className="w-8 h-8 text-white/20 mb-3" />
                <p className="text-xs font-semibold text-white/30">No email threads found</p>
              </div>
            ) : (
              filteredThreads.map(t => {
                const isSelected = selectedThreadId === t.id;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedThreadId(t.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedThreadId(t.id); }}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer relative group flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-accent/15 to-accent/5 border-accent/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                        : 'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                  >
                    {/* Read indicator */}
                    {t.unread && (
                      <div className="absolute top-4 left-1.5 w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
                    )}

                    <div className="flex items-start justify-between gap-2 pl-1">
                      <span className={`text-[11px] tracking-wide truncate flex-1 ${
                        t.unread ? 'text-white font-bold' : 'text-white/60 font-semibold group-hover:text-white/80'
                      }`}>
                        {t.from || t.subject}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); threadAction(t.id, t.starred ? 'unstar' : 'star'); }}
                        className={`shrink-0 p-0.5 transition-all ${t.starred ? 'text-amber-400' : 'text-white/25 md:opacity-0 md:group-hover:opacity-100 hover:text-amber-400'}`}
                        title={t.starred ? 'Unstar' : 'Star'}
                      >
                        <Star className={`w-3.5 h-3.5 ${t.starred ? 'fill-amber-400' : ''}`} />
                      </button>
                      <span className="text-[11px] md:text-[9px] font-medium text-white/30 tracking-wide whitespace-nowrap pt-0.5 shrink-0">
                        {t.lastMessageDate}
                      </span>
                    </div>

                    <span className={`text-xs tracking-wide truncate pl-1 ${
                      t.unread ? 'text-white/90 font-semibold' : 'text-white/50 font-medium'
                    }`}>
                      {t.subject}
                    </span>

                    <p className="text-[10px] font-normal text-white/40 leading-normal line-clamp-2 pl-1 select-none">
                      {t.snippet}
                    </p>

                    <div className="flex items-center gap-2 mt-1 pl-1">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] md:text-[7px] font-semibold uppercase tracking-widest border border-${t.labelColor}/20 bg-${t.labelColor}/10 text-${t.labelColor}`}>
                        {t.label}
                      </span>
                      {t.hasAttachments && (
                        <Paperclip className="w-3 h-3 text-white/30" />
                      )}

                      {/* Hover quick actions, Gmail-style */}
                      <span className="ml-auto flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); threadAction(t.id, 'archive'); }}
                          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          title="Archive"
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); threadAction(t.id, 'trash'); }}
                          className="p-1 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Move to Trash"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); threadAction(t.id, 'markUnread'); }}
                          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          title="Mark as Unread"
                        >
                          <Mail className="w-3 h-3" />
                        </button>
                      </span>
                      {isSelected && (
                        <ChevronRight className="w-3 h-3 text-accent animate-pulse group-hover:hidden ml-auto" />
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Load older conversations (Gmail pagination) */}
            {isLive && nextPageToken && !isLoadingList && (
              <button
                onClick={() => fetchThreads({ append: true })}
                disabled={isLoadingMore}
                className="w-full py-2.5 mt-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-semibold uppercase tracking-widest text-white/50 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {isLoadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load older conversations'}
              </button>
            )}
          </div>
        </div>

        {/* Right Pane: Conversation History */}
        <div className={`flex-1 flex-col min-w-0 bg-black/10 ${selectedThreadId ? 'flex' : 'hidden md:flex'}`}>
          {isLoadingThread ? (
            <div className="flex-grow flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : currentThread ? (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Thread Header / Context Action Bar */}
              <div className="p-4 md:px-6 bg-black/30 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 select-none shrink-0">
                <div className="min-w-0 flex items-center gap-2">
                  {/* Back to list (phones only) */}
                  <button
                    onClick={() => { setSelectedThreadId(null); setCurrentThread(null); }}
                    className="md:hidden p-2 -ml-1 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white shrink-0"
                    title="Back to inbox"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                  <h3 className="text-sm font-semibold tracking-wide text-white truncate max-w-md">
                    {currentThread.subject}
                  </h3>
                  <p className="text-[11px] md:text-[9px] font-semibold uppercase tracking-wider text-accent mt-0.5">
                    {currentThread.messages?.length} {currentThread.messages?.length === 1 ? 'Message' : 'Messages'} in thread
                  </p>
                  </div>
                </div>

                {/* Studio OS Integration Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(() => {
                    const listThread = threads.find(t => t.id === currentThread.id);
                    return (
                      <>
                        <button
                          onClick={() => threadAction(currentThread.id, listThread?.starred ? 'unstar' : 'star')}
                          className={`p-2 rounded-lg border border-white/10 transition-all ${listThread?.starred ? 'text-amber-400 bg-amber-400/10' : 'text-white/40 bg-white/5 hover:text-amber-400 hover:bg-white/10'}`}
                          title={listThread?.starred ? 'Unstar conversation' : 'Star conversation'}
                        >
                          <Star className={`w-3.5 h-3.5 ${listThread?.starred ? 'fill-amber-400' : ''}`} />
                        </button>
                        <button
                          onClick={() => threadAction(currentThread.id, 'archive')}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          title="Archive conversation"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => threadAction(currentThread.id, 'trash')}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Move conversation to Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => threadAction(currentThread.id, 'markUnread')}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          title="Mark as Unread and close"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-px h-5 bg-white/10 mx-1" />
                      </>
                    );
                  })()}
                  <button
                    onClick={handleLinkToSlate}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] md:text-[9px] font-semibold tracking-wide text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Link Email Conversation to active Slate"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-accent" />
                    Link to Slate
                  </button>
                  <button 
                    onClick={handleConvertToTask}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] md:text-[9px] font-semibold tracking-wide text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Convert email instructions into a Crew/Gear Task"
                  >
                    <Package className="w-3.5 h-3.5 text-accent" />
                    Convert to Task
                  </button>
                </div>
              </div>

              {/* Message List Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {currentThread.messages?.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`bg-zinc-950/40 border border-white/10 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${
                      isMe(msg.from)
                        ? 'border-accent/20 bg-accent/5 ml-6'
                        : 'mr-6'
                    }`}
                  >
                    {/* Ambient layout accents for admin replies */}
                    {isMe(msg.from) && (
                      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
                    )}

                    {/* Sender Details Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3 mb-4 select-none">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold border ${
                          isMe(msg.from)
                            ? 'bg-accent/15 border-accent/30 text-accent'
                            : 'bg-white/5 border-white/10 text-white/60'
                        }`}>
                          {isMe(msg.from) ? 'ME' : <User className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-white">{msg.from}</p>
                          <p className="text-[11px] md:text-[9px] font-medium text-white/30 tracking-wide mt-0.5">To: {msg.to}</p>
                        </div>
                      </div>
                      <span className="text-[11px] md:text-[9px] font-medium text-white/30 tracking-wide flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-white/20" /> {msg.date}
                      </span>
                    </div>

                    {/* Rich HTML body render. Email bodies are attacker-
                        controlled (anyone can send mail to the connected
                        inbox), so sanitize before injecting to block script
                        execution, inline handlers, and javascript: URLs. */}
                    <div
                      className="text-sm font-normal leading-relaxed text-white/70 space-y-3 email-rendered-body"
                      dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(msg.body) }}
                    />

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2 select-none">
                        {msg.attachments.map(att => (
                          <button
                            key={att.attachmentId}
                            onClick={() => downloadAttachment(att)}
                            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent/30 rounded-lg transition-all group/att max-w-full"
                            title={`Download ${att.filename}`}
                          >
                            <Paperclip className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span className="text-[10px] font-semibold text-white/70 group-hover/att:text-white truncate">
                              {att.filename}
                            </span>
                            {att.size > 0 && (
                              <span className="text-[11px] md:text-[9px] font-medium text-white/30 shrink-0">{formatBytes(att.size)}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Composer Reply Box */}
              <div className="p-4 bg-black/40 border-t border-white/5 shrink-0">
                <form onSubmit={handleSendReply} className="space-y-3">
                  <div className="relative bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-accent transition-colors">
                    
                    {/* Template Reply dropdown toggler */}
                    <div className="absolute right-3 top-3 z-30 select-none">
                      <button
                        type="button"
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] md:text-[9px] font-semibold tracking-wide text-accent hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-accent animate-pulse" />
                        Reply Templates
                      </button>
                      <AnimatePresence>
                        {showTemplates && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 bottom-full mb-2 w-64 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-2 space-y-1 text-left"
                          >
                            <p className="text-[11px] md:text-[8px] font-semibold tracking-wider uppercase text-white/30 px-2 py-1.5 border-b border-white/5 mb-1">Select Template</p>
                            {REPLY_TEMPLATES.map((tmpl, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleApplyTemplate(tmpl.body)}
                                className="w-full px-2.5 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left tracking-wide block"
                              >
                                {tmpl.title}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <textarea
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      placeholder={`Reply to ${currentThread.messages?.[currentThread.messages.length - 1]?.from.match(/^([^<]+)/)?.[1]?.trim() || 'sender'}...`}
                      required
                      className="w-full bg-transparent border-0 outline-none text-sm font-normal leading-relaxed text-white/80 placeholder:opacity-20 p-4 min-h-[100px] resize-none focus:ring-0 focus:text-white transition-colors"
                    />

                    <div className="bg-black/30 border-t border-white/5 px-4 py-2 flex items-center justify-between select-none">
                      <span className="text-[11px] md:text-[9px] font-medium text-white/20 tracking-wide">
                        Replying via {isLive ? 'Gmail Live API' : 'Simulated Sandbox SMTP'}
                      </span>
                      <button aria-label="Send" title="Send"
                        type="submit"
                        disabled={isSending || !replyBody.trim()}
                        className="bg-accent px-4 py-2 rounded-lg text-xs font-semibold tracking-wide text-white hover:bg-white hover:text-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3 h-3" /> Send Reply
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center select-none">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-6 relative group overflow-hidden">
                <div className="absolute inset-0 bg-accent/5 blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                <Mail className="w-7 h-7 text-white/30 group-hover:scale-115 transition-transform" />
              </div>
              <h4 className="text-sm font-semibold tracking-wide text-white">No Conversation Selected</h4>
              <p className="text-[11px] md:text-[9px] font-medium text-white/30 tracking-wide mt-1 max-w-[240px] leading-relaxed">
                Select an email thread from the sidebar list to view its message timeline and compose replies.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Compose New Email */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowCompose(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl max-h-[88vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/40">
                <h3 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                  <SquarePen className="w-4 h-4 text-accent" /> New Message
                </h3>
                <button onClick={() => setShowCompose(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSendCompose}>
                <div className="px-5 divide-y divide-white/5">
                  <div className="flex items-center gap-3 py-3">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30 w-14 shrink-0">To</label>
                    <input
                      autoFocus
                      type="email"
                      required
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="recipient@example.com"
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-white placeholder:text-white/20"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-3">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30 w-14 shrink-0">Subject</label>
                    <input
                      type="text"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="What's this about?"
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-white placeholder:text-white/20"
                    />
                  </div>
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    required
                    placeholder="Write your message..."
                    className="w-full bg-transparent border-none outline-none text-sm font-normal leading-relaxed text-white/80 placeholder:text-white/20 py-4 min-h-[180px] resize-none focus:ring-0"
                  />
                </div>
                <div className="bg-black/40 border-t border-white/5 px-5 py-3 flex items-center justify-between select-none">
                  <span className="text-[11px] md:text-[9px] font-medium text-white/20 tracking-wide">
                    Sending as {accountEmail || (isLive ? 'connected account' : 'Sandbox')}
                  </span>
                  <button aria-label="Send" title="Send"
                    type="submit"
                    disabled={isSending || !composeTo.trim() || !composeBody.trim()}
                    className="bg-accent px-5 py-2 rounded-lg text-xs font-semibold tracking-wide text-white hover:bg-white hover:text-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3" /> Send</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link-to-Job picker */}
      <AnimatePresence>
        {showJobPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowJobPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-accent" /> Link Email to Job
                </h3>
                <button onClick={() => setShowJobPicker(false)} className="text-white/40 hover:text-white">
                  <AlertCircle className="w-4 h-4 rotate-45" />
                </button>
              </div>
              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                  <input
                    autoFocus
                    value={jobPickerSearch}
                    onChange={(e) => setJobPickerSearch(e.target.value)}
                    placeholder="Search jobs..."
                    className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-3 rounded-lg outline-none focus:border-accent text-sm font-normal text-white"
                  />
                </div>
              </div>
              <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                {linkableJobs
                  .filter(j => {
                    const q = jobPickerSearch.toLowerCase();
                    return !q || j.title.toLowerCase().includes(q) || (j.client_name || '').toLowerCase().includes(q);
                  })
                  .map(j => (
                    <button
                      key={j.id}
                      onClick={() => linkThreadToJob(j.id, j.title)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{j.title}</p>
                        <p className="text-[11px] md:text-[9px] font-medium text-white/40 truncate">{j.client_name || 'No Client'}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-accent transition-colors shrink-0" />
                    </button>
                  ))}
                {linkableJobs.length === 0 && (
                  <p className="text-center text-xs font-medium text-white/30 py-8">No active jobs found.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
