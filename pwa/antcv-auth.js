/* antcv-auth.js — drop-in auth module for the AntCV PWA.
 *
 * Loads BEFORE the inline app JSX in index.html via:
 *   <script type="text/babel" data-presets="env,react" src="antcv-auth.js"></script>
 *
 * Exposes:
 *   - window.AntcvAuth        — imperative API (signIn / signOut / getEmail / etc.)
 *   - window.AntcvAuthPanel   — React component for the Settings menu
 *   - wrapped window.fetch    — auto-injects `Authorization: Bearer …` on relay calls
 *
 * Storage keys (plain localStorage):
 *   antcv:auth:token        — raw JWT
 *   antcv:auth:email        — email of the signed-in user
 *   antcv:auth:expires_at   — unix seconds
 */

(() => {
  'use strict';

  // v1.38: relay URL is loaded from relay-config.json by the index.html
  // bootstrap BEFORE this script runs. If the config was missing or
  // malformed, window.ANTCV_RELAY_URL is undefined and the app shows the
  // "service unavailable" screen; we never reach the auth panel in that
  // state. So the read here is straightforward.
  const DEFAULT_PROXY_URL = (typeof window !== 'undefined' && typeof window.ANTCV_RELAY_URL === 'string')
    ? window.ANTCV_RELAY_URL.replace(/\/+$/, '')
    : '';

  // Cryptographically-random URL-safe token. Used as OAuth `state` and
  // OpenID Connect `nonce` values for the "use a different account" flow.
  function randomToken(byteLength) {
    const arr = new Uint8Array(byteLength || 16);
    (crypto.getRandomValues || crypto.webkitGetRandomValues).call(crypto, arr);
    let s = '';
    for (let i = 0; i < arr.length; i++) {
      s += arr[i].toString(16).padStart(2, '0');
    }
    return s;
  }

  // ===== State =====
  const KEY_TOKEN = 'antcv:auth:token';
  const KEY_EMAIL = 'antcv:auth:email';
  const KEY_EXP   = 'antcv:auth:expires_at';

  const subscribers = new Set();

  function readState() {
    return {
      token: localStorage.getItem(KEY_TOKEN) || '',
      email: localStorage.getItem(KEY_EMAIL) || '',
      expiresAt: Number(localStorage.getItem(KEY_EXP) || 0),
    };
  }
  function writeState({ token, email, expiresAt }) {
    if (token) localStorage.setItem(KEY_TOKEN, token); else localStorage.removeItem(KEY_TOKEN);
    if (email) localStorage.setItem(KEY_EMAIL, email); else localStorage.removeItem(KEY_EMAIL);
    if (expiresAt) localStorage.setItem(KEY_EXP, String(expiresAt)); else localStorage.removeItem(KEY_EXP);
    notify();
  }
  function notify() {
    const s = readState();
    for (const fn of subscribers) {
      try { fn(s); } catch (e) { /* ignore */ }
    }
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY_TOKEN || e.key === KEY_EMAIL || e.key === KEY_EXP) notify();
  });

  // ===== Proxy URL detection =====
  function getProxyUrl() {
    const raw = localStorage.getItem('proxyUrl') || '';
    if (raw) {
      let url = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') url = parsed;
      } catch (e) { /* not JSON, use raw */ }
      url = (url || '').replace(/\/+$/, '');
      if (url) return url;
    }
    return DEFAULT_PROXY_URL;
  }
  function isRelayUrl(url) {
    const proxy = getProxyUrl();
    if (!proxy) return false;
    if (typeof url !== 'string') return false;
    return url === proxy || url.startsWith(proxy + '/') || url.startsWith(proxy + '?') || url.startsWith(proxy + '#');
  }

  // ===== Fetch wrapper =====
  const originalFetch = window.fetch.bind(window);

  async function wrappedFetch(input, init) {
    let url = '';
    if (typeof input === 'string') url = input;
    else if (input && typeof input.url === 'string') url = input.url;

    const isRelay = isRelayUrl(url);
    const { token } = readState();

    if (isRelay && token) {
      init = init || {};
      const headers = new Headers((input && input.headers) || init.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', 'Bearer ' + token);
      }
      init.headers = headers;
    }

    const res = await originalFetch(input, init);

    if (isRelay) {
      const refreshed = res.headers.get('X-Auth-Refresh');
      if (refreshed) {
        const decoded = decodeJwtPayload(refreshed);
        if (decoded && decoded.email) {
          writeState({ token: refreshed, email: decoded.email, expiresAt: decoded.exp || 0 });
        }
      }
      if (res.status === 401 && token) {
        const cloned = res.clone();
        let body;
        try { body = await cloned.json(); } catch (e) { body = null; }
        const looksLikeAuth =
          body && typeof body.error === 'string' &&
          (body.error === 'unauthenticated' || body.error.indexOf('expired') >= 0 || body.error.indexOf('auth') >= 0);
        if (looksLikeAuth) {
          writeState({ token: '', email: '', expiresAt: 0 });
        }
      }
    }
    return res;
  }
  window.fetch = wrappedFetch;

  // ===== JWT helpers (decode only) =====
  function decodeJwtPayload(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch (e) { return null; }
  }

  // ===== Imperative API =====
  const Auth = {
    defaultProxyUrl: DEFAULT_PROXY_URL,
    get email()     { return readState().email; },
    get token()     { return readState().token; },
    get expiresAt() { return readState().expiresAt; },
    isSignedIn()    { const s = readState(); return !!(s.token && s.email); },
    getState()      { return readState(); },

    subscribe(fn) {
      subscribers.add(fn);
      try { fn(readState()); } catch (e) { /* ignore */ }
      return () => subscribers.delete(fn);
    },

    /** Throw a clear error if the user isn't signed in. Used by the LLM call gates. */
    requireSignedIn(action) {
      if (!this.isSignedIn()) {
        const what = action ? ` for ${action}` : '';
        const e = new Error(`Sign in required${what}. Open ⚙ Settings → Account to sign in with Google or email.`);
        e.code = 'antcv_auth_required';
        throw e;
      }
    },

    async signOut() {
      const proxy = getProxyUrl();
      let hardResetUrl = 'https://cv-generator-det.pages.dev?hardReset=1&logout=1';
      try {
        if (proxy) {
          const res = await wrappedFetch(proxy + '/auth/logout', { method: 'POST' });
          const body = await res.json().catch(() => ({}));
          if (body && body.hard_reset_url) hardResetUrl = body.hard_reset_url;
        }
      } catch (e) { /* ignore; local hard reset still runs */ }
      const keepProxyUrl = (() => { try { return localStorage.getItem('proxyUrl') || JSON.stringify(DEFAULT_PROXY_URL); } catch (e) { return JSON.stringify(DEFAULT_PROXY_URL); } })();
      writeState({ token: '', email: '', expiresAt: 0 });
      try { localStorage.clear(); } catch (e) {}
      try { localStorage.setItem('proxyUrl', keepProxyUrl || JSON.stringify(DEFAULT_PROXY_URL)); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      try {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          window.google.accounts.id.disableAutoSelect();
        }
      } catch (e) { /* ignore */ }
      try {
        if (window.AntcvHardReset) {
          await window.AntcvHardReset({ target: hardResetUrl.split('?')[0] });
          return;
        }
      } catch (e) { /* fall through to redirect */ }
      window.location.reload();
    },

    async signInWithGoogle(idToken) {
      const proxy = getProxyUrl();
      if (!proxy) throw new Error('Proxy URL not configured. Set it in Settings → Account first (the worker URL field).');
      const res = await originalFetch(proxy + '/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Not-allowlisted: the relay has already LOGGED an access request for this
        // email (admin reviews it). Surface a structured error so the UI can show
        // "request submitted" + a Cancel option instead of the raw code, and carry
        // the id_token so Cancel can re-prove ownership.
        if (body && body.error === 'email_not_allowed') {
          const e = new Error('email_not_allowed');
          e.code = 'email_not_allowed';
          e.email = body.email || '';
          e.idToken = idToken;
          throw e;
        }
        throw new Error(body.message || body.error || `Google sign-in failed (${res.status})`);
      }
      writeState({ token: body.token, email: body.email, expiresAt: body.expires_at || 0 });
      // v1.40.194: persist the relay origin so antcv-privacy-led.js
      // (and other sidecars that classify hosts) recognise it as
      // own-proxy rather than demo-proxy. The PWA's `proxyUrl` key is
      // intentionally left untouched — many users edit it manually for
      // BYOK; we use a dedicated key.
      try {
        if (proxy) localStorage.setItem('relayUrl', proxy);
      } catch (_) {}
      return body;
    },

    // Withdraw the access request the relay logged for a denied (not-allowlisted)
    // sign-in. Re-proves ownership with the same Google id_token. Best-effort.
    async cancelAccessRequest(idToken) {
      const proxy = getProxyUrl();
      if (!proxy) throw new Error('Proxy URL not configured.');
      if (!idToken) throw new Error('Sign in again to withdraw the request.');
      const res = await originalFetch(proxy + '/auth/access-request/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || `Could not withdraw request (${res.status})`);
      return body;
    },

    // Forces Google's account chooser via OAuth 2.0 implicit redirect with
    // `prompt=select_account`. Use this when the GIS personalized button
    // ("Sign in as <X>") doesn't give the user the account they want.
    //
    // Requires the PWA's origin to be added as an Authorized redirect URI
    // in the Google Cloud Console for this OAuth client (in addition to
    // being in Authorized JavaScript origins).
    async signInWithGoogleSelectAccount(clientId) {
      if (!clientId) throw new Error('Google client ID is missing. Make sure /config returns auth.google_client_id.');
      const nonce  = randomToken(24);
      const state  = randomToken(16);
      try {
        sessionStorage.setItem('antcv:google_oauth_nonce', nonce);
        sessionStorage.setItem('antcv:google_oauth_state', state);
        // Remember where to come back to once auth completes.
        sessionStorage.setItem('antcv:google_oauth_return', window.location.pathname + window.location.search);
      } catch (e) { /* ignore — best effort */ }
      // Redirect URI is the PWA's exact origin + path (no query, no hash).
      // The user must add this to "Authorized redirect URIs" on the OAuth
      // client in Google Cloud Console.
      const redirectUri = window.location.origin + window.location.pathname;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id',     clientId);
      url.searchParams.set('redirect_uri',  redirectUri);
      url.searchParams.set('response_type', 'id_token');
      url.searchParams.set('scope',         'openid email profile');
      url.searchParams.set('nonce',         nonce);
      url.searchParams.set('state',         state);
      url.searchParams.set('prompt',        'select_account');
      window.location.assign(url.toString());
    },

    // Call once on app boot. If the URL fragment carries `id_token` from
    // a Google OAuth redirect, validate state and complete sign-in. Returns
    // a promise that resolves to true if a redirect was handled (caller
    // can then route to the post-sign-in screen), false otherwise.
    async handleAuthRedirect() {
      const hash = window.location.hash || '';
      if (!hash.includes('id_token=') && !hash.includes('error=')) return false;
      const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const idToken    = params.get('id_token');
      const stateBack  = params.get('state');
      const errorBack  = params.get('error');
      const errorDesc  = params.get('error_description');
      // Always clear the hash so it's not exposed if the user shares the URL.
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* ignore */ }
      if (errorBack) {
        const e = new Error(`Google sign-in error: ${errorBack}${errorDesc ? ' — ' + errorDesc : ''}`);
        e.code = 'antcv_auth_redirect_error';
        throw e;
      }
      if (!idToken) return false;
      let stateExpected = '';
      try { stateExpected = sessionStorage.getItem('antcv:google_oauth_state') || ''; } catch (e) { /* ignore */ }
      try { sessionStorage.removeItem('antcv:google_oauth_state'); } catch (e) {}
      try { sessionStorage.removeItem('antcv:google_oauth_nonce'); } catch (e) {}
      if (!stateExpected || stateExpected !== stateBack) {
        const e = new Error('Google sign-in state mismatch — possible CSRF, sign-in aborted.');
        e.code = 'antcv_auth_state_mismatch';
        throw e;
      }
      await this.signInWithGoogle(idToken);
      return true;
    },

    async requestEmailCode(email) {
      const proxy = getProxyUrl();
      if (!proxy) throw new Error('Proxy URL not configured. Set it in Settings → Account first (the worker URL field).');
      const res = await originalFetch(proxy + '/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.hint || body.error || `Couldn't send code (${res.status})`);
      return body;
    },

    async verifyEmailCode(email, code) {
      const proxy = getProxyUrl();
      if (!proxy) throw new Error('Proxy URL not configured. Set it in Settings → Account first (the worker URL field).');
      const res = await originalFetch(proxy + '/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body.error === 'wrong_code'
          ? `Wrong code (${body.attempts_remaining} ${body.attempts_remaining === 1 ? 'attempt' : 'attempts'} left)`
          : (body.hint || body.error || `Verification failed (${res.status})`);
        throw new Error(msg);
      }
      writeState({ token: body.token, email: body.email, expiresAt: body.expires_at || 0 });
      // v1.40.194: see signInWithGoogle — same rationale.
      try { if (proxy) localStorage.setItem('relayUrl', proxy); } catch (_) {}
      return body;
    },

    async fetchConfig() {
      const proxy = getProxyUrl();
      if (!proxy) throw new Error('Proxy URL not configured.');
      // The relay's /config returns auth.user.is_admin only when the JWT
      // is present in the request. Going through originalFetch (which
      // skips the wrapped fetch's Authorization header) meant the panel
      // always saw is_admin = false, hiding the admin allowlist UI even
      // for the deployment owner. Use the wrapped fetch — it's a no-op
      // for non-relay URLs but injects Bearer for relay URLs.
      const res = await window.fetch(proxy + '/config');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.hint || body.error || `Config fetch failed (${res.status})`);
      return body;
    },
  };
  window.AntcvAuth = Auth;

  // ===== Google Identity Services loader =====
  let _gsiPromise = null;
  function loadGoogleIdentityServices() {
    if (_gsiPromise) return _gsiPromise;
    _gsiPromise = new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(s);
    });
    return _gsiPromise;
  }

  // ===== One-time GIS initialise =====
  // GIS logs "google.accounts.id.initialize() is called multiple times"
  // and only honours the last call if `initialize()` is invoked more than
  // once per page. The auth panel's render effect re-runs on every tab
  // switch and on every mount of the panel (boot screen + Settings tab),
  // which used to fire `initialize()` repeatedly. The fix:
  //
  //   - call `initialize()` exactly once per page lifecycle here,
  //   - keep a module-level `_currentSignInHandler` that the GIS
  //     callback always defers to,
  //   - each panel mount/effect just sets that handler and calls
  //     `renderButton()` (which is idempotent and fast).
  //
  // Result: no more GSI_LOGGER warnings, no flicker of the personalised
  // button on tab switch.
  let _gsiInitForClientId = null;        // clientId GIS was last initialised with
  let _currentSignInHandler = null;      // callback the panel currently wants invoked
  async function initGoogleIdentityServicesOnce(clientId) {
    if (!clientId) throw new Error('Google client ID missing.');
    await loadGoogleIdentityServices();
    if (_gsiInitForClientId === clientId) return; // already initialised
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp) => {
        if (typeof _currentSignInHandler === 'function') _currentSignInHandler(resp);
      },
      ux_mode: 'popup',
      auto_select: false,
    });
    _gsiInitForClientId = clientId;
  }
  function setGoogleSignInHandler(fn) { _currentSignInHandler = fn; }

  // ===== Theme palettes =====
  // 'dark' matches the AntCV Settings modal (background ~#1a2a45). 'light'
  // matches a light Settings panel. Default = 'dark'.
  const PALETTES = {
    dark: {
      cardBg:        'transparent',
      cardBorder:    '1px solid rgba(255,255,255,0.10)',
      cardPad:       16,
      heading:       '#fff',
      headingMuted:  'rgba(255,255,255,0.50)',
      text:          'rgba(255,255,255,0.90)',
      textMuted:     'rgba(255,255,255,0.55)',
      input:         'rgba(255,255,255,0.08)',
      inputBorder:   '1px solid rgba(255,255,255,0.20)',
      inputColor:    '#fff',
      btnPrimaryBg:  '#01B7BB',
      btnPrimaryFg:  '#0d2030',
      btnAltBg:      'transparent',
      btnAltBorder:  '1px solid rgba(255,255,255,0.25)',
      btnAltFg:      'rgba(255,255,255,0.90)',
      linkColor:     '#01B7BB',
      okBg:          'rgba(126,255,212,0.10)',
      okFg:          '#7effd4',
      okBorder:      '1px solid rgba(126,255,212,0.25)',
      errBg:         'rgba(255,120,120,0.10)',
      errFg:         '#ffb4b4',
      errBorder:     '1px solid rgba(255,120,120,0.30)',
      tabActiveFg:   '#01B7BB',
      tabIdleFg:     'rgba(255,255,255,0.45)',
      tabActiveBd:   '2px solid #01B7BB',
    },
    light: {
      cardBg:        '#fff',
      cardBorder:    '1px solid #e0e6ed',
      cardPad:       16,
      heading:       '#283556',
      headingMuted:  '#5a6473',
      text:          '#283556',
      textMuted:     '#5a6473',
      input:         '#fff',
      inputBorder:   '1px solid #cbd5e0',
      inputColor:    '#283556',
      btnPrimaryBg:  '#00746E',
      btnPrimaryFg:  '#fff',
      btnAltBg:      '#fff',
      btnAltBorder:  '1px solid #cbd5e0',
      btnAltFg:      '#283556',
      linkColor:     '#00746E',
      okBg:          '#ecfdf5',
      okFg:          '#065f46',
      okBorder:      '1px solid #a7f3d0',
      errBg:         '#fef2f2',
      errFg:         '#b91c1c',
      errBorder:     '1px solid #fecaca',
      tabActiveFg:   '#00746E',
      tabIdleFg:     '#5a6473',
      tabActiveBd:   '2px solid #00746E',
    },
  };

  // ===== React component for the Settings panel =====
  function AntcvAuthPanel({ proxyUrl, theme = 'dark' } = {}) {
    const R = window.React;
    if (!R) return null;
    const { useEffect, useState, useRef, useCallback } = R;
    const P = PALETTES[theme] || PALETTES.dark;

    const [state, setState] = useState(readState());
    const [config, setConfig] = useState(null);
    const [configError, setConfigError] = useState('');
    const [mode, setMode] = useState('idle'); // idle | email_step1 | email_step2
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    // Access-request flow: set when a not-allowlisted Google sign-in is denied.
    // Holds { email, idToken } so we can show "request submitted" + a Cancel button.
    const [requestPending, setRequestPending] = useState(null);
    const googleBtnRef = useRef(null);

    useEffect(() => Auth.subscribe(setState), []);

    useEffect(() => {
      let cancelled = false;
      setConfig(null); setConfigError('');
      Auth.fetchConfig().then((c) => { if (!cancelled) setConfig(c); })
                       .catch((e) => { if (!cancelled) setConfigError(e.message || String(e)); });
      return () => { cancelled = true; };
    }, [proxyUrl]);

    useEffect(() => {
      if (!config || !config.auth || !config.auth.methods || !config.auth.methods.google) return;
      if (state.token) return;
      const clientId = config.auth.google_client_id;
      if (!clientId) return;
      // The container only exists in the DOM when the Google tab is
      // active. If the user toggled to Email, the ref points to nothing
      // useful; bail and we'll re-run when they come back. The `mode` dep
      // below is what re-fires this effect on tab switch.
      if (!googleBtnRef.current) return;
      let cancelled = false;
      // Each panel instance owns the callback for its own busy/err/msg
      // state. Register it with the module-level handler so the single
      // global GIS init can route into the currently-mounted panel.
      const handler = async (resp) => {
        setBusy(true); setErr(''); setMsg(''); setRequestPending(null);
        try { await Auth.signInWithGoogle(resp.credential); setMsg('Signed in.'); }
        catch (e) {
          // Not-allowlisted: the relay already filed an access request. Show the
          // request-submitted panel (with Cancel) instead of the raw error code.
          if (e && e.code === 'email_not_allowed') {
            setRequestPending({ email: e.email || '', idToken: e.idToken || resp.credential });
          } else {
            setErr(e.message || String(e));
          }
        }
        finally { setBusy(false); }
      };
      setGoogleSignInHandler(handler);

      initGoogleIdentityServicesOnce(clientId).then(() => {
        if (cancelled || !googleBtnRef.current) return;
        try {
          // Only re-render if the container is currently empty. The GIS
          // button DOM survives tab switches via React's reconciliation
          // when the wrapper div is conditionally rendered, so checking
          // for emptiness avoids the visual flicker on every effect run.
          if (googleBtnRef.current.childElementCount === 0) {
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              type: 'standard',
              theme: theme === 'dark' ? 'filled_black' : 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
            });
          }
        } catch (e) {
          setErr('Google button init failed: ' + (e.message || e));
        }
      }).catch((e) => setErr(e.message || String(e)));
      return () => {
        cancelled = true;
        // If this panel is unmounting, clear the handler so a stale
        // reference can't fire after the component is gone.
        if (_currentSignInHandler === handler) setGoogleSignInHandler(null);
      };
    }, [config, state.token, theme, mode]);

    const onSendCode = useCallback(async (e) => {
      if (e) e.preventDefault();
      setBusy(true); setErr(''); setMsg('');
      try { await Auth.requestEmailCode(email); setMode('email_step2'); setMsg('Code sent. Check your inbox (it can take up to a minute).'); }
      catch (e) { setErr(e.message || String(e)); }
      finally { setBusy(false); }
    }, [email]);

    const onVerifyCode = useCallback(async (e) => {
      if (e) e.preventDefault();
      setBusy(true); setErr(''); setMsg('');
      try { await Auth.verifyEmailCode(email, code); setMsg('Signed in.'); setCode(''); setMode('idle'); }
      catch (e) { setErr(e.message || String(e)); }
      finally { setBusy(false); }
    }, [email, code]);

    const onSignOut = useCallback(async () => {
      setBusy(true); setErr(''); setMsg('');
      try { await Auth.signOut(); setMsg('Signed out.'); }
      finally { setBusy(false); }
    }, []);

    const onCancelRequest = useCallback(async () => {
      if (!requestPending) return;
      setBusy(true); setErr(''); setMsg('');
      try {
        await Auth.cancelAccessRequest(requestPending.idToken);
        setRequestPending(null);
        setMsg('Access request withdrawn.');
      } catch (e) { setErr(e.message || String(e)); }
      finally { setBusy(false); }
    }, [requestPending]);

    // ---------- shared styles ----------
    const card     = { border: P.cardBorder, borderRadius: 8, padding: P.cardPad, background: P.cardBg, marginBottom: 14, fontFamily: 'inherit', color: P.text };
    const heading  = { margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: P.headingMuted, letterSpacing: 1, textTransform: 'uppercase' };
    const subtle   = { fontSize: 12, color: P.textMuted, margin: '0 0 12px', lineHeight: 1.5 };
    const errStyle = { fontSize: 12, color: P.errFg, background: P.errBg, border: P.errBorder, padding: '8px 10px', borderRadius: 6, margin: '8px 0', lineHeight: 1.5 };
    const okStyle  = { fontSize: 12, color: P.okFg,  background: P.okBg,  border: P.okBorder,  padding: '8px 10px', borderRadius: 6, margin: '8px 0', lineHeight: 1.5 };
    const inputSty = { width: '100%', padding: '9px 11px', background: P.input, border: P.inputBorder, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: P.inputColor };
    const btnPrim  = { padding: '8px 14px', background: P.btnPrimaryBg, color: P.btnPrimaryFg, border: 0, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
    const btnAlt   = { padding: '8px 14px', background: P.btnAltBg, color: P.btnAltFg, border: P.btnAltBorder, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' };
    const btnLink  = { padding: '4px 0', background: 'transparent', color: P.linkColor, border: 0, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' };
    const tabBar   = { display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid ' + (theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e0e6ed') };
    const tab      = (active) => ({
      padding: '7px 12px', fontSize: 12, cursor: 'pointer', border: 0, background: 'transparent',
      color: active ? P.tabActiveFg : P.tabIdleFg, fontWeight: active ? 600 : 400,
      borderBottom: active ? P.tabActiveBd : '2px solid transparent', marginBottom: -1,
    });

    // ---------- signed-in view ----------
    if (state.token && state.email) {
      const expiresIn = state.expiresAt ? Math.max(0, state.expiresAt - Math.floor(Date.now() / 1000)) : 0;
      const days = Math.floor(expiresIn / 86400);
      return R.createElement('div', { style: card },
        R.createElement('div', { style: heading }, 'Account'),
        R.createElement('div', { style: { fontSize: 13, marginBottom: 4, color: P.text } },
          'Signed in as ',
          R.createElement('strong', { style: { color: P.heading } }, state.email)
        ),
        expiresIn > 0 && R.createElement('div', { style: { fontSize: 11, color: P.textMuted, marginBottom: 12 } },
          `Session valid for ${days} day${days === 1 ? '' : 's'}.`
        ),
        msg && R.createElement('div', { style: okStyle }, msg),
        err && R.createElement('div', { style: errStyle }, err),
        R.createElement('button', { type: 'button', onClick: onSignOut, disabled: busy, style: btnAlt }, busy ? '…' : 'Sign out')
      );
    }

    // ---------- access-request pending view ----------
    // Shown after a not-allowlisted Google sign-in: make it explicit that the
    // attempt FILED a request (the relay logged it for the admin), and offer a
    // clear way to withdraw it. Replaces the raw "email_not_allowed" code.
    if (requestPending) {
      return R.createElement('div', { style: card },
        R.createElement('div', { style: heading }, 'Access requested'),
        R.createElement('div', { style: okStyle },
          R.createElement('div', { style: { fontWeight: 600, marginBottom: 4 } }, 'Your access request has been submitted.'),
          R.createElement('div', null,
            (requestPending.email ? requestPending.email + ' ' : 'This email ') +
            "isn't on the access list yet. An administrator has received your request and will review it — you'll be able to sign in once it's approved."
          )
        ),
        msg && R.createElement('div', { style: okStyle }, msg),
        err && R.createElement('div', { style: errStyle }, err),
        R.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 4, alignItems: 'center' } },
          R.createElement('button', { type: 'button', onClick: onCancelRequest, disabled: busy, style: btnAlt }, busy ? '…' : 'Withdraw request'),
          R.createElement('button', { type: 'button', onClick: () => { setRequestPending(null); setErr(''); setMsg(''); }, disabled: busy, style: btnLink }, 'Back to sign in')
        )
      );
    }

    // ---------- signed-out view ----------
    if (configError) {
      return R.createElement('div', { style: card },
        R.createElement('div', { style: heading }, 'Sign in'),
        R.createElement('div', { style: errStyle },
          R.createElement('div', { style: { fontWeight: 600, marginBottom: 4 } }, "Couldn't reach the relay:"),
          R.createElement('div', null, configError),
          R.createElement('div', { style: { marginTop: 6, fontSize: 11 } }, 'Use the setup wizard to configure your Worker URL, or paste it in Settings → Account.')
        )
      );
    }
    if (!config) {
      return R.createElement('div', { style: card },
        R.createElement('div', { style: heading }, 'Sign in'),
        R.createElement('div', { style: subtle }, 'Loading …')
      );
    }
    const hasGoogle = !!(config.auth && config.auth.methods && config.auth.methods.google);
    const hasEmail  = !!(config.auth && config.auth.methods && config.auth.methods.email_otp);

    if (!hasGoogle && !hasEmail) {
      const dump = (() => {
        try { return JSON.stringify({ methods: config.auth && config.auth.methods, has_client_id: !!(config.auth && config.auth.google_client_id) }); }
        catch (e) { return '(unable to stringify)'; }
      })();
      return R.createElement('div', { style: card },
        R.createElement('div', { style: heading }, 'Sign in'),
        R.createElement('div', { style: errStyle },
          R.createElement('div', { style: { fontWeight: 600, marginBottom: 6 } }, 'No sign-in methods are configured on the relay.'),
          R.createElement('div', { style: { marginBottom: 6 } }, 'Set ', R.createElement('code', null, 'GOOGLE_CLIENT_ID'), ' (for Google sign-in) and/or ', R.createElement('code', null, 'RESEND_API_KEY'), ' (for email-code sign-in) on the worker via ', R.createElement('code', null, 'wrangler secret put'), ', then ', R.createElement('code', null, 'wrangler deploy'), '.'),
          R.createElement('div', { style: { fontSize: 10, opacity: 0.7, marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' } }, '/config returned: ', dump)
        )
      );
    }

    const showTabs = hasGoogle && hasEmail;
    // activeTab must reflect which method is actually configured. When
    // only one is available, force the tab to that one regardless of
    // `mode` — otherwise the panel renders an empty card (heading +
    // subtitle, nothing below) because both block conditions evaluate
    // false. When both are configured, `mode` drives the choice as
    // before.
    const activeTab = !hasGoogle
      ? 'email'
      : !hasEmail
        ? 'google'
        : (mode === 'email_step1' || mode === 'email_step2' ? 'email' : 'google');
    const switchTo = (which) => { setErr(''); setMsg(''); if (which === 'email') setMode('email_step1'); else setMode('idle'); };

    return R.createElement('div', { style: card },
      R.createElement('div', { style: heading }, 'Sign in:'),
      R.createElement('div', { style: subtle }, 'Choose a sign-in method.'),

      showTabs && R.createElement('div', { style: tabBar },
        hasGoogle && R.createElement('button', { type: 'button', onClick: () => switchTo('google'), style: tab(activeTab === 'google') }, 'Google'),
        hasEmail  && R.createElement('button', { type: 'button', onClick: () => switchTo('email'),  style: tab(activeTab === 'email')  }, 'Email code')
      ),

      err && R.createElement('div', { style: errStyle }, err),
      msg && R.createElement('div', { style: okStyle }, msg),

      (activeTab === 'google' && hasGoogle) && R.createElement('div', null,
        R.createElement('button', {
          type: 'button',
          disabled: busy,
          onClick: async () => {
            setBusy(true); setErr(''); setMsg('');
            try {
              const clientId = (config && config.auth && config.auth.google_client_id) || '';
              await Auth.signInWithGoogleSelectAccount(clientId);
            } catch (e) {
              setErr(e.message || String(e));
              setBusy(false);
            }
          },
          style: { ...btnPrim, width: '100%', marginBottom: 10 },
          title: 'Open Google account selection and sign in.',
        }, busy ? 'Opening Google…' : 'Sign in with Google'),
        R.createElement('div', { ref: googleBtnRef, style: { minHeight: 40, display: 'flex', justifyContent: 'center', opacity: 0.95 } }),
        !showTabs && hasEmail && R.createElement('div', { style: { marginTop: 12 } },
          R.createElement('button', { type: 'button', style: btnLink, onClick: () => switchTo('email') }, 'Or sign in with an email code')
        )
      ),

      (activeTab === 'email' && hasEmail) && R.createElement('div', null,
        mode !== 'email_step2' && R.createElement('form', { onSubmit: onSendCode },
          R.createElement('label', { style: { display: 'block', fontSize: 11, marginBottom: 4, color: P.textMuted, textTransform: 'uppercase', letterSpacing: 1 } }, 'Email address'),
          R.createElement('input', {
            type: 'email', required: true, autoComplete: 'email',
            value: email, onChange: (e) => setEmail(e.target.value),
            placeholder: 'you@example.com', style: { ...inputSty, marginBottom: 10 }, disabled: busy,
          }),
          R.createElement('button', { type: 'submit', disabled: busy || !email, style: btnPrim }, busy ? 'Sending…' : 'Send code'),
          !showTabs && hasGoogle && R.createElement('div', { style: { marginTop: 12 } },
            R.createElement('button', { type: 'button', style: btnLink, onClick: () => switchTo('google') }, 'Or use Google instead')
          )
        ),
        mode === 'email_step2' && R.createElement('form', { onSubmit: onVerifyCode },
          R.createElement('div', { style: { fontSize: 12, marginBottom: 8, color: P.textMuted, lineHeight: 1.5 } },
            'Code sent to ',
            R.createElement('strong', { style: { color: P.text } }, email),
            '. Enter the 6 digits below.'
          ),
          R.createElement('input', {
            type: 'text', inputMode: 'numeric', pattern: '\\d{4,8}', autoFocus: true,
            value: code, onChange: (e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8)),
            placeholder: '123456',
            style: { ...inputSty, marginBottom: 10, fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'monospace' },
            disabled: busy,
          }),
          R.createElement('div', { style: { display: 'flex', gap: 8 } },
            R.createElement('button', { type: 'submit', disabled: busy || code.length < 4, style: btnPrim }, busy ? 'Verifying…' : 'Verify'),
            R.createElement('button', { type: 'button', onClick: () => { setMode('email_step1'); setCode(''); setErr(''); setMsg(''); }, style: btnAlt }, 'Back')
          )
        )
      )
    );
  }
  window.AntcvAuthPanel = AntcvAuthPanel;

  // v1.40.194: on script boot, mirror the resolved relay URL into
  // localStorage.relayUrl. This is the same value getProxyUrl() returns
  // and is read by antcv-privacy-led.js so the LED classifies the
  // relay as own-proxy (Level 1) rather than demo-proxy (Level 2).
  // The write is idempotent and skips if the value already matches —
  // we don't want to thrash storage on every page load.
  try {
    const resolved = (typeof DEFAULT_PROXY_URL === 'string' && DEFAULT_PROXY_URL)
      ? DEFAULT_PROXY_URL : '';
    if (resolved) {
      let cur = '';
      try { cur = localStorage.getItem('relayUrl') || ''; } catch (_) {}
      if (cur !== resolved) {
        try { localStorage.setItem('relayUrl', resolved); } catch (_) {}
      }
    }
  } catch (_) {}
})();
