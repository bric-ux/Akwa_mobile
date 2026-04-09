import React, { useState } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { isVideoUrl } from '../utils/media';

type MediaThumbProps = {
  uri: string;
  style?: StyleProp<ImageStyle | ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  /** Si défini, évite de redétecter depuis l’URL */
  isVideo?: boolean;
};

/**
 * Vignette image ou courte preview vidéo (muet, pas de lecture auto prolongée).
 */
const MediaThumb: React.FC<MediaThumbProps> = ({ uri, style, resizeMode = 'cover', isVideo: isVideoProp }) => {
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

  return <Image source={{ uri }} style={style as ImageStyle} resizeMode={resizeMode} />;
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

export default MediaThumb;
