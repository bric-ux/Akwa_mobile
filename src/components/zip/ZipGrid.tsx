import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ZipCell, ZipPuzzle } from '../../games/zip/types';
import { buildZipGridHtml } from './zipGridHtml';

type Props = {
  puzzle: ZipPuzzle;
  path: ZipCell[];
  onPathChange: (path: ZipCell[]) => void;
  cellSize?: number;
  disabled?: boolean;
  resetToken?: number;
  onDebugLog?: (line: string) => void;
};

export function findStartCell(puzzle: ZipPuzzle): ZipCell | null {
  for (const [key, value] of Object.entries(puzzle.numbers)) {
    if (value === 1) {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    }
  }
  return null;
}

function debugLog(onDebugLog: Props['onDebugLog'], tag: string, detail?: unknown) {
  const line = detail !== undefined ? `[ZipGrid:${tag}] ${JSON.stringify(detail)}` : `[ZipGrid:${tag}]`;
  console.log(line);
  onDebugLog?.(line);
}

const ZipGrid: React.FC<Props> = ({
  puzzle,
  onPathChange,
  cellSize = 48,
  disabled = false,
  resetToken = 0,
  onDebugLog,
}) => {
  const webRef = useRef<WebView>(null);
  const onPathChangeRef = useRef(onPathChange);
  onPathChangeRef.current = onPathChange;
  const onDebugLogRef = useRef(onDebugLog);
  onDebugLogRef.current = onDebugLog;

  const html = useMemo(() => buildZipGridHtml(puzzle, cellSize), [puzzle, cellSize]);

  const gridHeight = puzzle.rows * cellSize + 60;
  const gridWidth = puzzle.cols * cellSize + 16;

  useEffect(() => {
    debugLog(onDebugLogRef.current, 'mount', {
      puzzleId: puzzle.id,
      rows: puzzle.rows,
      cols: puzzle.cols,
      cellSize,
      gridWidth,
      gridHeight,
      disabled,
    });
  }, [cellSize, disabled, gridHeight, gridWidth, puzzle.cols, puzzle.id, puzzle.rows]);

  useEffect(() => {
    debugLog(onDebugLogRef.current, 'setDisabled', { disabled });
    webRef.current?.injectJavaScript(`window.setZipDisabled && window.setZipDisabled(${disabled ? 'true' : 'false'}); true;`);
  }, [disabled]);

  useEffect(() => {
    debugLog(onDebugLogRef.current, 'resetToken', { resetToken });
    webRef.current?.injectJavaScript('window.resetZip && window.resetZip(); true;');
  }, [resetToken]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const raw = event.nativeEvent.data;
    try {
      const data = JSON.parse(raw) as {
        type: string;
        path?: ZipCell[];
        msg?: string;
        extra?: unknown;
      };

      if (data.type === 'log') {
        debugLog(onDebugLogRef.current, 'web', { msg: data.msg, extra: data.extra });
        return;
      }

      if (data.type === 'ready') {
        debugLog(onDebugLogRef.current, 'web-ready');
        return;
      }

      if (data.type === 'path' && Array.isArray(data.path)) {
        debugLog(onDebugLogRef.current, 'path-message', { len: data.path.length });
        onPathChangeRef.current(data.path);
        return;
      }

      debugLog(onDebugLogRef.current, 'unknown-message', data);
    } catch (err) {
      debugLog(onDebugLogRef.current, 'parse-error', { raw, err: String(err) });
    }
  }, []);

  return (
    <View style={[styles.container, { width: gridWidth, height: gridHeight }]}>
      <WebView
        ref={webRef}
        source={{ html }}
        onMessage={onMessage}
        onLoadStart={() => debugLog(onDebugLogRef.current, 'webview-load-start')}
        onLoadEnd={() => debugLog(onDebugLogRef.current, 'webview-load-end')}
        onError={(e) => debugLog(onDebugLogRef.current, 'webview-error', e.nativeEvent)}
        onHttpError={(e) => debugLog(onDebugLogRef.current, 'webview-http-error', e.nativeEvent)}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={false}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        automaticallyAdjustContentInsets={false}
        setSupportMultipleWindows={false}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webviewContainer: {
    backgroundColor: '#fff',
  },
});

export default ZipGrid;
