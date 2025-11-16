import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ModeTransitionRouteProp = RouteProp<RootStackParamList, 'ModeTransition'>;

const { width, height } = Dimensions.get('window');

const ModeTransitionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ModeTransitionRouteProp>();
  const { targetMode = 'host', targetPath = 'HostSpace', fromMode = 'traveler' } = route.params || {};
  
  useEffect(() => {
    console.log('🟡 [ModeTransitionScreen] Page de transition montée avec params:', {
      targetMode,
      targetPath,
      fromMode,
      allParams: route.params,
    });
    return () => {
      console.log('🔴 [ModeTransitionScreen] Page de transition démontée');
    };
  }, [targetMode, targetPath, fromMode, route.params]);

  const [animationStage, setAnimationStage] = useState(0);
  const fadeAnim = useState(new Animated.Value(1))[0];
  const scaleAnim = useState(new Animated.Value(1))[0];
  const nextFadeAnim = useState(new Animated.Value(0))[0];
  const nextScaleAnim = useState(new Animated.Value(0.9))[0];
  const progressAnim = useState(new Animated.Value(0))[0];
  const arrowOpacity = useState(new Animated.Value(0))[0];

  const isToHost = targetMode === 'host';
  const currentColor = isToHost ? '#2563eb' : '#e67e22';
  const nextColor = isToHost ? '#e67e22' : '#2563eb';
  const currentIcon = isToHost ? 'airplane-outline' : 'home-outline';
  const nextIcon = isToHost ? 'home-outline' : 'airplane-outline';
  const currentText = isToHost ? 'Mode Voyageur' : 'Mode Hôte';
  const nextText = isToHost ? 'Mode Hôte' : 'Mode Voyageur';

  useEffect(() => {
    // Animation en 3 étapes
    const stages = [
      () => {
        // Étape 1: Fade out du mode actuel
        setAnimationStage(1);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      },
      () => {
        // Étape 2: Transition (flèche apparaît)
        setAnimationStage(2);
        Animated.timing(arrowOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      },
      () => {
        // Étape 3: Fade in du nouveau mode
        setAnimationStage(3);
        Animated.parallel([
          Animated.timing(nextFadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(nextScaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      },
    ];

    // Animation de la barre de progression
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        stages[currentStage]();
        currentStage++;
      } else {
        clearInterval(interval);
        // Navigation après l'animation
        setTimeout(async () => {
          // Sauvegarder le mode préféré
          if (targetMode === 'host') {
            await AsyncStorage.setItem('preferredMode', 'host');
          } else {
            await AsyncStorage.setItem('preferredMode', 'traveler');
          }

          // Naviguer vers la destination
          if (targetPath === 'HostSpace') {
            navigation.reset({
              index: 0,
              routes: [{ name: 'HostSpace' }],
            });
          } else if (targetPath === 'BecomeHost') {
            // Si la destination est BecomeHost, naviguer directement sans reset
            navigation.navigate('BecomeHost' as never);
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }, 500);
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Particules animées en arrière-plan */}
      <View style={styles.particlesContainer}>
        {[...Array(20)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.particle,
              {
                backgroundColor: currentColor,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: Math.random() * 100 + 50,
                height: Math.random() * 100 + 50,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        {/* Mode actuel - Fade out */}
        <Animated.View
          style={[
            styles.modeContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-40, 0],
              }) }],
            },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${currentColor}15`,
                borderColor: `${currentColor}40`,
              },
            ]}
          >
            <Ionicons name={currentIcon as any} size={64} color={currentColor} />
          </View>
          <Text style={[styles.modeText, { color: currentColor }]}>
            {currentText}
          </Text>
        </Animated.View>

        {/* Flèche animée */}
        <Animated.View
          style={[
            styles.arrowContainer,
            {
              opacity: arrowOpacity,
            },
          ]}
        >
          <Ionicons
            name="arrow-forward"
            size={32}
            color={nextColor}
            style={styles.arrow}
          />
        </Animated.View>

        {/* Mode suivant - Fade in */}
        <Animated.View
          style={[
            styles.modeContainer,
            {
              opacity: nextFadeAnim,
              transform: [
                { scale: nextScaleAnim },
                {
                  translateY: nextFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              styles.nextIconContainer,
              {
                backgroundColor: `${nextColor}15`,
                borderColor: nextColor,
              },
            ]}
          >
            <Ionicons name={nextIcon as any} size={64} color={nextColor} />
          </View>
          <Text style={[styles.modeText, { color: nextColor }]}>
            {nextText}
          </Text>
        </Animated.View>

        {/* Loader */}
        {animationStage < 3 && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={nextColor} />
          </View>
        )}

        {/* Message */}
        <Text style={styles.message}>
          {animationStage < 2
            ? 'Changement de mode en cours...'
            : 'Chargement de votre espace...'}
        </Text>
      </View>

      {/* Barre de progression */}
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: nextColor,
            },
          ]}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modeContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    marginBottom: 16,
  },
  nextIconContainer: {
    // Animation pulse pour le prochain mode
  },
  modeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  arrowContainer: {
    marginVertical: 20,
  },
  arrow: {
    // Animation pulse
  },
  loaderContainer: {
    marginTop: 32,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    maxWidth: width - 40,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#e9ecef',
  },
  progressBar: {
    height: '100%',
  },
});

export default ModeTransitionScreen;

