/**
 * Watch Party / genel session reklam ağı filtresi (EasyList tarzı host listesi).
 * Cross-origin iframe DOM’una enjekte etmez; yalnızca ağ isteklerini keser.
 */
const { session, ipcMain } = require('electron');

/** Yaygın reklam / tracker host kalıpları (kısaltılmış çekirdek liste) */
const BLOCK_HOST_RE =
  /(^|\.)((doubleclick|googlesyndication|googleadservices|adservice|adnxs|adsrvr|advertising|adform|outbrain|taboola|criteo|scorecardresearch|quantserve|moatads|amazon-adsystem|facebook\.com\/tr|hotjar|sentry-cdn)\.)/i;

const BLOCK_PATH_RE =
  /(\/ads?\/|\/ad[-_]|\/advert|pagead|adsystem|adservice|sponsor|popunder|popads)/i;

let enabled = true;

function shouldBlockUrl(url) {
  if (!enabled) return false;
  try {
    const u = new URL(url);
    if (BLOCK_HOST_RE.test(u.hostname)) return true;
    if (BLOCK_PATH_RE.test(u.pathname + u.search)) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * @param {string} [partition]
 */
function registerWatchPartyAdblock(partition = 'persist:watchparty') {
  const ses = session.fromPartition(partition);
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    if (shouldBlockUrl(details.url)) {
      callback({ cancel: true });
      return;
    }
    callback({});
  });

  const def = session.defaultSession;
  def.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    if (!enabled) {
      callback({});
      return;
    }
    if (
      BLOCK_HOST_RE.test(
        (() => {
          try {
            return new URL(details.url).hostname;
          } catch {
            return '';
          }
        })(),
      )
    ) {
      callback({ cancel: true });
      return;
    }
    callback({});
  });

  ipcMain.handle('adblock:set-enabled', (_e, next) => {
    enabled = Boolean(next);
    return { enabled };
  });
  ipcMain.handle('adblock:get-enabled', () => ({ enabled }));

  return {
    partition,
    setEnabled: (v) => {
      enabled = Boolean(v);
      return enabled;
    },
    isEnabled: () => enabled,
  };
}

module.exports = { registerWatchPartyAdblock, shouldBlockUrl };
