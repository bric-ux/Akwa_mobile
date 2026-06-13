import type { ZipPuzzle } from '../../games/zip/types';

export function buildZipGridHtml(puzzle: ZipPuzzle, cellSize: number): string {
  const payload = JSON.stringify({
    rows: puzzle.rows,
    cols: puzzle.cols,
    numbers: puzzle.numbers,
    cellSize,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; touch-action: none; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      overflow: hidden; background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      user-select: none; -webkit-user-select: none;
    }
    #grid {
      display: grid;
      width: ${puzzle.cols * cellSize}px;
      height: ${puzzle.rows * cellSize}px;
      grid-template-columns: repeat(${puzzle.cols}, ${cellSize}px);
      grid-template-rows: repeat(${puzzle.rows}, ${cellSize}px);
      border: 3px solid #f97316;
      border-radius: 12px;
      overflow: hidden;
    }
    .cell {
      display: flex; align-items: center; justify-content: center;
      border: 1px solid #e2e8f0;
      background: #fff;
      font-size: ${Math.max(14, Math.floor(cellSize * 0.34))}px;
      font-weight: 800;
      color: #0f172a;
      position: relative;
    }
    .cell.start { background: #dcfce7; border-color: #22c55e; }
    .cell.in-path { background: #ffedd5; border-color: #fdba74; color: #c2410c; }
    .cell.head { box-shadow: inset 0 0 0 2px #ea580c; }
    .cell.end.in-path { background: #fef3c7; border-color: #f59e0b; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #f97316; }
    #hint {
      margin-top: 8px; font-size: 12px; color: #b45309;
      font-weight: 600; text-align: center; min-height: 16px;
    }
    #progress {
      margin-bottom: 8px; font-size: 14px; font-weight: 800;
      color: #c2410c; text-align: center;
    }
    .wrap { display: flex; flex-direction: column; align-items: center; padding: 4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="progress"></div>
    <div id="grid"></div>
    <div id="hint"></div>
  </div>
  <script>
    const PUZZLE = ${payload};
    let path = [];
    let dragging = false;
    let disabled = false;
    let moveCount = 0;

    function cellKey(r, c) { return r + ',' + c; }
    function log(msg, extra) {
      post({ type: 'log', msg: String(msg), extra: extra || null });
    }
    function post(msg) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        } else {
          console.log('[ZipWeb no-bridge]', msg);
        }
      } catch (err) {
        console.log('[ZipWeb post-error]', err);
      }
    }
    function getMaxNumber() {
      return Math.max.apply(null, Object.values(PUZZLE.numbers).concat([0]));
    }
    function getNextExpected() {
      let expected = 1;
      for (let i = 0; i < path.length; i++) {
        const c = path[i];
        const label = PUZZLE.numbers[cellKey(c.row, c.col)];
        if (label === expected) expected++;
      }
      return expected;
    }
    function canExtend(cell) {
      const key = cellKey(cell.row, cell.col);
      const index = path.findIndex(function(c) { return cellKey(c.row, c.col) === key; });
      if (path.length === 0) return PUZZLE.numbers[key] === 1;
      if (index >= 0) return index === path.length - 2;
      const last = path[path.length - 1];
      return Math.abs(last.row - cell.row) + Math.abs(last.col - cell.col) === 1;
    }
    function applyCellToPath(cell) {
      const key = cellKey(cell.row, cell.col);
      const index = path.findIndex(function(c) { return cellKey(c.row, c.col) === key; });
      if (path.length === 0) return PUZZLE.numbers[key] === 1 ? [cell] : path;
      if (index >= 0 && index === path.length - 2) return path.slice(0, -1);
      if (index >= 0) return path;
      const last = path[path.length - 1];
      const adjacent = Math.abs(last.row - cell.row) + Math.abs(last.col - cell.col) === 1;
      if (!adjacent) return path;
      return path.concat([cell]);
    }
    function pointToCell(clientX, clientY) {
      const grid = document.getElementById('grid');
      const rect = grid.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
      const col = Math.min(PUZZLE.cols - 1, Math.max(0, Math.floor(x / PUZZLE.cellSize)));
      const row = Math.min(PUZZLE.rows - 1, Math.max(0, Math.floor(y / PUZZLE.cellSize)));
      return { row: row, col: col };
    }
    function setHint(text) {
      document.getElementById('hint').textContent = text || '';
    }
    function render() {
      const total = PUZZLE.rows * PUZZLE.cols;
      const next = getNextExpected();
      document.getElementById('progress').textContent =
        path.length + '/' + total + (path.length > 0 ? ' · n°' + next + ' suivant' : ' · glissez depuis le 1');

      const pathSet = new Set(path.map(function(c) { return cellKey(c.row, c.col); }));
      const head = path.length ? path[path.length - 1] : null;
      const headKey = head ? cellKey(head.row, head.col) : null;
      const maxN = getMaxNumber();

      document.querySelectorAll('.cell').forEach(function(el) {
        const r = +el.dataset.row;
        const c = +el.dataset.col;
        const key = cellKey(r, c);
        const label = PUZZLE.numbers[key];
        const inPath = pathSet.has(key);
        el.className = 'cell';
        if (label === 1) el.classList.add('start');
        if (inPath) el.classList.add('in-path');
        if (key === headKey) el.classList.add('head');
        if (label === maxN && inPath) el.classList.add('end');
        if (label !== undefined) {
          el.innerHTML = String(label);
        } else if (inPath) {
          el.innerHTML = '<div class="dot"></div>';
        } else {
          el.innerHTML = '';
        }
      });
    }
    function tryApply(clientX, clientY, source) {
      if (disabled) {
        log('tryApply blocked: disabled', { source: source });
        return;
      }
      const cell = pointToCell(clientX, clientY);
      if (!cell) {
        log('tryApply no cell', { source: source });
        return;
      }
      const current = path;
      const key = cellKey(cell.row, cell.col);
      const label = PUZZLE.numbers[key];
      const expected = getNextExpected();
      if (!canExtend(cell)) {
        log('tryApply cannot extend', { source: source, cell: cell, label: label, expected: expected, pathLen: current.length });
        if (current.length === 0) setHint('Glissez depuis la case 1 (verte).');
        else if (label !== undefined && label !== expected) setHint('Prochain numéro : ' + expected);
        return;
      }
      const next = applyCellToPath(cell);
      if (next.length === current.length) {
        log('tryApply no path change', { source: source, cell: cell });
        return;
      }
      path = next;
      setHint('');
      render();
      log('path updated', { source: source, len: path.length, cell: cell });
      post({ type: 'path', path: path });
    }
    function buildGrid() {
      const grid = document.getElementById('grid');
      grid.innerHTML = '';
      for (let row = 0; row < PUZZLE.rows; row++) {
        for (let col = 0; col < PUZZLE.cols; col++) {
          const div = document.createElement('div');
          div.className = 'cell';
          div.dataset.row = String(row);
          div.dataset.col = String(col);
          grid.appendChild(div);
        }
      }
      render();
    }
    function onTouchStart(e) {
      e.preventDefault();
      dragging = true;
      moveCount = 0;
      const t = e.touches[0];
      log('touchstart', { x: t.clientX, y: t.clientY, touches: e.touches.length });
      tryApply(t.clientX, t.clientY, 'touchstart');
    }
    function onTouchMove(e) {
      e.preventDefault();
      if (!dragging) return;
      moveCount++;
      const t = e.touches[0];
      if (moveCount <= 3 || moveCount % 10 === 0) {
        log('touchmove', { n: moveCount, x: t.clientX, y: t.clientY });
      }
      tryApply(t.clientX, t.clientY, 'touchmove');
    }
    function onTouchEnd() {
      log('touchend', { moves: moveCount, pathLen: path.length });
      dragging = false;
    }
    window.resetZip = function() {
      path = [];
      setHint('');
      render();
      log('resetZip');
    };
    window.setZipDisabled = function(value) {
      disabled = !!value;
      log('setZipDisabled', { disabled: disabled });
    };
    buildGrid();
    const grid = document.getElementById('grid');
    document.body.addEventListener('touchstart', onTouchStart, { passive: false });
    document.body.addEventListener('touchmove', onTouchMove, { passive: false });
    document.body.addEventListener('touchend', onTouchEnd, { passive: false });
    document.body.addEventListener('touchcancel', onTouchEnd, { passive: false });
    log('ready', {
      hasBridge: !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage),
      rows: PUZZLE.rows,
      cols: PUZZLE.cols,
      cellSize: PUZZLE.cellSize,
      startCell: Object.keys(PUZZLE.numbers).find(function(k) { return PUZZLE.numbers[k] === 1; })
    });
    post({ type: 'ready' });
  </script>
</body>
</html>`;
}
