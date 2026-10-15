/** Mobil Watch Party URL çözümleyici (web `watch-party-media` ile uyumlu) */

export type WatchMediaRef = {
  provider: string;
  sourceUrl: string;
  embedUrl: string;
  /** Platform video id (YouTube vb.) */
  id: string | null;
  isDirectFile: boolean;
  label: string;
};

const DIRECT_EXT = /\.(mp4|webm|ogg|ogv|m3u8|mov|mkv)(\?|#|$)/i;
const PARENT = 'dracord.com.tr';
/** YouTube Error 153 — WebView’de geçerli HTTPS origin / Referer */
export const WATCH_EMBED_ORIGIN = 'https://dracord.com.tr';
export const WATCH_APP_REFERER = 'https://com.dracord.mobile';

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
    const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{6,})/);
    return m?.[2] ?? null;
  }
  return null;
}

export function resolveWatchMedia(raw: string): WatchMediaRef | null {
  const u = safeUrl(raw);
  if (!u) return null;
  const sourceUrl = u.toString();

  const yt = youtubeId(u);
  if (yt) {
    const origin = encodeURIComponent(WATCH_EMBED_ORIGIN);
    return {
      provider: 'youtube',
      sourceUrl,
      // nocookie + origin/widget_referrer → Error 153 önler
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&origin=${origin}&widget_referrer=${origin}`,
      id: yt,
      isDirectFile: false,
      label: 'YouTube',
    };
  }

  const host = u.hostname.replace(/^www\./, '');
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(?:\/video)?\/(\d{6,})/);
    if (m?.[1]) {
      return {
        provider: 'vimeo',
        sourceUrl,
        embedUrl: `https://player.vimeo.com/video/${m[1]}`,
        id: m[1],
        isDirectFile: false,
        label: 'Vimeo',
      };
    }
  }

  if (host === 'twitch.tv' || host === 'm.twitch.tv' || host === 'clips.twitch.tv') {
    const parts = u.pathname.split('/').filter(Boolean);
    let embedUrl = '';
    let id: string | null = null;
    if (host === 'clips.twitch.tv' && parts[0]) {
      id = parts[0];
      embedUrl = `https://clips.twitch.tv/embed?clip=${parts[0]}&parent=${PARENT}&autoplay=false`;
    } else if (parts[0] === 'videos' && parts[1]) {
      id = parts[1];
      embedUrl = `https://player.twitch.tv/?video=${parts[1]}&parent=${PARENT}&autoplay=false`;
    } else if (parts[0]) {
      id = parts[0];
      embedUrl = `https://player.twitch.tv/?channel=${parts[0]}&parent=${PARENT}&autoplay=false`;
    }
    if (embedUrl) {
      return {
        provider: 'twitch',
        sourceUrl,
        embedUrl,
        id,
        isDirectFile: false,
        label: 'Twitch',
      };
    }
  }

  if (DIRECT_EXT.test(u.pathname) || DIRECT_EXT.test(sourceUrl)) {
    return {
      provider: 'file',
      sourceUrl,
      embedUrl: '',
      id: null,
      isDirectFile: true,
      label: 'Dosya',
    };
  }

  // Bilinmeyen https — iframe dene
  return {
    provider: 'iframe',
    sourceUrl,
    embedUrl: sourceUrl,
    id: null,
    isDirectFile: false,
    label: 'Bağlantı',
  };
}

/**
 * YouTube IFrame API + RN komut köprüsü (play/pause/seek senkron).
 * baseUrl = WATCH_EMBED_ORIGIN → Error 153 önler.
 */
export function youtubeEmbedHtml(videoId: string, startAt = 0): string {
  const origin = WATCH_EMBED_ORIGIN;
  const start = Math.max(0, Math.floor(startAt));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}#player{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div id="player"></div><script>
var player=null,ready=false,pending=null;
function post(o){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
function apply(cmd){
  if(!player||!ready){pending=cmd;return;}
  try{
    if(cmd.type==='play'){player.playVideo();}
    else if(cmd.type==='pause'){player.pauseVideo();}
    else if(cmd.type==='seek'){
      var t=Number(cmd.at)||0;
      player.seekTo(t,true);
      if(cmd.playing)player.playVideo();else player.pauseVideo();
    }
    else if(cmd.type==='getTime'){
      post({type:'time',at:player.getCurrentTime(),duration:player.getDuration(),playing:player.getPlayerState()===1});
    }
  }catch(e){post({type:'err',message:String(e)});}
}
window.__dracordCmd=function(cmd){apply(typeof cmd==='string'?JSON.parse(cmd):cmd);};
function onYouTubeIframeAPIReady(){
  player=new YT.Player('player',{
    width:'100%',height:'100%',videoId:${JSON.stringify(videoId)},
    host:'https://www.youtube-nocookie.com',
    playerVars:{enablejsapi:1,playsinline:1,rel:0,modestbranding:1,origin:${JSON.stringify(origin)},widget_referrer:${JSON.stringify(origin)},start:${start}},
    events:{
      onReady:function(){ready=true;post({type:'ready'});if(pending){apply(pending);pending=null;}},
      onStateChange:function(e){post({type:'state',state:e.data});}
    }
  });
}
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
</script></body></html>`;
}
