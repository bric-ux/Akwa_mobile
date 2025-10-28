import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategorizedPhoto } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoCategoryDisplayProps {
  photos: CategorizedPhoto[];
  propertyTitle: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  chambre: '🛏️ Chambre',
  salle_de_bain: '🚿 Salle de bain',
  cuisine: '🍳 Cuisine',
  jardin: '🌳 Jardin',
  salon: '🛋️ Salon',
  exterieur: '🏡 Extérieur',
  terrasse: '☀️ Terrasse',
  balcon: '🪴 Balcon',
  salle_a_manger: '🍽️ Salle à manger',
  cave: '🍷 Cave',
  toilette: '🚽 Toilette',
  buanderie: '🧺 Buanderie',
  wc: '🚾 WC',
  piscine: '🏊 Piscine',
  autre: '📷 Autre'
};

const CATEGORY_COLORS: Record<string, string> = {
  chambre: '#3b82f6',
  salle_de_bain: '#06b6d4',
  cuisine: '#f97316',
  jardin: '#22c55e',
  salon: '#8b5cf6',
  exterieur: '#eab308',
  terrasse: '#f59e0b',
  balcon: '#14b8a6',
  salle_a_manger: '#ec4899',
  cave: '#6366f1',
  toilette: '#0ea5e9',
  buanderie: '#8b5cf6',
  wc: '#64748b',
  piscine: '#60a5fa',
  autre: '#6b7280'
};

const PhotoCategoryDisplay: React.FC<PhotoCategoryDisplayProps> = ({ photos, propertyTitle }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  // Grouper les photos par catégorie
  const photosByCategory = photos.reduce((acc, photo) => {
    if (!acc[photo.category]) {
      acc[photo.category] = [];
    }
    acc[photo.category].push(photo);
    return acc;
  }, {} as Record<string, CategorizedPhoto[]>);

  // Trier les photos dans chaque catégorie par displayOrder
  Object.keys(photosByCategory).forEach(category => {
    photosByCategory[category].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  });

  const categories = Object.keys(photosByCategory).sort();

  const openLightbox = (category: string, index: number) => {
    setSelectedCategory(category);
    setCurrentPhotoIndex(index);
    setShowLightbox(true);
  };

  const closeLightbox = () => {
    setShowLightbox(false);
    setSelectedCategory(null);
    setCurrentPhotoIndex(0);
  };

  const nextPhoto = () => {
    if (!selectedCategory) return;
    const categoryPhotos = photosByCategory[selectedCategory];
    setCurrentPhotoIndex((prev) => (prev + 1) % categoryPhotos.length);
  };

  const prevPhoto = () => {
    if (!selectedCategory) return;
    const categoryPhotos = photosByCategory[selectedCategory];
    setCurrentPhotoIndex((prev) => prev === 0 ? categoryPhotos.length - 1 : prev - 1);
  };

  if (photos.length === 0) {
    return (
      <View style={styles.noPhotosContainer}>
        <Ionicons name="image-outline" size={48} color="#9ca3af" />
        <Text style={styles.noPhotosText}>Aucune photo disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* En-tête avec titre */}
      <View style={styles.header}>
        <Text style={styles.title}>Photos de {propertyTitle}</Text>
        <Text style={styles.subtitle}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
      </View>

      {/* Onglets des catégories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryTab,
              { backgroundColor: CATEGORY_COLORS[category] }
            ]}
            onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
          >
            <Text style={styles.categoryTabText}>
              {CATEGORY_LABELS[category]}
            </Text>
            <Text style={styles.categoryCount}>
              {photosByCategory[category].length}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grille des photos */}
      <ScrollView style={styles.photosContainer}>
        {selectedCategory ? (
          // Afficher les photos de la catégorie sélectionnée
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {CATEGORY_LABELS[selectedCategory]} ({photosByCategory[selectedCategory].length})
            </Text>
            <View style={styles.photoGrid}>
              {photosByCategory[selectedCategory].map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => openLightbox(selectedCategory, index)}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          // Afficher toutes les photos groupées par catégorie
          <View style={styles.allPhotosContainer}>
            {categories.map((category) => (
              <View key={category} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>
                    {CATEGORY_LABELS[category]}
                  </Text>
                  <Text style={styles.categorySubtitle}>
                    {photosByCategory[category].length} photo{photosByCategory[category].length > 1 ? 's' : ''}
                  </Text>
                </View>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryPhotosScroll}
                >
                  {photosByCategory[category].map((photo, index) => (
                    <TouchableOpacity
                      key={photo.id}
                      style={styles.categoryPhotoItem}
                      onPress={() => openLightbox(category, index)}
                    >
                      <Image
                        source={{ uri: photo.url }}
                        style={styles.categoryPhotoImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Lightbox */}
      <Modal
        visible={showLightbox}
        transparent={true}
        animationType="fade"
        onRequestClose={closeLightbox}
      >
        <SafeAreaView style={styles.lightboxContainer}>
          <View style={styles.lightboxHeader}>
            <TouchableOpacity onPress={closeLightbox} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.lightboxTitle}>
              {selectedCategory && CATEGORY_LABELS[selectedCategory]}
            </Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.lightboxContent}>
            {selectedCategory && (
              <Image
                source={{ uri: photosByCategory[selectedCategory][currentPhotoIndex].url }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.lightboxFooter}>
            <TouchableOpacity onPress={prevPhoto} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.photoCounter}>
              {currentPhotoIndex + 1} / {selectedCategory ? photosByCategory[selectedCategory].length : 0}
            </Text>
            
            <TouchableOpacity onPress={nextPhoto} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  categoryTabs: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  categoryCount: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  photosContainer: {
    flex: 1,
  },
  allPhotosContainer: {
    padding: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  categoryPhotosScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryPhotoItem: {
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  categoryPhotoImage: {
    width: 120,
    height: 120,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoItem: {
    width: (screenWidth - 48) / 2,
    height: (screenWidth - 48) / 2,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  noPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPhotosText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  // Lightbox styles
  lightboxContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    padding: 8,
  },
  lightboxTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  lightboxContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  lightboxFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  navButton: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
  },
  photoCounter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PhotoCategoryDisplay;





