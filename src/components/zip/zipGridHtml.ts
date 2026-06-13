import type { ZipPuzzle } from '../../games/zip/types';

export function buildZipGridHtml(puzzle: ZipPuzzle, cellSize: number): string {
  const payload = JSON.stringify({
    rows: puzzle.rows,
    cols: puzzle.cols,
    numbers: puzzle.numbers,
    cellSize,
  });

  const gridW = puzzle.cols * cellSize;
  const gridH = puzzle.rows * cellSize;
  const fontSize = Math.max(15, Math.floor(cellSize * 0.36));
  const tubeW = Math.max(8, Math.floor(cellSize * 0.2));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; touch-action: none; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      overflow: hidden; background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      user-select: none; -webkit-user-select: none;
    }
    .wrap {
      display: flex; flex-direction: column; align-items: center;
      padding: 2px 4px;
    }
    .progress-wrap {
      width: 100%;
      max-width: ${gridW}px;
      margin-bottom: 12px;
    }
    .progress-track {
      height: 6px;
      border-radius: 999px;
      background: #e2e8f0;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      border-radius: 999px;
      background: linear-gradient(90deg, #22c55e, #f97316, #ea580c);
      transition: width 0.25s cubic-bezier(0.34, 1.3, 0.64, 1);
      box-shadow: 0 0 10px rgba(249, 115, 22, 0.45);
    }
    .progress-label {
      margin-top: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      text-align: center;
      letter-spacing: 0.3px;
    }
    .board {
      position: relative;
      width: ${gridW}px;
      height: ${gridH}px;
      border-radius: 18px;
      transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
      touch-action: none;
    }
    .board.won {
      transform: scale(1.02);
    }
    .board-frame {
      position: absolute;
      inset: -4px;
      border-radius: 22px;
      background: linear-gradient(135deg, #fb923c, #ea580c, #fbbf24);
      opacity: 0.85;
      z-index: 0;
    }
    .board-inner {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 16px;
      overflow: hidden;
      background: #f8fafc;
      z-index: 1;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
    }
    #grid {
      display: grid;
      width: ${gridW}px;
      height: ${gridH}px;
      grid-template-columns: repeat(${puzzle.cols}, ${cellSize}px);
      grid-template-rows: repeat(${puzzle.rows}, ${cellSize}px);
      position: relative;
      z-index: 3;
    }
    #pathSvg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      overflow: visible;
    }
    #confettiCanvas {
      position: absolute;
      inset: -20px;
      width: calc(100% + 40px);
      height: calc(100% + 40px);
      pointer-events: none;
      z-index: 20;
    }
    .win-banner {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0.6);
      opacity: 0;
      z-index: 25;
      pointer-events: none;
      padding: 10px 18px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.88);
      color: #fff;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.5px;
      white-space: nowrap;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    }
    .board.won .win-banner {
      animation: bannerPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
    }
    @keyframes bannerPop {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
      100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    .cell {
      display: flex; align-items: center; justify-content: center;
      background: #ffffff;
      border: 1px solid rgba(226, 232, 240, 0.9);
      font-size: ${fontSize}px;
      font-weight: 800;
      color: #1e293b;
      position: relative;
      transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }
    .cell.start {
      background: linear-gradient(160deg, #ecfdf5, #d1fae5);
      color: #1e293b;
      font-weight: 900;
    }
    .cell.in-path {
      background: rgba(255, 251, 235, 0.45);
      border-color: #fed7aa;
    }
    .cell.has-label span.num {
      position: relative;
      z-index: 6;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${Math.floor(cellSize * 0.62)}px;
      height: ${Math.floor(cellSize * 0.62)}px;
      border-radius: 50%;
      background: #ffffff;
      color: #1e293b;
      font-weight: 800;
      box-shadow: 0 1px 6px rgba(15, 23, 42, 0.12), inset 0 0 0 1px rgba(226, 232, 240, 0.9);
    }
    .cell.in-path.has-label span.num {
      box-shadow: 0 2px 8px rgba(249, 115, 22, 0.18), inset 0 0 0 2px #ffedd5;
    }
    .cell.head {
      background: #fff7ed;
      box-shadow: inset 0 0 0 2px #fb923c;
    }
    .head-dot {
      position: absolute;
      width: ${Math.max(10, Math.floor(cellSize * 0.22))}px;
      height: ${Math.max(10, Math.floor(cellSize * 0.22))}px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #fdba74, #ea580c);
      border: 2px solid #fff;
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.25), 0 2px 8px rgba(234, 88, 12, 0.5);
      animation: headPulse 1s ease-in-out infinite;
      z-index: 5;
    }
    @keyframes headPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.85; }
    }
    .cell.end.in-path {
      background: linear-gradient(160deg, rgba(254,249,195,0.55), rgba(253,224,71,0.55));
      color: #1e293b;
    }
    .cell.end.in-path span.num {
      box-shadow: 0 2px 10px rgba(234, 179, 8, 0.28), inset 0 0 0 2px #fde68a;
    }
    .cell.next-num {
      animation: nextShimmer 1.4s ease-in-out infinite;
      color: #1e293b;
      font-weight: 900;
    }
    @keyframes nextShimmer {
      0%, 100% { box-shadow: inset 0 0 0 0 rgba(59, 130, 246, 0); background: #fff; }
      50% { box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.45); background: #eff6ff; }
    }
    .board.won .cell.in-path {
      animation: cellPop 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) backwards;
    }
    @keyframes cellPop {
      0% { transform: scale(0.92); }
      100% { transform: scale(1); }
    }
    #pathMain { transition: stroke 0.4s ease; }
    .board.won #pathUnder { stroke: rgba(255,255,255,0.95); }
    .board.won #pathMain {
      stroke: url(#winGrad);
      filter: url(#winGlow);
    }
    #hint {
      display: none;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="progress-wrap">
      <div class="progress-track"><div id="progressFill" class="progress-fill"></div></div>
      <div id="progressLabel" class="progress-label"></div>
    </div>
    <div class="board" id="board">
      <div class="board-frame"></div>
      <div class="board-inner">
        <svg id="pathSvg" viewBox="0 0 ${gridW} ${gridH}">
          <defs>
            <linearGradient id="pathGrad" gradientUnits="userSpaceOnUse"
              x1="0" y1="0" x2="${gridW}" y2="${gridH}">
              <stop offset="0%" stop-color="#4ade80"/>
              <stop offset="45%" stop-color="#fb923c"/>
              <stop offset="100%" stop-color="#ea580c"/>
            </linearGradient>
            <linearGradient id="winGrad" gradientUnits="userSpaceOnUse"
              x1="0" y1="0" x2="${gridW}" y2="0">
              <stop offset="0%" stop-color="#fde047"/>
              <stop offset="50%" stop-color="#f97316"/>
              <stop offset="100%" stop-color="#22c55e"/>
            </linearGradient>
            <filter id="pathGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="winGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path id="pathUnder" fill="none" stroke="rgba(255,255,255,0.92)"
            stroke-width="${tubeW + 6}" stroke-linecap="round" stroke-linejoin="round"/>
          <path id="pathGlow" fill="none" stroke="rgba(249,115,22,0.35)"
            stroke-width="${tubeW + 4}" stroke-linecap="round" stroke-linejoin="round"
            filter="url(#pathGlow)"/>
          <path id="pathMain" fill="none" stroke="url(#pathGrad)"
            stroke-width="${tubeW}" stroke-linecap="round" stroke-linejoin="round"/>
          <circle id="headRing" r="${Math.max(7, tubeW * 0.55)}" fill="none"
            stroke="#fb923c" stroke-width="2.5" opacity="0" />
          <circle id="headCore" r="${Math.max(4, tubeW * 0.32)}" fill="#ea580c" opacity="0"/>
        </svg>
        <div id="grid"></div>
        <canvas id="confettiCanvas"></canvas>
        <div class="win-banner" id="winBanner">Bravo !</div>
      </div>
    </div>
    <div id="hint"></div>
  </div>
  <script>
    const PUZZLE = ${payload};
    let path = [];
    let dragging = false;
    let disabled = false;
    let won = false;
    let activePointer = null;
    let syncLock = false;
    var usePointer = typeof window.PointerEvent !== 'undefined';

    function cellKey(r, c) { return r + ',' + c; }
    function post(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }
    function cellCenter(row, col) {
      return {
        x: (col + 0.5) * PUZZLE.cellSize,
        y: (row + 0.5) * PUZZLE.cellSize
      };
    }
    function buildPathD(cells) {
      if (!cells.length) return '';
      var d = '';
      for (var i = 0; i < cells.length; i++) {
        var p = cellCenter(cells[i].row, cells[i].col);
        d += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      }
      return d;
    }
    function getMaxNumber() {
      return Math.max.apply(null, Object.values(PUZZLE.numbers).concat([0]));
    }
    function getNextExpected() {
      var expected = 1;
      for (var i = 0; i < path.length; i++) {
        var label = PUZZLE.numbers[cellKey(path[i].row, path[i].col)];
        if (label === expected) expected++;
      }
      return expected;
    }
    function canExtend(cell) {
      var key = cellKey(cell.row, cell.col);
      var index = path.findIndex(function(c) { return cellKey(c.row, c.col) === key; });
      if (path.length === 0) return PUZZLE.numbers[key] === 1;
      if (index >= 0) return index === path.length - 2;
      var last = path[path.length - 1];
      return Math.abs(last.row - cell.row) + Math.abs(last.col - cell.col) === 1;
    }
    function applyCellToPath(cell) {
      var key = cellKey(cell.row, cell.col);
      var index = path.findIndex(function(c) { return cellKey(c.row, c.col) === key; });
      if (path.length === 0) return PUZZLE.numbers[key] === 1 ? [cell] : path;
      if (index >= 0 && index === path.length - 2) return path.slice(0, -1);
      if (index >= 0) return path;
      var last = path[path.length - 1];
      if (Math.abs(last.row - cell.row) + Math.abs(last.col - cell.col) !== 1) return path;
      return path.concat([cell]);
    }
    function pointToCell(clientX, clientY) {
      var board = document.getElementById('board');
      var rect = board.getBoundingClientRect();
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
      return {
        row: Math.min(PUZZLE.rows - 1, Math.max(0, Math.floor(y / PUZZLE.cellSize))),
        col: Math.min(PUZZLE.cols - 1, Math.max(0, Math.floor(x / PUZZLE.cellSize)))
      };
    }
    function setHint(text) {
      /* hints désactivés pendant le jeu pour éviter les messages tutoriel intempestifs */
    }
    function syncPathFromNative(cells) {
      syncLock = true;
      path = Array.isArray(cells) ? cells.slice() : [];
      render();
      syncLock = false;
    }
    function drawPath() {
      var d = buildPathD(path);
      document.getElementById('pathUnder').setAttribute('d', d);
      document.getElementById('pathGlow').setAttribute('d', d);
      document.getElementById('pathMain').setAttribute('d', d);

      var headRing = document.getElementById('headRing');
      var headCore = document.getElementById('headCore');
      if (path.length && !won) {
        var head = cellCenter(path[path.length - 1].row, path[path.length - 1].col);
        headRing.setAttribute('cx', head.x);
        headRing.setAttribute('cy', head.y);
        headCore.setAttribute('cx', head.x);
        headCore.setAttribute('cy', head.y);
        headRing.setAttribute('opacity', '0.7');
        headCore.setAttribute('opacity', '1');
      } else {
        headRing.setAttribute('opacity', '0');
        headCore.setAttribute('opacity', '0');
      }
    }
    function render() {
      var total = PUZZLE.rows * PUZZLE.cols;
      var next = getNextExpected();
      var pct = Math.round((path.length / total) * 100);
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressLabel').textContent =
        path.length + ' / ' + total + ' cases' +
        (path.length > 0 ? ' · n° ' + next + ' suivant' : '');

      var pathSet = new Set(path.map(function(c) { return cellKey(c.row, c.col); }));
      var head = path.length ? path[path.length - 1] : null;
      var headKey = head ? cellKey(head.row, head.col) : null;
      var maxN = getMaxNumber();

      document.querySelectorAll('.cell').forEach(function(el) {
        var r = +el.dataset.row;
        var c = +el.dataset.col;
        var key = cellKey(r, c);
        var label = PUZZLE.numbers[key];
        var inPath = pathSet.has(key);
        el.className = 'cell';
        el.innerHTML = '';
        if (label === 1) el.classList.add('start');
        if (inPath) el.classList.add('in-path');
        if (label !== undefined) el.classList.add('has-label');
        if (key === headKey && !won) el.classList.add('head');
        if (label === maxN && inPath) el.classList.add('end');
        if (label === next && path.length > 0 && !inPath) el.classList.add('next-num');
        if (label !== undefined) {
          var span = document.createElement('span');
          span.className = 'num';
          span.textContent = String(label);
          el.appendChild(span);
        }
        if (key === headKey && !won && label === undefined) {
          var dot = document.createElement('div');
          dot.className = 'head-dot';
          el.appendChild(dot);
        }
      });

      drawPath();
    }
    function tryApply(clientX, clientY) {
      if (disabled || won) return;
      var cell = pointToCell(clientX, clientY);
      if (!cell) return;
      var current = path;
      if (!canExtend(cell)) return;
      var next = applyCellToPath(cell);
      if (next.length === current.length) return;
      path = next;
      render();
      if (!syncLock) post({ type: 'path', path: path });
    }
    function buildGrid() {
      var grid = document.getElementById('grid');
      grid.innerHTML = '';
      for (var row = 0; row < PUZZLE.rows; row++) {
        for (var col = 0; col < PUZZLE.cols; col++) {
          var div = document.createElement('div');
          div.className = 'cell';
          div.dataset.row = String(row);
          div.dataset.col = String(col);
          grid.appendChild(div);
        }
      }
      render();
    }
    function launchBoardConfetti() {
      var canvas = document.getElementById('confettiCanvas');
      var board = document.getElementById('board');
      var rect = board.getBoundingClientRect();
      canvas.width = rect.width + 40;
      canvas.height = rect.height + 40;
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      var colors = ['#f97316','#ea580c','#fbbf24','#22c55e','#fff','#fdba74'];
      var pieces = [];
      for (var i = 0; i < 90; i++) {
        pieces.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * 40,
          y: canvas.height / 2,
          vx: (Math.random() - 0.5) * 14,
          vy: -6 - Math.random() * 12,
          rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 0.3,
          w: 4 + Math.random() * 6,
          h: 3 + Math.random() * 4,
          color: colors[i % colors.length],
          life: 1
        });
      }
      var frame = 0;
      function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var alive = false;
        for (var j = 0; j < pieces.length; j++) {
          var p = pieces[j];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.35;
          p.rot += p.vr;
          p.life -= 0.012;
          if (p.life <= 0) continue;
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        frame++;
        if (alive && frame < 120) requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      tick();
    }
    window.celebrateZip = function() {
      if (won) return;
      won = true;
      disabled = true;
      document.getElementById('board').classList.add('won');
      document.getElementById('winBanner').textContent = 'Bravo !';
      drawPath();
      launchBoardConfetti();
    };
    window.resetZip = function() {
      path = [];
      won = false;
      disabled = false;
      dragging = false;
      activePointer = null;
      document.getElementById('board').classList.remove('won');
      setHint('');
      render();
    };
    window.setZipPath = function(cells) {
      syncPathFromNative(cells);
    };
    window.setZipDisabled = function(value) {
      disabled = !!value;
    };
    function onPointerDown(e) {
      if (disabled || won) return;
      e.preventDefault();
      var board = document.getElementById('board');
      if (board.setPointerCapture) board.setPointerCapture(e.pointerId);
      activePointer = e.pointerId;
      dragging = true;
      tryApply(e.clientX, e.clientY);
    }
    function onPointerMove(e) {
      if (!dragging || e.pointerId !== activePointer) return;
      e.preventDefault();
      tryApply(e.clientX, e.clientY);
    }
    function onPointerEnd(e) {
      if (e.pointerId !== activePointer) return;
      var board = document.getElementById('board');
      if (board.releasePointerCapture) {
        try { board.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      dragging = false;
      activePointer = null;
    }
    function onTouchStart(e) {
      if (usePointer || disabled || won || dragging) return;
      e.preventDefault();
      dragging = true;
      tryApply(e.touches[0].clientX, e.touches[0].clientY);
    }
    function onTouchMove(e) {
      if (usePointer || !dragging) return;
      e.preventDefault();
      tryApply(e.touches[0].clientX, e.touches[0].clientY);
    }
    function onTouchEnd(e) {
      if (usePointer) return;
      e.preventDefault();
      dragging = false;
    }
    buildGrid();
    var boardEl = document.getElementById('board');
    if (usePointer) {
      boardEl.addEventListener('pointerdown', onPointerDown, { passive: false });
      boardEl.addEventListener('pointermove', onPointerMove, { passive: false });
      boardEl.addEventListener('pointerup', onPointerEnd, { passive: false });
      boardEl.addEventListener('pointercancel', onPointerEnd, { passive: false });
    } else {
      boardEl.addEventListener('touchstart', onTouchStart, { passive: false });
      boardEl.addEventListener('touchmove', onTouchMove, { passive: false });
      boardEl.addEventListener('touchend', onTouchEnd, { passive: false });
      boardEl.addEventListener('touchcancel', onTouchEnd, { passive: false });
    }
    post({ type: 'ready' });
  </script>
</body>
</html>`;
}
