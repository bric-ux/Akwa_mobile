import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters, HotelEstablishmentType } from '../types';
import { useAmenities } from '../hooks/useAmenities';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';
import { getAmenityIonicIcon } from '../utils/amenityIcons';
import { HOST_COLORS, HOTEL_COLORS, MONTHLY_RENTAL_COLORS } from '../constants/colors';

export type SearchFilterContext = 'residence' | 'hotel' | 'monthly' | 'mixed';
export type SearchServiceType = 'residence' | 'hotel' | 'monthly';

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
  filterContext: SearchFilterContext;
}

const RESIDENCE_PROPERTY_TYPES = [
  { key: 'apartment', label: 'Appartement' },
  { key: 'house', label: 'Maison' },
  { key: 'villa', label: 'Villa' },
  { key: 'eco_lodge', label: 'Éco-lodge' },
  { key: 'other', label: 'Autre' },
] as const;

const MONTHLY_PROPERTY_TYPES = [
  { key: 'apartment', label: 'Appartement' },
  { key: 'house', label: 'Maison' },
  { key: 'villa', label: 'Villa' },
  { key: 'studio', label: 'Studio' },
] as const;

const HOTEL_ESTABLISHMENT_TYPES: { key: HotelEstablishmentType; label: string }[] = [
  { key: 'hotel', label: 'Hôtel' },
  { key: 'aparthotel', label: "Appart'hôtel" },
  { key: 'guesthouse', label: "Maison d'hôtes" },
  { key: 'residence', label: 'Résidence hôtelière' },
];

const STAR_OPTIONS = [1, 2, 3, 4, 5];

const SERVICE_OPTIONS: {
  key: SearchServiceType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { key: 'residence', label: 'Résidence meublée', icon: 'home', color: HOST_COLORS.primary },
  { key: 'hotel', label: 'Hôtel', icon: 'bed', color: HOTEL_COLORS.primary },
  { key: 'monthly', label: 'Location longue durée', icon: 'calendar', color: MONTHLY_RENTAL_COLORS.primary },
];

function deriveServiceType(
  initialFilters: SearchFilters,
  filterContext: SearchFilterContext,
): SearchServiceType {
  if (filterContext !== 'mixed') return filterContext;
  if (initialFilters.rentalType === 'monthly') return 'monthly';
  if (initialFilters.accommodationType === 'hotel') return 'hotel';
  return 'residence';
}

const CONTEXT_META: Record<
  SearchFilterContext,
  { title: string; color: string; priceLabel: string; priceMax: number }
> = {
  residence: {
    title: 'Résidences meublées',
    color: HOST_COLORS.primary,
    priceLabel: 'Prix par nuit',
    priceMax: 200000,
  },
  hotel: {
    title: 'Hôtels',
    color: HOTEL_COLORS.primary,
    priceLabel: 'Prix par nuit',
    priceMax: 300000,
  },
  monthly: {
    title: 'Location longue durée',
    color: MONTHLY_RENTAL_COLORS.primary,
    priceLabel: 'Loyer mensuel',
    priceMax: 2000000,
  },
  mixed: {
    title: 'Tous les hébergements',
    color: HOST_COLORS.primary,
    priceLabel: 'Prix par nuit',
    priceMax: 200000,
  },
};

const FiltersModal: React.FC<FiltersModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = {},
  filterContext,
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [selectedService, setSelectedService] = useState<SearchServiceType>(() =>
    deriveServiceType(initialFilters, filterContext),
  );
  const { amenities, loading: amenitiesLoading } = useAmenities();
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [minPriceInput, setMinPriceInput] = useState<string>(initialFilters.priceMin?.toString() || '');
  const [maxPriceInput, setMaxPriceInput] = useState<string>(initialFilters.priceMax?.toString() || '');
  const [minSurfaceInput, setMinSurfaceInput] = useState<string>(
    initialFilters.minSurfaceM2?.toString() || '',
  );
  const [guestsInput, setGuestsInput] = useState<string>(
    initialFilters.guests ? String(initialFilters.guests) : '',
  );

  const effectiveContext: SearchServiceType = selectedService;
  const effectiveMeta = CONTEXT_META[effectiveContext];

  useEffect(() => {
    if (!visible) return;
    setFilters(initialFilters);
    setSelectedService(deriveServiceType(initialFilters, filterContext));
    setSelectedAmenities(initialFilters.amenities ?? []);
    setMinPriceInput(initialFilters.priceMin?.toString() || '');
    setMaxPriceInput(initialFilters.priceMax?.toString() || '');
    setMinSurfaceInput(initialFilters.minSurfaceM2?.toString() || '');
    setGuestsInput(initialFilters.guests ? String(initialFilters.guests) : '');
  }, [initialFilters, filterContext, visible]);

  const handleServiceChange = (service: SearchServiceType) => {
    setSelectedService(service);
    setFilters((prev) => ({
      rentalType: service === 'monthly' ? 'monthly' : 'short_term',
      accommodationType:
        service === 'hotel' ? 'hotel' : service === 'residence' ? 'property' : undefined,
      sortBy: prev.sortBy,
    }));
    setSelectedAmenities([]);
    setMinSurfaceInput('');
  };

  const handleApply = () => {
    const priceMin = minPriceInput ? parseInt(minPriceInput, 10) : undefined;
    const priceMax = maxPriceInput ? parseInt(maxPriceInput, 10) : undefined;
    const guests = guestsInput ? parseInt(guestsInput, 10) : undefined;
    const minSurfaceM2 = minSurfaceInput ? parseInt(minSurfaceInput, 10) : undefined;

    const base: SearchFilters = {
      ...filters,
      priceMin,
      priceMax,
      guests: guests && guests > 0 ? guests : undefined,
      sortBy: initialFilters.sortBy,
      radiusKm: undefined,
      centerLat: undefined,
      centerLng: undefined,
    };

    if (effectiveContext === 'monthly') {
      onApply({
        ...base,
        rentalType: 'monthly',
        accommodationType: undefined,
        monthlyPropertyType: filters.monthlyPropertyType,
        isFurnished: filters.isFurnished,
        chargesIncluded: filters.chargesIncluded,
        minSurfaceM2: minSurfaceM2 && minSurfaceM2 > 0 ? minSurfaceM2 : undefined,
        minBedrooms: filters.minBedrooms,
        propertyType: undefined,
        amenities: undefined,
        establishmentType: undefined,
        starRatingMin: undefined,
      });
    } else if (effectiveContext === 'hotel') {
      onApply({
        ...base,
        rentalType: 'short_term',
        accommodationType: 'hotel',
        establishmentType: filters.establishmentType,
        starRatingMin: filters.starRatingMin,
        amenities: undefined,
        propertyType: undefined,
        monthlyPropertyType: undefined,
        isFurnished: undefined,
        chargesIncluded: undefined,
        minSurfaceM2: undefined,
        minBedrooms: undefined,
      });
    } else if (effectiveContext === 'residence') {
      onApply({
        ...base,
        rentalType: 'short_term',
        accommodationType: 'property',
        propertyType: filters.propertyType,
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        establishmentType: undefined,
        starRatingMin: undefined,
        monthlyPropertyType: undefined,
        isFurnished: undefined,
        chargesIncluded: undefined,
        minSurfaceM2: undefined,
        minBedrooms: undefined,
      });
    } else {
      onApply({
        ...base,
        rentalType: 'short_term',
        accommodationType: 'all',
        amenities: undefined,
        propertyType: undefined,
        establishmentType: undefined,
        starRatingMin: undefined,
        monthlyPropertyType: undefined,
        isFurnished: undefined,
        chargesIncluded: undefined,
        minSurfaceM2: undefined,
        minBedrooms: undefined,
      });
    }
    onClose();
  };

  const clearFilters = () => {
    const service = deriveServiceType(initialFilters, filterContext);
    setSelectedService(service);
    setFilters({
      rentalType: service === 'monthly' ? 'monthly' : 'short_term',
      accommodationType:
        service === 'hotel' ? 'hotel' : service === 'residence' ? 'property' : undefined,
      sortBy: initialFilters.sortBy,
    });
    setSelectedAmenities([]);
    setMinPriceInput('');
    setMaxPriceInput('');
    setMinSurfaceInput('');
    setGuestsInput('');
  };

  const toggleAmenity = (amenityName: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityName) ? prev.filter((a) => a !== amenityName) : [...prev, amenityName],
    );
  };

  const renderChip = (
    label: string,
    active: boolean,
    onPress: () => void,
    color = effectiveMeta.color,
  ) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderPriceSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="cash" size={18} color={effectiveMeta.color} />
        <Text style={styles.sectionTitle}>{effectiveMeta.priceLabel}</Text>
      </View>
      <View style={styles.priceRow}>
        <View style={styles.priceInputContainer}>
          <Text style={styles.priceLabel}>Minimum</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="0"
            value={minPriceInput}
            onChangeText={setMinPriceInput}
            keyboardType="numeric"
          />
          <Text style={styles.priceUnit}>FCFA</Text>
        </View>
        <Text style={styles.priceSeparator}>-</Text>
        <View style={styles.priceInputContainer}>
          <Text style={styles.priceLabel}>Maximum</Text>
          <TextInput
            style={styles.priceInput}
            placeholder={String(effectiveMeta.priceMax)}
            value={maxPriceInput}
            onChangeText={setMaxPriceInput}
            keyboardType="numeric"
          />
          <Text style={styles.priceUnit}>FCFA</Text>
        </View>
      </View>
    </View>
  );

  const essentialAmenities = [
    'WiFi gratuit',
    'Eau chaude',
    'Climatisation',
    'Parking gratuit',
    'Piscine',
    'Jacuzzi',
    'Sauna',
    'Ascenseur',
  ];

  const sortedAmenities = [...amenities].sort((a, b) => {
    const aEss = essentialAmenities.includes(a.name);
    const bEss = essentialAmenities.includes(b.name);
    if (aEss && !bEss) return -1;
    if (!aEss && bEss) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Filtres</Text>
          <TouchableOpacity onPress={handleApply}>
            <Text style={[styles.applyText, { color: effectiveMeta.color }]}>Appliquer</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.contextBanner, { borderLeftColor: effectiveMeta.color }]}>
          <Text style={[styles.contextBannerText, { color: effectiveMeta.color }]}>
            {effectiveMeta.title}
          </Text>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid" size={18} color={effectiveMeta.color} />
              <Text style={styles.sectionTitle}>Type de service</Text>
            </View>
            <View style={styles.serviceRow}>
              {SERVICE_OPTIONS.filter(
                (opt) => opt.key !== 'monthly' || FEATURE_MONTHLY_RENTAL,
              ).map((opt) => {
                const active = selectedService === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.serviceChip,
                      active && { backgroundColor: opt.color, borderColor: opt.color },
                    ]}
                    onPress={() => handleServiceChange(opt.key)}
                  >
                    <Ionicons name={opt.icon} size={16} color={active ? '#fff' : opt.color} />
                    <Text style={[styles.serviceChipText, active && styles.serviceChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {renderPriceSection()}

          {effectiveContext === 'hotel' && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bed" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Type d&apos;établissement</Text>
                </View>
                <View style={styles.chipRow}>
                  {renderChip('Tous', !filters.establishmentType, () =>
                    setFilters({ ...filters, establishmentType: undefined }),
                  )}
                  {HOTEL_ESTABLISHMENT_TYPES.map((t) =>
                    renderChip(t.label, filters.establishmentType === t.key, () =>
                      setFilters({ ...filters, establishmentType: t.key }),
                    ),
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Étoiles minimum</Text>
                </View>
                <View style={styles.chipRow}>
                  {renderChip('Toutes', !filters.starRatingMin, () =>
                    setFilters({ ...filters, starRatingMin: undefined }),
                  )}
                  {STAR_OPTIONS.map((n) =>
                    renderChip(`${n}+`, filters.starRatingMin === n, () =>
                      setFilters({ ...filters, starRatingMin: n }),
                    ),
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Voyageurs</Text>
                </View>
                <TextInput
                  style={styles.singleInput}
                  placeholder="Nombre de personnes"
                  value={guestsInput}
                  onChangeText={setGuestsInput}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}

          {effectiveContext === 'residence' && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="business" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Type de bien</Text>
                </View>
                <View style={styles.chipRow}>
                  {renderChip('Tous', !filters.propertyType, () =>
                    setFilters({ ...filters, propertyType: undefined }),
                  )}
                  {RESIDENCE_PROPERTY_TYPES.map((t) =>
                    renderChip(t.label, filters.propertyType === t.key, () =>
                      setFilters({ ...filters, propertyType: t.key }),
                    ),
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Voyageurs</Text>
                </View>
                <TextInput
                  style={styles.singleInput}
                  placeholder="Nombre de personnes"
                  value={guestsInput}
                  onChangeText={setGuestsInput}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="options" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Équipements</Text>
                </View>
                {amenitiesLoading ? (
                  <Text style={styles.loadingText}>Chargement...</Text>
                ) : (
                  <View style={styles.amenities}>
                    {sortedAmenities.map((amenity) => {
                      const isSelected = selectedAmenities.includes(amenity.name);
                      const iconName = getAmenityIonicIcon(amenity.name) as keyof typeof Ionicons.glyphMap;
                      return (
                        <TouchableOpacity
                          key={amenity.id}
                          style={[
                            styles.amenityButton,
                            isSelected && { backgroundColor: effectiveMeta.color, borderColor: effectiveMeta.color },
                          ]}
                          onPress={() => toggleAmenity(amenity.name)}
                        >
                          <Ionicons name={iconName} size={18} color={isSelected ? '#fff' : '#666'} />
                          <Text style={[styles.amenityText, isSelected && styles.amenityTextActive]}>
                            {amenity.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}

          {effectiveContext === 'monthly' && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="business" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Type de bien</Text>
                </View>
                <View style={styles.chipRow}>
                  {renderChip('Tous', !filters.monthlyPropertyType, () =>
                    setFilters({ ...filters, monthlyPropertyType: undefined }),
                  )}
                  {MONTHLY_PROPERTY_TYPES.map((t) =>
                    renderChip(t.label, filters.monthlyPropertyType === t.key, () =>
                      setFilters({ ...filters, monthlyPropertyType: t.key }),
                    ),
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="home" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Meublé</Text>
                </View>
                <View style={styles.chipRow}>
                  {renderChip('Tous', filters.isFurnished === undefined, () =>
                    setFilters({ ...filters, isFurnished: undefined }),
                  )}
                  {renderChip('Meublé', filters.isFurnished === true, () =>
                    setFilters({ ...filters, isFurnished: true }),
                  )}
                  {renderChip('Non meublé', filters.isFurnished === false, () =>
                    setFilters({ ...filters, isFurnished: false }),
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="receipt" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Charges</Text>
                </View>
                <View style={styles.chipRow}>
                  {renderChip('Indifférent', filters.chargesIncluded !== true, () =>
                    setFilters({ ...filters, chargesIncluded: undefined }),
                  )}
                  {renderChip('Charges comprises', filters.chargesIncluded === true, () =>
                    setFilters({ ...filters, chargesIncluded: true }),
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="resize" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Surface minimum</Text>
                </View>
                <TextInput
                  style={styles.singleInput}
                  placeholder="Ex : 50 m²"
                  value={minSurfaceInput}
                  onChangeText={setMinSurfaceInput}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bed" size={18} color={effectiveMeta.color} />
                  <Text style={styles.sectionTitle}>Chambres minimum</Text>
                </View>
                <View style={styles.chipRow}>
                  {renderChip('Toutes', !filters.minBedrooms, () =>
                    setFilters({ ...filters, minBedrooms: undefined }),
                  )}
                  {[1, 2, 3, 4, 5].map((n) =>
                    renderChip(`${n}+`, filters.minBedrooms === n, () =>
                      setFilters({ ...filters, minBedrooms: n }),
                    ),
                  )}
                </View>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Effacer tous les filtres</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  cancelText: { fontSize: 16, color: '#6c757d' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  applyText: { fontSize: 16, fontWeight: '600' },
  contextBanner: {
    marginHorizontal: 15,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  contextBannerText: { fontSize: 14, fontWeight: '700' },
  modalContent: { flex: 1, padding: 15 },
  section: { marginBottom: 22 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceRow: { gap: 8 },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  serviceChipText: { flex: 1, fontSize: 14, color: '#2c3e50', fontWeight: '500' },
  serviceChipTextActive: { color: '#fff', fontWeight: '600' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 13, color: '#6c757d' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  priceInputContainer: { flex: 1 },
  priceLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  priceUnit: {
    position: 'absolute',
    right: 8,
    top: 28,
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  priceInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    paddingRight: 48,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  priceSeparator: { marginHorizontal: 4, fontSize: 16, color: '#6c757d' },
  singleInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
    gap: 6,
  },
  amenityText: { fontSize: 13, color: '#6c757d' },
  amenityTextActive: { color: '#fff', fontWeight: '600' },
  clearButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  clearButtonText: { fontSize: 16, color: '#dc3545', fontWeight: '600' },
  loadingText: { fontSize: 14, color: '#666', paddingVertical: 8 },
});

export default FiltersModal;
