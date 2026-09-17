import React, { useState, memo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  EXPLORE_SHELF_IMAGE_HEIGHT,
  EXPLORE_SHELF_CARD_WIDTH,
} from '../constants/exploreShelfCard';
import {
  getGalleryThumbUrl,
  getHomeShelfImageUrl,
  getListCardImageUrl,
  isVideoUrl,
} from '../utils/media';

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
  /** Accueil carrousel : recadrage portrait optimisé pour remplir l'encart. */
  preferOriginal?: boolean;
  /** Résultats recherche : image uploadée sans crop agressif côté CDN. */
  fitWholeImage?: boolean;
  contentPosition?: 'center' | 'top' | 'bottom';
};

/**
 * Vignette image ou placeholder vidéo (pas de player natif en liste).
 * Images distantes : expo-image (cache disque + mémoire).
 */
const MediaThumbInner: React.FC<MediaThumbProps> = ({
  uri,
  style,
  resizeMode = 'cover',
  isVideo: isVideoProp,
  priority = 'normal',
  recyclingKey,
  preferOriginal = false,
  fitWholeImage = false,
  contentPosition = 'center',
}) => {
  const [useOriginal, setUseOriginal] = useState(false);
  const video = isVideoProp ?? isVideoUrl(uri);

  if (!uri) {
    return (
      <View style={[styles.placeholder, style as ViewStyle]}>
        <Ionicons name="image-outline" size={32} color="#9ca3af" />
      </View>
    );
  }

  if (video) {
    return (
      <View style={[preferOriginal ? styles.shelfWrap : styles.wrap, style as ViewStyle]}>
        <View style={styles.videoPlaceholder}>
          <Ionicons name="videocam" size={28} color="rgba(255,255,255,0.85)" />
        </View>
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.92)" />
        </View>
      </View>
    );
  }

  const optimizedUri = useOriginal
    ? uri
    : fitWholeImage
      ? getListCardImageUrl(uri)
      : preferOriginal
        ? getHomeShelfImageUrl(uri, EXPLORE_SHELF_CARD_WIDTH, EXPLORE_SHELF_IMAGE_HEIGHT)
        : getGalleryThumbUrl(uri);
  const displayUri = useOriginal ? uri : optimizedUri;
  const contentFit = resizeMode === 'cover' ? 'cover' : 'contain';

  if (preferOriginal) {
    return (
      <View style={[styles.shelfWrap, style as ViewStyle]}>
        <Image
          source={displayUri}
          style={styles.shelfMedia}
          contentFit={contentFit}
          contentPosition={contentPosition}
          cachePolicy="memory-disk"
          priority={priority}
          recyclingKey={recyclingKey ?? uri}
          transition={120}
          allowDownscaling
          onError={() => {
            if (!useOriginal && displayUri !== uri) setUseOriginal(true);
          }}
        />
      </View>
    );
  }

  return (
    <Image
      source={displayUri}
      style={style as ImageStyle}
      contentFit={contentFit}
      contentPosition={contentPosition}
      cachePolicy="memory-disk"
      priority={priority}
      recyclingKey={recyclingKey ?? uri}
      transition={120}
      allowDownscaling
      onError={() => {
        if (!useOriginal && displayUri !== uri) setUseOriginal(true);
      }}
    />
  );
};

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  shelfWrap: {
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  shelfMedia: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.08 }],
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
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
