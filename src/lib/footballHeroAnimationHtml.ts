/** HTML/CSS identique au composant web `FootballHeroAnimation` (sans Tailwind). */
export function buildFootballHeroAnimationHtml(): string {
  const twinkles = Array.from({ length: 50 }, (_, i) => {
    const left = i * 2 + ((i * 7) % 3);
    const bottom = (i * 13) % 18;
    const dur = 1.2 + (i % 5) * 0.4;
    const delay = (i % 7) * 0.3;
    return `<span style="position:absolute;width:2px;height:2px;border-radius:50%;background:rgba(255,255,255,0.7);left:${left}%;bottom:${bottom}px;animation:fha-twinkle ${dur}s ease-in-out ${delay}s infinite"></span>`;
  }).join('');

  const ballTrails = Array.from({ length: 6 }, (_, i) =>
    `<span class="fha-ball-wrap" style="animation-delay:${(-0.06 * (i + 1)).toFixed(2)}s;opacity:${(0.1 + i * 0.05).toFixed(2)}"><span class="fha-trail-dot"></span></span>`,
  ).join('');

  const confetti = Array.from({ length: 14 }, (_, i) => {
    const colors = ['#FF7900', '#ffffff', '#009E60', '#FFD700'];
    const rot = (i % 2 ? 1 : -1) * (360 + i * 40);
    return `<span class="fha-confetti" style="left:${20 + i * 4.5}%;background:${colors[i % colors.length]};animation-delay:${(4.6 + (i % 5) * 0.06).toFixed(2)}s;--rot:${rot}deg"></span>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
    -webkit-text-size-adjust: 100%;
  }
  .fha-scene {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 16px;
    user-select: none;
  }
  .sky {
    position: absolute; inset: 0;
    background: radial-gradient(120% 80% at 50% 120%, #0a3d2a 0%, #072a1d 40%, #020814 100%);
  }
  .sky-glow {
    position: absolute; inset: 0;
    background: radial-gradient(60% 40% at 50% 0%, rgba(255,200,80,0.18), transparent 70%);
  }
  .fha-beams {
    position: absolute;
    top: -40px; left: 50%;
    width: 180%; height: 180%;
    transform-origin: top center;
    animation: fha-beams-sweep 6s ease-in-out infinite;
    mix-blend-mode: screen;
  }
  .beam {
    position: absolute; top: 0; left: 50%;
    width: 8px; height: 100%;
    margin-left: -4px;
    background: linear-gradient(to bottom, rgba(254,249,195,0.3), transparent);
    filter: blur(6px);
    transform-origin: top center;
  }
  .beam-1 { transform: rotate(-18deg); }
  .beam-2 { transform: rotate(6deg); opacity: 0.85; }
  .beam-3 { transform: rotate(22deg); }
  .stadium {
    position: absolute; left: 0; right: 0; bottom: 48px; height: 40px;
    color: rgba(0,0,0,0.7);
  }
  .crowd {
    position: absolute; left: 0; right: 0; bottom: 52px; height: 24px;
  }
  .pitch {
    position: absolute; left: 0; right: 0; bottom: 0; height: 48px;
    background: linear-gradient(to bottom, #059669, #047857, #064e3b);
  }
  .pitch-stripes {
    position: absolute; left: 0; right: 0; bottom: 0; height: 48px; opacity: 0.25;
    background-image: repeating-linear-gradient(90deg, transparent 0 32px, rgba(255,255,255,0.18) 32px 64px);
  }
  .pitch-line {
    position: absolute; left: 0; right: 0; bottom: 44px; height: 1px;
    background: rgba(255,255,255,0.5);
  }
  .goal-svg {
    position: absolute; right: 8px; bottom: 44px; height: 96px; color: #fff;
  }
  .fha-player {
    position: absolute; height: 112px;
    animation: fha-player-move 6s cubic-bezier(.5,.05,.3,1) infinite;
    bottom: 24px;
  }
  .fha-player-rot {
    transform-origin: 70px 70px;
    animation: fha-player-rot 6s cubic-bezier(.5,.05,.3,1) infinite;
  }
  .fha-strike-leg {
    transform-origin: 82px 78px;
    animation: fha-strike 6s ease-out infinite;
  }
  .fha-ball-wrap {
    position: absolute;
    animation: fha-ball-fly 6s cubic-bezier(.4,0,.55,1) infinite;
  }
  .fha-trail-dot {
    display: block; width: 8px; height: 8px; border-radius: 50%; background: #fff;
  }
  .fha-ball-spin {
    font-size: 28px; line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
    animation: fha-ball-spin 6s linear infinite;
  }
  .scoreboard {
    position: absolute; top: 8px; left: 8px;
    display: flex; align-items: center; gap: 8px;
    padding: 4px 8px; border-radius: 8px;
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff; font-size: 10px; font-family: ui-monospace, monospace;
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  }
  .score-civ { color: #FF7900; font-weight: 700; }
  .score-adv { color: rgba(255,255,255,0.7); font-weight: 700; }
  .fha-score-home { position: relative; width: 12px; text-align: center; font-variant-numeric: tabular-nums; }
  .fha-score-home::before {
    content: "1"; position: absolute; inset: 0; text-align: center;
    opacity: 0; color: #FF7900;
    animation: fha-score-show 6s steps(1) infinite;
  }
  .goal-burst {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .fha-goal-text {
    font-weight: 900; letter-spacing: 0.2em; color: #fff;
    font-size: 28px;
    text-shadow: 0 4px 20px rgba(255,121,0,0.8);
    animation: fha-goal-pop 6s ease-out infinite;
  }
  .fha-flash {
    position: absolute; inset: 0;
    mix-blend-mode: screen;
    animation: fha-flash 6s linear infinite;
  }
  .fha-confetti {
    position: absolute; top: 0;
    width: 6px; height: 12px; border-radius: 2px;
    animation: fha-confetti-fall 1.6s ease-in infinite;
  }

  @keyframes fha-twinkle { 0%,100%{opacity:.15} 50%{opacity:.9} }
  @keyframes fha-beams-sweep { 0%,100% { transform: translateX(-50%) rotate(-6deg); } 50% { transform: translateX(-50%) rotate(6deg); } }
  @keyframes fha-player-move {
    0%   { left: -12%; bottom: 24px; }
    35%  { left: 20%;  bottom: 24px; }
    50%  { left: 28%;  bottom: 72px; }
    65%  { left: 34%;  bottom: 24px; }
    100% { left: 34%;  bottom: 24px; }
  }
  @keyframes fha-player-rot {
    0%,35% { transform: rotate(0deg); }
    50%    { transform: rotate(-95deg); }
    65%    { transform: rotate(-20deg); }
    100%   { transform: rotate(0deg); }
  }
  @keyframes fha-strike { 0%,46% { transform: rotate(0); } 52% { transform: rotate(-25deg); } 100% { transform: rotate(0); } }
  @keyframes fha-ball-fly {
    0%, 48%   { left: 36%; bottom: 48%; opacity: 0; transform: scale(.5); }
    49%       { opacity: 1; transform: scale(1); }
    50%       { left: 40%; bottom: 55%; }
    62%       { left: 62%; bottom: 78%; }
    72%       { left: 80%; bottom: 48%; }
    75%       { left: 82%; bottom: 40%; transform: scale(1.05); }
    85%       { left: 80%; bottom: 22%; }
    100%      { left: 80%; bottom: 22%; opacity: 1; transform: scale(1); }
  }
  @keyframes fha-ball-spin { to { transform: rotate(900deg); } }
  @keyframes fha-net-ripple {
    0%,74% { transform: scale(1,1); }
    76% { transform: scale(1.04, 1.08); }
    82% { transform: scale(0.98, 0.96); }
    88% { transform: scale(1.01, 1.02); }
    100% { transform: scale(1,1); }
  }
  .fha-net { animation: fha-net-ripple 6s ease-out infinite; transform-origin: 50% 0%; transform-box: fill-box; }
  @keyframes fha-flash {
    0%,74% { background-color: rgba(255,255,255,0); }
    76% { background-color: rgba(255,255,255,.5); }
    90% { background-color: rgba(255,255,255,0); }
    100% { background-color: rgba(255,255,255,0); }
  }
  @keyframes fha-goal-pop {
    0%,75% { opacity: 0; transform: scale(.6); }
    78% { opacity: 1; transform: scale(1.2); }
    85% { opacity: 1; transform: scale(1); }
    95% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1); }
  }
  @keyframes fha-score-show { 0%,76% { opacity: 0; } 78%,100% { opacity: 1; } }
  @keyframes fha-confetti-fall {
    0% { opacity: 0; transform: translateY(-10px) rotate(0); }
    5% { opacity: 1; }
    100% { opacity: 0; transform: translateY(180px) rotate(var(--rot, 540deg)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .fha-scene * { animation: none !important; }
  }
</style>
</head>
<body>
  <div class="fha-scene">
    <div class="sky"></div>
    <div class="sky-glow"></div>
    <div class="fha-beams">
      <div class="beam beam-1"></div>
      <div class="beam beam-2"></div>
      <div class="beam beam-3"></div>
    </div>
    <svg class="stadium" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
      <path fill="currentColor" d="M0 80 V50 Q40 30 80 45 Q120 28 160 42 Q200 24 240 42 Q280 28 320 45 Q360 30 400 50 V80 Z" />
    </svg>
    <div class="crowd">${twinkles}</div>
    <div class="pitch"></div>
    <div class="pitch-stripes"></div>
    <div class="pitch-line"></div>
    <svg class="goal-svg" viewBox="0 0 140 100" aria-hidden="true">
      <defs>
        <pattern id="fha-net" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6 M6 0 L0 6" stroke="white" stroke-opacity="0.55" stroke-width="0.6" />
        </pattern>
      </defs>
      <path class="fha-net" d="M10 8 H130 V90 H10 Z" fill="url(#fha-net)" />
      <path d="M8 92 V6 H132 V92" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M8 6 L20 18 V92 M132 6 L120 18 V92 M20 18 H120" stroke="currentColor" stroke-opacity="0.8" stroke-width="1.5" fill="none" />
    </svg>
    <svg class="fha-player" viewBox="0 0 140 140" aria-hidden="true">
      <g class="fha-player-rot">
        <rect x="58" y="60" width="28" height="20" rx="4" fill="#ffffff" />
        <path d="M52 36 L70 32 L88 36 L94 60 L84 64 L82 78 L58 78 L56 64 L46 60 Z" fill="#FF7900" />
        <text x="70" y="58" text-anchor="middle" font-size="14" font-weight="900" fill="#0b1f4d">10</text>
        <circle cx="70" cy="22" r="9" fill="#fcd9b6" />
        <path d="M62 18 Q70 8 78 18" stroke="#1a1a1a" stroke-width="3" fill="none" stroke-linecap="round" />
        <path d="M50 44 Q30 40 18 50" stroke="#fcd9b6" stroke-width="6" stroke-linecap="round" fill="none" />
        <path d="M90 44 Q108 38 120 48" stroke="#fcd9b6" stroke-width="6" stroke-linecap="round" fill="none" />
        <path d="M62 78 Q56 96 50 110" stroke="#fcd9b6" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M50 110 l-8 2" stroke="#111" stroke-width="6" stroke-linecap="round" />
        <g class="fha-strike-leg">
          <path d="M82 78 Q100 62 118 50" stroke="#fcd9b6" stroke-width="7" stroke-linecap="round" fill="none" />
          <path d="M118 50 l8 -3" stroke="#111" stroke-width="6" stroke-linecap="round" />
        </g>
      </g>
    </svg>
    ${ballTrails}
    <div class="fha-ball-wrap"><div class="fha-ball-spin">⚽</div></div>
    <div class="scoreboard">
      <span class="score-civ">CIV</span>
      <span class="fha-score-home">0</span>
      <span style="opacity:0.5">:</span>
      <span style="width:12px;text-align:center">0</span>
      <span class="score-adv">ALL</span>
    </div>
    <div class="goal-burst"><span class="fha-goal-text">BUT&nbsp;!</span></div>
    <div class="fha-flash"></div>
    ${confetti}
  </div>
</body>
</html>`;
}

const FOOTBALL_HERO_HTML = buildFootballHeroAnimationHtml();
export default FOOTBALL_HERO_HTML;
