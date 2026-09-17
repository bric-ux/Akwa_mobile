import React, { useState, useEffect, memo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
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

type VideoPreviewProps = {
  uri: string;
  contentFit: 'cover' | 'contain';
};

/**
 * Affiche une vraie frame vidéo (pas de fond gris / overlay).
 * Micro-play puis pause pour forcer le décodage de la frame.
 */
const VideoThumbPreview: React.FC<VideoPreviewProps> = ({ uri, contentFit }) => {
  const primedRef = React.useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
    p.pause();
  });

  useEffect(() => {
    primedRef.current = false;

    const primeFrame = () => {
      if (primedRef.current) return;
      primedRef.current = true;
      try {
        player.currentTime = 0.35;
        player.play();
        setTimeout(() => {
          try {
            player.pause();
          } catch {
            // ignore
          }
        }, 80);
      } catch {
        // ignore
      }
    };

    if (player.status === 'readyToPlay') {
      primeFrame();
    }

    const sub = player.addListener(
      'statusChange',
      (payload: { status?: string }) => {
        if (payload?.status === 'readyToPlay') {
          primeFrame();
        }
      }
    );

    return () => {
      sub.remove();
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [player, uri]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit={contentFit}
      nativeControls={false}
      useExoShutter={false}
      surfaceType="textureView"
    />
  );
};

/**
 * Vignette image ou preview vidéo (frame + bouton play).
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
  const contentFit = resizeMode === 'cover' ? 'cover' : 'contain';

  if (!uri) {
    return (
      <View style={[styles.placeholder, style as ViewStyle]}>
        <Ionicons name="image-outline" size={32} color="#9ca3af" />
      </View>
    );
  }

  if (video) {
    return (
      <View style={[styles.videoRoot, style as ViewStyle]}>
        <VideoThumbPreview uri={uri} contentFit={contentFit} />
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons
            name="play-circle"
            size={36}
            color="#fff"
            style={styles.playIcon}
          />
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
  shelfWrap: {
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  shelfMedia: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.08 }],
  },
  videoRoot: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  placeholder: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    // Pas de fond / voile — preview vidéo nette
  },
  playIcon: {
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});

const MediaThumb = memo(MediaThumbInner);
export default MediaThumb;
