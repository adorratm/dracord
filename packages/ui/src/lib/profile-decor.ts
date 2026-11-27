/**
 * F1 — avatar decorations and profile effects, drawn with CSS only (no image files,
 * nothing to download). Injected once; animations stop for reduced-motion users.
 */
const STYLE_ID = 'dracord-profile-decor-css';

const ring = (bg: string) => `background:${bg};`;

export const PROFILE_DECOR_CSS = `
.avatar-deco{--deco-a:0deg;position:absolute;left:-14%;top:-14%;width:128%;height:auto;aspect-ratio:1;border-radius:9999px;pointer-events:none;z-index:1;
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));
          mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));}
.avatar-deco--neon{${ring('conic-gradient(from calc(var(--deco-a) + 0deg),#ff79c6,#bd93f9,#8be9fd,#50fa7b,#ff79c6)')}animation:deco-spin 3s linear infinite;filter:drop-shadow(0 0 4px #bd93f9);}
.avatar-deco--dracula{${ring('conic-gradient(from calc(var(--deco-a) + 90deg),#bd93f9,#6272a4,#ff79c6,#6272a4,#bd93f9)')}animation:deco-spin 6s linear infinite;}
.avatar-deco--fire{${ring('conic-gradient(from calc(var(--deco-a) + 180deg),#ff5555,#ffb86c,#f1fa8c,#ffb86c,#ff5555)')}animation:deco-flicker .9s ease-in-out infinite;filter:drop-shadow(0 0 5px #ff8a3d);}
.avatar-deco--ice{${ring('conic-gradient(from calc(var(--deco-a) + 0deg),#e0fbff,#8be9fd,#5bc0eb,#e0fbff,#8be9fd)')}animation:deco-spin 8s linear infinite;filter:drop-shadow(0 0 4px #8be9fd);}
.avatar-deco--sakura{${ring('conic-gradient(from calc(var(--deco-a) + 0deg),#ffd1dc,#ff9ec7,#ffffff,#ff9ec7,#ffd1dc)')}animation:deco-spin 10s linear infinite;}
.avatar-deco--galaxy{${ring('conic-gradient(from calc(var(--deco-a) + 0deg),#1b1464,#6a0dad,#c471ed,#12c2e9,#1b1464)')}animation:deco-spin 4s linear infinite;filter:drop-shadow(0 0 5px #c471ed);}
.avatar-deco--gold{${ring('conic-gradient(from calc(var(--deco-a) + 0deg),#b8860b,#ffd700,#fff4b0,#ffd700,#b8860b)')}animation:deco-spin 5s linear infinite;filter:drop-shadow(0 0 3px #ffd700);}
.avatar-deco--rainbow{${ring('conic-gradient(from var(--deco-a),red,orange,yellow,lime,cyan,blue,violet,red)')}animation:deco-spin 2.5s linear infinite;}
@property --deco-a{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes deco-spin{to{--deco-a:360deg}}
@keyframes deco-flicker{0%,100%{opacity:1}50%{opacity:.75}}

.profile-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;border-radius:inherit}
.profile-fx::before,.profile-fx::after{content:'';position:absolute;left:0;right:0;top:-100%;height:200%;background-repeat:repeat;animation:fx-fall 9s linear infinite}
.profile-fx::after{animation-duration:14s;opacity:.7;background-position:40px 60px}
.profile-fx--snow::before,.profile-fx--snow::after{background-image:radial-gradient(circle,#fff 0 2px,transparent 3px),radial-gradient(circle,#fff 0 1.4px,transparent 2px);background-size:90px 90px,55px 55px}
.profile-fx--sparkles::before,.profile-fx--sparkles::after{background-image:radial-gradient(circle,#f1fa8c 0 1.6px,transparent 2.6px),radial-gradient(circle,#fff 0 1px,transparent 2px);background-size:70px 80px,45px 50px;animation-name:fx-twinkle;animation-duration:3s}
.profile-fx--hearts::before,.profile-fx--hearts::after{background-image:radial-gradient(circle at 40% 40%,#ff79c6 0 3px,transparent 3.5px),radial-gradient(circle at 60% 40%,#ff79c6 0 3px,transparent 3.5px);background-size:80px 80px;animation-name:fx-rise}
.profile-fx--embers::before,.profile-fx--embers::after{background-image:radial-gradient(circle,#ffb86c 0 1.8px,transparent 3px),radial-gradient(circle,#ff5555 0 1.2px,transparent 2.4px);background-size:60px 70px,40px 45px;animation-name:fx-rise;animation-duration:6s}
.profile-fx--bubbles::before,.profile-fx--bubbles::after{background-image:radial-gradient(circle,transparent 0 5px,rgba(139,233,253,.7) 5.5px 6.5px,transparent 7px);background-size:100px 110px;animation-name:fx-rise;animation-duration:12s}
@keyframes fx-fall{from{transform:translateY(0)}to{transform:translateY(50%)}}
@keyframes fx-rise{from{transform:translateY(50%)}to{transform:translateY(0)}}
@keyframes fx-twinkle{0%,100%{opacity:.35}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.avatar-deco,.profile-fx::before,.profile-fx::after{animation:none!important}}
`;

export function ensureProfileDecorStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = PROFILE_DECOR_CSS;
  document.head.appendChild(el);
}
