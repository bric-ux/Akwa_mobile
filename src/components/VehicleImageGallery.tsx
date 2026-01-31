import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VehiclePhoto {
  id: string;
  url: string;
  category?: string;
  is_main?: boolean;
  display_order?: number;
}

interface VehicleImageGalleryProps {
  images: string[];
  photos?: VehiclePhoto[];
  vehicleTitle: string;
  style?: any;
}

const CATEGORY_LABELS: Record<string, string> = {
  exterior: 'Extérieur',
  interior: 'Intérieur',
  engine: 'Moteur',
  dashboard: 'Tableau de bord',
  seats: 'Sièges',
  trunk: 'Coffre',
  wheels: 'Roues',
  other: 'Autre',
};

const VehicleImageGallery: React.FC<VehicleImageGalleryProps> = ({
  images,
  photos,
  vehicleTitle,
  style,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Utiliser les photos avec catégories si disponibles, sinon utiliser les images
  const allPhotos: VehiclePhoto[] = photos || images.map((url, index) => ({
    id: `img-${index}`,
    url,
    category: 'other',
    is_main: index === 0,
    display_order: index,
  }));

  // Trier les photos: principale d'abord, puis par ordre
  const sortedPhotos = [...allPhotos].sort((a, b) => {
    if (a.is_main && !b.is_main) return -1;
    if (!a.is_main && b.is_main) return 1;
    return (a.display_order || 0) - (b.display_order || 0);
  });

  // Filtrer par catégorie si active
  const displayedPhotos = activeCategory
    ? sortedPhotos.filter(p => p.category === activeCategory)
    : sortedPhotos;

  // Obtenir les catégories uniques
  const categories = [...new Set(allPhotos.map(p => p.category).filter(Boolean))];

  const handlePrev = () => {
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : displayedPhotos.length - 1));
  };

  const handleNext = () => {
    setSelectedIndex(prev => (prev < displayedPhotos.length - 1 ? prev + 1 : 0));
  };

  if (sortedPhotos.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Ionicons name="car-outline" size={96} color="#ccc" />
      </View>
    );
  }

  const mainPhoto = displayedPhotos[selectedIndex] || displayedPhotos[0];

  return (
    <View style={[styles.container, style]}>
      {/* Image principale */}
      <TouchableOpacity
        style={styles.mainImageContainer}
        onPress={() => setIsLightboxOpen(true)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: mainPhoto?.url }}
          style={styles.mainImage}
          resizeMode="cover"
        />
        
        {/* Badge catégorie */}
        {mainPhoto?.category && mainPhoto.category !== 'other' && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {CATEGORY_LABELS[mainPhoto.category] || mainPhoto.category}
            </Text>
          </View>
        )}

        {/* Navigation */}
        {displayedPhotos.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonLeft]}
              onPress={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonRight]}
              onPress={(e) => {
                e.stopPropagation();
                handleNext();
              }}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {/* Compteur */}
        <View style={styles.counter}>
          <Ionicons name="images-outline" size={16} color="#fff" />
          <Text style={styles.counterText}>
            {selectedIndex + 1} / {displayedPhotos.length}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Filtres par catégorie */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilters}
          contentContainerStyle={styles.categoryFiltersContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryFilter,
              activeCategory === null && styles.categoryFilterActive,
            ]}
            onPress={() => {
              setActiveCategory(null);
              setSelectedIndex(0);
            }}
          >
            <Text
              style={[
                styles.categoryFilterText,
                activeCategory === null && styles.categoryFilterTextActive,
              ]}
            >
              Toutes ({allPhotos.length})
            </Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryFilter,
                activeCategory === cat && styles.categoryFilterActive,
              ]}
              onPress={() => {
                setActiveCategory(cat || null);
                setSelectedIndex(0);
              }}
            >
              <Text
                style={[
                  styles.categoryFilterText,
                  activeCategory === cat && styles.categoryFilterTextActive,
                ]}
              >
                {CATEGORY_LABELS[cat!] || cat} ({allPhotos.filter(p => p.category === cat).length})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Thumbnails */}
      {displayedPhotos.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnails}
          contentContainerStyle={styles.thumbnailsContent}
        >
          {displayedPhotos.map((photo, index) => (
            <TouchableOpacity
              key={photo.id}
              onPress={() => setSelectedIndex(index)}
              style={[
                styles.thumbnail,
                index === selectedIndex && styles.thumbnailActive,
              ]}
            >
              <Image
                source={{ uri: photo.url }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Lightbox Modal */}
      <Modal
        visible={isLightboxOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLightboxOpen(false)}
      >
        <SafeAreaView style={styles.lightboxContainer}>
          <View style={styles.lightboxHeader}>
            <Text style={styles.lightboxTitle} numberOfLines={1}>
              {vehicleTitle}
            </Text>
            <TouchableOpacity
              style={styles.lightboxCloseButton}
              onPress={() => setIsLightboxOpen(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.lightboxImageContainer}>
            <Image
              source={{ uri: displayedPhotos[selectedIndex]?.url }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />

            {displayedPhotos.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.lightboxNavButton, styles.lightboxNavButtonLeft]}
                  onPress={handlePrev}
                >
                  <Ionicons name="chevron-back" size={32} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.lightboxNavButton, styles.lightboxNavButtonRight]}
                  onPress={handleNext}
                >
                  <Ionicons name="chevron-forward" size={32} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.lightboxFooter}>
            <View style={styles.lightboxCounter}>
              <Text style={styles.lightboxCounterText}>
                {selectedIndex + 1} / {displayedPhotos.length}
              </Text>
            </View>

            {displayedPhotos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.lightboxThumbnails}
                contentContainerStyle={styles.lightboxThumbnailsContent}
              >
                {displayedPhotos.map((photo, index) => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => setSelectedIndex(index)}
                    style={[
                      styles.lightboxThumbnail,
                      index === selectedIndex && styles.lightboxThumbnailActive,
                    ]}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.lightboxThumbnailImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  emptyContainer: {
    height: 400,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImageContainer: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  navButtonLeft: {
    left: 16,
  },
  navButtonRight: {
    right: 16,
  },
  counter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryFilters: {
    marginTop: 8,
  },
  categoryFiltersContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryFilterActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  categoryFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  categoryFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  thumbnails: {
    marginTop: 8,
  },
  thumbnailsContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#1e293b',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  lightboxTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 16,
  },
  lightboxCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  lightboxImage: {
    width: SCREEN_WIDTH - 32,
    height: '70%',
    maxHeight: 600,
  },
  lightboxNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  lightboxNavButtonLeft: {
    left: 16,
  },
  lightboxNavButtonRight: {
    right: 16,
  },
  lightboxFooter: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  lightboxCounter: {
    alignItems: 'center',
    marginBottom: 12,
  },
  lightboxCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  lightboxThumbnails: {
    marginTop: 8,
  },
  lightboxThumbnailsContent: {
    gap: 6,
    justifyContent: 'center',
  },
  lightboxThumbnail: {
    width: 48,
    height: 32,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.6,
  },
  lightboxThumbnailActive: {
    borderColor: '#fff',
    opacity: 1,
  },
  lightboxThumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

export default VehicleImageGallery;



















