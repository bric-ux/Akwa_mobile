import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export const InfoBanner: React.FC = () => {
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation de défilement continue
    const startAnimation = () => {
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: -width * 1.2, // Ajuster selon la nouvelle largeur
          duration: 20000, // Ralentir l'animation (20 secondes au lieu de 15)
          useNativeDriver: true,
        })
      ).start();
    };

    startAnimation();
  }, [scrollX]);

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Animated.View
          style={[
            styles.scrollContent,
            {
              transform: [{ translateX: scrollX }],
            },
          ]}
        >
          {/* Premier passage */}
          <View style={styles.contentRow}>
            <View style={styles.iconTextContainer}>
              <Ionicons name="sparkles" size={14} color="#F97316" />
              <Text style={styles.highlightText}>Nouveautés</Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <Ionicons name="notifications" size={14} color="#22C55E" />
                <Text style={styles.featureText}>Conciergerie</Text>
              </View>
              
              <View style={styles.featureSeparator} />
              
              <View style={styles.featureItem}>
                <Ionicons name="car" size={14} color="#F97316" />
                <Text style={styles.featureText}>Véhicules</Text>
              </View>
            </View>
            
            <View style={styles.separator} />
            
            <Text style={styles.comingSoonText}>
              Bientôt disponible
            </Text>
          </View>

          {/* Deuxième passage (pour l'effet de continuité) */}
          <View style={styles.contentRow}>
            <View style={styles.iconTextContainer}>
              <Ionicons name="sparkles" size={14} color="#F97316" />
              <Text style={styles.highlightText}>Nouveautés</Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <Ionicons name="notifications" size={14} color="#22C55E" />
                <Text style={styles.featureText}>Conciergerie</Text>
              </View>
              
              <View style={styles.featureSeparator} />
              
              <View style={styles.featureItem}>
                <Ionicons name="car" size={14} color="#F97316" />
                <Text style={styles.featureText}>Véhicules</Text>
              </View>
            </View>
            
            <View style={styles.separator} />
            
            <Text style={styles.comingSoonText}>
              Bientôt disponible
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)', // orange-primary/10
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(249, 115, 22, 0.2)', // orange-primary/20
    overflow: 'hidden',
    marginTop: 0, // Supprimer la marge en haut
  },
  banner: {
    height: 40,
    justifyContent: 'center',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: width * 1.2, // Augmenter la largeur pour éviter le chevauchement
    paddingHorizontal: 15,
    justifyContent: 'space-around', // Utiliser space-around au lieu de space-between
  },
  iconTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F97316', // orange-primary
    marginLeft: 6,
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(249, 115, 22, 0.3)',
    marginHorizontal: 12,
  },
  featuresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 12,
    color: '#6B7280', // muted-foreground
    marginLeft: 6,
  },
  featureSeparator: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    marginHorizontal: 16,
  },
  comingSoonText: {
    fontSize: 10,
    color: '#6B7280', // muted-foreground
    fontWeight: '600',
    flexShrink: 0,
  },
});
