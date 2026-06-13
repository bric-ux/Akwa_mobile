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
  celebrate?: boolean;
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

const ZipGrid: React.FC<Props> = ({
  puzzle,
  onPathChange,
  cellSize = 48,
  disabled = false,
  resetToken = 0,
  celebrate = false,
}) => {
  const webRef = useRef<WebView>(null);
  const onPathChangeRef = useRef(onPathChange);
  onPathChangeRef.current = onPathChange;

  const html = useMemo(() => buildZipGridHtml(puzzle, cellSize), [puzzle, cellSize]);

  const gridHeight = puzzle.rows * cellSize + 72;
  const gridWidth = puzzle.cols * cellSize + 16;

  useEffect(() => {
    webRef.current?.injectJavaScript(`window.setZipDisabled && window.setZipDisabled(${disabled ? 'true' : 'false'}); true;`);
  }, [disabled]);

  useEffect(() => {
    webRef.current?.injectJavaScript('window.resetZip && window.resetZip(); true;');
  }, [resetToken]);

  useEffect(() => {
    if (celebrate) {
      webRef.current?.injectJavaScript('window.celebrateZip && window.celebrateZip(); true;');
    }
  }, [celebrate]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; path?: ZipCell[] };
      if (data.type === 'path' && Array.isArray(data.path)) {
        onPathChangeRef.current(data.path);
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  return (
    <View style={[styles.container, { width: gridWidth, height: gridHeight }]}>
      <WebView
        ref={webRef}
        source={{ html }}
        onMessage={onMessage}
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
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewContainer: {
    backgroundColor: 'transparent',
  },
});

export default ZipGrid;
