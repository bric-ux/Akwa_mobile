import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DestinationSearchModal, { DestinationSuggestion } from './DestinationSearchModal';
import DateGuestsSelector from './DateGuestsSelector';
import SearchButton from './SearchButton';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { MONTHLY_RENTAL_COLORS, HOTEL_COLORS } from '../constants/colors';

export type StaySearchType = 'short_term' | 'monthly' | 'hotel';

type Props = {
  visible: boolean;
  canDismissToResults: boolean;
  onClose: () => void;
  onBack: () => void;
  onOpenFilters: () => void;
  rentalType: StaySearchType;
  onRentalModeSwitch: (type: StaySearchType) => void;
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
};

const SearchFormModal: React.FC<Props> = ({
  visible,
  canDismissToResults,
  onClose,
  onBack,
  onOpenFilters,
  rentalType,
  onRentalModeSwitch,
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
}) => {
  const { monthlyRental, hotel } = useFeatureFlags();
  const showTypeSwitch = monthlyRental || hotel;
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState(currentSearchQuery);

  useEffect(() => {
    setDestinationQuery(currentSearchQuery);
  }, [currentSearchQuery]);

  const hasDestination = destinationQuery.trim().length > 0;
  const needsDates = rentalType !== 'monthly';

  const handleDestinationSelect = (suggestion: DestinationSuggestion) => {
    setDestinationQuery(suggestion.text);
    onSearch(suggestion.text);
    onSuggestionSelect(suggestion);
    setShowDestinationModal(false);
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

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
                Choisissez le type d’hébergement, une destination
                {needsDates ? ', vos dates et le nombre de voyageurs' : ''}.
              </Text>
            </View>
          )}

          {showTypeSwitch ? (
            <View style={styles.modeSwitch}>
              <TouchableOpacity
                style={[styles.modeChip, rentalType === 'short_term' && styles.modeChipActive]}
                onPress={() => onRentalModeSwitch('short_term')}
              >
                <Ionicons
                  name="home-outline"
                  size={15}
                  color={rentalType === 'short_term' ? '#fff' : '#2E7D32'}
                />
                <Text style={[styles.modeChipText, rentalType === 'short_term' && styles.modeChipTextActive]}>
                  Résidence
                </Text>
              </TouchableOpacity>
              {hotel ? (
                <TouchableOpacity
                  style={[
                    styles.modeChip,
                    styles.modeChipHotel,
                    rentalType === 'hotel' && styles.modeChipHotelActive,
                  ]}
                  onPress={() => onRentalModeSwitch('hotel')}
                >
                  <Ionicons
                    name="business-outline"
                    size={15}
                    color={rentalType === 'hotel' ? '#fff' : HOTEL_COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.modeChipText,
                      { color: HOTEL_COLORS.primary },
                      rentalType === 'hotel' && styles.modeChipTextActive,
                    ]}
                  >
                    Hôtel
                  </Text>
                </TouchableOpacity>
              ) : null}
              {monthlyRental ? (
                <TouchableOpacity
                  style={[
                    styles.modeChip,
                    styles.modeChipMonthly,
                    rentalType === 'monthly' && styles.modeChipMonthlyActive,
                  ]}
                  onPress={() => onRentalModeSwitch('monthly')}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={rentalType === 'monthly' ? '#fff' : MONTHLY_RENTAL_COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.modeChipText,
                      { color: MONTHLY_RENTAL_COLORS.primary },
                      rentalType === 'monthly' && styles.modeChipTextActive,
                    ]}
                  >
                    Longue durée
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

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
          </View>

          {needsDates ? (
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
                Location longue durée : recherchez par ville, puis affinez le loyer et les pièces.
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
      </SafeAreaView>

      <DestinationSearchModal
        visible={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        onSelect={handleDestinationSelect}
        initialQuery={destinationQuery}
      />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: '#f8fafc' },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { alignItems: 'center', paddingVertical: 8, gap: 8 },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#111', textAlign: 'center' },
  heroSubtitle: { fontSize: 14, lineHeight: 20, color: '#6b7280', textAlign: 'center' },
  modeSwitch: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
  },
  modeChipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  modeChipMonthly: { borderColor: MONTHLY_RENTAL_COLORS.primary },
  modeChipMonthlyActive: {
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    borderColor: MONTHLY_RENTAL_COLORS.primary,
  },
  modeChipHotel: { borderColor: HOTEL_COLORS.primary },
  modeChipHotelActive: {
    backgroundColor: HOTEL_COLORS.primary,
    borderColor: HOTEL_COLORS.primary,
  },
  modeChipText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  modeChipTextActive: { color: '#fff' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  destinationPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
  },
  destinationPickerText: { flex: 1, fontSize: 15, color: '#111' },
  destinationPickerPlaceholder: { color: '#9ca3af' },
  datesGuestsField: { marginTop: 0 },
  monthlyHint: { fontSize: 14, lineHeight: 20, color: '#64748b' },
});

export default SearchFormModal;
