import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { useDynamicPricing } from '../hooks/useDynamicPricing';

type PropertyPricingRouteProp = RouteProp<RootStackParamList, 'PropertyPricing'>;

const PropertyPricingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PropertyPricingRouteProp>();
  const { propertyId } = route.params;
  const { getDynamicPrices, setPriceForPeriod, deleteDynamicPrice, loading: dynamicPricingLoading } = useDynamicPricing();
  const scrollViewRef = useRef<ScrollView>(null);
  const basePriceInputRef = useRef<TextInput>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // État pour le prix de base
  const [basePrice, setBasePrice] = useState<string>('');
  const [propertyTitle, setPropertyTitle] = useState<string>('');
  
  // État pour la tarification
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMinNights, setDiscountMinNights] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [longStayDiscountEnabled, setLongStayDiscountEnabled] = useState(false);
  const [longStayDays, setLongStayDays] = useState<string>('40');
  const [longStayDiscountPercentage, setLongStayDiscountPercentage] = useState<string>('');
  
  // État pour les prix dynamiques
  const [dynamicPrices, setDynamicPrices] = useState<any[]>([]);
  const [showAddPriceForm, setShowAddPriceForm] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<string>('');
  const [selectedEndDate, setSelectedEndDate] = useState<string>('');
  const [newPriceAmount, setNewPriceAmount] = useState<string>('');
  
  // États pour les sélecteurs de dates
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(new Date());
  const [tempEndDate, setTempEndDate] = useState<Date>(new Date());

  useEffect(() => {
    loadProperty();
    loadDynamicPrices();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .select('title, price_per_night, discount_enabled, discount_min_nights, discount_percentage, long_stay_discount_enabled, long_stay_discount_min_nights, long_stay_discount_percentage')
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      if (data) {
        setPropertyTitle(data.title || '');
        setBasePrice(data.price_per_night?.toString() || '');
        setDiscountEnabled(data.discount_enabled || false);
        setDiscountMinNights(data.discount_min_nights?.toString() || '');
        setDiscountPercentage(data.discount_percentage?.toString() || '');
        
        // Réduction séjour long
        setLongStayDiscountEnabled(data.long_stay_discount_enabled || false);
        setLongStayDays(data.long_stay_discount_min_nights?.toString() || '40');
        setLongStayDiscountPercentage(data.long_stay_discount_percentage?.toString() || '');
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la propriété:', error);
      Alert.alert('Erreur', 'Impossible de charger la propriété');
    } finally {
      setLoading(false);
    }
  };

  const loadDynamicPrices = async () => {
    try {
      const prices = await getDynamicPrices(propertyId);
      setDynamicPrices(prices);
    } catch (error) {
      console.error('Erreur lors du chargement des prix dynamiques:', error);
    }
  };

  // Fonction pour obtenir le prix d'une date
  const getPriceForDate = (date: Date): number | null => {
    const dateStr = date.toISOString().split('T')[0];
    const priceInfo = dynamicPrices.find(price => {
      return dateStr >= price.start_date && dateStr <= price.end_date;
    });
    return priceInfo ? priceInfo.price_per_night : (basePrice ? parseInt(basePrice) : null);
  };

  // Fonction pour vérifier si une date a un prix personnalisé
  const hasCustomPrice = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return dynamicPrices.some(price => {
      return dateStr >= price.start_date && dateStr <= price.end_date;
    });
  };

  // États pour la sélection sur le calendrier
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarSelectedStart, setCalendarSelectedStart] = useState<Date | null>(null);
  const [calendarSelectedEnd, setCalendarSelectedEnd] = useState<Date | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);

  // Composant calendrier des prix
  const PricingCalendarComponent = () => {
    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      
      // Ajouter les jours vides du début
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }

      // Ajouter les jours du mois
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(new Date(year, month, day));
      }

      return days;
    };

    const handleDatePress = (date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return; // Ne pas permettre la sélection des dates passées

      if (!calendarSelectedStart || (calendarSelectedStart && calendarSelectedEnd)) {
        // Nouvelle sélection
        setCalendarSelectedStart(date);
        setCalendarSelectedEnd(null);
        setIsSelectingRange(true);
        setSelectedStartDate(date.toISOString().split('T')[0]);
        setSelectedEndDate('');
      } else if (calendarSelectedStart && !calendarSelectedEnd) {
        // Compléter la plage
        if (date >= calendarSelectedStart) {
          setCalendarSelectedEnd(date);
          setIsSelectingRange(false);
          setSelectedEndDate(date.toISOString().split('T')[0]);
        } else {
          // Si la date sélectionnée est avant la date de début, inverser
          setCalendarSelectedEnd(calendarSelectedStart);
          setCalendarSelectedStart(date);
          setIsSelectingRange(false);
          setSelectedStartDate(date.toISOString().split('T')[0]);
          setSelectedEndDate(calendarSelectedStart.toISOString().split('T')[0]);
        }
      }
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
      const newMonth = new Date(calendarMonth);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      setCalendarMonth(newMonth);
    };

    const days = getDaysInMonth(calendarMonth);
    const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <View style={styles.pricingCalendarContainer}>
        {/* Navigation du mois */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => navigateMonth('prev')}>
            <Ionicons name="chevron-back" size={24} color="#e67e22" />
          </TouchableOpacity>
          <Text style={styles.calendarMonthTitle}>
            {calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => navigateMonth('next')}>
            <Ionicons name="chevron-forward" size={24} color="#e67e22" />
          </TouchableOpacity>
        </View>

        {/* Instructions de sélection */}
        <View style={styles.calendarInstructions}>
          {!calendarSelectedStart && (
            <Text style={styles.instructionText}>
              👆 Cliquez sur une date pour commencer la sélection
            </Text>
          )}
          {calendarSelectedStart && !calendarSelectedEnd && (
            <Text style={styles.instructionText}>
              👆 Cliquez sur une date de fin pour compléter la période
            </Text>
          )}
          {calendarSelectedStart && calendarSelectedEnd && (
            <View style={styles.instructionSelected}>
              <Text style={styles.instructionText}>
                Période sélectionnée : {calendarSelectedStart.toLocaleDateString('fr-FR')} - {calendarSelectedEnd.toLocaleDateString('fr-FR')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCalendarSelectedStart(null);
                  setCalendarSelectedEnd(null);
                  setIsSelectingRange(false);
                  setSelectedStartDate('');
                  setSelectedEndDate('');
                }}
                style={styles.resetButton}
              >
                <Ionicons name="close-circle" size={18} color="#e67e22" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Légende */}
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { borderWidth: 2, borderColor: '#3498db', backgroundColor: '#fff' }]} />
            <Text style={styles.legendText}>Prix de base</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#00bcd4' }]} />
            <Text style={styles.legendText}>Prix personnalisé</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#ff9800' }]} />
            <Text style={styles.legendText}>Sélection</Text>
          </View>
        </View>

        {/* Jours de la semaine */}
        <View style={styles.calendarWeekDays}>
          {weekDays.map((day, index) => (
            <View key={index} style={styles.weekDayHeader}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Grille du calendrier */}
        <View style={styles.calendarGrid}>
          {days.map((date, index) => {
            if (!date) {
              return <View key={`empty-${index}`} style={styles.calendarDayCell} />;
            }

            const isPast = date < today;
            const customPrice = getPriceForDate(date);
            const displayPrice = customPrice;
            const hasCustomPriceForDate = hasCustomPrice(date);
            const isToday = date.getTime() === today.getTime();
            
            // Vérifier si la date est dans la plage sélectionnée
            const isInSelectedRange = calendarSelectedStart && calendarSelectedEnd &&
              date >= calendarSelectedStart && date <= calendarSelectedEnd;
            const isSelectedStart = calendarSelectedStart && date.getTime() === calendarSelectedStart.getTime();
            const isSelectedEnd = calendarSelectedEnd && date.getTime() === calendarSelectedEnd.getTime();
            const isInPartialRange = calendarSelectedStart && !calendarSelectedEnd &&
              date >= calendarSelectedStart;

            return (
              <TouchableOpacity
                key={date.toISOString()}
                style={[
                  styles.calendarDayCell,
                  isPast && styles.calendarDayCellPast,
                  isToday && !isPast && styles.calendarDayCellToday,
                  !isPast && hasCustomPriceForDate && styles.calendarDayCellCustomPrice,
                  !isPast && !hasCustomPriceForDate && styles.calendarDayCellBasePrice,
                  isInSelectedRange && styles.calendarDayCellSelected,
                  isSelectedStart && styles.calendarDayCellSelectedStart,
                  isSelectedEnd && styles.calendarDayCellSelectedEnd,
                  isInPartialRange && !isSelectedStart && styles.calendarDayCellPartialRange,
                ]}
                onPress={() => handleDatePress(date)}
                disabled={isPast}
              >
                <Text
                  style={[
                    styles.calendarDayNumber,
                    isPast && styles.calendarDayNumberPast,
                    isInSelectedRange && styles.calendarDayNumberSelected,
                  ]}
                >
                  {date.getDate()}
                </Text>
                {!isPast && displayPrice && (
                  <Text
                    style={[
                      styles.calendarDayPrice,
                      hasCustomPriceForDate && styles.calendarDayPriceCustom,
                      isInSelectedRange && styles.calendarDayPriceSelected,
                    ]}
                  >
                    {(displayPrice / 1000).toFixed(0)}k
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const handleAddDynamicPrice = async () => {
    if (!selectedStartDate || !selectedEndDate || !newPriceAmount) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      const result = await setPriceForPeriod(
        propertyId,
        selectedStartDate,
        selectedEndDate,
        parseInt(newPriceAmount)
      );
      
      if (result.success) {
        setSelectedStartDate('');
        setSelectedEndDate('');
        setNewPriceAmount('');
        setShowAddPriceForm(false);
        setCalendarSelectedStart(null);
        setCalendarSelectedEnd(null);
        setIsSelectingRange(false);
        await loadDynamicPrices();
        // Forcer le re-render du calendrier
        setCalendarMonth(new Date(calendarMonth));
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du prix:', error);
    }
  };

  const handleDeleteDynamicPrice = async (priceId: string) => {
    Alert.alert(
      'Supprimer le prix',
      'Êtes-vous sûr de vouloir supprimer ce prix personnalisé ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteDynamicPrice(priceId);
            if (result.success) {
              await loadDynamicPrices();
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates: any = {
        price_per_night: basePrice ? parseInt(basePrice) : null,
        discount_enabled: discountEnabled,
        discount_min_nights: discountMinNights ? parseInt(discountMinNights) : null,
        discount_percentage: discountPercentage ? parseFloat(discountPercentage) : null,
      };

      // Si réduction séjour long activée, utiliser les champs corrects
      if (longStayDiscountEnabled) {
        try {
          updates.long_stay_discount_enabled = true;
          updates.long_stay_discount_min_nights = parseInt(longStayDays);
          updates.long_stay_discount_percentage = parseFloat(longStayDiscountPercentage);
        } catch (e) {
          console.log('Les champs de réduction séjour long ne sont pas disponibles');
        }
      } else {
        updates.long_stay_discount_enabled = false;
        updates.long_stay_discount_min_nights = null;
        updates.long_stay_discount_percentage = null;
      }

      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', propertyId);

      if (error) {
        // Si l'erreur concerne des colonnes inexistantes, on ignore ces champs
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log('Certaines colonnes n\'existent pas encore, sauvegarde des champs disponibles uniquement');
          // Réessayer sans les champs qui n'existent pas
          const safeUpdates: any = {
            discount_enabled: discountEnabled,
            discount_min_nights: discountMinNights ? parseInt(discountMinNights) : null,
            discount_percentage: discountPercentage ? parseFloat(discountPercentage) : null,
          };
          const { error: retryError } = await supabase
            .from('properties')
            .update(safeUpdates)
            .eq('id', propertyId);
          
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      Alert.alert('Succès', 'Les modifications ont été enregistrées');
      navigation.goBack();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder les modifications');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleBasePriceFocus = () => {
    // Attendre un peu pour que le clavier s'ouvre
    setTimeout(() => {
      basePriceInputRef.current?.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({
            y: y - 100, // Scroll avec un peu de marge
            animated: true,
          });
        },
        () => {
          // Fallback si measureLayout échoue
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      );
    }, 300);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tarification</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Calendrier visuel des prix */}
        <View style={styles.section}>
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="calendar-outline" size={24} color="#e67e22" />
                <View style={styles.optionTitleContainer}>
                  <Text style={styles.optionTitle}>Calendrier des prix</Text>
                  <Text style={styles.optionSubtitle}>Sélectionnez les dates pour modifier le prix sur une période</Text>
                </View>
              </View>
            </View>
            <View style={styles.optionContent}>
              {PricingCalendarComponent()}
              
              {/* Formulaire de prix personnalisé (affiché quand une période est sélectionnée) */}
              {selectedStartDate && selectedEndDate && (
                <View style={styles.priceFormContainer}>
                  <View style={styles.priceFormHeader}>
                    <Ionicons name="pricetag-outline" size={20} color="#e67e22" />
                    <Text style={styles.priceFormTitle}>Définir un prix personnalisé</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedStartDate('');
                        setSelectedEndDate('');
                        setNewPriceAmount('');
                        setCalendarSelectedStart(null);
                        setCalendarSelectedEnd(null);
                        setIsSelectingRange(false);
                      }}
                      style={styles.closeFormButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.selectedPeriodInfo}>
                    <Text style={styles.selectedPeriodText}>
                      Période : {new Date(selectedStartDate).toLocaleDateString('fr-FR')} - {new Date(selectedEndDate).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Prix par nuit pour cette période (XOF)</Text>
                    <TextInput
                      style={styles.input}
                      value={newPriceAmount}
                      onChangeText={setNewPriceAmount}
                      placeholder="Ex: 25000"
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.addPriceButton}
                      onPress={handleAddDynamicPrice}
                      disabled={dynamicPricingLoading || !newPriceAmount}
                    >
                      {dynamicPricingLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="add-circle-outline" size={20} color="#fff" />
                          <Text style={styles.addPriceButtonText}>Ajouter ce prix</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Liste des prix personnalisés */}
        {dynamicPrices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.optionCard}>
              <View style={styles.optionHeader}>
                <View style={styles.optionHeaderLeft}>
                  <Ionicons name="list-outline" size={24} color="#e67e22" />
                  <Text style={styles.optionTitle}>Prix personnalisés existants</Text>
                </View>
              </View>
              <View style={styles.optionContent}>
                {dynamicPrices.map((price) => (
                  <View key={price.id} style={styles.dynamicPriceItem}>
                    <View style={styles.dynamicPriceInfo}>
                      <Text style={styles.dynamicPriceAmount}>
                        {price.price_per_night.toLocaleString('fr-FR')} XOF/nuit
                      </Text>
                      <Text style={styles.dynamicPriceDates}>
                        Du {new Date(price.start_date).toLocaleDateString('fr-FR')} au {new Date(price.end_date).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deletePriceButton}
                      onPress={() => handleDeleteDynamicPrice(price.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Réduction par nombre de nuits */}
        <View style={styles.section}>
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="pricetag-outline" size={24} color="#e67e22" />
                <Text style={styles.optionTitle}>Réduction par nombre de nuits</Text>
              </View>
              <Switch
                value={discountEnabled}
                onValueChange={setDiscountEnabled}
                trackColor={{ false: '#ccc', true: '#e67e22' }}
              />
            </View>
            
            {discountEnabled && (
              <View style={styles.optionContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre minimum de nuits</Text>
                  <TextInput
                    style={styles.input}
                    value={discountMinNights}
                    onChangeText={setDiscountMinNights}
                    placeholder="Ex: 7"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Pourcentage de réduction (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={discountPercentage}
                    onChangeText={setDiscountPercentage}
                    placeholder="Ex: 15"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Réduction séjour long */}
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="calendar-outline" size={24} color="#e67e22" />
                <Text style={styles.optionTitle}>Réduction séjour long</Text>
              </View>
              <Switch
                value={longStayDiscountEnabled}
                onValueChange={setLongStayDiscountEnabled}
                trackColor={{ false: '#ccc', true: '#e67e22' }}
              />
            </View>
            
            {longStayDiscountEnabled && (
              <View style={styles.optionContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre de jours minimum</Text>
                  <TextInput
                    style={styles.input}
                    value={longStayDays}
                    onChangeText={setLongStayDays}
                    placeholder="Ex: 40"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Pourcentage de réduction (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={longStayDiscountPercentage}
                    onChangeText={setLongStayDiscountPercentage}
                    placeholder="Ex: 20"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Prix de base - Modifie le prix de la propriété */}
        <View style={styles.section}>
          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <Ionicons name="cash-outline" size={24} color="#e67e22" />
                <View style={styles.optionTitleContainer}>
                  <Text style={styles.optionTitle}>Prix de base de la propriété</Text>
                  <Text style={styles.optionSubtitle}>Modifie le prix par défaut de votre propriété</Text>
                </View>
              </View>
            </View>
            <View style={styles.optionContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Prix par nuit (XOF)</Text>
                <TextInput
                  ref={basePriceInputRef}
                  style={styles.input}
                  value={basePrice}
                  onChangeText={setBasePrice}
                  placeholder="Ex: 20000"
                  keyboardType="numeric"
                  onFocus={handleBasePriceFocus}
                />
                <Text style={styles.helpText}>
                  Ce prix sera utilisé par défaut pour toutes les dates sans prix personnalisé
                </Text>
              </View>
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  optionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  optionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  optionTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    marginLeft: 12,
  },
  optionContent: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dateInputGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  addPriceButton: {
    backgroundColor: '#e67e22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  addPriceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dynamicPricesList: {
    marginTop: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dynamicPriceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  dynamicPriceInfo: {
    flex: 1,
  },
  dynamicPriceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0277bd',
    marginBottom: 4,
  },
  dynamicPriceDates: {
    fontSize: 12,
    color: '#0288d1',
  },
  deletePriceButton: {
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  selectedPeriodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedPeriodText: {
    fontSize: 14,
    color: '#0277bd',
    fontWeight: '500',
    flex: 1,
  },
  // Styles pour le calendrier des prix
  pricingCalendarContainer: {
    marginTop: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 4,
    margin: 1,
  },
  calendarDayCellPast: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  calendarDayCellToday: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  calendarDayCellBasePrice: {
    backgroundColor: '#fff',
    borderColor: '#3498db',
    borderWidth: 2,
  },
  calendarDayCellCustomPrice: {
    backgroundColor: '#e0f7fa',
    borderColor: '#00bcd4',
    borderWidth: 2,
  },
  calendarDayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  calendarDayNumberPast: {
    color: '#999',
  },
  calendarDayPrice: {
    fontSize: 10,
    color: '#3498db',
    fontWeight: '600',
    marginTop: 2,
  },
  calendarDayPriceCustom: {
    color: '#00bcd4',
    fontWeight: 'bold',
  },
  calendarDayCellSelected: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    borderWidth: 2,
  },
  calendarDayCellSelectedStart: {
    backgroundColor: '#ff9800',
    borderColor: '#ff9800',
    borderWidth: 2,
  },
  calendarDayCellSelectedEnd: {
    backgroundColor: '#ff9800',
    borderColor: '#ff9800',
    borderWidth: 2,
  },
  calendarDayCellPartialRange: {
    backgroundColor: '#ffe0b2',
  },
  calendarDayNumberSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  calendarDayPriceSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  calendarInstructions: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  instructionText: {
    fontSize: 14,
    color: '#1976d2',
    textAlign: 'center',
  },
  instructionSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetButton: {
    padding: 4,
  },
  priceFormContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  priceFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  priceFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  closeFormButton: {
    padding: 4,
  },
});

export default PropertyPricingScreen;

