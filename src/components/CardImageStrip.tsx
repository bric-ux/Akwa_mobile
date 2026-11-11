import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native';
import MediaThumb from './MediaThumb';
import { isVideoUrl } from '../utils/media';

type CardImageStripProps = {
  urls: string[];
  height: number;
  onPress: () => void;
  recyclingKey: string;
};

export default function CardImageStrip({
  urls,
  height,
  onPress,
  recyclingKey,
}: CardImageStripProps) {
  const slides = urls.filter(Boolean).slice(0, 12);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - width) > 0.5) setWidth(next);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  if (slides.length === 0) return null;

  return (
    <View style={{ height, width: '100%' }} onLayout={onLayout}>
      {slides.length > 1 && width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumScrollEnd}
          keyboardShouldPersistTaps="handled"
        >
          {slides.map((uri, i) => (
            <Pressable key={`${uri}-${i}`} onPress={onPress} style={{ width, height }}>
              <MediaThumb
                uri={uri}
                style={{ width, height }}
                resizeMode="cover"
                isVideo={isVideoUrl(uri)}
                priority={i === 0 ? 'high' : 'low'}
                recyclingKey={`${recyclingKey}-${i}`}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={onPress} style={{ width: '100%', height }}>
          <MediaThumb
            uri={slides[0]}
            style={{ width: '100%', height }}
            resizeMode="cover"
            isVideo={isVideoUrl(slides[0])}
            priority="low"
            recyclingKey={`${recyclingKey}-0`}
          />
        </Pressable>
      )}

      {slides.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dotActive: {
    width: 14,
    backgroundColor: '#fff',
  },
});
