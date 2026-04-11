import React, { useState, memo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { isVideoUrl } from '../utils/media';

type MediaThumbProps = {
  uri: string;
  style?: StyleProp<ImageStyle | ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  /** Si défini, évite de redétecter depuis l’URL */
  isVideo?: boolean;
  /**
   * `low` pour les listes (Explorer, recherche) : moins de bande passante concurrente.
   * `high` pour la fiche détail / première image.
   */
  priority?: 'low' | 'normal' | 'high';
  /** Stabilise le recyclage des vues (listes) — ex. `${propertyId}-${index}` */
  recyclingKey?: string;
};

/**
 * Vignette image ou courte preview vidéo (muet, pas de lecture auto prolongée).
 * Images distantes : expo-image (cache disque + mémoire, meilleures perfs que Image RN).
 */
const MediaThumbInner: React.FC<MediaThumbProps> = ({
  uri,
  style,
  resizeMode = 'cover',
  isVideo: isVideoProp,
  priority = 'normal',
  recyclingKey,
}) => {
  const [videoError, setVideoError] = useState(false);
  const video = isVideoProp ?? isVideoUrl(uri);

  if (!uri) {
    return (
      <View style={[styles.placeholder, style as ViewStyle]}>
        <Ionicons name="image-outline" size={32} color="#9ca3af" />
      </View>
    );
  }

  if (video && !videoError) {
    return (
      <View style={[styles.wrap, style as ViewStyle]}>
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN}
          shouldPlay={false}
          isMuted
          isLooping={false}
          useNativeControls={false}
          onError={() => setVideoError(true)}
        />
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.92)" />
        </View>
      </View>
    );
  }

  if (video && videoError) {
    return (
      <View style={[styles.placeholder, style as ViewStyle]}>
        <Ionicons name="videocam-outline" size={36} color="#64748b" />
      </View>
    );
  }

  return (
    <Image
      source={uri}
      style={style as ImageStyle}
      contentFit={resizeMode === 'cover' ? 'cover' : 'contain'}
      cachePolicy="memory-disk"
      priority={priority}
      recyclingKey={recyclingKey ?? uri}
      transition={120}
    />
  );
};

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  placeholder: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadge: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});

const MediaThumb = memo(MediaThumbInner);
export default MediaThumb;
