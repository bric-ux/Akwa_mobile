import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

export type AppVideoHandle = {
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  stopAsync: () => Promise<void>;
};

type AppVideoProps = {
  source: { uri: string };
  style?: StyleProp<ViewStyle>;
  contentFit?: 'contain' | 'cover' | 'fill';
  nativeControls?: boolean;
  shouldPlay?: boolean;
  isMuted?: boolean;
  isLooping?: boolean;
  onPlaybackStatusUpdate?: (status: { isPlaying?: boolean; isLoaded?: boolean }) => void;
  onError?: () => void;
};

/**
 * Thin wrapper around expo-video with an API close to the old expo-av <Video />.
 */
const AppVideo = forwardRef<AppVideoHandle, AppVideoProps>(function AppVideo(
  {
    source,
    style,
    contentFit = 'contain',
    nativeControls = false,
    shouldPlay = false,
    isMuted = false,
    isLooping = false,
    onPlaybackStatusUpdate,
    onError,
  },
  ref
) {
  const lastUriRef = useRef(source.uri);
  const player = useVideoPlayer(source.uri, (p) => {
    p.loop = isLooping;
    p.muted = isMuted;
    if (shouldPlay) {
      p.play();
    } else {
      p.pause();
    }
  });

  useEffect(() => {
    if (lastUriRef.current !== source.uri) {
      lastUriRef.current = source.uri;
      player.replace(source.uri);
    }
  }, [source.uri, player]);

  useImperativeHandle(ref, () => ({
    playAsync: async () => {
      player.play();
    },
    pauseAsync: async () => {
      player.pause();
    },
    stopAsync: async () => {
      player.pause();
      player.currentTime = 0;
    },
  }));

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    player.loop = isLooping;
  }, [isLooping, player]);

  useEffect(() => {
    if (shouldPlay) player.play();
    else player.pause();
  }, [shouldPlay, player]);

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  useEffect(() => {
    onPlaybackStatusUpdate?.({ isPlaying, isLoaded: true });
  }, [isPlaying, onPlaybackStatusUpdate]);

  useEffect(() => {
    const sub = player.addListener('statusChange', (payload: { status?: string }) => {
      if (payload?.status === 'error') {
        onError?.();
      }
    });
    return () => sub.remove();
  }, [player, onError]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={nativeControls}
    />
  );
});

export default AppVideo;
