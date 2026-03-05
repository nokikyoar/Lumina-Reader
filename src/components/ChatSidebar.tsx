import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowDown, ArrowUp, Bot, Check, Copy, Download, Eye, EyeOff, Loader2, MessageSquarePlus, Pencil, Pin, Plus, PlugZap, Scissors, Send, Settings2, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { type Book } from '@/lib/db';
import { cn } from '@/lib/utils';
import { getThemeStyles, type Theme } from './reader/readerUtils';
import {
  type AiConfig,
  type AiProvider,
  type ChatStore,
  type ConnectionState,
  type Message,
  type TokenUsage,
  PROVIDER_PRESETS,
  callWithRetry,
  clamp,
  createSession,
  defaultConfig,
  estimateTokens,
  exportChat,
  isLikelyValidUrl,
  loadAiConfig,
  loadChatStore,
  makeMessage,
  persistChatStore,
  saveAiConfig,
  summarizeSessionTitle,
  toUserFriendlyError,
} from './chat/chatSupport';

interface ChatSidebarProps {
  book: Book;
  currentTextContext: string;
  quotedText?: string | null;
  onClearQuote?: () => void;
  onClose: () => void;
  theme: Theme;
}

interface MessageActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

const EMPTY_USAGE: TokenUsage = {
  contextTokens: 0,
  responseTokens: 0,
  totalTokens: 0,
  updatedAt: 0,
};

const DEFAULT_CONTEXT_WINDOW = 12;
const CONTEXT_WINDOW_OPTIONS = [8, 12, 20] as const;
const HISTORY_SUMMARY_TRIGGER = 20;

function MessageActionButton({ label, onClick, className, children }: MessageActionButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative p-1.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm group/action',
        className,
      )}
    >
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-200 group-hover/action:opacity-100">
        {label}
      </span>
    </button>
  );
}

export function ChatSidebar({ book, currentTextContext, quotedText, onClearQuote, onClose, theme }: ChatSidebarProps) {
  const [chatStore, setChatStore] = useState<ChatStore>(() => loadChatStore(book.id, book.title));
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [configDraft, setConfigDraft] = useState<AiConfig>(defaultConfig());
  const [configSaved, setConfigSaved] = useState<AiConfig>(defaultConfig());
  const [configHint, setConfigHint] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionHint, setConnectionHint] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingDraft, setRenamingDraft] = useState('');
  const [contextWindowSize, setContextWindowSize] = useState<number>(DEFAULT_CONTEXT_WINDOW);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const configReady = useMemo(() => Boolean(configSaved.apiKey.trim() && configSaved.model.trim() && configSaved.baseUrl.trim()), [configSaved]);
  const styles = getThemeStyles(theme);
  const isDark = theme === 'dark';
  const isEInk = theme === 'e-ink';
  const isSepia = theme === 'sepia';

  const activeSession = useMemo(
    () => chatStore.sessions.find((session) => session.id === chatStore.activeSessionId) ?? chatStore.sessions[0],
    [chatStore.activeSessionId, chatStore.sessions],
  );
  const messages: Message[] = activeSession?.messages ?? [];
  const tokenUsage = chatStore.usageBySession[activeSession?.id ?? ''] ?? EMPTY_USAGE;
  const userInputPreview = input.trim() || (quotedText ? 'Please explain this selected quote in plain language.' : '');
  const recentMessagesPreview = messages.slice(-contextWindowSize);
  const summaryMessagesPreview = messages.slice(0, Math.max(0, messages.length - contextWindowSize));
  const summaryTextPreview = summaryMessagesPreview.length >= HISTORY_SUMMARY_TRIGGER
    ? summaryMessagesPreview
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.text.slice(0, 140)}`)
      .join('\n')
    : '';
  const estimatedNextPromptTokens = estimateTokens([
    `Book title: ${book.title}`,
    `Book author: ${book.author || 'Unknown'}`,
    '--- Context ---',
    quotedText || currentTextContext,
    summaryTextPreview ? '--- Older conversation summary ---' : '',
    summaryTextPreview,
    '--- Recent conversation ---',
    ...recentMessagesPreview.flatMap((message) => [message.role === 'user' ? 'User:' : 'Assistant:', message.text, '']),
    '--- User question ---',
    userInputPreview,
  ].filter(Boolean).join('\n'));

  useEffect(() => {
    let active = true;
    void loadAiConfig().then((loaded) => {
      if (!active) return;
      setConfigDraft(loaded);
      setConfigSaved(loaded);
      setConfigLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    persistChatStore(book.id, chatStore);
  }, [book.id, chatStore]);

  useEffect(() => {
    setChatStore(loadChatStore(book.id, book.title));
    setEditingMessageId(null);
    setEditingDraft('');
  }, [book.id, book.title]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!copyHint) return;
    const timer = window.setTimeout(() => setCopyHint(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copyHint]);

  const normalizeConfig = (source: AiConfig): AiConfig => ({
    ...source,
    apiKey: source.apiKey.trim(),
    model: source.model.trim(),
    baseUrl: source.baseUrl.trim(),
    azureApiVersion: source.azureApiVersion.trim() || '2024-06-01',
    temperature: clamp(source.temperature, 0, 2),
    maxTokens: clamp(source.maxTokens, 128, 4096),
  });

  const updateActiveSession = (updater: (session: Message[]) => Message[]) => {
    if (!activeSession) return;
    setChatStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => {
        if (session.id !== prev.activeSessionId) return session;
        const nextMessages = updater(session.messages);
        return {
          ...session,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
      }),
    }));
  };

  const handleSaveConfig = async () => {
    const normalized = normalizeConfig(configDraft);
    await saveAiConfig(normalized);
    setConfigSaved(normalized);
    setConfigHint('Saved. Your API key is encrypted and stored locally in this browser only.');
    setConnectionState('idle');
    setConnectionHint(null);
    window.setTimeout(() => setConfigHint(null), 2400);
  };

  const handleProviderChange = (provider: AiProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    setConfigDraft((prev) => ({
      ...prev,
      provider,
      model: prev.model === PROVIDER_PRESETS[prev.provider].defaultModel ? preset.defaultModel : prev.model,
      baseUrl: prev.baseUrl === PROVIDER_PRESETS[prev.provider].defaultBaseUrl ? preset.defaultBaseUrl : prev.baseUrl,
    }));
  };

  const handleExportConfig = () => {
    const raw = window.localStorage.getItem('lumina.ai.config.v2');
    if (!raw) return setConfigHint('Nothing to export. Save configuration first.');
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lumina-ai-config.encrypted.json';
    a.click();
    URL.revokeObjectURL(url);
    setConfigHint('Encrypted configuration exported.');
  };

  const handleImportConfig = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!parsed.provider || !parsed.baseUrl || !parsed.model || !parsed.encryptedApiKey || !parsed.apiKeyIv) throw new Error('Invalid');
      window.localStorage.setItem('lumina.ai.config.v2', JSON.stringify(parsed));
      const loaded = await loadAiConfig();
      setConfigDraft(loaded);
      setConfigSaved(loaded);
      setConfigHint('Encrypted configuration imported successfully.');
    } catch {
      setConfigHint('Import failed. Please provide a valid encrypted configuration file.');
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleTestConnection = async () => {
    const candidate = normalizeConfig(configDraft);
    if (!candidate.apiKey || !candidate.model || !candidate.baseUrl) return setConnectionHint('Please complete Base URL, Model, and API Key first.');
    if (!isLikelyValidUrl(candidate.baseUrl)) return setConnectionHint('Invalid Base URL format. Please provide a valid http(s) endpoint.');
    setConnectionState('testing');
    setConnectionHint('Testing connection...');
    try {
      const result = await callWithRetry(candidate, 'Reply with exactly: Connection OK', 'You are a connectivity test assistant. Return a very short response.');
      setConnectionState('success');
      setConnectionHint(`Connected. status=${result.status}, latency=${result.latencyMs}ms, endpoint=${result.endpoint}`);
    } catch (error) {
      setConnectionState('error');
      setConnectionHint(`Connection failed. ${toUserFriendlyError(error)}`);
    }
  };

  const handleCopyMessage = async (text: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API not available');
      }
      await navigator.clipboard.writeText(text);
      setCopyHint('Copied');
    } catch {
      setCopyHint('Copy failed');
    }
  };

  const handleEditAsNextQuestion = (text: string) => {
    setInput(text);
    setEditingMessageId(null);
    setEditingDraft('');
  };

  const handleNewSession = () => {
    const session = createSession(book.title);
    setChatStore((prev) => ({
      ...prev,
      activeSessionId: session.id,
      sessions: [session, ...prev.sessions],
    }));
    setEditingMessageId(null);
    setEditingDraft('');
    setRenamingSessionId(null);
    setRenamingDraft('');
    setInput('');
  };

  const handleStartRenameSession = (sessionId: string, currentTitle: string) => {
    setRenamingSessionId(sessionId);
    setRenamingDraft(currentTitle);
  };

  const handleSaveRenameSession = () => {
    if (!renamingSessionId) return;
    const nextTitle = renamingDraft.trim() || 'New chat';
    setChatStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => (
        session.id === renamingSessionId
          ? { ...session, title: nextTitle, updatedAt: Date.now() }
          : session
      )),
    }));
    setRenamingSessionId(null);
    setRenamingDraft('');
  };

  const handleDeleteSession = (sessionId: string) => {
    setChatStore((prev) => {
      if (prev.sessions.length <= 1) {
        const fallback = createSession(book.title);
        return { activeSessionId: fallback.id, sessions: [fallback], usageBySession: {} };
      }

      const remaining = prev.sessions.filter((session) => session.id !== sessionId);
      const nextActiveSessionId = prev.activeSessionId === sessionId ? remaining[0].id : prev.activeSessionId;
      const { [sessionId]: _removedUsage, ...restUsage } = prev.usageBySession;
      return {
        ...prev,
        activeSessionId: nextActiveSessionId,
        sessions: remaining,
        usageBySession: restUsage,
      };
    });

    if (renamingSessionId === sessionId) {
      setRenamingSessionId(null);
      setRenamingDraft('');
    }
  };

  const formatSessionTime = (timestamp: number) => {
    const delta = Date.now() - timestamp;
    if (delta < 60_000) return 'Just now';
    if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
    if (delta < 86_400_000) return `${Math.max(1, Math.floor(delta / 3_600_000))}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const moveSession = (sessionId: string, direction: 'up' | 'down') => {
    setChatStore((prev) => {
      const index = prev.sessions.findIndex((session) => session.id === sessionId);
      if (index < 0) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.sessions.length) return prev;
      const next = [...prev.sessions];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return { ...prev, sessions: next };
    });
  };

  const pinSession = (sessionId: string) => {
    setChatStore((prev) => {
      const index = prev.sessions.findIndex((session) => session.id === sessionId);
      if (index <= 0) return prev;
      const next = [...prev.sessions];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return { ...prev, sessions: next };
    });
  };

  const handleCompressCurrentSession = () => {
    if (!activeSession) return;
    const keepRecent = activeSession.messages.slice(-contextWindowSize);
    const oldMessages = activeSession.messages.slice(0, Math.max(0, activeSession.messages.length - contextWindowSize));
    if (oldMessages.length < HISTORY_SUMMARY_TRIGGER) return;

    const summary = oldMessages
      .slice(-10)
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.text.slice(0, 120)}`)
      .join('\n');

    const summaryMessage = makeMessage('model', `[History summary (auto-compressed)]\n${summary}`);
    setChatStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => (
        session.id === prev.activeSessionId
          ? {
            ...session,
            messages: [summaryMessage, ...keepRecent],
            updatedAt: Date.now(),
          }
          : session
      )),
    }));
  };

  const handleSend = async () => {
    if (!input.trim() && !quotedText) return;
    if (!activeSession) return;
    if (!configReady) {
      updateActiveSession((prev) => [...prev, makeMessage('model', 'Please configure your AI API first. Click settings and fill in Provider, Base URL, Model, and API Key.')]);
      setShowSettings(true);
      return;
    }

    const userMessage = input;
    const context = quotedText || currentTextContext;
    const nextUserMessage = makeMessage('user', quotedText ? `> ${quotedText}\n\n${userMessage}` : userMessage);

    setChatStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => {
        if (session.id !== prev.activeSessionId) return session;
        const shouldRename = session.title === 'New chat' || session.title === 'Legacy chat';
        return {
          ...session,
          title: shouldRename ? summarizeSessionTitle(userMessage || quotedText || '') : session.title,
          messages: [...session.messages, nextUserMessage],
          updatedAt: Date.now(),
        };
      }),
    }));

    setInput('');
    onClearQuote?.();
    setLoading(true);

    const recentMessages = activeSession.messages.slice(-contextWindowSize);
    const summaryMessages = activeSession.messages.slice(0, Math.max(0, activeSession.messages.length - contextWindowSize));
    const summaryText = summaryMessages.length >= HISTORY_SUMMARY_TRIGGER
      ? summaryMessages
        .slice(-8)
        .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.text.slice(0, 160)}`)
        .join('\n')
      : '';
    const historyLines = recentMessages.flatMap((message) => [message.role === 'user' ? 'User:' : 'Assistant:', message.text, '']);
    const prompt = [
      `Book title: ${book.title}`,
      `Book author: ${book.author || 'Unknown'}`,
      '--- Context ---',
      context,
      summaryText ? '--- Older conversation summary ---' : '',
      summaryText,
      '--- Recent conversation ---',
      ...historyLines,
      '--- User question ---',
      userMessage || 'Please explain this selected quote in plain language.',
    ].filter(Boolean).join('\n');
    const systemPrompt = 'You are a precise reading assistant. Be concise, actionable, and faithful to the given context. If context is insufficient, ask one clarifying question.';

    const contextTokens = estimateTokens(systemPrompt) + estimateTokens(prompt);

    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const result = await callWithRetry(configSaved, prompt, systemPrompt, controller.signal);
      const responseTokens = estimateTokens(result.content);
      const increment = contextTokens + responseTokens;

      setChatStore((prev) => {
        const sessionId = prev.activeSessionId;
        const prevUsage = prev.usageBySession[sessionId] ?? EMPTY_USAGE;
        return {
          ...prev,
          sessions: prev.sessions.map((session) => (
            session.id === sessionId
              ? { ...session, messages: [...session.messages, makeMessage('model', result.content)], updatedAt: Date.now() }
              : session
          )),
          usageBySession: {
            ...prev.usageBySession,
            [sessionId]: {
              contextTokens: prevUsage.contextTokens + contextTokens,
              responseTokens: prevUsage.responseTokens + responseTokens,
              totalTokens: prevUsage.totalTokens + increment,
              updatedAt: Date.now(),
            },
          },
        };
      });
    } catch (error) {
      updateActiveSession((prev) => [...prev, makeMessage('model', toUserFriendlyError(error))]);
    } finally {
      setLoading(false);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  };

  return (
    <div className={cn('flex flex-col h-full border-l transition-colors duration-300', styles.bg, styles.text, styles.sidebarBorder)}>
      <div className={cn('p-4 border-b flex justify-between items-center bg-opacity-50 backdrop-blur-sm', styles.divider)}>
        <div className="flex items-center gap-2"><Sparkles className={cn('w-5 h-5', isEInk ? 'text-neutral-900' : isDark ? 'text-amber-300' : isSepia ? 'text-[#7a5a3f]' : 'text-brand-orange')} /><h2 className="font-serif font-bold">AI Assistant</h2></div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportChat(book, messages)} className={cn('p-1.5 rounded-full transition-colors', styles.toolbarHoverBg)} title="Export chat (JSON + Markdown)"><Download className="w-4.5 h-4.5" /></button>
          <button onClick={() => setShowSettings((v) => !v)} className={cn('p-1.5 rounded-full transition-colors', styles.toolbarHoverBg)} title="AI API Settings"><Settings2 className={cn('w-4.5 h-4.5', configReady ? 'text-emerald-500' : 'text-amber-500')} /></button>
          <button onClick={onClose} className={cn('p-1 rounded-full transition-colors', styles.toolbarHoverBg)}><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className={cn('px-4 py-3 border-b space-y-2', styles.divider, styles.noteCardBg)}>
        <div className="flex items-center justify-between gap-2">
          <div className={cn('text-xs font-medium truncate', styles.subtleText)}>{activeSession?.title || 'New chat'}</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCompressCurrentSession}
              className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors', styles.inputBorder, styles.toolbarHoverBg)}
              title="Compress older history"
            >
              <Scissors className="w-3.5 h-3.5" />
              Compress
            </button>
            <button onClick={handleNewSession} className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors', styles.inputBorder, styles.toolbarHoverBg)}>
              <Plus className="w-3.5 h-3.5" />
              New chat
            </button>
          </div>
        </div>
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {chatStore.sessions.map((session, index) => {
            const isActive = session.id === chatStore.activeSessionId;
            const isRenaming = renamingSessionId === session.id;
            return (
              <div
                key={session.id}
                className={cn(
                  'group/session rounded-lg border transition-all px-2 py-1.5',
                  isActive
                    ? 'bg-brand-orange/10 border-brand-orange/40'
                    : cn(styles.inputBorder, styles.toolbarHoverBg),
                )}
              >
                <div className="flex items-center gap-1">
                  {isRenaming ? (
                    <input
                      value={renamingDraft}
                      onChange={(e) => setRenamingDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRenameSession();
                        if (e.key === 'Escape') { setRenamingSessionId(null); setRenamingDraft(''); }
                      }}
                      autoFocus
                      className={cn('min-w-0 flex-1 bg-transparent text-xs outline-none', styles.inputText)}
                    />
                  ) : (
                    <button
                      onClick={() => setChatStore((prev) => ({ ...prev, activeSessionId: session.id }))}
                      className={cn('min-w-0 flex-1 truncate text-xs text-left px-1.5 py-0.5 rounded-md', isActive ? 'text-brand-orange font-medium' : styles.subtleText)}
                      title={session.title}
                    >
                      {session.title}
                    </button>
                  )}

                  {isRenaming ? (
                    <button onClick={handleSaveRenameSession} className={cn('p-1 rounded-md', styles.toolbarHoverBg)} title="Save rename">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => pinSession(session.id)} className={cn('p-1 rounded-md opacity-0 group-hover/session:opacity-100 transition-opacity', styles.toolbarHoverBg)} title="Pin to top">
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveSession(session.id, 'up')} disabled={index === 0} className={cn('p-1 rounded-md opacity-0 group-hover/session:opacity-100 transition-opacity disabled:opacity-30', styles.toolbarHoverBg)} title="Move up">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveSession(session.id, 'down')} disabled={index === chatStore.sessions.length - 1} className={cn('p-1 rounded-md opacity-0 group-hover/session:opacity-100 transition-opacity disabled:opacity-30', styles.toolbarHoverBg)} title="Move down">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStartRenameSession(session.id, session.title)}
                        className={cn('p-1 rounded-md opacity-0 group-hover/session:opacity-100 transition-opacity', styles.toolbarHoverBg)}
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className={cn('p-1 rounded-md opacity-0 group-hover/session:opacity-100 transition-opacity text-rose-500', styles.toolbarHoverBg)}
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <div className={cn('mt-1 px-1.5 text-[10px]', styles.subtleText)}>
                  Updated {formatSessionTime(session.updatedAt)}
                </div>
              </div>
            );
          })}
        </div>
        <div className={cn('text-[11px] rounded-lg px-2.5 py-2 border space-y-1.5', styles.inputBorder, styles.inputBg)}>
          <div className="flex items-center justify-between">
            <span className={styles.subtleText}>Token usage (estimate)</span>
            <span className="font-medium">ctx {tokenUsage.contextTokens} · resp {tokenUsage.responseTokens} · total {tokenUsage.totalTokens}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className={styles.subtleText}>Context window</span>
              <select
                value={contextWindowSize}
                onChange={(e) => setContextWindowSize(Number(e.target.value))}
                className={cn('rounded-md border px-1.5 py-0.5 text-[11px]', styles.inputBg, styles.inputBorder)}
              >
                {CONTEXT_WINDOW_OPTIONS.map((size) => <option key={size} value={size}>{size} msgs</option>)}
              </select>
            </div>
            <span className={cn('text-[11px]', styles.subtleText)}>next ~{estimatedNextPromptTokens} tokens</span>
          </div>
        </div>
      </div>

      {showSettings && <div className={cn('px-4 py-3 border-b space-y-3', styles.divider, styles.noteCardBg)}>
        <div className="flex items-start gap-2 text-xs leading-relaxed"><ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /><p className={styles.subtleText}>Security notice: API key is encrypted before local storage and never uploaded by this settings panel.</p></div>
        <select value={configDraft.provider} onChange={(e) => handleProviderChange(e.target.value as AiProvider)} className={cn('w-full rounded-lg border px-3 py-2 text-sm', styles.inputBg, styles.inputBorder)}>{Object.entries(PROVIDER_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select>
        <input value={configDraft.baseUrl} onChange={(e) => setConfigDraft((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder="https://api.example.com/v1" className={cn('w-full rounded-lg border px-3 py-2 text-sm', styles.inputBg, styles.inputBorder)} />
        <input value={configDraft.model} onChange={(e) => setConfigDraft((prev) => ({ ...prev, model: e.target.value }))} placeholder="gpt-4o-mini" className={cn('w-full rounded-lg border px-3 py-2 text-sm', styles.inputBg, styles.inputBorder)} />
        <div className="relative"><input type={showApiKey ? 'text' : 'password'} value={configDraft.apiKey} onChange={(e) => setConfigDraft((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder={PROVIDER_PRESETS[configDraft.provider].keyPlaceholder} className={cn('w-full rounded-lg border px-3 py-2 pr-10 text-sm', styles.inputBg, styles.inputBorder)} /><button className={cn('absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md', styles.toolbarHoverBg)} onClick={() => setShowApiKey((v) => !v)} type="button">{showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
        <input ref={importFileRef} type="file" accept="application/json" className="hidden" onChange={(e) => void handleImportConfig(e.target.files?.[0])} />
        <div className="flex items-center justify-between gap-2"><p className={cn('text-xs', styles.subtleText)}>{configLoading ? 'Loading configuration...' : configHint || (configReady ? 'Configured and ready.' : 'Not configured yet.')}</p>
          <div className="flex items-center gap-2"><button onClick={handleTestConnection} disabled={connectionState === 'testing' || configLoading} className={cn('px-3 py-1.5 text-xs rounded-lg border', styles.inputBorder, styles.toolbarHoverBg)}>{connectionState === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}</button><button onClick={handleExportConfig} className={cn('px-3 py-1.5 text-xs rounded-lg border', styles.inputBorder, styles.toolbarHoverBg)}>Export encrypted</button><button onClick={() => importFileRef.current?.click()} className={cn('px-3 py-1.5 text-xs rounded-lg border', styles.inputBorder, styles.toolbarHoverBg)}><Upload className="w-3.5 h-3.5" /></button><button onClick={() => void handleSaveConfig()} className="px-3 py-1.5 text-xs rounded-lg bg-brand-orange text-white">Save</button></div>
        </div>
        {connectionHint && <div className="text-xs">{connectionHint}</div>}
      </div>}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isEditing = editingMessageId === msg.id;
          const isUserMessage = msg.role === 'user';
          return (
            <div key={msg.id} className={cn('group/message flex gap-3 items-start', isUserMessage ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold shadow-sm ring-1 ring-black/5',
                isUserMessage ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700' : 'bg-gradient-to-br from-brand-orange to-orange-500 text-white',
              )}>
                {isUserMessage ? 'You' : <Bot className="w-4.5 h-4.5" />}
              </div>
              <div className={cn(
                'p-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed border shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all duration-200',
                isUserMessage
                  ? cn(styles.toolbarGroupBg, 'border-transparent')
                  : cn(styles.noteCardBg, styles.divider, 'border'),
              )}>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)} rows={4} className="w-full rounded-md border px-2 py-1 text-sm" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingMessageId(null)} className={cn('text-xs px-2 py-1 rounded-md', styles.toolbarHoverBg)}>Cancel</button>
                      <button
                        onClick={() => {
                          const nextText = editingDraft.trim() || msg.text;
                          if (isUserMessage) handleEditAsNextQuestion(nextText);
                          updateActiveSession((prev) => prev.map((m) => (m.id === msg.id ? { ...m, text: nextText, updatedAt: Date.now() } : m)));
                          setEditingMessageId(null);
                        }}
                        className="text-xs px-2 py-1 rounded-md bg-brand-orange text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={cn('prose prose-sm max-w-none', isDark ? 'prose-invert' : '')}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                    <div className={cn(
                      'mt-2 flex justify-end gap-1 opacity-0 translate-y-1 transition-all duration-200 group-hover/message:opacity-100 group-hover/message:translate-y-0',
                      isEditing ? 'opacity-100 translate-y-0' : '',
                    )}>
                      <MessageActionButton
                        onClick={() => void handleCopyMessage(msg.text)}
                        label="Copy"
                        className={cn(styles.toolbarHoverBg, styles.subtleText)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </MessageActionButton>
                      <MessageActionButton
                        onClick={() => { setEditingMessageId(msg.id); setEditingDraft(msg.text); }}
                        label="Edit"
                        className={cn(styles.toolbarHoverBg, styles.subtleText)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </MessageActionButton>
                      {isUserMessage && (
                        <MessageActionButton
                          onClick={() => handleEditAsNextQuestion(msg.text)}
                          label="Ask from here"
                          className={cn(styles.toolbarHoverBg, styles.subtleText)}
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                        </MessageActionButton>
                      )}
                      <MessageActionButton
                        onClick={() => updateActiveSession((prev) => prev.filter((m) => m.id !== msg.id))}
                        label="Delete"
                        className={cn(styles.toolbarHoverBg, 'text-rose-500')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </MessageActionButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {loading && <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-brand-orange text-white grid place-items-center"><Bot className="w-5 h-5" /></div><div className={cn('p-3 rounded-2xl flex items-center gap-2 border', styles.noteCardBg, styles.divider)}><Loader2 className={cn('w-4 h-4 animate-spin', styles.subtleText)} /><span className="text-xs opacity-80">Generating response...</span></div></div>}
        <div ref={messagesEndRef} />
      </div>

      <div className={cn('p-4 border-t shrink-0', styles.divider)}>
        {copyHint && <div className={cn('mb-2 text-xs', styles.subtleText)}>{copyHint}</div>}
        {tokenUsage.totalTokens >= 120000 && <div className="mb-2 text-[11px] text-amber-600">This session is getting long. Starting a new chat can reduce context cost.</div>}
        {quotedText && <div className={cn('mb-2 p-2 border-l-2 rounded-r-lg text-xs relative group', 'bg-brand-orange/10 border-brand-orange text-gray-900')}><p className="line-clamp-2 italic opacity-80">{quotedText}</p><button onClick={onClearQuote} className={cn('absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity', styles.toolbarGroupBg, styles.toolbarHoverBg)}><X className="w-3 h-3" /></button></div>}
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border transition-all', styles.inputBg, styles.inputBorder)}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleSend()} placeholder={quotedText ? 'Ask about this quote...' : 'Ask about the book...'} className={cn('flex-1 bg-transparent border-none outline-none text-sm', styles.inputText, styles.inputPlaceholder)} />
          <button onClick={() => void handleSend()} disabled={(!input.trim() && !quotedText) || loading} className={cn('p-2 rounded-lg transition-colors', (!input.trim() && !quotedText) ? styles.disabledText : cn('text-brand-orange', styles.toolbarHoverBg))}><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
