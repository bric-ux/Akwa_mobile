import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../constants/homeExploreLayout';

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
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  onImagePress,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SLIDE_WIDTH);
    setCurrentIndex(index);
  };

  const goToSlide = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * SLIDE_WIDTH,
      animated: true,
    });
  };

  // Défilement automatique toutes les 2 secondes
  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % images.length;
      goToSlide(nextIndex);
    }, 2000);

    return () => clearInterval(interval);
  }, [currentIndex, images.length]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Explorez les trésors de la Côte d'Ivoire</Text>

      <View style={styles.carouselContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {images.map((image) => (
            <TouchableOpacity
              key={image.id}
              style={styles.slide}
              onPress={() => onImagePress?.(image)}
              activeOpacity={0.9}
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

              <View style={styles.overlay}>
                <View style={styles.textContainer}>
                  <Text style={styles.imageTitle}>{image.title}</Text>
                  <Text style={styles.imageDescription}>{image.description}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.dotsContainer}>
        {images.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.activeDot,
            ]}
            onPress={() => goToSlide(index)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
