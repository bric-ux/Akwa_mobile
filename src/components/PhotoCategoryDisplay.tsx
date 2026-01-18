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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategorizedPhoto } from '../types';
import { supabase } from '../services/supabase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoCategoryDisplayProps {
  photos: CategorizedPhoto[];
  propertyTitle: string;
  propertyId?: string;
  onPhotoUpdate?: () => void;
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

const PhotoCategoryDisplay: React.FC<PhotoCategoryDisplayProps> = ({ photos, propertyTitle, propertyId, onPhotoUpdate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'category'>('grid');
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  
  // Limiter l'affichage initial à 7 photos en vue grille
  const MAX_PHOTOS_GRID = 7;

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
  
  // Toutes les photos triées par display_order pour la vue grille
  const allPhotosFlat = photos.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  
  // Photos limitées pour la vue grille (7 premières)
  const limitedPhotosGrid = allPhotosFlat.slice(0, MAX_PHOTOS_GRID);
  const hasMorePhotosGrid = photos.length > MAX_PHOTOS_GRID;

  const openLightbox = (category: string, index: number) => {
    setSelectedCategory(category);
    setCurrentPhotoIndex(index);
    setShowLightbox(true);
  };
  
  const openFullGallery = (startIndex: number = 0) => {
    setCurrentPhotoIndex(startIndex);
    setShowFullGallery(true);
  };
  
  const closeFullGallery = () => {
    setShowFullGallery(false);
    setCurrentPhotoIndex(0);
  };
  
  const nextPhotoInGallery = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % allPhotosFlat.length);
  };
  
  const prevPhotoInGallery = () => {
    setCurrentPhotoIndex((prev) => prev === 0 ? allPhotosFlat.length - 1 : prev - 1);
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
      {/* En-tête avec titre et toggle de vue */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              Photos de {propertyTitle}
            </Text>
            <Text style={styles.subtitle}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
          </View>
        </View>
        {/* Toggle vue grille / catégorie - en dessous du titre */}
        <View style={styles.viewModeToggleContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
            onPress={() => {
              console.log('Switching to grid mode');
              setViewMode('grid');
              setSelectedCategory(null);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={18} color={viewMode === 'grid' ? '#fff' : '#666'} />
            <Text style={[styles.viewModeText, viewMode === 'grid' && styles.viewModeTextActive]}>
              Grille
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'category' && styles.viewModeButtonActive]}
            onPress={() => {
              console.log('Switching to category mode');
              setViewMode('category');
              setSelectedCategory(null);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="apps-outline" size={18} color={viewMode === 'category' ? '#fff' : '#666'} />
            <Text style={[styles.viewModeText, viewMode === 'category' && styles.viewModeTextActive]}>
              Catégories
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Onglets des catégories - seulement en mode catégorie */}
      {viewMode === 'category' && (
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
      )}

      {/* Grille des photos */}
      <ScrollView style={styles.photosContainer} key={`photos-${viewMode}`}>
        {viewMode === 'grid' ? (
          // Vue grille : afficher les 7 premières photos
          <View style={styles.gridContainer}>
            {limitedPhotosGrid.length === 0 ? (
              <View style={styles.noPhotosContainer}>
                <Ionicons name="image-outline" size={48} color="#9ca3af" />
                <Text style={styles.noPhotosText}>Aucune photo disponible</Text>
              </View>
            ) : (
              <View style={styles.photoGrid}>
                {limitedPhotosGrid.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => {
                    const photoIndex = allPhotosFlat.findIndex(p => p.id === photo.id);
                    openFullGallery(photoIndex >= 0 ? photoIndex : index);
                  }}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  {/* Badge catégorie */}
                  <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[photo.category] }]}>
                    <Text style={styles.categoryBadgeText}>
                      {CATEGORY_LABELS[photo.category]}
                    </Text>
                  </View>
                  {/* Bouton pour définir comme principale */}
                  {propertyId && !(photo.is_main || photo.isMain) && (
                    <TouchableOpacity
                      style={styles.setMainButton}
                      onPress={async (e) => {
                        e.stopPropagation();
                        try {
                          await supabase
                            .from('property_photos')
                            .update({ is_main: false })
                            .eq('property_id', propertyId)
                            .eq('is_main', true);
                          
                          const { error } = await supabase
                            .from('property_photos')
                            .update({ is_main: true })
                            .eq('id', photo.id);
                          
                          if (error) throw error;
                          
                          Alert.alert(
                            'Photo principale définie',
                            'Cette photo sera maintenant affichée en couverture.',
                            [{ text: 'OK' }]
                          );
                          
                          if (onPhotoUpdate) {
                            onPhotoUpdate();
                          }
                        } catch (error: any) {
                          console.error('Erreur lors de la définition de la photo principale:', error);
                          Alert.alert(
                            'Erreur',
                            'Impossible de définir la photo principale.',
                            [{ text: 'OK' }]
                          );
                        }
                      }}
                    >
                      <Ionicons name="star-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                ))}
              </View>
            )}
            
            {/* Bouton "Voir plus" */}
            {hasMorePhotosGrid && (
              <TouchableOpacity
                style={styles.viewMoreButton}
                onPress={() => setShowAllPhotos(true)}
              >
                <Ionicons name="images-outline" size={20} color="#e67e22" />
                <Text style={styles.viewMoreButtonText}>
                  Voir plus ({photos.length - MAX_PHOTOS_GRID} autres photos)
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#e67e22" />
              </TouchableOpacity>
            )}
          </View>
        ) : viewMode === 'category' && selectedCategory ? (
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
                  {/* Bouton pour définir comme principale */}
                  {propertyId && !(photo.is_main || photo.isMain) && (
                    <TouchableOpacity
                      style={styles.setMainButton}
                      onPress={async (e) => {
                        e.stopPropagation();
                        try {
                          // Désactiver toutes les autres photos principales
                          await supabase
                            .from('property_photos')
                            .update({ is_main: false })
                            .eq('property_id', propertyId)
                            .eq('is_main', true);
                          
                          // Définir cette photo comme principale
                          const { error } = await supabase
                            .from('property_photos')
                            .update({ is_main: true })
                            .eq('id', photo.id);
                          
                          if (error) throw error;
                          
                          Alert.alert(
                            'Photo principale définie',
                            'Cette photo sera maintenant affichée en couverture.',
                            [{ text: 'OK' }]
                          );
                          
                          if (onPhotoUpdate) {
                            onPhotoUpdate();
                          }
                        } catch (error: any) {
                          console.error('Erreur lors de la définition de la photo principale:', error);
                          Alert.alert(
                            'Erreur',
                            'Impossible de définir la photo principale.',
                            [{ text: 'OK' }]
                          );
                        }
                      }}
                    >
                      <Ionicons name="star-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          // Vue par catégorie : afficher toutes les photos groupées par catégorie
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
                  {/* Bouton pour définir comme principale */}
                  {propertyId && !(photo.is_main || photo.isMain) && (
                        <TouchableOpacity
                          style={styles.setMainButton}
                          onPress={async (e) => {
                            e.stopPropagation();
                            try {
                              await supabase
                                .from('property_photos')
                                .update({ is_main: false })
                                .eq('property_id', propertyId)
                                .eq('is_main', true);
                              
                              const { error } = await supabase
                                .from('property_photos')
                                .update({ is_main: true })
                                .eq('id', photo.id);
                              
                              if (error) throw error;
                              
                              Alert.alert(
                                'Photo principale définie',
                                'Cette photo sera maintenant affichée en couverture.',
                                [{ text: 'OK' }]
                              );
                              
                              if (onPhotoUpdate) {
                                onPhotoUpdate();
                              }
                            } catch (error: any) {
                              console.error('Erreur lors de la définition de la photo principale:', error);
                              Alert.alert(
                                'Erreur',
                                'Impossible de définir la photo principale.',
                                [{ text: 'OK' }]
                              );
                            }
                          }}
                        >
                          <Ionicons name="star-outline" size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
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

      {/* Modal "Voir plus" - Vue grille complète */}
      {showAllPhotos && (
        <Modal
          visible={showAllPhotos}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAllPhotos(false)}
        >
          <SafeAreaView style={styles.fullGalleryContainer}>
            <View style={styles.fullGalleryHeader}>
              <TouchableOpacity onPress={() => setShowAllPhotos(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.fullGalleryTitle}>Toutes les photos</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.fullGalleryGridContainer}>
              <View style={styles.fullGalleryGrid}>
                {allPhotosFlat.map((photo, index) => (
                  <TouchableOpacity
                    key={photo.id}
                    style={styles.fullGalleryGridItem}
                    onPress={() => {
                      setShowAllPhotos(false);
                      openFullGallery(index);
                    }}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.fullGalleryGridImage}
                      resizeMode="cover"
                    />
                    <View style={[styles.categoryBadgeSmall, { backgroundColor: CATEGORY_COLORS[photo.category] }]}>
                      <Text style={styles.categoryBadgeSmallText}>
                        {CATEGORY_LABELS[photo.category]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Modal Galerie complète */}
      <Modal
        visible={showFullGallery}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFullGallery}
      >
        <SafeAreaView style={styles.fullGalleryContainer}>
          <View style={styles.fullGalleryHeader}>
            <TouchableOpacity onPress={closeFullGallery} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullGalleryTitle}>
              {allPhotosFlat[currentPhotoIndex]?.category 
                ? CATEGORY_LABELS[allPhotosFlat[currentPhotoIndex].category] 
                : 'Toutes les photos'}
            </Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.fullGalleryContent}>
            {allPhotosFlat.length > 0 && (
              <Image
                source={{ uri: allPhotosFlat[currentPhotoIndex].url }}
                style={styles.fullGalleryImage}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.fullGalleryFooter}>
            <TouchableOpacity onPress={prevPhotoInGallery} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.photoCounter}>
              {currentPhotoIndex + 1} / {allPhotosFlat.length}
            </Text>
            
            <TouchableOpacity onPress={nextPhotoInGallery} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Miniatures en bas */}
          {allPhotosFlat.length > 1 && allPhotosFlat.length <= 20 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.thumbnailsContainer}
              contentContainerStyle={styles.thumbnailsContent}
            >
              {allPhotosFlat.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id || index}
                  onPress={() => setCurrentPhotoIndex(index)}
                  style={[
                    styles.thumbnail,
                    index === currentPhotoIndex && styles.thumbnailActive
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
  headerTop: {
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 0,
    maxWidth: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  viewModeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  viewModeButtonActive: {
    backgroundColor: '#e67e22',
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  viewModeTextActive: {
    color: '#fff',
  },
  gridContainer: {
    padding: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  categoryBadgeSmall: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeSmallText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e67e22',
    borderStyle: 'dashed',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  viewMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e67e22',
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
  mainPhotoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  mainPhotoBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },
  setMainButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#e67e22',
    padding: 6,
    borderRadius: 20,
    opacity: 0.9,
  },
  fullGalleryGridContainer: {
    flex: 1,
    padding: 16,
  },
  fullGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  fullGalleryGridItem: {
    width: (screenWidth - 48) / 3,
    height: (screenWidth - 48) / 3,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fullGalleryGridImage: {
    width: '100%',
    height: '100%',
  },
  // Full Gallery styles
  fullGalleryContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullGalleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  fullGalleryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  fullGalleryContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullGalleryImage: {
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  fullGalleryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  thumbnailsContainer: {
    maxHeight: 100,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  thumbnailsContent: {
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#e67e22',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

export default PhotoCategoryDisplay;





