/**
 * Dracord ile giriş — 3. parti siteler için widget.
 *
 * Kullanım:
 * <script src="https://dracord.com.tr/sdk/login-with-dracord.js"></script>
 * <div id="dracord-login"></div>
 * <script>
 *   DracordLogin.render('#dracord-login', {
 *     clientId: 'APP_ID',
 *     redirectUri: 'https://your.app/callback',
 *     state: 'optional'
 *   });
 * </script>
 */
(function (global) {
  var ORIGIN = 'https://dracord.com.tr';
  try {
    if (typeof document !== 'undefined' && document.currentScript) {
      var src = document.currentScript.src || '';
      var m = /^https?:\/\/[^/]+/.exec(src);
      if (m) ORIGIN = m[0];
    }
  } catch (_) {}

  function buildUrl(opts) {
    var u = new URL(ORIGIN + '/oauth/authorize');
    u.searchParams.set('client_id', opts.clientId || '');
    u.searchParams.set('redirect_uri', opts.redirectUri || '');
    u.searchParams.set('response_type', 'code');
    if (opts.state) u.searchParams.set('state', opts.state);
    return u.toString();
  }

  function render(sel, opts) {
    var el =
      typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    var a = document.createElement('a');
    a.href = buildUrl(opts || {});
    a.rel = 'noopener';
    a.textContent = (opts && opts.label) || 'Dracord ile devam et';
    a.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'padding:10px 16px;border-radius:10px;background:#bd93f9;color:#1a1025;' +
      'font:600 14px/1.2 system-ui,sans-serif;text-decoration:none';
    el.appendChild(a);
  }

  global.DracordLogin = { render: render, authorizeUrl: buildUrl };
})(typeof window !== 'undefined' ? window : globalThis);
