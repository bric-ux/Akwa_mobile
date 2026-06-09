import React from 'react';
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
import AutoCompleteSearch, { AutoCompleteSearchHandle } from './AutoCompleteSearch';
import DateGuestsSelector from './DateGuestsSelector';
import SearchButton from './SearchButton';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';

type Props = {
  visible: boolean;
  canDismissToResults: boolean;
  onClose: () => void;
  onBack: () => void;
  onOpenFilters: () => void;
  rentalType: 'short_term' | 'monthly';
  onRentalModeSwitch: (type: 'short_term' | 'monthly') => void;
  searchInputRef: React.RefObject<AutoCompleteSearchHandle | null>;
  currentSearchQuery: string;
  onSearch: (query: string) => void;
  onSuggestionSelect: (suggestion: { text: string }) => void;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  babies: number;
  onDateGuestsChange: (
    dates: { checkIn?: string; checkOut?: string },
    guests: { adults: number; children: number; babies: number },
  ) => void;
  onSearchPress: () => void;
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
  searchInputRef,
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
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={canDismissToResults ? onClose : onBack}
    >
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

          {FEATURE_MONTHLY_RENTAL ? (
            <View style={styles.modeSwitch}>
              <TouchableOpacity
                style={[styles.modeChip, rentalType === 'short_term' && styles.modeChipActive]}
                onPress={() => onRentalModeSwitch('short_term')}
              >
                <Ionicons
                  name="home-outline"
                  size={16}
                  color={rentalType === 'short_term' ? '#fff' : '#2E7D32'}
                />
                <Text style={[styles.modeChipText, rentalType === 'short_term' && styles.modeChipTextActive]}>
                  Résidence meublée
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeChip,
                  styles.modeChipMonthly,
                  rentalType === 'monthly' && styles.modeChipMonthlyActive,
                ]}
                onPress={() => onRentalModeSwitch('monthly')}
              >
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={rentalType === 'monthly' ? '#fff' : '#0d9488'}
                />
                <Text
                  style={[
                    styles.modeChipText,
                    styles.modeChipTextMonthly,
                    rentalType === 'monthly' && styles.modeChipTextActive,
                  ]}
                >
                  Location mensuelle
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Destination</Text>
            <View style={styles.destinationField}>
              <AutoCompleteSearch
                ref={searchInputRef}
                placeholder="Ville, commune ou quartier"
                onSearch={onSearch}
                onSuggestionSelect={onSuggestionSelect}
                initialValue={currentSearchQuery}
                requireFocusForSuggestions
                inlineSuggestions
                embedded
              />
            </View>
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

          <SearchButton onPress={onSearchPress} disabled={isSearching} loading={isSearching} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f7f5',
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
  modeSwitch: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  modeChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  modeChipMonthly: {
    borderColor: '#99f6e4',
  },
  modeChipMonthlyActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  modeChipTextMonthly: {
    color: '#0d9488',
  },
  modeChipTextActive: {
    color: '#fff',
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
  destinationField: {
    zIndex: 20,
    ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
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
