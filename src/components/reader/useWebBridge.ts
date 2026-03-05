import { useEffect, useMemo, useState } from 'react';

const WEB_BLOCKED_HOSTS_KEY = 'lumina.web.blocked-hosts.v1';

interface UseWebBridgeParams {
  isWeb: boolean;
  bookContent: unknown;
  webIframeRef: React.RefObject<HTMLIFrameElement | null>;
  webBridgeSourceWindowRef: { current: Window | null };
  setQuotedText: (text: string | null) => void;
  setActiveTab: (tab: 'chat' | 'contents' | 'highlights' | 'bookmarks' | 'search') => void;
  setShowSidebar: (show: boolean) => void;
  setTempSelection: (selection: { text: string } | null) => void;
  addHighlight: (color: 'yellow' | 'green' | 'blue' | 'red', note?: string) => void;
}

const safeParseBlockedHosts = () => {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.localStorage.getItem(WEB_BLOCKED_HOSTS_KEY);
    if (!raw) return new Set<string>();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set<string>();
    return new Set<string>(arr.filter((item) => typeof item === 'string'));
  } catch {
    return new Set<string>();
  }
};

const persistBlockedHosts = (hosts: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEB_BLOCKED_HOSTS_KEY, JSON.stringify(Array.from(hosts)));
  } catch {
    // ignore storage failures
  }
};

const getHostFromUrl = (url: string) => {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
};

export function useWebBridge({
  isWeb,
  bookContent,
  webIframeRef,
  webBridgeSourceWindowRef,
  setQuotedText,
  setActiveTab,
  setShowSidebar,
  setTempSelection,
  addHighlight,
}: UseWebBridgeParams) {
  const [webUrl, setWebUrl] = useState(() => (isWeb && typeof bookContent === 'string' ? bookContent : ''));
  const [webFrameStatus, setWebFrameStatus] = useState<'idle' | 'loading' | 'loaded' | 'error' | 'blocked'>('idle');
  const [webFrameHint, setWebFrameHint] = useState<string | null>(null);
  const [webBlockedByPolicy, setWebBlockedByPolicy] = useState(false);
  const [blockedHosts, setBlockedHosts] = useState<Set<string>>(() => safeParseBlockedHosts());
  const [webBridgeConnected, setWebBridgeConnected] = useState(false);
  const [webBridgeVersion, setWebBridgeVersion] = useState<string | null>(null);
  const [webBridgeLastError, setWebBridgeLastError] = useState<string | null>(null);
  const [webBridgeLastAction, setWebBridgeLastAction] = useState<string | null>(null);

  const normalizeWebInputUrl = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const normalizedUrl = useMemo(() => normalizeWebInputUrl(webUrl), [webUrl]);
  const currentHost = useMemo(() => getHostFromUrl(normalizedUrl), [normalizedUrl]);

  const markHostAsBlocked = (url: string) => {
    const host = getHostFromUrl(url);
    if (!host) return;
    setBlockedHosts((prev) => {
      if (prev.has(host)) return prev;
      const next = new Set(prev);
      next.add(host);
      persistBlockedHosts(next);
      return next;
    });
  };

  const clearBlockedHost = (url: string) => {
    const host = getHostFromUrl(url);
    if (!host) return;
    setBlockedHosts((prev) => {
      if (!prev.has(host)) return prev;
      const next = new Set(prev);
      next.delete(host);
      persistBlockedHosts(next);
      return next;
    });
  };

  const clearAllBlockedHosts = () => {
    setBlockedHosts(() => {
      const next = new Set<string>();
      persistBlockedHosts(next);
      return next;
    });
  };

  useEffect(() => {
    if (!isWeb) return;
    const initialUrl = typeof bookContent === 'string' ? bookContent : '';
    setWebUrl(initialUrl);
    setWebBridgeConnected(false);
    setWebBridgeVersion(null);
    setWebFrameHint('Recommended production setup: enable the browser extension bridge (content script + postMessage) for in-page selection, highlights, notes, and AI quotes.');

    const normalized = normalizeWebInputUrl(initialUrl);
    const host = getHostFromUrl(normalized);
    if (host && blockedHosts.has(host)) {
      setWebBlockedByPolicy(true);
      setWebFrameStatus('blocked');
      setWebFrameHint('This site does not allow iframe embedding. Switched to external-open mode automatically.');
      return;
    }

    setWebBlockedByPolicy(false);
    setWebFrameStatus('loading');
  }, [isWeb, bookContent]);

  useEffect(() => {
    if (!isWeb) return;
    if (webFrameStatus !== 'loading') return;
    if (!currentHost) return;

    if (blockedHosts.has(currentHost)) {
      setWebBlockedByPolicy(true);
      setWebFrameStatus('blocked');
      setWebFrameHint('This site does not allow iframe embedding. Switched to external-open mode automatically.');
    }
  }, [isWeb, webFrameStatus, blockedHosts, currentHost]);

  useEffect(() => {
    if (!isWeb) return;
    if (webFrameStatus !== 'loading') return;

    const timer = window.setTimeout(() => {
      if (webBridgeConnected) return;
      setWebBlockedByPolicy(true);
      setWebFrameStatus('blocked');
      setWebFrameHint('The target page likely enforces embed-restriction policies. Switched to external-open mode.');
      markHostAsBlocked(normalizedUrl);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [isWeb, webFrameStatus, webBridgeConnected, normalizedUrl]);

  useEffect(() => {
    if (!isWeb) return;

    const postBridgeAck = (ok: boolean, reqId?: string, action?: string, error?: string, detail?: string) => {
      const targetWindow = webBridgeSourceWindowRef.current || webIframeRef.current?.contentWindow;
      if (!targetWindow) return;
      targetWindow.postMessage({ source: 'lumina-host', type: 'host-ack', protocolVersion: '2.0.0', ok, reqId, action, error, detail, ts: Date.now() }, '*');
    };

    const handleBridgeMessage = (event: MessageEvent) => {
      const payload = event.data as { source?: string; type?: string; version?: string; protocolVersion?: string; reqId?: string; action?: string; text?: string; note?: string } | null;
      if (!payload || payload.source !== 'lumina-web-bridge') return;

      const iframeWindow = webIframeRef.current?.contentWindow;
      const lockedSource = webBridgeSourceWindowRef.current;
      if (lockedSource && event.source && event.source !== lockedSource) return;

      if (!lockedSource) {
        try {
          const expectedOrigin = iframeWindow ? new URL(webIframeRef.current?.src || '').origin : null;
          if (expectedOrigin && event.origin && event.origin !== 'null' && event.origin !== expectedOrigin) return;
        } catch {
          // ignore malformed iframe src
        }
      }

      if (payload.type === 'bridge-ready') {
        webBridgeSourceWindowRef.current = (event.source as Window) || iframeWindow || null;
        setWebBridgeConnected(true);
        setWebBlockedByPolicy(false);
        setWebFrameStatus('loaded');
        setWebBridgeVersion(payload.version || payload.protocolVersion || null);
        setWebBridgeLastError(null);
        setWebFrameHint(`Bridge connected${payload.version ? ` (v${payload.version})` : ''}. In-page selection sync is available.`);
        postBridgeAck(true, payload.reqId, 'bridge-ready');
        return;
      }

      if (!webBridgeConnected) {
        webBridgeSourceWindowRef.current = (event.source as Window) || iframeWindow || null;
        setWebBridgeConnected(true);
        setWebBlockedByPolicy(false);
        setWebFrameStatus('loaded');
        setWebBridgeVersion(payload.protocolVersion || payload.version || null);
        setWebFrameHint('Bridge connected. Selection/action messages are flowing.');
      }

      if (payload.type === 'selection' && payload.text?.trim()) {
        setQuotedText(payload.text.trim());
        setActiveTab('chat');
        setShowSidebar(true);
        setWebBridgeLastAction('quote.toChat');
        postBridgeAck(true, payload.reqId, 'quote.toChat');
        return;
      }

      if (payload.type === 'host-action') {
        const action = payload.action;
        const text = payload.text?.trim();

        if (action === 'quote.toChat') {
          if (!text) return postBridgeAck(false, payload.reqId, action, 'MISSING_TEXT', 'quote.toChat requires text');
          setQuotedText(text);
          setActiveTab('chat');
          setShowSidebar(true);
          setWebBridgeLastAction(action);
          setWebBridgeLastError(null);
          return postBridgeAck(true, payload.reqId, action);
        }

        if (action === 'highlight.create') {
          if (!text) return postBridgeAck(false, payload.reqId, action, 'MISSING_TEXT', 'highlight.create requires text');
          setTempSelection({ text });
          addHighlight('yellow');
          setActiveTab('highlights');
          setShowSidebar(true);
          setWebBridgeLastAction(action);
          setWebBridgeLastError(null);
          return postBridgeAck(true, payload.reqId, action);
        }

        if (action === 'note.create') {
          if (!text) return postBridgeAck(false, payload.reqId, action, 'MISSING_TEXT', 'note.create requires text');
          setTempSelection({ text });
          addHighlight('yellow', payload.note?.trim() || '');
          setActiveTab('highlights');
          setShowSidebar(true);
          setWebBridgeLastAction(action);
          setWebBridgeLastError(null);
          return postBridgeAck(true, payload.reqId, action);
        }

        setWebBridgeLastError(`Unsupported action: ${action || 'unknown'}`);
        postBridgeAck(false, payload.reqId, action, 'UNSUPPORTED_ACTION', 'Host does not support this action');
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    const helloTimer = window.setInterval(() => {
      const frameWindow = webIframeRef.current?.contentWindow;
      if (!frameWindow) return;
      frameWindow.postMessage({ source: 'lumina-host', type: 'host-hello', protocolVersion: '2.0.0', ts: Date.now() }, '*');
    }, 1500);

    return () => {
      window.removeEventListener('message', handleBridgeMessage);
      window.clearInterval(helloTimer);
    };
  }, [isWeb, webBridgeConnected, webBridgeSourceWindowRef, webIframeRef, setQuotedText, setActiveTab, setShowSidebar, setTempSelection, addHighlight]);

  return {
    webUrl,
    setWebUrl,
    webFrameStatus,
    setWebFrameStatus,
    webFrameHint,
    setWebFrameHint,
    webBlockedByPolicy,
    setWebBlockedByPolicy,
    webBridgeConnected,
    webBridgeVersion,
    webBridgeLastError,
    webBridgeLastAction,
    normalizeWebInputUrl,
    markHostAsBlocked,
    clearBlockedHost,
    clearAllBlockedHosts,
  };
}
