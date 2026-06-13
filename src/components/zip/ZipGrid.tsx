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
  path,
  onPathChange,
  cellSize = 48,
  disabled = false,
  resetToken = 0,
  celebrate = false,
}) => {
  const webRef = useRef<WebView>(null);
  const onPathChangeRef = useRef(onPathChange);
  const pathRef = useRef(path);
  const webReadyRef = useRef(false);
  onPathChangeRef.current = onPathChange;
  pathRef.current = path;

  const html = useMemo(() => buildZipGridHtml(puzzle, cellSize), [puzzle, cellSize]);

  const gridHeight = puzzle.rows * cellSize + 72;
  const gridWidth = puzzle.cols * cellSize + 16;

  const inject = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js} true;`);
  }, []);

  const syncPath = useCallback(() => {
    if (!webReadyRef.current) return;
    inject(`window.setZipPath && window.setZipPath(${JSON.stringify(pathRef.current)});`);
  }, [inject]);

  const syncDisabled = useCallback(() => {
    if (!webReadyRef.current) return;
    inject(`window.setZipDisabled && window.setZipDisabled(${disabled ? 'true' : 'false'});`);
  }, [disabled, inject]);

  useEffect(() => {
    webReadyRef.current = false;
  }, [html]);

  useEffect(() => {
    inject('window.resetZip && window.resetZip();');
  }, [inject, resetToken]);

  useEffect(() => {
    if (celebrate) {
      inject('window.celebrateZip && window.celebrateZip();');
    }
  }, [celebrate, inject]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; path?: ZipCell[] };
      if (data.type === 'ready') {
        webReadyRef.current = true;
        syncPath();
        syncDisabled();
      }
      if (data.type === 'path' && Array.isArray(data.path)) {
        onPathChangeRef.current(data.path);
      }
    } catch {
      // ignore malformed messages
    }
  }, [syncDisabled, syncPath]);

  useEffect(() => {
    syncDisabled();
  }, [syncDisabled]);

  const onLoadEnd = useCallback(() => {
    webReadyRef.current = true;
    syncPath();
    syncDisabled();
  }, [syncDisabled, syncPath]);

  return (
    <View style={[styles.container, { width: gridWidth, height: gridHeight }]}>
      <WebView
        ref={webRef}
        source={{ html }}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
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
