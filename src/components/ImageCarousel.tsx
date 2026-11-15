import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../constants/homeExploreLayout';
import { useLanguage } from '../contexts/LanguageContext';

const SCREEN_W = Dimensions.get('window').width;
const CAROUSEL_SIDE_MARGIN = HOME_EXPLORE_HORIZONTAL_GUTTER;
const SLIDE_WIDTH = SCREEN_W - CAROUSEL_SIDE_MARGIN * 2;

interface CarouselImage {
  id: string;
  source: any;
  title: string;
  description: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  onImagePress?: (image: CarouselImage) => void;
  variant?: 'section' | 'hero';
  title?: string;
  subtitle?: string;
  overlay?: ReactNode;
}

const HERO_HEIGHT = 248;

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  onImagePress,
  variant = 'section',
  title,
  subtitle,
  overlay,
}) => {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const hero = variant === 'hero';
  const slideWidth = hero ? width : SLIDE_WIDTH;
  const slideHeight = hero ? HERO_HEIGHT : 250;
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / slideWidth);
    if (index >= 0 && index < images.length) setCurrentIndex(index);
  };

  const goToSlide = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * slideWidth,
      animated: true,
    });
  };

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % images.length;
      goToSlide(nextIndex);
    }, hero ? 5000 : 2000);

    return () => clearInterval(interval);
  }, [currentIndex, hero, images.length, slideWidth]);

  return (
    <View style={hero ? styles.heroContainer : styles.container}>
      {hero ? null : <Text style={styles.sectionTitle}>{t('home.carouselTitle')}</Text>}

      <View style={[styles.carouselContainer, hero && styles.heroFrame]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ height: slideHeight }}
        >
          {images.map((image) => (
            <TouchableOpacity
              key={image.id}
              style={{ width: slideWidth, height: slideHeight, backgroundColor: '#0f172a' }}
              onPress={() => onImagePress?.(image)}
              activeOpacity={0.95}
            >
              <Image
                source={image.source}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
                transition={0}
                placeholderContentFit="cover"
              />
              {hero ? <View style={styles.heroShade} pointerEvents="none" /> : null}
              {hero ? null : (
                <View style={styles.overlay}>
                  <View style={styles.textContainer}>
                    <Text style={styles.imageTitle}>{image.title}</Text>
                    <Text style={styles.imageDescription}>{image.description}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {hero ? (
          <>
            <View style={styles.heroCopy} pointerEvents="none">
              {title ? <Text style={styles.heroTitle}>{title}</Text> : null}
              {subtitle ? <Text style={styles.heroTitle}>{subtitle}</Text> : null}
              {images[currentIndex]?.title ? (
                <Text style={styles.heroSlide} numberOfLines={1}>
                  {images[currentIndex].title}
                </Text>
              ) : null}
            </View>
            <View style={styles.heroBottom} pointerEvents="box-none">
              <View style={styles.heroDots}>
                {images.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => goToSlide(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    style={[styles.heroDot, index === currentIndex && styles.heroDotActive]}
                  />
                ))}
              </View>
              {overlay}
            </View>
          </>
        ) : null}
      </View>

      {hero ? null : (
        <View style={styles.dotsContainer}>
          {images.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.dot, index === currentIndex && styles.activeDot]}
              onPress={() => goToSlide(index)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  heroContainer: {
    backgroundColor: '#0f172a',
  },
  heroFrame: {
    height: HERO_HEIGHT,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroCopy: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  heroSlide: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.82)',
  },
  heroBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroDot: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  heroDotActive: {
    width: 16,
    backgroundColor: '#fff',
  },
  container: {
    marginVertical: 20,
    marginHorizontal: CAROUSEL_SIDE_MARGIN,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 0,
    marginBottom: 15,
  },
  carouselContainer: {
    position: 'relative',
    borderRadius: 0,
    overflow: 'hidden',
  },
  scrollView: {
    height: 250,
  },
  slide: {
    width: SLIDE_WIDTH,
    height: 250,
    position: 'relative',
    backgroundColor: '#e8eef4',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e8eef4',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 20,
  },
  textContainer: {
    alignItems: 'center',
  },
  imageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
  },
  imageDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 0,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#2E7D32',
    width: 12,
  },
});

export default ImageCarousel;
