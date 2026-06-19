import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DestinationSearchModal, { DestinationSuggestion } from './DestinationSearchModal';
import DateGuestsSelector from './DateGuestsSelector';
import SearchButton from './SearchButton';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
  visible: boolean;
  canDismissToResults: boolean;
  onClose: () => void;
  onBack: () => void;
  onOpenFilters: () => void;
  showFiltersPanel?: boolean;
  filtersPanel?: React.ReactNode;
  rentalType: 'short_term' | 'monthly';
  currentSearchQuery: string;
  onSearch: (query: string) => void;
  onSuggestionSelect: (suggestion: DestinationSuggestion) => void;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  babies: number;
  onDateGuestsChange: (
    dates: { checkIn?: string; checkOut?: string },
    guests: { adults: number; children: number; babies: number },
  ) => void;
  onSearchPress: (query: string) => void;
  isSearching: boolean;
  onNearbyPress?: () => void;
  nearbyLoading?: boolean;
};

const SearchFormModal: React.FC<Props> = ({
  visible,
  canDismissToResults,
  onClose,
  onBack,
  onOpenFilters,
  showFiltersPanel = false,
  filtersPanel,
  rentalType,
  currentSearchQuery,
  onSearch,
  onSuggestionSelect,
  checkIn,
  checkOut,
  adults,
  children,
  babies,
  onDateGuestsChange,
  onSearchPress,
  isSearching,
  onNearbyPress,
  nearbyLoading = false,
}) => {
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState(currentSearchQuery);
  const filtersSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    setDestinationQuery(currentSearchQuery);
  }, [currentSearchQuery]);

  useEffect(() => {
    Animated.timing(filtersSlide, {
      toValue: showFiltersPanel ? 0 : SCREEN_WIDTH,
      duration: showFiltersPanel ? 280 : 220,
      easing: showFiltersPanel ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showFiltersPanel, filtersSlide]);

  const hasDestination = destinationQuery.trim().length > 0;

  const handleDestinationSelect = (suggestion: DestinationSuggestion) => {
    setDestinationQuery(suggestion.text);
    onSearch(suggestion.text);
    onSuggestionSelect(suggestion);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={canDismissToResults ? onClose : onBack}
    >
      <View style={styles.modalRoot}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={canDismissToResults ? onClose : onBack}
            accessibilityLabel={canDismissToResults ? 'Fermer' : 'Retour'}
          >
            <Ionicons name={canDismissToResults ? 'close' : 'arrow-back'} size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Rechercher</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenFilters} accessibilityLabel="Filtres">
            <Ionicons name="options-outline" size={24} color="#2E7D32" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentShell}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          pointerEvents={showFiltersPanel ? 'none' : 'auto'}
        >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {!hasDestination && (
            <View style={styles.hero}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="compass-outline" size={32} color="#2E7D32" />
              </View>
              <Text style={styles.heroTitle}>Où souhaitez-vous séjourner ?</Text>
              <Text style={styles.heroSubtitle}>
                Choisissez une destination, vos dates et le nombre de voyageurs pour découvrir les hébergements
                disponibles en Côte d&apos;Ivoire.
              </Text>
            </View>
          )}

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Destination</Text>
            <TouchableOpacity
              style={styles.destinationPicker}
              onPress={() => setShowDestinationModal(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Choisir une destination"
            >
              <Ionicons name="location" size={20} color={hasDestination ? '#2E7D32' : '#9ca3af'} />
              <Text
                style={[styles.destinationPickerText, !hasDestination && styles.destinationPickerPlaceholder]}
                numberOfLines={1}
              >
                {hasDestination ? destinationQuery : 'Ville, commune ou quartier'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            {rentalType !== 'monthly' && onNearbyPress ? (
              <TouchableOpacity
                style={styles.nearbyQuickBtn}
                onPress={onNearbyPress}
                disabled={nearbyLoading || isSearching}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={18} color="#2E7D32" />
                <Text style={styles.nearbyQuickText}>Près de moi</Text>
                {nearbyLoading ? (
                  <ActivityIndicator size="small" color="#2E7D32" style={styles.nearbyQuickSpinner} />
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>

          {rentalType !== 'monthly' ? (
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Dates et voyageurs</Text>
              <View style={styles.datesGuestsField}>
                <DateGuestsSelector
                  checkIn={checkIn}
                  checkOut={checkOut}
                  adults={adults}
                  children={children}
                  babies={babies}
                  onDateGuestsChange={onDateGuestsChange}
                  embedded
                />
              </View>
            </View>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.monthlyHint}>
                Recherche dédiée longue durée : filtrez par ville et critères mensuels.
              </Text>
            </View>
          )}

          <SearchButton
            onPress={() => onSearchPress(destinationQuery.trim())}
            disabled={isSearching}
            loading={isSearching}
          />
        </ScrollView>
        </KeyboardAvoidingView>

        {filtersPanel ? (
          <Animated.View
            style={[styles.filtersOverlay, { transform: [{ translateX: filtersSlide }] }]}
            pointerEvents={showFiltersPanel ? 'auto' : 'none'}
          >
            {filtersPanel}
          </Animated.View>
        ) : null}
        </View>
      </SafeAreaView>

      <DestinationSearchModal
        visible={showDestinationModal}
        embedded
        initialQuery={destinationQuery}
        onClose={() => setShowDestinationModal(false)}
        onSelect={handleDestinationSelect}
        onNearbyPress={
          rentalType !== 'monthly' && onNearbyPress
            ? () => {
                setShowDestinationModal(false);
                onNearbyPress();
              }
            : undefined
        }
        nearbyLoading={nearbyLoading}
      />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#f4f7f5',
  },
  safe: {
    flex: 1,
    backgroundColor: '#f4f7f5',
  },
  contentShell: {
    flex: 1,
    overflow: 'hidden',
  },
  filtersOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  hero: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e8f5e9',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14532d',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
  formCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...(Platform.OS === 'android' ? { overflow: 'visible' as const } : {}),
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  destinationPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  destinationPickerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  destinationPickerPlaceholder: {
    fontWeight: '400',
    color: '#9ca3af',
  },
  nearbyQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  nearbyQuickText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  nearbyQuickSpinner: {
    marginLeft: 4,
  },
  datesGuestsField: {
    zIndex: 1,
  },
  monthlyHint: {
    fontSize: 14,
    color: '#0d9488',
    lineHeight: 20,
    padding: 12,
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
});

export default SearchFormModal;
