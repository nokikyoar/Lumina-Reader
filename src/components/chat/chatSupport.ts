import { type Book } from '@/lib/db';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface TokenUsage {
  contextTokens: number;
  responseTokens: number;
  totalTokens: number;
  updatedAt: number;
}

export interface ChatStore {
  activeSessionId: string;
  sessions: ChatSession[];
  usageBySession: Record<string, TokenUsage>;
}

export type AiProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'azure-openai' | 'custom-openai';
export type ConnectionState = 'idle' | 'testing' | 'success' | 'error';

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  azureApiVersion: string;
}

interface StoredAiConfig {
  provider?: AiProvider;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  azureApiVersion?: string;
  apiKey?: string;
  encryptedApiKey?: string;
  apiKeyIv?: string;
}

interface ApiErrorInfo {
  status?: number;
  message: string;
  category: 'auth' | 'rate_limit' | 'server' | 'network' | 'timeout' | 'cancelled' | 'unknown';
}

interface ApiCallResult {
  content: string;
  status: number;
  latencyMs: number;
  endpoint: string;
}

const AI_CONFIG_STORAGE_KEY = 'lumina.ai.config.v2';
const AI_CONFIG_LEGACY_STORAGE_KEY = 'lumina.ai.config.v1';
const AI_LOCAL_SECRET_KEY = 'lumina.ai.local.secret.v1';
const CHAT_STORAGE_KEY_PREFIX = 'lumina.chat.store.v2';
const CHAT_STORAGE_KEY_LEGACY_PREFIX = 'lumina.chat.messages.v1';
const REQUEST_TIMEOUT_MS = 45000;
const MAX_RETRIES = 2;
const LEGACY_CONNECT_PROMPT = 'Before we start, open settings and connect your AI API.';
const FRIENDLY_CONNECT_PROMPT = '${FRIENDLY_CONNECT_PROMPT}';

export const PROVIDER_PRESETS: Record<AiProvider, { label: string; defaultBaseUrl: string; defaultModel: string; keyPlaceholder: string }> = {
  openai: { label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', keyPlaceholder: 'sk-...' },
  anthropic: { label: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-5-sonnet-latest', keyPlaceholder: 'sk-ant-...' },
  google: { label: 'Google Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash', keyPlaceholder: 'AIza...' },
  openrouter: { label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini', keyPlaceholder: 'sk-or-v1-...' },
  'azure-openai': { label: 'Azure OpenAI', defaultBaseUrl: 'https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT', defaultModel: 'gpt-4o-mini', keyPlaceholder: 'Azure API Key' },
  'custom-openai': { label: 'Custom OpenAI-Compatible', defaultBaseUrl: 'https://your-endpoint.com/v1', defaultModel: 'your-model-name', keyPlaceholder: 'API Key' },
};

export const makeMsgId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const makeSessionId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const makeMessage = (role: 'user' | 'model', text: string): Message => ({ id: makeMsgId(), role, text, createdAt: Date.now() });

export const defaultConfig = (): AiConfig => ({
  provider: 'openai',
  model: PROVIDER_PRESETS.openai.defaultModel,
  apiKey: '',
  baseUrl: PROVIDER_PRESETS.openai.defaultBaseUrl,
  temperature: 0.4,
  maxTokens: 900,
  azureApiVersion: '2024-06-01',
});

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
const getChatStorageKey = (bookId: string) => `${CHAT_STORAGE_KEY_PREFIX}:${bookId}`;
const getLegacyChatStorageKey = (bookId: string) => `${CHAT_STORAGE_KEY_LEGACY_PREFIX}:${bookId}`;

function replaceLegacyConnectPrompt(text: string): string {
  if (!text.includes(LEGACY_CONNECT_PROMPT)) return text;
  return text.replace(LEGACY_CONNECT_PROMPT, FRIENDLY_CONNECT_PROMPT);
}

function initialAssistantMessage(fallbackTitle: string): Message {
  return makeMessage('model', `Hi! I'm your reading assistant. I can help you understand "${fallbackTitle}".\n\n${FRIENDLY_CONNECT_PROMPT}`);
}

function createDefaultSession(fallbackTitle: string): ChatSession {
  const now = Date.now();
  return {
    id: makeSessionId(),
    title: 'New chat',
    messages: [initialAssistantMessage(fallbackTitle)],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeMessages(input: unknown): Message[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const msg = m as Partial<Message>;
      if (typeof msg.id !== 'string' || typeof msg.text !== 'string' || (msg.role !== 'user' && msg.role !== 'model')) return null;
      return {
        id: msg.id,
        role: msg.role,
        text: replaceLegacyConnectPrompt(msg.text),
        createdAt: Number(msg.createdAt ?? Date.now()),
        updatedAt: msg.updatedAt ? Number(msg.updatedAt) : undefined,
      } as Message;
    })
    .filter((m): m is Message => Boolean(m));
}

function normalizeSession(input: unknown, fallbackTitle: string): ChatSession | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ChatSession>;
  if (typeof raw.id !== 'string') return null;
  const messages = normalizeMessages(raw.messages);
  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'New chat',
    messages: messages.length > 0 ? messages : [initialAssistantMessage(fallbackTitle)],
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
  };
}

function normalizeUsage(input: unknown): Record<string, TokenUsage> {
  if (!input || typeof input !== 'object') return {};
  const output: Record<string, TokenUsage> = {};
  Object.entries(input as Record<string, unknown>).forEach(([sessionId, value]) => {
    if (!value || typeof value !== 'object') return;
    const usage = value as Partial<TokenUsage>;
    output[sessionId] = {
      contextTokens: Math.max(0, Number(usage.contextTokens ?? 0)),
      responseTokens: Math.max(0, Number(usage.responseTokens ?? 0)),
      totalTokens: Math.max(0, Number(usage.totalTokens ?? 0)),
      updatedAt: Number(usage.updatedAt ?? Date.now()),
    };
  });
  return output;
}

export function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function isLikelyValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function loadChatStore(bookId: string, fallbackTitle: string): ChatStore {
  const createInitial = (): ChatStore => {
    const defaultSession = createDefaultSession(fallbackTitle);
    return {
      activeSessionId: defaultSession.id,
      sessions: [defaultSession],
      usageBySession: {},
    };
  };

  try {
    const raw = window.localStorage.getItem(getChatStorageKey(bookId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatStore>;
      const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions.map((s) => normalizeSession(s, fallbackTitle)).filter((s): s is ChatSession => Boolean(s))
        : [];
      if (sessions.length === 0) return createInitial();
      const activeSessionId = sessions.some((s) => s.id === parsed.activeSessionId)
        ? (parsed.activeSessionId as string)
        : sessions[0].id;
      const usageBySession = normalizeUsage(parsed.usageBySession);
      return { activeSessionId, sessions, usageBySession };
    }

    const legacyRaw = window.localStorage.getItem(getLegacyChatStorageKey(bookId));
    if (legacyRaw) {
      const messages = normalizeMessages(JSON.parse(legacyRaw));
      const now = Date.now();
      const legacySession: ChatSession = {
        id: makeSessionId(),
        title: 'Legacy chat',
        messages: messages.length > 0 ? messages : [initialAssistantMessage(fallbackTitle)],
        createdAt: now,
        updatedAt: now,
      };
      const migrated: ChatStore = { activeSessionId: legacySession.id, sessions: [legacySession], usageBySession: {} };
      persistChatStore(bookId, migrated);
      window.localStorage.removeItem(getLegacyChatStorageKey(bookId));
      return migrated;
    }
  } catch {
    return createInitial();
  }

  return createInitial();
}

export function persistChatStore(bookId: string, store: ChatStore) {
  window.localStorage.setItem(getChatStorageKey(bookId), JSON.stringify(store));
}

export function createSession(fallbackTitle: string): ChatSession {
  return createDefaultSession(fallbackTitle);
}

export function summarizeSessionTitle(text: string): string {
  const stripped = text.replace(/^>.*$/gm, '').replace(/\s+/g, ' ').trim();
  if (!stripped) return 'New chat';
  return stripped.slice(0, 36);
}

// backward compatibility for existing imports/usages
export function loadChatMessages(bookId: string, fallbackTitle: string): Message[] {
  const store = loadChatStore(bookId, fallbackTitle);
  return store.sessions.find((s) => s.id === store.activeSessionId)?.messages ?? store.sessions[0]?.messages ?? [initialAssistantMessage(fallbackTitle)];
}

export function persistChatMessages(bookId: string, messages: Message[]) {
  const store = loadChatStore(bookId, 'Book');
  const nextSessions = store.sessions.map((s) => (s.id === store.activeSessionId ? { ...s, messages, updatedAt: Date.now() } : s));
  persistChatStore(bookId, { ...store, sessions: nextSessions });
}

async function getOrCreateLocalSecret(): Promise<Uint8Array> {
  const existing = window.localStorage.getItem(AI_LOCAL_SECRET_KEY);
  if (existing) return base64ToBytes(existing);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  window.localStorage.setItem(AI_LOCAL_SECRET_KEY, bytesToBase64(bytes));
  return bytes;
}

async function deriveAesKey(secret: Uint8Array): Promise<CryptoKey> {
  const secretBuffer = secret.buffer.slice(secret.byteOffset, secret.byteOffset + secret.byteLength) as ArrayBuffer;
  return crypto.subtle.importKey('raw', secretBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptText(plainText: string): Promise<{ encryptedApiKey: string; apiKeyIv: string }> {
  const secret = await getOrCreateLocalSecret();
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText));
  return { encryptedApiKey: bytesToBase64(new Uint8Array(encrypted)), apiKeyIv: bytesToBase64(iv) };
}

async function decryptText(encryptedBase64: string, ivBase64: string): Promise<string> {
  const secret = await getOrCreateLocalSecret();
  const key = await deriveAesKey(secret);
  const encryptedBytes = base64ToBytes(encryptedBase64);
  const iv = base64ToBytes(ivBase64);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedBytes);
  return new TextDecoder().decode(plainBuffer);
}

export async function loadAiConfig(): Promise<AiConfig> {
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY) ?? window.localStorage.getItem(AI_CONFIG_LEGACY_STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as StoredAiConfig;
    const provider = parsed.provider && PROVIDER_PRESETS[parsed.provider] ? parsed.provider : 'openai';
    let apiKey = '';
    if (parsed.encryptedApiKey && parsed.apiKeyIv) {
      try { apiKey = await decryptText(parsed.encryptedApiKey, parsed.apiKeyIv); } catch { apiKey = ''; }
    } else if (parsed.apiKey) apiKey = parsed.apiKey.trim();

    const normalized: AiConfig = {
      provider,
      model: parsed.model?.trim() || PROVIDER_PRESETS[provider].defaultModel,
      apiKey,
      baseUrl: parsed.baseUrl?.trim() || PROVIDER_PRESETS[provider].defaultBaseUrl,
      temperature: clamp(Number(parsed.temperature ?? 0.4), 0, 2),
      maxTokens: clamp(Number(parsed.maxTokens ?? 900), 128, 4096),
      azureApiVersion: parsed.azureApiVersion?.trim() || '2024-06-01',
    };
    if (!parsed.encryptedApiKey && apiKey) await saveAiConfig(normalized);
    return normalized;
  } catch {
    return defaultConfig();
  }
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  const encrypted = config.apiKey ? await encryptText(config.apiKey) : { encryptedApiKey: '', apiKeyIv: '' };
  window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    azureApiVersion: config.azureApiVersion,
    encryptedApiKey: encrypted.encryptedApiKey,
    apiKeyIv: encrypted.apiKeyIv,
  }));
  window.localStorage.removeItem(AI_CONFIG_LEGACY_STORAGE_KEY);
}

function classifyError(error: unknown): ApiErrorInfo {
  if (!(error instanceof Error)) return { message: 'Unknown failure', category: 'unknown' };
  const message = error.message || 'Unknown failure';
  if (message.includes('timed out')) return { message, category: 'timeout' };
  if (message.includes('cancelled') || message.includes('canceled')) return { message, category: 'cancelled' };
  const status = Number(message.match(/\((\d{3})\)/)?.[1]);
  if (status === 401 || status === 403) return { status, message, category: 'auth' };
  if (status === 429) return { status, message, category: 'rate_limit' };
  if (status >= 500) return { status, message, category: 'server' };
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('failed to fetch')) return { message, category: 'network' };
  return { status, message, category: 'unknown' };
}

export function toUserFriendlyError(err: unknown): string {
  const info = classifyError(err);
  switch (info.category) {
    case 'auth': return 'Authentication failed. Please verify API key, model permission, and endpoint.';
    case 'rate_limit': return 'Rate limit reached. Retrying may help, or reduce request frequency.';
    case 'server': return 'Provider service is currently unavailable. Please try again shortly.';
    case 'network': return 'Network request failed. Check connectivity, CORS policy, or endpoint URL.';
    case 'timeout': return 'Request timed out. Try again or reduce the prompt size.';
    case 'cancelled': return 'Request was cancelled.';
    default: return `Request failed. ${info.message}`;
  }
}

function buildEndpoint(config: AiConfig): string {
  const trimmed = config.baseUrl.replace(/\/$/, '');
  if (config.provider === 'azure-openai') return `${trimmed}/chat/completions?api-version=${encodeURIComponent(config.azureApiVersion || '2024-06-01')}`;
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

async function callOpenAiCompatibleOnce(config: AiConfig, prompt: string, systemPrompt: string, signal?: AbortSignal, timeoutMs = REQUEST_TIMEOUT_MS): Promise<ApiCallResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.provider === 'azure-openai') headers['api-key'] = config.apiKey;
  else headers.Authorization = `Bearer ${config.apiKey}`;

  const payload: Record<string, unknown> = {
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
  };
  if (config.provider !== 'azure-openai') payload.model = config.model;

  const endpoint = buildEndpoint(config);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
  const abortListener = () => controller.abort(new Error('Request cancelled'));
  signal?.addEventListener('abort', abortListener);

  try {
    const startedAt = performance.now();
    const response = await fetch(endpoint, { method: 'POST', headers, signal: controller.signal, body: JSON.stringify(payload) });
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    if (!response.ok) throw new Error(`AI API Error (${response.status}): ${(await response.text()).slice(0, 240)}`);
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { content: data.choices?.[0]?.message?.content?.trim() || 'No content returned by model.', status: response.status, latencyMs, endpoint };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abortListener);
  }
}

export async function callWithRetry(config: AiConfig, prompt: string, systemPrompt: string, signal?: AbortSignal): Promise<ApiCallResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await callOpenAiCompatibleOnce(config, prompt, systemPrompt, signal, REQUEST_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      const c = classifyError(error).category;
      if (signal?.aborted || !['rate_limit', 'server', 'network', 'timeout'].includes(c) || attempt >= MAX_RETRIES) break;
      await sleep(Math.min(4000, 400 * 2 ** attempt) + Math.floor(Math.random() * 180));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
}

export function exportChat(book: Book, messages: Message[]) {
  const payload = { bookId: book.id, bookTitle: book.title, exportedAt: new Date().toISOString(), messages };
  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonA = document.createElement('a');
  jsonA.href = jsonUrl;
  jsonA.download = `lumina-chat-${book.id}.json`;
  jsonA.click();
  URL.revokeObjectURL(jsonUrl);

  const mdLines = ['# Chat Export', '', `- Book: ${book.title}`, `- Book ID: ${book.id}`, `- Exported At: ${new Date().toISOString()}`, '', ...messages.flatMap((m, i) => [`## ${i + 1}. ${m.role === 'user' ? 'User' : 'Assistant'}`, '', m.text, ''])];
  const mdBlob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const mdUrl = URL.createObjectURL(mdBlob);
  const mdA = document.createElement('a');
  mdA.href = mdUrl;
  mdA.download = `lumina-chat-${book.id}.md`;
  mdA.click();
  URL.revokeObjectURL(mdUrl);
}
