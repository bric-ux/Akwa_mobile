import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';

interface Announcement {
  icon: string;
  label: string;
  color: string;
  accentColor: string;
  action: () => void;
}

const CAROUSEL_MAX_HEIGHT = 72;

type InfoBannerProps = {
  /** Bandeau défilant Conciergerie / Véhicules (masqué au scroll vers le bas sur Explorer). */
  showCarousel?: boolean;
};

export const InfoBanner: React.FC<InfoBannerProps> = ({ showCarousel = true }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const carouselCollapse = useRef(new Animated.Value(1)).current;

  const goToBecomeHost = () => {
    if (user) {
      navigation.navigate('BecomeHost' as never);
    } else {
      navigation.navigate('Auth' as never, { returnTo: 'BecomeHost' } as never);
    }
  };

  const announcements: Announcement[] = useMemo(
    () => [
      {
        icon: 'sparkles',
        label: 'Conciergerie',
        color: '#10b981',
        accentColor: 'rgba(16, 185, 129, 0.1)',
        action: () => navigation.navigate('Conciergerie' as never),
      },
      {
        icon: 'car-sport',
        label: 'Véhicules',
        color: '#3b82f6',
        accentColor: 'rgba(59, 130, 246, 0.1)',
        action: () => navigation.navigate('Vehicles' as never),
      },
    ],
    [navigation],
  );

  useEffect(() => {
    Animated.timing(carouselCollapse, {
      toValue: showCarousel ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [showCarousel, carouselCollapse]);

  useEffect(() => {
    if (!showCarousel) return;

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: -20,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [announcements.length, scaleAnim, translateX, showCarousel]);

  const current = announcements[currentIndex];

  const carouselMaxHeight = carouselCollapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CAROUSEL_MAX_HEIGHT],
  });
  const carouselOpacity = carouselCollapse;

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={{
          maxHeight: carouselMaxHeight,
          opacity: carouselOpacity,
          overflow: 'hidden',
        }}
        pointerEvents={showCarousel ? 'auto' : 'none'}
      >
      <View style={styles.container}>
      <TouchableOpacity
        onPress={current.action}
        activeOpacity={0.85}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ translateX }, { scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: current.accentColor }]}>
            <Ionicons name={current.icon as any} size={16} color={current.color} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.label} numberOfLines={1}>
              {current.label}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Nouveau</Text>
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={14}
            color="rgba(255, 255, 255, 0.4)"
            style={styles.arrow}
          />
        </Animated.View>
      </TouchableOpacity>

      <View style={styles.indicators}>
        {announcements.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => {
              setCurrentIndex(index);
              translateX.setValue(0);
              scaleAnim.setValue(1);
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.indicator,
                index === currentIndex && [
                  styles.indicatorActive,
                  { backgroundColor: current.color },
                ],
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
      </View>
      </Animated.View>

      <TouchableOpacity
        onPress={goToBecomeHost}
        activeOpacity={0.85}
        style={styles.hostBanner}
      >
        <View style={[styles.hostIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
          <Ionicons name="home" size={16} color="#10b981" />
        </View>
        <Text style={styles.hostBannerText}>
          Ajouter une résidence sur AkwaHome{' '}
          <Text style={styles.hostBannerLink}>en cliquant ici</Text>
        </Text>
        <Ionicons name="chevron-forward" size={14} color="rgba(255, 255, 255, 0.4)" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#0a0e1a',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  container: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  hostIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  hostBannerLink: {
    color: '#6ee7b7',
    textDecorationLine: 'underline',
  },
  touchable: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  badge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  badgeText: {
    color: '#f97316',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  arrow: {
    marginLeft: 'auto',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  indicator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  indicatorActive: {
    width: 16,
    borderRadius: 1.5,
  },
});
