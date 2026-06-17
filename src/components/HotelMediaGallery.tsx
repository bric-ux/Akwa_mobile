import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { isVideoUrl } from '../utils/media';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HotelMediaGalleryProps {
  urls: string[];
  height?: number;
  width?: number;
  /** Contenu superposé (bouton retour, etc.) */
  overlay?: React.ReactNode;
  showCounter?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  style?: ViewStyle;
  /** Index contrôlé depuis l’extérieur (ex. vignettes) */
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
}

const HotelMediaGallery: React.FC<HotelMediaGalleryProps> = ({
  urls,
  height = 280,
  width = SCREEN_WIDTH,
  overlay,
  showCounter = true,
  showArrows = true,
  showDots = true,
  style,
  activeIndex,
  onIndexChange,
}) => {
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(0);

  const gallery = urls.filter(Boolean);
  const hasMany = gallery.length > 1;

  const scrollTo = useCallback(
    (next: number) => {
      const clamped = ((next % gallery.length) + gallery.length) % gallery.length;
      listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
      setIndex(clamped);
      onIndexChange?.(clamped);
    },
    [gallery.length, width, onIndexChange],
  );

  useEffect(() => {
    if (activeIndex !== undefined && activeIndex !== index && gallery.length > 0) {
      const clamped = Math.max(0, Math.min(activeIndex, gallery.length - 1));
      if (clamped !== index) {
        listRef.current?.scrollToOffset({ offset: clamped * width, animated: false });
        setIndex(clamped);
      }
    }
  }, [activeIndex, gallery.length, width]);

  if (gallery.length === 0) {
    return (
      <View style={[styles.wrap, { height, width }, style]}>
        <View style={[styles.placeholder, { height, width }]}>
          <Ionicons name="image-outline" size={48} color="#94a3b8" />
        </View>
        {overlay}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height, width }, style]}>
      <FlatList
        ref={listRef}
        data={gallery}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item}-${i}`}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
          onIndexChange?.(i);
        }}
        renderItem={({ item, index: itemIndex }) => (
          <View style={{ width, height }}>
            {isVideoUrl(item) ? (
              <Video
                source={{ uri: item }}
                style={{ width, height }}
                resizeMode={ResizeMode.COVER}
                useNativeControls
                shouldPlay={false}
              />
            ) : (
              <Image
                source={{ uri: item }}
                style={{ width, height }}
                contentFit="cover"
                priority={itemIndex === 0 ? 'high' : 'normal'}
              />
            )}
          </View>
        )}
      />

      {overlay}

      {hasMany && showArrows ? (
        <>
          <TouchableOpacity
            style={[styles.arrow, styles.arrowLeft]}
            onPress={() => scrollTo(index - 1)}
            accessibilityLabel="Média précédent"
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrow, styles.arrowRight]}
            onPress={() => scrollTo(index + 1)}
            accessibilityLabel="Média suivant"
          >
            <Ionicons name="chevron-forward" size={26} color="#fff" />
          </TouchableOpacity>
        </>
      ) : null}

      {hasMany && showCounter ? (
        <View style={styles.counter}>
          <Ionicons
            name={isVideoUrl(gallery[index]) ? 'videocam' : 'images'}
            size={14}
            color="#fff"
          />
          <Text style={styles.counterText}>
            {index + 1}/{gallery.length}
          </Text>
        </View>
      ) : null}

      {hasMany && showDots ? (
        <View style={styles.dots}>
          {gallery.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => scrollTo(i)}>
              <View style={[styles.dot, i === index && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', backgroundColor: '#0f172a' },
  placeholder: {
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  counter: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: { backgroundColor: '#fff', width: 18 },
});

export default HotelMediaGallery;
