(() => {
  const BRIDGE_SOURCE = 'lumina-web-bridge';
  const HOST_SOURCE = 'lumina-host';
  const PROTOCOL_VERSION = '2.0.0';
  const ALLOWED_HOST_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  let hostDetected = false;
  let hostOrigin = null;
  let currentSelectionText = '';
  let lastSelectionRect = null;

  const MENU_ID = 'lumina-bridge-selection-menu';
  const NOTE_EDITOR_ID = 'lumina-bridge-note-editor';
  const DEBUG_ID = 'lumina-bridge-debug';
  let debugVisible = false;

  const makeReqId = () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const isAllowedHostOrigin = (origin) => {
    if (!origin || origin === 'null') return false;
    if (ALLOWED_HOST_ORIGINS.includes(origin)) return true;
    if (origin.endsWith('.lumina-reader.app')) return true;
    return false;
  };

  const postToHost = (payload) => {
    const packet = {
      source: BRIDGE_SOURCE,
      protocolVersion: PROTOCOL_VERSION,
      ...payload,
      ts: Date.now(),
    };

    // Send to direct parent (most common: embedded reader iframe).
    window.parent.postMessage(packet, '*');

    // Fallback for deeper nesting: also notify top window.
    if (window.top && window.top !== window.parent) {
      window.top.postMessage(packet, '*');
    }
  };

  const sendBridgeReady = () => {
    postToHost({
      type: 'bridge-ready',
      version: PROTOCOL_VERSION,
      reqId: makeReqId(),
    });
  };

  const pushSelectionAction = (action, text, note = '') => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    postToHost({
      type: 'host-action',
      reqId: makeReqId(),
      action,
      text: trimmed,
      note,
    });
  };

  const pushSelectionEvent = (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    postToHost({
      type: 'selection',
      reqId: makeReqId(),
      text: trimmed,
    });
  };

  const removeEl = (id) => {
    const el = document.getElementById(id);
    if (el?.parentNode) el.parentNode.removeChild(el);
  };

  const createMenu = () => {
    if (document.getElementById(MENU_ID)) return document.getElementById(MENU_ID);

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.style.cssText = [
      'position: fixed',
      'z-index: 2147483647',
      'display: none',
      'padding: 6px',
      'border-radius: 999px',
      'background: rgba(20,20,20,0.95)',
      'color: #fff',
      'font-family: Inter, system-ui, sans-serif',
      'font-size: 12px',
      'box-shadow: 0 8px 24px rgba(0,0,0,0.35)',
      'gap: 6px',
      'align-items: center',
      'user-select: none',
    ].join(';');

    const makeBtn = (label, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = [
        'border: 0',
        'border-radius: 999px',
        'padding: 6px 10px',
        'cursor: pointer',
        'font-size: 12px',
        'font-weight: 600',
      ].join(';');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return btn;
    };

    const quoteBtn = makeBtn('Quote', () => {
      pushSelectionAction('quote.toChat', currentSelectionText);
      hideMenu();
    });
    quoteBtn.style.background = '#fb923c';
    quoteBtn.style.color = '#fff';

    const hlBtn = makeBtn('Highlight', () => {
      pushSelectionAction('highlight.create', currentSelectionText);
      hideMenu();
    });
    hlBtn.style.background = '#fde68a';
    hlBtn.style.color = '#1f2937';

    const noteBtn = makeBtn('Note', () => {
      openNoteEditor(currentSelectionText, lastSelectionRect);
    });
    noteBtn.style.background = '#93c5fd';
    noteBtn.style.color = '#0f172a';

    menu.appendChild(quoteBtn);
    menu.appendChild(hlBtn);
    menu.appendChild(noteBtn);

    document.documentElement.appendChild(menu);
    return menu;
  };

  const hideNoteEditor = () => {
    removeEl(NOTE_EDITOR_ID);
  };

  const openNoteEditor = (text, rect) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    hideMenu();
    hideNoteEditor();

    const editor = document.createElement('div');
    editor.id = NOTE_EDITOR_ID;
    editor.style.cssText = [
      'position: fixed',
      'z-index: 2147483647',
      'width: min(360px, calc(100vw - 24px))',
      'padding: 10px',
      'border-radius: 12px',
      'background: rgba(20,20,20,0.96)',
      'color: #fff',
      'font-family: Inter, system-ui, sans-serif',
      'box-shadow: 0 12px 40px rgba(0,0,0,0.45)',
      'display: flex',
      'flex-direction: column',
      'gap: 8px',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Add note';
    title.style.cssText = 'font-weight: 700; font-size: 12px; opacity: 0.95;';

    const quote = document.createElement('div');
    quote.textContent = trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed;
    quote.style.cssText = [
      'font-size: 12px',
      'opacity: 0.85',
      'line-height: 1.35',
      'padding: 8px',
      'border-radius: 10px',
      'background: rgba(255,255,255,0.06)',
      'max-height: 96px',
      'overflow: auto',
      'white-space: pre-wrap',
    ].join(';');

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Type your note…';
    textarea.rows = 3;
    textarea.style.cssText = [
      'width: 100%',
      'resize: vertical',
      'min-height: 72px',
      'max-height: 180px',
      'border-radius: 10px',
      'border: 1px solid rgba(255,255,255,0.18)',
      'background: rgba(255,255,255,0.06)',
      'color: #fff',
      'padding: 8px',
      'font-size: 12px',
      'outline: none',
    ].join(';');

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';

    const btn = (label, cssText, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = cssText;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return b;
    };

    const baseBtnCss = [
      'border: 0',
      'border-radius: 999px',
      'padding: 8px 12px',
      'cursor: pointer',
      'font-size: 12px',
      'font-weight: 700',
    ].join(';');

    const cancelBtn = btn('Cancel', `${baseBtnCss}; background: rgba(255,255,255,0.10); color: #fff;`, () => {
      hideNoteEditor();
    });

    const saveBtn = btn('Save', `${baseBtnCss}; background: #93c5fd; color: #0f172a;`, () => {
      const note = (textarea.value || '').trim();
      pushSelectionAction('note.create', trimmed, note);
      hideNoteEditor();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    editor.appendChild(title);
    editor.appendChild(quote);
    editor.appendChild(textarea);
    editor.appendChild(actions);

    const defaultX = Math.max(12, Math.min(window.innerWidth - 372, 12));
    const defaultY = Math.max(12, Math.min(window.innerHeight - 220, 12));
    let x = defaultX;
    let y = defaultY;
    if (rect && typeof rect.left === 'number' && typeof rect.top === 'number') {
      x = Math.min(window.innerWidth - 372, Math.max(12, rect.left));
      y = Math.min(window.innerHeight - 220, Math.max(12, rect.bottom + 10));
    }
    editor.style.left = `${x}px`;
    editor.style.top = `${y}px`;

    document.documentElement.appendChild(editor);
    textarea.focus();
  };

  const hideMenu = () => {
    const menu = document.getElementById(MENU_ID);
    if (!menu) return;
    menu.style.display = 'none';
  };

  const showMenu = (rect) => {
    const menu = createMenu();
    const x = Math.min(window.innerWidth - 220, Math.max(12, rect.left + rect.width / 2 - 100));
    const y = Math.min(window.innerHeight - 56, Math.max(12, rect.top - 48));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'flex';
  };

  const updateSelectionAndMaybeShowMenu = () => {
    const selection = window.getSelection();
    const text = (selection?.toString() || '').trim();
    currentSelectionText = text;

    if (!hostDetected || !text || !selection || selection.rangeCount === 0) {
      hideMenu();
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      hideMenu();
      return;
    }
    lastSelectionRect = rect;

    pushSelectionEvent(text);
    showMenu(rect);
  };

  const toggleDebug = () => {
    debugVisible = !debugVisible;
    if (!debugVisible) {
      removeEl(DEBUG_ID);
      return;
    }
    removeEl(DEBUG_ID);
    const panel = document.createElement('div');
    panel.id = DEBUG_ID;
    panel.style.cssText = [
      'position: fixed',
      'right: 12px',
      'bottom: 12px',
      'z-index: 2147483647',
      'max-width: min(420px, calc(100vw - 24px))',
      'padding: 10px 12px',
      'border-radius: 12px',
      'background: rgba(0,0,0,0.78)',
      'color: #fff',
      'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
      'font-size: 11px',
      'line-height: 1.35',
      'white-space: pre-wrap',
    ].join(';');
    panel.textContent = [
      '[Lumina Bridge Debug]',
      `hostDetected: ${String(hostDetected)}`,
      `hostOrigin: ${hostOrigin || '(none)'}`,
      `selection.len: ${String((currentSelectionText || '').length)}`,
      `hasRect: ${String(!!lastSelectionRect)}`,
      'Hotkey: Ctrl+Shift+L to toggle',
    ].join('\n');
    document.documentElement.appendChild(panel);
  };

  window.addEventListener('message', (event) => {
    const payload = event.data;
    if (!payload || payload.source !== HOST_SOURCE) return;

    if (!isAllowedHostOrigin(event.origin)) return;
    if (hostOrigin && event.origin !== hostOrigin) return;

    if (payload.type === 'host-hello') {
      hostDetected = true;
      hostOrigin = event.origin;
      sendBridgeReady();
      return;
    }

    if (payload.type === 'host-ack') {
      if (!payload.ok) {
        console.warn('[lumina-bridge] host action failed', payload);
      }
    }
  });

  document.addEventListener('mouseup', () => {
    updateSelectionAndMaybeShowMenu();
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') return;
    updateSelectionAndMaybeShowMenu();
  });

  document.addEventListener('mousedown', (e) => {
    const menu = document.getElementById(MENU_ID);
    const editor = document.getElementById(NOTE_EDITOR_ID);
    if (menu && menu.contains(e.target)) return;
    if (editor && editor.contains(e.target)) return;
    hideMenu();
    hideNoteEditor();
  });

  window.addEventListener('scroll', hideMenu, true);
  window.addEventListener('blur', hideMenu);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      e.stopPropagation();
      toggleDebug();
    }
    if (e.key === 'Escape') {
      hideNoteEditor();
      hideMenu();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'bridge-action') return;
    if (message.action === 'note.create') {
      // Use last known selection rect if available; right-click may not preserve selection APIs.
      openNoteEditor(message.text, lastSelectionRect);
      return;
    }
    pushSelectionAction(message.action, message.text, message.note || '');
  });

  sendBridgeReady();
})();