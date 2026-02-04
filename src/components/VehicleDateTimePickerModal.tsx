import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TRAVELER_COLORS } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VehicleDateTimePickerModalProps {
  visible: boolean;
  startDateTime: string | null;
  endDateTime: string | null;
  onClose: () => void;
  onConfirm: (startDateTime: string, endDateTime: string) => void;
}

const VehicleDateTimePickerModal: React.FC<VehicleDateTimePickerModalProps> = ({
  visible,
  startDateTime,
  endDateTime,
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<'start' | 'end'>('start');
  const [mode, setMode] = useState<'manual' | 'days'>('manual'); // 'manual' = sélection manuelle, 'days' = nombre de jours
  const [rentalDays, setRentalDays] = useState<string>('1');
  const [tempStartDate, setTempStartDate] = useState<Date>(() => {
    if (startDateTime) return new Date(startDateTime);
    const now = new Date();
    // Arrondir à l'heure supérieure (ex: 8h59 -> 9h, 10h30 -> 11h)
    const roundedHour = now.getHours() + 1;
    now.setHours(roundedHour, 0, 0, 0);
    return now;
  });
  const [tempEndDate, setTempEndDate] = useState<Date>(() => {
    if (endDateTime) return new Date(endDateTime);
    const now = new Date();
    // Arrondir à l'heure supérieure + 1 heure pour la date de fin
    const roundedHour = now.getHours() + 2;
    now.setHours(roundedHour, 0, 0, 0);
    return now;
  });

  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);
  const datesScrollRef = useRef<ScrollView>(null);

  // Générer les dates à afficher (30 jours à partir d'aujourd'hui)
  const generateDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Aujourd'hui
    dates.push(new Date(today));
    
    // 30 jours après
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const dates = generateDates();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0]; // Seulement 00 (pas de sélection de minutes autres que 00)

  const currentDate = activeTab === 'start' ? tempStartDate : tempEndDate;
  const setCurrentDate = activeTab === 'start' ? setTempStartDate : setTempEndDate;

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date);
    // Toujours mettre les minutes à 00
    newDate.setHours(currentDate.getHours(), 0, 0, 0);
    
    // Si c'est la date de début et que c'est aujourd'hui, arrondir à l'heure supérieure
    if (activeTab === 'start') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateOnly = new Date(date);
      selectedDateOnly.setHours(0, 0, 0, 0);
      
      if (selectedDateOnly.getTime() === today.getTime()) {
        // Si c'est aujourd'hui, arrondir à l'heure supérieure
        const now = new Date();
        const roundedHour = now.getHours() + 1;
        newDate.setHours(roundedHour, 0, 0, 0);
      }
      
      setTempStartDate(newDate);
      
      // Si la nouvelle date de début est après la date de fin, ajuster la date de fin
      const startDateOnly = new Date(newDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(tempEndDate);
      endDateOnly.setHours(0, 0, 0, 0);
      
      if (startDateOnly.getTime() >= endDateOnly.getTime()) {
        // Ajuster la date de fin au lendemain de la date de début
        const adjustedEndDate = new Date(newDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
        adjustedEndDate.setHours(tempEndDate.getHours(), 0, 0, 0);
        setTempEndDate(adjustedEndDate);
      }
    } else {
      // Si on sélectionne une date de fin
      setTempEndDate(newDate);
      
      // Si la nouvelle date de fin est avant la date de début, ajuster la date de début
      const startDateOnly = new Date(tempStartDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(newDate);
      endDateOnly.setHours(0, 0, 0, 0);
      
      if (endDateOnly.getTime() <= startDateOnly.getTime()) {
        // Ajuster la date de début au jour précédent de la date de fin
        const adjustedStartDate = new Date(newDate);
        adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
        adjustedStartDate.setHours(tempStartDate.getHours(), 0, 0, 0);
        setTempStartDate(adjustedStartDate);
      }
    }
  };

  const handleHourSelect = (hour: number) => {
    const newDate = new Date(currentDate);
    // Toujours mettre les minutes à 00
    newDate.setHours(hour, 0, 0, 0);
    
    // Vérifier si c'est aujourd'hui et si l'heure est dans le passé
    const now = new Date();
    const dateOnly = new Date(currentDate);
    dateOnly.setHours(0, 0, 0, 0);
    const todayOnly = new Date(now);
    todayOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === todayOnly.getTime() && newDate.getTime() <= now.getTime()) {
      // Si c'est aujourd'hui et l'heure est passée, utiliser l'heure actuelle arrondie à l'heure supérieure
      const minTime = new Date(now);
      const roundedHour = minTime.getHours() + 1;
      minTime.setHours(roundedHour, 0, 0, 0);
      newDate.setTime(minTime.getTime());
    }
    
    if (activeTab === 'start') {
      setTempStartDate(newDate);
      // Si la date/heure de début est après la date de fin, ajuster la date de fin
      if (newDate.getTime() >= tempEndDate.getTime()) {
        const adjustedEndDate = new Date(newDate);
        adjustedEndDate.setHours(adjustedEndDate.getHours() + 1, 0, 0, 0);
        setTempEndDate(adjustedEndDate);
      }
    } else {
      setTempEndDate(newDate);
      // Si la date/heure de fin est avant la date de début, ajuster la date de début
      if (newDate.getTime() <= tempStartDate.getTime()) {
        const adjustedStartDate = new Date(newDate);
        adjustedStartDate.setHours(adjustedStartDate.getHours() - 1, 0, 0, 0);
        setTempStartDate(adjustedStartDate);
      }
    }
  };

  const handleMinuteSelect = (minute: number) => {
    // Les minutes sont toujours à 00, donc on ne fait rien ici
    // Cette fonction est gardée pour la compatibilité mais ne devrait pas être appelée
    // car il n'y a qu'une seule option (00)
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToFormat = new Date(date);
    dateToFormat.setHours(0, 0, 0, 0);
    
    if (dateToFormat.getTime() === today.getTime()) {
      return "Aujourd'hui";
    }
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateToFormat.getTime() === tomorrow.getTime()) {
      return "Demain";
    }
    
    const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatTime = (date: Date): string => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const calculateDuration = (): { days: number; hours: number } => {
    const diff = tempEndDate.getTime() - tempStartDate.getTime();
    const totalHours = Math.ceil(diff / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return { days, hours };
  };

  const handleConfirm = () => {
    // S'assurer que les minutes sont toujours à 00
    const finalStartDate = new Date(tempStartDate);
    finalStartDate.setMinutes(0, 0, 0);
    
    const finalEndDate = new Date(tempEndDate);
    finalEndDate.setMinutes(0, 0, 0);
    
    // Vérification finale : s'assurer que la date de fin est après la date de début
    const startDateOnly = new Date(finalStartDate);
    startDateOnly.setHours(0, 0, 0, 0);
    const endDateOnly = new Date(finalEndDate);
    endDateOnly.setHours(0, 0, 0, 0);
    
    if (endDateOnly.getTime() <= startDateOnly.getTime()) {
      // Si la date de fin est avant ou égale à la date de début, ajuster
      finalEndDate.setTime(finalStartDate.getTime());
      finalEndDate.setHours(finalEndDate.getHours() + 1, 0, 0, 0);
    }
    
    // Vérifier que la date de début n'est pas dans le passé
    const now = new Date();
    if (finalStartDate.getTime() < now.getTime()) {
      // Arrondir à l'heure supérieure
      const roundedHour = now.getHours() + 1;
      finalStartDate.setTime(now.getTime());
      finalStartDate.setHours(roundedHour, 0, 0, 0);
    }
    
    onConfirm(finalStartDate.toISOString(), finalEndDate.toISOString());
    onClose();
  };

  // Calculer automatiquement la date de fin si on est en mode "jours"
  useEffect(() => {
    if (mode === 'days' && rentalDays) {
      const days = parseInt(rentalDays) || 1;
      const calculatedEndDate = new Date(tempStartDate);
      calculatedEndDate.setDate(calculatedEndDate.getDate() + days);
      calculatedEndDate.setHours(tempStartDate.getHours(), 0, 0, 0);
      setTempEndDate(calculatedEndDate);
    }
  }, [mode, rentalDays, tempStartDate]);

  // Fonction pour scroller vers une date/heure spécifique (centré)
  const scrollToDateAndHour = (targetDate: Date, delay: number = 200) => {
    setTimeout(() => {
      // Trouver l'index de la date sélectionnée
      const dateIndex = dates.findIndex(date => {
        return date.getDate() === targetDate.getDate() &&
               date.getMonth() === targetDate.getMonth() &&
               date.getFullYear() === targetDate.getFullYear();
      });
      
      const hourIndex = targetDate.getHours();
      
      // Centrer l'élément sélectionné dans le ScrollView
      // Le contentContainerStyle a un paddingVertical de 75px
      // Donc le premier item commence à y=75, pas y=0
      // Formule : (paddingTop + index * itemHeight) - (scrollViewHeight / 2) + (itemHeight / 2)
      const itemHeight = 58; // 50px height + 4px margin top + 4px margin bottom
      const scrollViewHeight = 200;
      const paddingTop = 75; // paddingVertical du contentContainerStyle
      
      if (datesScrollRef.current && dateIndex >= 0) {
        // Position de l'item : paddingTop + (index * itemHeight)
        // Pour centrer : position - (hauteur visible / 2) + (hauteur item / 2)
        const itemPosition = paddingTop + (dateIndex * itemHeight);
        const scrollPosition = itemPosition - (scrollViewHeight / 2) + (itemHeight / 2);
        datesScrollRef.current.scrollTo({ y: Math.max(0, scrollPosition), animated: true });
      }
      if (hoursScrollRef.current && hourIndex >= 0) {
        // Même calcul pour les heures
        const itemPosition = paddingTop + (hourIndex * itemHeight);
        const scrollPosition = itemPosition - (scrollViewHeight / 2) + (itemHeight / 2);
        hoursScrollRef.current.scrollTo({ y: Math.max(0, scrollPosition), animated: true });
      }
    }, delay);
  };

  // Scroll pour le mode "sélection manuelle" (utilise currentDate qui change selon activeTab)
  useEffect(() => {
    if (visible && mode === 'manual') {
      scrollToDateAndHour(currentDate, 200);
    }
  }, [currentDate, visible, activeTab, mode]);

  // Scroll pour le mode "par nombre de jours" (utilise tempStartDate)
  useEffect(() => {
    if (visible && mode === 'days') {
      scrollToDateAndHour(tempStartDate, 200);
    }
  }, [tempStartDate, visible, mode]);

  if (!visible) return null;

  const duration = calculateDuration();
  const durationText = duration.days > 0 
    ? `${duration.days} jour${duration.days > 1 ? 's' : ''}${duration.hours > 0 ? ` et ${duration.hours}h` : ''}`
    : `${duration.hours}h`;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.contentWrapper}>
            {/* Contenu scrollable */}
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
          {/* Sélecteur de mode */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'days' && styles.modeButtonActive]}
              onPress={() => setMode('days')}
            >
              <Ionicons name="calendar-number-outline" size={18} color={mode === 'days' ? TRAVELER_COLORS.primary : '#666'} />
              <Text style={[styles.modeButtonText, mode === 'days' && styles.modeButtonTextActive]}>
                Par nombre de jours
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
              onPress={() => setMode('manual')}
            >
              <Ionicons name="time-outline" size={18} color={mode === 'manual' ? TRAVELER_COLORS.primary : '#666'} />
              <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
                Sélection manuelle
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode par nombre de jours */}
          {mode === 'days' ? (
            <>
              {/* Nombre de jours */}
              <View style={styles.daysInputContainer}>
                <Text style={styles.daysInputLabel}>Nombre de jours de location</Text>
                <View style={styles.daysInputRow}>
                  <TouchableOpacity
                    style={styles.daysButton}
                    onPress={() => {
                      const current = parseInt(rentalDays) || 1;
                      if (current > 1) {
                        setRentalDays((current - 1).toString());
                      }
                    }}
                  >
                    <Ionicons name="remove" size={20} color={TRAVELER_COLORS.primary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.daysInput}
                    value={rentalDays}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      if (num >= 1 && num <= 365) {
                        setRentalDays(text);
                      } else if (text === '') {
                        setRentalDays('');
                      }
                    }}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.daysButton}
                    onPress={() => {
                      const current = parseInt(rentalDays) || 1;
                      if (current < 365) {
                        setRentalDays((current + 1).toString());
                      }
                    }}
                  >
                    <Ionicons name="add" size={20} color={TRAVELER_COLORS.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.daysInputHint}>
                  {rentalDays === '1' ? '1 jour' : `${rentalDays} jours`}
                </Text>
              </View>

              {/* Onglet Début uniquement */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, styles.tabButtonFull]}
                >
                  <Text style={styles.tabButtonTextActive}>
                    Date et heure de début
                  </Text>
                  <Text style={styles.tabButtonSubtextActive}>
                    {formatDate(tempStartDate)} à {formatTime(tempStartDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Sélecteurs Date et Heure */}
              <View style={styles.pickerContainer}>
                {/* Titres des colonnes */}
                <View style={styles.pickerColumnHeader}>
                  <Text style={styles.pickerColumnTitle}>Date</Text>
                </View>
                <View style={styles.pickerColumnHeader}>
                  <Text style={styles.pickerColumnTitle}>Heure</Text>
                </View>
                <View style={styles.pickerColumnHeader}>
                  <Text style={styles.pickerColumnTitle}>Minutes</Text>
                </View>
              </View>
              
              <View style={styles.pickerContainer}>
                {/* Colonne Date */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={datesScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={58}
                    decelerationRate="fast"
                  >
                    {dates.map((date, index) => {
                      const isDateSelected = 
                        date.getDate() === tempStartDate.getDate() &&
                        date.getMonth() === tempStartDate.getMonth() &&
                        date.getFullYear() === tempStartDate.getFullYear();
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dateToCheck = new Date(date);
                      dateToCheck.setHours(0, 0, 0, 0);
                      const isPast = dateToCheck.getTime() < today.getTime();
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.pickerItem,
                            isDateSelected && styles.pickerItemSelected,
                            isPast && styles.pickerItemDisabled
                          ]}
                          onPress={() => {
                            if (!isPast) {
                              const newDate = new Date(date);
                              newDate.setHours(tempStartDate.getHours(), 0, 0, 0);
                              setTempStartDate(newDate);
                            }
                          }}
                          disabled={isPast}
                        >
                          <Text style={[
                            styles.pickerText,
                            isDateSelected && styles.pickerTextSelected,
                            isPast && styles.pickerTextDisabled
                          ]}>
                            {formatDate(date)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                
                {/* Colonne Heures */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={hoursScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={58}
                    decelerationRate="fast"
                  >
                    {hours.map((hour) => {
                      const isHourSelected = tempStartDate.getHours() === hour;
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={[
                            styles.pickerItem,
                            isHourSelected && styles.pickerItemSelected
                          ]}
                          onPress={() => {
                            const newDate = new Date(tempStartDate);
                            newDate.setHours(hour, 0, 0, 0);
                            setTempStartDate(newDate);
                          }}
                        >
                          <Text style={[
                            styles.pickerText,
                            isHourSelected && styles.pickerTextSelected
                          ]}>
                            {hour.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                
                {/* Colonne Minutes - seulement 00 */}
                <View style={styles.pickerColumn}>
                  <View style={[styles.pickerItem, styles.minutesDisplay]}>
                    <Text style={styles.pickerText}>
                      00
                    </Text>
                  </View>
                </View>
              </View>

              {/* Aperçu de la date de fin calculée */}
              <View style={styles.calculatedEndContainer}>
                <Ionicons name="information-circle-outline" size={20} color={TRAVELER_COLORS.primary} />
                <View style={styles.calculatedEndContent}>
                  <Text style={styles.calculatedEndLabel}>Date et heure de fin (calculée automatiquement)</Text>
                  <Text style={styles.calculatedEndValue}>
                    {formatDate(tempEndDate)} à {formatTime(tempEndDate)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Mode manuel - Onglets Début/Fin */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'start' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('start')}
                >
                  <Text style={[styles.tabButtonText, activeTab === 'start' && styles.tabButtonTextActive]}>
                    Début
                  </Text>
                  <Text style={[styles.tabButtonSubtext, activeTab === 'start' && styles.tabButtonSubtextActive]}>
                    {formatDate(tempStartDate)} à {formatTime(tempStartDate)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'end' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('end')}
                >
                  <Text style={[styles.tabButtonText, activeTab === 'end' && styles.tabButtonTextActive]}>
                    Fin
                  </Text>
                  <Text style={[styles.tabButtonSubtext, activeTab === 'end' && styles.tabButtonSubtextActive]}>
                    {formatDate(tempEndDate)} à {formatTime(tempEndDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Titres des colonnes */}
              <View style={styles.pickerContainer}>
                <View style={styles.pickerColumnHeader}>
                  <Text style={styles.pickerColumnTitle}>Date</Text>
                </View>
                <View style={styles.pickerColumnHeader}>
                  <Text style={styles.pickerColumnTitle}>Heure</Text>
                </View>
                <View style={styles.pickerColumnHeader}>
                  <Text style={styles.pickerColumnTitle}>Minutes</Text>
                </View>
              </View>

              {/* Trois colonnes scrollables : Date, Heures, Minutes */}
              <View style={styles.pickerContainer}>
                {/* Colonne Date */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={datesScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={58}
                    decelerationRate="fast"
                  >
                    {dates.map((date, index) => {
                      const isDateSelected = 
                        date.getDate() === currentDate.getDate() &&
                        date.getMonth() === currentDate.getMonth() &&
                        date.getFullYear() === currentDate.getFullYear();
                      
                      // Vérifier si la date est dans le passé (pour l'onglet début)
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dateToCheck = new Date(date);
                      dateToCheck.setHours(0, 0, 0, 0);
                      const isPast = dateToCheck.getTime() < today.getTime();
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.pickerItem,
                            isDateSelected && styles.pickerItemSelected,
                            isPast && activeTab === 'start' && styles.pickerItemDisabled
                          ]}
                          onPress={() => {
                            if (!(isPast && activeTab === 'start')) {
                              handleDateSelect(date);
                            }
                          }}
                          disabled={isPast && activeTab === 'start'}
                        >
                          <Text style={[
                            styles.pickerText,
                            isDateSelected && styles.pickerTextSelected,
                            isPast && activeTab === 'start' && styles.pickerTextDisabled
                          ]}>
                            {formatDate(date)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                
                {/* Colonne Heures */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={hoursScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={58}
                    decelerationRate="fast"
                  >
                    {hours.map((hour) => {
                      const isHourSelected = currentDate.getHours() === hour;
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={[
                            styles.pickerItem,
                            isHourSelected && styles.pickerItemSelected
                          ]}
                          onPress={() => handleHourSelect(hour)}
                        >
                          <Text style={[
                            styles.pickerText,
                            isHourSelected && styles.pickerTextSelected
                          ]}>
                            {hour.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                
                {/* Colonne Minutes - seulement 00 */}
                <View style={styles.pickerColumn}>
                  <View style={[styles.pickerItem, styles.minutesDisplay]}>
                    <Text style={styles.pickerText}>
                      00
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
            </ScrollView>
          </View>

          {/* Bouton de confirmation fixé en bas (toujours visible) */}
          <View style={styles.confirmButtonWrapper}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>
                Rechercher pour {durationText}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
    flexDirection: 'column',
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContent: {
    paddingBottom: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabButtonActive: {
    backgroundColor: '#f0f0f0',
    borderColor: TRAVELER_COLORS.primary,
    borderWidth: 1.5,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  tabButtonTextActive: {
    color: TRAVELER_COLORS.primary,
  },
  tabButtonSubtext: {
    fontSize: 13,
    color: '#999',
  },
  tabButtonSubtextActive: {
    color: '#333',
    fontWeight: '500',
  },
  tabButtonFull: {
    width: '100%',
  },
  modeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#fff3e0',
    borderColor: TRAVELER_COLORS.primary,
    borderWidth: 1.5,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  modeButtonTextActive: {
    color: TRAVELER_COLORS.primary,
    fontWeight: '600',
  },
  daysInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f9fafb',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  daysInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  daysInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  daysButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: TRAVELER_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysInput: {
    width: 80,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TRAVELER_COLORS.primary,
    fontSize: 24,
    fontWeight: '700',
    color: TRAVELER_COLORS.primary,
  },
  daysInputHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  calculatedEndContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  calculatedEndContent: {
    flex: 1,
    marginLeft: 12,
  },
  calculatedEndLabel: {
    fontSize: 12,
    color: '#0369a1',
    marginBottom: 4,
    fontWeight: '500',
  },
  calculatedEndValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
  tabButtonFull: {
    width: '100%',
  },
  modeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#fff3e0',
    borderColor: TRAVELER_COLORS.primary,
    borderWidth: 1.5,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  modeButtonTextActive: {
    color: TRAVELER_COLORS.primary,
    fontWeight: '600',
  },
  daysInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f9fafb',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  daysInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  daysInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  daysButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: TRAVELER_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysInput: {
    width: 80,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TRAVELER_COLORS.primary,
    fontSize: 24,
    fontWeight: '700',
    color: TRAVELER_COLORS.primary,
  },
  daysInputHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  calculatedEndContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  calculatedEndContent: {
    flex: 1,
    marginLeft: 12,
  },
  calculatedEndLabel: {
    fontSize: 12,
    color: '#0369a1',
    marginBottom: 4,
    fontWeight: '500',
  },
  calculatedEndValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
    flex: 1,
  },
  pickerColumnHeader: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
    paddingBottom: 8,
  },
  pickerColumnTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  pickerScroll: {
    height: 200,
    width: '100%',
  },
  pickerScrollContent: {
    alignItems: 'center',
    paddingVertical: 75,
  },
  pickerItem: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  pickerItemSelected: {
    backgroundColor: TRAVELER_COLORS.primary,
    borderColor: TRAVELER_COLORS.primary,
  },
  pickerItemDisabled: {
    opacity: 0.4,
    backgroundColor: '#f0f0f0',
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  pickerTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  pickerTextDisabled: {
    color: '#999',
  },
  minutesDisplay: {
    // Utilise les mêmes styles que pickerItem pour l'alignement
    marginTop: 75, // Aligner avec le paddingVertical du ScrollView
  },
  confirmButton: {
    backgroundColor: TRAVELER_COLORS.primary,
    paddingVertical: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TRAVELER_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonWrapper: {
    paddingVertical: 16,
    paddingHorizontal: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    minHeight: 80,
  },
});

export default VehicleDateTimePickerModal;
