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
  const normalizeToMinuteSlot = (date: Date): Date => {
    const normalized = new Date(date);
    const minute = normalized.getMinutes();
    normalized.setMinutes(minute >= 30 ? 30 : 0, 0, 0);
    return normalized;
  };

  const roundUpToNextMinuteSlot = (date: Date): Date => {
    const rounded = new Date(date);
    rounded.setSeconds(0, 0);
    const minute = rounded.getMinutes();
    if (minute === 0 || minute === 30) return rounded;
    if (minute < 30) {
      rounded.setMinutes(30, 0, 0);
    } else {
      rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
    }
    return rounded;
  };

  const [activeTab, setActiveTab] = useState<'start' | 'end'>('start');
  const [mode, setMode] = useState<'manual' | 'days'>('manual'); // 'manual' = sélection manuelle, 'days' = nombre de jours
  const [rentalDays, setRentalDays] = useState<string>('1');
  const [tempStartDate, setTempStartDate] = useState<Date>(() => {
    if (startDateTime) return normalizeToMinuteSlot(new Date(startDateTime));
    return roundUpToNextMinuteSlot(new Date());
  });
  const [tempEndDate, setTempEndDate] = useState<Date>(() => {
    if (endDateTime) return normalizeToMinuteSlot(new Date(endDateTime));
    const base = roundUpToNextMinuteSlot(new Date());
    base.setHours(base.getHours() + 1);
    return base;
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
  const minutes = [0, 30];

  const currentDate = activeTab === 'start' ? tempStartDate : tempEndDate;
  const setCurrentDate = activeTab === 'start' ? setTempStartDate : setTempEndDate;

  const handleDateSelect = (date: Date) => {
    console.log(`📅 [VehicleDateTimePickerModal] handleDateSelect - activeTab: ${activeTab}, date sélectionnée:`, date.toISOString());
    const newDate = new Date(date);
    // Préserver l'heure et la minute du sélecteur courant.
    const currentHour = activeTab === 'start' ? tempStartDate.getHours() : tempEndDate.getHours();
    const currentMinute = activeTab === 'start' ? tempStartDate.getMinutes() : tempEndDate.getMinutes();
    newDate.setHours(currentHour, currentMinute, 0, 0);
    
    console.log(`📅 [VehicleDateTimePickerModal] handleDateSelect - Heure préservée: ${currentHour}, nouvelle date:`, newDate.toISOString());
    
    // Si c'est la date de début et que c'est aujourd'hui, arrondir à l'heure supérieure
    if (activeTab === 'start') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateOnly = new Date(date);
      selectedDateOnly.setHours(0, 0, 0, 0);
      
      if (selectedDateOnly.getTime() === today.getTime()) {
        // Si c'est aujourd'hui, forcer le prochain créneau valide (00 ou 30).
        const nextSlot = roundUpToNextMinuteSlot(new Date());
        if (newDate.getTime() < nextSlot.getTime()) {
          newDate.setTime(nextSlot.getTime());
        }
        console.log(`📅 [VehicleDateTimePickerModal] Date de début = aujourd'hui, heure/min ajustées`);
      }
      
      console.log(`📅 [VehicleDateTimePickerModal] Mise à jour tempStartDate:`, {
        avant: tempStartDate.toISOString(),
        après: newDate.toISOString(),
      });
      setTempStartDate(newDate);
      
      // Si la nouvelle date de début est après la date de fin, ajuster la date de fin
      // MAIS seulement si la date de fin a déjà été modifiée par l'utilisateur
      const startDateOnly = new Date(newDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(tempEndDate);
      endDateOnly.setHours(0, 0, 0, 0);
      
      if (startDateOnly.getTime() >= endDateOnly.getTime()) {
        // Ajuster la date de fin au lendemain de la date de début
        const adjustedEndDate = new Date(newDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
        adjustedEndDate.setHours(tempEndDate.getHours(), tempEndDate.getMinutes(), 0, 0);
        console.log(`⚠️ [VehicleDateTimePickerModal] Date de fin ajustée car <= date de début:`, {
          avant: tempEndDate.toISOString(),
          après: adjustedEndDate.toISOString(),
        });
        setTempEndDate(adjustedEndDate);
      }
    } else {
      // Si on sélectionne une date de fin
      console.log(`📅 [VehicleDateTimePickerModal] Mise à jour tempEndDate:`, {
        avant: tempEndDate.toISOString(),
        après: newDate.toISOString(),
      });
      setTempEndDate(newDate);
      
      // NE PAS ajuster automatiquement la date de début si elle est après la date de fin
      // L'utilisateur peut vouloir sélectionner d'abord la date de fin, puis la date de début
      // La validation se fera dans handleConfirm
    }
  };

  const handleHourSelect = (hour: number) => {
    console.log(`🕐 [VehicleDateTimePickerModal] handleHourSelect - activeTab: ${activeTab}, heure sélectionnée: ${hour}`);
    
    // Utiliser la date actuelle selon l'onglet (tempStartDate ou tempEndDate)
    const currentDateToUse = activeTab === 'start' ? tempStartDate : tempEndDate;
    const newDate = new Date(currentDateToUse);
    newDate.setHours(hour, currentDateToUse.getMinutes(), 0, 0);
    
    console.log(`🕐 [VehicleDateTimePickerModal] handleHourSelect - Date actuelle:`, currentDateToUse.toISOString(), `Nouvelle date:`, newDate.toISOString());
    
    // Vérifier si c'est aujourd'hui et si l'heure est dans le passé
    const now = new Date();
    const dateOnly = new Date(currentDateToUse);
    dateOnly.setHours(0, 0, 0, 0);
    const todayOnly = new Date(now);
    todayOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === todayOnly.getTime() && newDate.getTime() <= now.getTime()) {
      const minTime = roundUpToNextMinuteSlot(now);
      newDate.setTime(minTime.getTime());
      console.log(`⚠️ [VehicleDateTimePickerModal] Heure ajustée car dans le passé`);
    }
    
    if (activeTab === 'start') {
      console.log(`🕐 [VehicleDateTimePickerModal] Mise à jour tempStartDate:`, {
        avant: tempStartDate.toISOString(),
        après: newDate.toISOString(),
      });
      setTempStartDate(newDate);
      // Si la date/heure de début est après la date de fin, ajuster la date de fin
      if (newDate.getTime() >= tempEndDate.getTime()) {
        const adjustedEndDate = new Date(newDate);
        adjustedEndDate.setHours(adjustedEndDate.getHours() + 1, adjustedEndDate.getMinutes(), 0, 0);
        console.log(`⚠️ [VehicleDateTimePickerModal] Date de fin ajustée car <= date de début:`, {
          avant: tempEndDate.toISOString(),
          après: adjustedEndDate.toISOString(),
        });
        setTempEndDate(adjustedEndDate);
      }
    } else {
      console.log(`🕐 [VehicleDateTimePickerModal] Mise à jour tempEndDate:`, {
        avant: tempEndDate.toISOString(),
        après: newDate.toISOString(),
      });
      setTempEndDate(newDate);
      // NE PAS ajuster automatiquement la date de début si elle est après la date de fin
      // L'utilisateur peut vouloir sélectionner d'abord la date de fin, puis la date de début
      // La validation se fera dans handleConfirm
    }
  };

  const handleMinuteSelect = (minute: number) => {
    const currentDateToUse = activeTab === 'start' ? tempStartDate : tempEndDate;
    const newDate = new Date(currentDateToUse);
    newDate.setMinutes(minute, 0, 0);

    if (activeTab === 'start') {
      const now = new Date();
      const dateOnly = new Date(newDate);
      dateOnly.setHours(0, 0, 0, 0);
      const todayOnly = new Date(now);
      todayOnly.setHours(0, 0, 0, 0);
      if (dateOnly.getTime() === todayOnly.getTime() && newDate.getTime() <= now.getTime()) {
        const minTime = roundUpToNextMinuteSlot(now);
        newDate.setTime(minTime.getTime());
      }
      setTempStartDate(newDate);
      if (newDate.getTime() >= tempEndDate.getTime()) {
        const adjustedEndDate = new Date(newDate);
        adjustedEndDate.setHours(adjustedEndDate.getHours() + 1, adjustedEndDate.getMinutes(), 0, 0);
        setTempEndDate(adjustedEndDate);
      }
      return;
    }

    setTempEndDate(newDate);
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
    // S'assurer que les minutes sont alignées sur des créneaux 00/30.
    const finalStartDate = normalizeToMinuteSlot(new Date(tempStartDate));
    const finalEndDate = normalizeToMinuteSlot(new Date(tempEndDate));
    
    console.log(`🕐 [VehicleDateTimePickerModal] handleConfirm - AVANT ajustements:`, {
      tempStartDate: tempStartDate.toISOString(),
      tempStartDateHours: tempStartDate.getHours(),
      tempStartDateMinutes: tempStartDate.getMinutes(),
      tempEndDate: tempEndDate.toISOString(),
      tempEndDateHours: tempEndDate.getHours(),
      tempEndDateMinutes: tempEndDate.getMinutes(),
    });
    
    // Vérification finale : s'assurer que la date de fin est après la date de début
    const startDateOnly = new Date(finalStartDate);
    startDateOnly.setHours(0, 0, 0, 0);
    const endDateOnly = new Date(finalEndDate);
    endDateOnly.setHours(0, 0, 0, 0);
    
    if (endDateOnly.getTime() <= startDateOnly.getTime()) {
      // Si la date de fin est avant ou égale à la date de début, ajuster
      finalEndDate.setTime(finalStartDate.getTime());
      finalEndDate.setHours(finalEndDate.getHours() + 1, finalEndDate.getMinutes(), 0, 0);
      console.log(`⚠️ [VehicleDateTimePickerModal] Date de fin ajustée car <= date de début`);
    }
    
    // Vérifier que la date de début n'est pas dans le passé
    const now = new Date();
    if (finalStartDate.getTime() < now.getTime()) {
      finalStartDate.setTime(roundUpToNextMinuteSlot(now).getTime());
      console.log(`⚠️ [VehicleDateTimePickerModal] Date de début ajustée car dans le passé`);
    }
    
    const startISO = finalStartDate.toISOString();
    const endISO = finalEndDate.toISOString();
    
    console.log(`✅ [VehicleDateTimePickerModal] handleConfirm - FINAL:`, {
      startISO,
      startDate: finalStartDate.toISOString().split('T')[0],
      startHours: finalStartDate.getHours(),
      startMinutes: finalStartDate.getMinutes(),
      endISO,
      endDate: finalEndDate.toISOString().split('T')[0],
      endHours: finalEndDate.getHours(),
      endMinutes: finalEndDate.getMinutes(),
    });
    
    onConfirm(startISO, endISO);
    onClose();
  };

  // Calculer automatiquement la date de fin si on est en mode "jours"
  useEffect(() => {
    if (mode === 'days' && rentalDays) {
      const days = parseInt(rentalDays) || 1;
      const calculatedEndDate = new Date(tempStartDate);
      calculatedEndDate.setDate(calculatedEndDate.getDate() + days);
      calculatedEndDate.setHours(tempStartDate.getHours(), tempStartDate.getMinutes(), 0, 0);
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
      const minuteSlot = targetDate.getMinutes() >= 30 ? 30 : 0;
      const minuteIndex = minutes.findIndex((minute) => minute === minuteSlot);
      
      // Centrer l'élément sélectionné dans le ScrollView
      // Le contentContainerStyle a un paddingVertical de 60px
      // Donc le premier item commence à y=60, pas y=0
      // Formule : (paddingTop + index * itemHeight) - (scrollViewHeight / 2) + (itemHeight / 2)
      const itemHeight = 46; // 40px height + 3px margin top + 3px margin bottom
      const scrollViewHeight = 160;
      const paddingTop = 60; // paddingVertical du contentContainerStyle
      
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
      if (minutesScrollRef.current && minuteIndex >= 0) {
        const itemPosition = paddingTop + (minuteIndex * itemHeight);
        const scrollPosition = itemPosition - (scrollViewHeight / 2) + (itemHeight / 2);
        minutesScrollRef.current.scrollTo({ y: Math.max(0, scrollPosition), animated: true });
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

  // Mettre à jour tempStartDate et tempEndDate UNIQUEMENT quand le modal s'ouvre (visible passe de false à true)
  // ou quand startDateTime/endDateTime changent depuis l'extérieur
  // Ne pas réinitialiser quand on change d'onglet (activeTab)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (visible && !hasInitializedRef.current) {
      // Première ouverture du modal : initialiser depuis les props
      if (startDateTime) {
        const newStartDate = normalizeToMinuteSlot(new Date(startDateTime));
        setTempStartDate(newStartDate);
        console.log(`🔄 [VehicleDateTimePickerModal] Initialisation tempStartDate depuis props:`, {
          startDateTime,
          newStartDate: newStartDate.toISOString(),
          heures: newStartDate.getHours(),
        });
      }
      if (endDateTime) {
        const newEndDate = normalizeToMinuteSlot(new Date(endDateTime));
        setTempEndDate(newEndDate);
        console.log(`🔄 [VehicleDateTimePickerModal] Initialisation tempEndDate depuis props:`, {
          endDateTime,
          newEndDate: newEndDate.toISOString(),
          heures: newEndDate.getHours(),
        });
      }
      hasInitializedRef.current = true;
    } else if (!visible) {
      // Modal fermé : réinitialiser le flag pour la prochaine ouverture
      hasInitializedRef.current = false;
    }
  }, [visible, startDateTime, endDateTime]);
  
  // Scroller vers la date/heure actuelle quand on change d'onglet (sans réinitialiser les valeurs)
  useEffect(() => {
    if (visible && mode === 'manual') {
      scrollToDateAndHour(currentDate, 200);
    }
  }, [activeTab, visible, mode]); // Seulement quand activeTab change, pas quand currentDate change

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
                    snapToInterval={46}
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
                              newDate.setHours(tempStartDate.getHours(), tempStartDate.getMinutes(), 0, 0);
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
                    snapToInterval={46}
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
                            newDate.setHours(hour, tempStartDate.getMinutes(), 0, 0);
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
                
                {/* Colonne Minutes - 00 / 30 */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={minutesScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={46}
                    decelerationRate="fast"
                  >
                    {minutes.map((minute) => {
                      const isMinuteSelected = tempStartDate.getMinutes() === minute;
                      return (
                        <TouchableOpacity
                          key={`days-minute-${minute}`}
                          style={[
                            styles.pickerItem,
                            isMinuteSelected && styles.pickerItemSelected
                          ]}
                          onPress={() => {
                            const newDate = new Date(tempStartDate);
                            newDate.setMinutes(minute, 0, 0);
                            setTempStartDate(newDate);
                          }}
                        >
                          <Text style={[
                            styles.pickerText,
                            isMinuteSelected && styles.pickerTextSelected
                          ]}>
                            {minute.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
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
                    snapToInterval={46}
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
                    snapToInterval={46}
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
                
                {/* Colonne Minutes - 00 / 30 */}
                <View style={styles.pickerColumn}>
                  <ScrollView
                    ref={minutesScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerScrollContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={46}
                    decelerationRate="fast"
                  >
                    {minutes.map((minute) => {
                      const isMinuteSelected = currentDate.getMinutes() === minute;
                      return (
                        <TouchableOpacity
                          key={`manual-minute-${minute}`}
                          style={[
                            styles.pickerItem,
                            isMinuteSelected && styles.pickerItemSelected
                          ]}
                          onPress={() => handleMinuteSelect(minute)}
                        >
                          <Text style={[
                            styles.pickerText,
                            isMinuteSelected && styles.pickerTextSelected
                          ]}>
                            {minute.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
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
    height: 160,
    width: '100%',
  },
  pickerScrollContent: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  pickerItem: {
    width: '100%',
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 6,
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
    fontSize: 14,
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
    marginTop: 60, // Aligner avec le paddingVertical du ScrollView
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
