import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface Announcement {
  icon: string;
  label: string;
  color: string;
  accentColor: string;
  action: () => void;
}

export const InfoBanner: React.FC = () => {
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const announcements: Announcement[] = [
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
  ];

  useEffect(() => {
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
  }, [currentIndex, announcements.length]);

  const current = announcements[currentIndex];

  return (
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
              transform: [
                { translateX },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Icon with glow effect */}
          <View style={[styles.iconContainer, { backgroundColor: current.accentColor }]}>
            <Ionicons name={current.icon as any} size={16} color={current.color} />
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={styles.label}>{current.label}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Nouveau</Text>
            </View>
          </View>

          {/* Arrow */}
          <Ionicons
            name="chevron-forward"
            size={14}
            color="rgba(255, 255, 255, 0.4)"
            style={styles.arrow}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Minimal indicators */}
      <View style={styles.indicators}>
        {announcements.map((_, index) => (
          <TouchableOpacity
            key={index}
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
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0e1a',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
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
