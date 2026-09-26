import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  LayoutChangeEvent,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../types';
import { useFavorites } from '../hooks/useFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { useCurrency } from '../hooks/useCurrency';
import { getPriceForDate } from '../utils/priceCalculator';
import { useLanguage } from '../contexts/LanguageContext';
import { sanitizePublicDescription } from '../utils/sanitizePublicDescription';
import MediaThumb from './MediaThumb';
import { getPropertyCoverUrl, getPropertyGalleryUrls, isVideoUrl } from '../utils/media';
import { getPropertyCardLocationLabel } from '../utils/locationLabel';
import { getPropertyTypeLabel } from '../utils/propertyTypeLabel';
import {
  EXPLORE_SHELF_IMAGE_HEIGHT,
  LIST_CARD_IMAGE_HEIGHT,
  formatExploreShelfHeadline,
  formatExploreShelfRatingSubtitle,
  formatListCardTitle,
} from '../constants/exploreShelfCard';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';

const CAROUSEL_HEIGHT = 200;
const SCREEN_W = Dimensions.get('window').width;

interface PropertyCardProps {
  property: Property;
  onPress: (property: Property) => void;
  variant?: 'grid' | 'list';
  /** Liste dans un carrousel horizontal (sans grandes marges gauche/droite). */
  horizontalShelf?: boolean;
}

const PropertyCardInner: React.FC<PropertyCardProps> = ({
  property,
  onPress,
  variant = 'grid',
  horizontalShelf = false,
}) => {
  const { requireAuthForFavorites } = useAuthRedirect();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading } = useFavorites();
  const { formatPrice: formatPriceWithCurrency, currency } = useCurrency();
  const { t } = useLanguage();
  const [isFavorited, setIsFavorited] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [slideWidth, setSlideWidth] = useState(SCREEN_W);

  useEffect(() => {
    // Mettre à jour l'état local quand le cache global change
    setIsFavorited(isFavoriteSync(property.id));
  }, [property.id, isFavoriteSync, currency]);

  // Prix dynamique : en liste, fourni par le parent (requête groupée). En grille, chargement unitaire.
  useEffect(() => {
    if (variant === 'list') {
      setDisplayPrice(null);
      return;
    }
    const loadTodayPrice = async () => {
      try {
        const today = new Date();
        const price = await getPriceForDate(property.id, today, property.price_per_night || 0);
        setDisplayPrice(price);
      } catch (error) {
        console.error('Error loading today price:', error);
        setDisplayPrice(null);
      }
    };

    loadTodayPrice();
  }, [property.id, property.price_per_night, variant]);

  const handleFavoritePress = async (e: any) => {
    e.stopPropagation();
    
    requireAuthForFavorites(async () => {
      try {
        await toggleFavorite(property.id);
        // L'état sera mis à jour automatiquement via le système de cache global
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Impossible de modifier les favoris');
      }
    });
  };

  const handlePropertyPress = () => {
    onPress(property);
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return t('common.priceOnRequest');
    return formatPriceWithCurrency(price);
  };

  const reviewCount = Number(property.review_count) || 0;
  const hasReviews = reviewCount > 0;
  const locationLabel = getPropertyCardLocationLabel(property);
  const coverUri = getPropertyCoverUrl(property);
  const galleryRaw = getPropertyGalleryUrls(property);
  const galleryUrls = galleryRaw.length > 0 ? galleryRaw : [coverUri];

  const onStripLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - slideWidth) > 0.5) {
      setSlideWidth(w);
    }
  };

  /** Liste : `dynamic_price_today` (batch). Grille : `displayPrice` async ou base. */
  const effectiveNightPrice =
    variant === 'list' && property.dynamic_price_today != null
      ? property.dynamic_price_today
      : displayPrice !== null
        ? displayPrice
        : property.price_per_night;

  /**
   * Liste (Explorer, recherche) : une seule image — pas de ScrollView horizontal dans la ligne,
   * sinon le défilement vertical du FlatList se bloque / saccade.
   */
  const renderListCoverImage = (height: number) => {
    const uri = coverUri || galleryUrls[0];
    return (
      <View style={[styles.listImageContainer, { height }]}>
        <MediaThumb
          uri={uri}
          style={{ width: '100%', height }}
          resizeMode="cover"
          contentPosition="center"
          fitWholeImage
          isVideo={isVideoUrl(uri)}
          priority="low"
          recyclingKey={`${property.id}-list-cover`}
        />
      </View>
    );
  };

  const renderImageCarousel = (height: number) => (
    <View style={[styles.imageContainer, { height }]} onLayout={onStripLayout}>
      {galleryUrls.length > 1 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          decelerationRate="fast"
          style={styles.imageScroll}
          keyboardShouldPersistTaps="handled"
        >
          {galleryUrls.map((uri, i) => (
            <View key={`${uri}-${i}`} style={{ width: slideWidth, height }}>
              <MediaThumb
                uri={uri}
                style={{ width: slideWidth, height }}
                resizeMode="cover"
                isVideo={isVideoUrl(uri)}
                priority={i === 0 ? 'high' : 'normal'}
                recyclingKey={`${property.id}-g-${i}`}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <MediaThumb
          uri={galleryUrls[0]}
          style={{ width: '100%', height }}
          resizeMode="cover"
          isVideo={isVideoUrl(galleryUrls[0])}
          priority="high"
          recyclingKey={`${property.id}-cover`}
        />
      )}
    </View>
  );

  if (variant === 'list' && horizontalShelf) {
    const uri = coverUri || galleryUrls[0];
    return (
      <View style={styles.listContainerShelf}>
        <ExploreShelfPhotoCard
          onPress={handlePropertyPress}
          title={formatExploreShelfHeadline({
            title: property.title,
            typeLabel: getPropertyTypeLabel(property.property_type),
          })}
          location={locationLabel || undefined}
          priceLabel={`${formatPrice(effectiveNightPrice)}/nuit`}
          promoLabel={
            property.discount_enabled && property.discount_percentage && property.discount_min_nights
              ? `-${property.discount_percentage}% dès ${property.discount_min_nights} nuits`
              : undefined
          }
          subtitle={formatExploreShelfRatingSubtitle(property.rating, reviewCount)}
          onFavoritePress={handleFavoritePress}
          isFavorited={isFavorited}
          favoriteLoading={favoriteLoading}
          imageHeight={EXPLORE_SHELF_IMAGE_HEIGHT}
          image={
            <MediaThumb
              uri={uri}
              style={{ width: '100%', height: EXPLORE_SHELF_IMAGE_HEIGHT }}
              resizeMode="cover"
              contentPosition="top"
              preferOriginal
              isVideo={isVideoUrl(uri)}
              priority="high"
              recyclingKey={`${property.id}-shelf-cover-${uri}`}
            />
          }
        />
      </View>
    );
  }

  if (variant === 'list') {
    const typeLabel = getPropertyTypeLabel(property.property_type);
    const cardTitle = formatListCardTitle({
      title: property.title,
      typeLabel,
    });
    const metaBits = [
      property.bedrooms != null && property.bedrooms > 0 ? `${property.bedrooms} ch.` : null,
      property.max_guests != null && property.max_guests > 0 ? `${property.max_guests} pers.` : null,
      typeLabel || null,
    ].filter(Boolean) as string[];
    const hasPromo = !!(
      property.discount_enabled &&
      property.discount_percentage &&
      property.discount_min_nights
    );
    const ratingValue = Number(property.rating) || 0;

    return (
      <View style={styles.listCardOuter}>
        <TouchableOpacity onPress={handlePropertyPress} activeOpacity={0.9}>
          <View style={[styles.listImageWrap, { height: LIST_CARD_IMAGE_HEIGHT }]}>
            {renderListCoverImage(LIST_CARD_IMAGE_HEIGHT)}

            <Pressable
              style={styles.listFavoriteButton}
              onPress={handleFavoritePress}
              disabled={favoriteLoading}
              hitSlop={8}
            >
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorited ? '#e74c3c' : '#1f2937'}
              />
            </Pressable>

            {hasPromo ? (
              <View style={styles.listPromoBadge}>
                <Text style={styles.listPromoText}>
                  −{property.discount_percentage}% dès {property.discount_min_nights} nuits
                </Text>
              </View>
            ) : null}

            {hasReviews ? (
              <View style={styles.listRatingBadge}>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={styles.listRatingText}>{ratingValue.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.listMeta}>
            {locationLabel ? (
              <View style={styles.listLocationRow}>
                <Ionicons name="location" size={14} color="#2E7D32" />
                <Text style={styles.listLocationText} numberOfLines={2}>
                  {locationLabel}
                </Text>
              </View>
            ) : null}

            <Text style={styles.listTitle} numberOfLines={2}>
              {cardTitle}
            </Text>

            <View style={styles.listPriceBlock}>
              <Text style={styles.listPrice}>
                {formatPrice(effectiveNightPrice)}
                <Text style={styles.listPriceUnit}>/{t('common.perNight')}</Text>
              </Text>
              {metaBits.length > 0 ? (
                <Text style={styles.listMetaBits} numberOfLines={1}>
                  {metaBits.join(' · ')}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }


  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePropertyPress}
      activeOpacity={0.8}
    >
        <>
          <View style={styles.imageArea}>
            {renderImageCarousel(CAROUSEL_HEIGHT)}
            <View style={styles.priceOverlay} pointerEvents="none">
              <Text style={styles.priceText}>
                {formatPrice(effectiveNightPrice)}/{t('common.perNight')}
              </Text>
              {property.discount_enabled && property.discount_percentage && property.discount_min_nights && (
                <Text style={styles.discountOverlay}>
                  -{property.discount_percentage}% {t('property.forNights')} {property.discount_min_nights}+ {t('property.nights')}
                </Text>
              )}
            </View>
            <Pressable
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
              disabled={favoriteLoading}
              hitSlop={8}
            >
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorited ? '#e74c3c' : '#fff'}
              />
            </Pressable>
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={2}>
              {property.title}
            </Text>
            
            {locationLabel ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.location} numberOfLines={1}>
                  {locationLabel}
                </Text>
              </View>
            ) : null}
            
            {/* Description courte */}
            {property.description && (
              <Text style={styles.gridDescription} numberOfLines={2}>
                {sanitizePublicDescription(property.description)}
              </Text>
            )}
            
            {/* Capacité compacte */}
            <View style={styles.gridCapacityContainer}>
              <Text style={styles.gridCapacity}>
                👥 {property.max_guests || 'N/A'}
              </Text>
              <Text style={styles.gridCapacity}>
                🛏️ {property.bedrooms || 'N/A'}
              </Text>
              <Text style={styles.gridCapacity}>
                💧 {property.bathrooms || 'N/A'}
              </Text>
            </View>
            
            {hasReviews ? (
              <Text style={styles.rating}>
                ⭐ {(Number(property.rating) || 0).toFixed(1)} ({reviewCount} {t('property.reviews')})
              </Text>
            ) : null}
            
            {property.amenities && property.amenities.length > 0 && (
              <View style={styles.amenitiesContainer}>
                {property.amenities.slice(0, 2).map((amenity, index) => (
                  <Text key={index} style={styles.amenity}>
                    {amenity.name}
                  </Text>
                ))}
                {property.amenities.length > 2 && (
                  <Text style={styles.moreAmenities}>
                    +{property.amenities.length - 2} {t('common.more')}
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  listContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  listContainerShelf: {
    marginHorizontal: 0,
    marginBottom: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  listCardOuter: {
    marginHorizontal: 16,
    marginBottom: 22,
  },
  listImageWrap: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#e5e7eb',
  },
  listImageContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    borderRadius: 22,
  },
  listFavoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  listPromoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 5,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  listPromoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  listRatingBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  listRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  listMeta: {
    marginTop: 12,
    paddingHorizontal: 2,
    gap: 6,
  },
  listLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  listLocationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 18,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
    letterSpacing: -0.2,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  listPriceBlock: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  listPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'left',
  },
  listPriceUnit: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6b7280',
  },
  listMetaBits: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'left',
  },
  // Nouveaux styles pour le design en cartes
  cardLayout: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  /** Carrousel Explore : hauteur de carte homogène (image fixe + zone texte réservée). */
  cardLayoutShelf: {
    flex: 1,
    minHeight: CAROUSEL_HEIGHT + 132,
  },
  imageArea: {
    position: 'relative',
    width: '100%',
    height: CAROUSEL_HEIGHT,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  imageScroll: {
    width: '100%',
  },
  cardImage: {
    width: '100%',
    height: 200,
  },
  priceOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  priceOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  discountOverlay: {
    color: '#fff',
    fontSize: 10,
    backgroundColor: '#ff6b35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  cardContentShelf: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    minHeight: 124,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 6,
  },
  cardLocation: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    flexShrink: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  cardRatingSlot: {},
  cardRatingSlotShelf: {
    minHeight: 22,
    marginBottom: 8,
    justifyContent: 'center',
  },
  cardRating: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardRatingInShelf: {
    marginBottom: 0,
  },
  cardRatingPlaceholder: {
    fontSize: 14,
    color: 'transparent',
  },
  cardAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  /** Une seule ligne : plus de hauteur variable entre cartes. */
  cardAmenitiesShelf: {
    flexWrap: 'nowrap',
    maxHeight: 30,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardAmenitiesShelfPlaceholder: {
    height: 30,
  },
  amenityTag: {
    fontSize: 12,
    color: '#2E7D32',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  amenityTagShelf: {
    flexShrink: 1,
    maxWidth: '38%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 20,
    elevation: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flex: 1,
    padding: 15,
    justifyContent: 'space-between',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  price: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
    flex: 1,
    marginRight: 10,
  },
  location: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    flexShrink: 1,
  },
  rating: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  amenity: {
    fontSize: 10,
    color: '#2E7D32',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreAmenities: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  amenities: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  listPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'right',
  },
  discountBadge: {
    fontSize: 10,
    color: '#e67e22',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    fontWeight: '600',
  },
  discountBadgeOverlay: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#e67e22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    fontWeight: '600',
  },
  // Nouveaux styles pour les détails
  description: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 8,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  capacity: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 4,
    marginRight: 12,
  },
  bedIcon: {
    marginLeft: 8,
  },
  // Styles pour le variant grid
  gridDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 6,
  },
  gridCapacityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gridCapacity: {
    fontSize: 11,
    color: '#6c757d',
  },
});

const PropertyCard = memo(PropertyCardInner);
export default PropertyCard;