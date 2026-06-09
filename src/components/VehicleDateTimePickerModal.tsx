import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TRAVELER_COLORS } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { computeVehicleRentalDurationFromIso } from '../lib/vehicleRentalDuration';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Même encodage ISO que handleConfirm (mur horaire affiché → UTC stockée). */
function displayDateToVehicleBookingIso(d: Date): string {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0)
  ).toISOString();
}

interface VehicleDateTimePickerModalProps {
  visible: boolean;
  startDateTime: string | null;
  endDateTime: string | null;
  onClose: () => void;
  onConfirm: (startDateTime: string, endDateTime: string, rentalDaysIntent?: number) => void;
  /**
   * Si défini, appelé avant onConfirm / fermeture. Retourner false pour garder le modal ouvert
   * (ex. créneau indisponible). Peut être async.
   */
  beforeConfirm?: (startISO: string, endISO: string) => boolean | Promise<boolean>;
}

const VehicleDateTimePickerModal: React.FC<VehicleDateTimePickerModalProps> = ({
  visible,
  startDateTime,
  endDateTime,
  onClose,
  onConfirm,
  beforeConfirm,
}) => {
  /** Parse l'ISO en date d'affichage : les chiffres de l'ISO (ex. 11:30) = heure affichée (pas de conversion timezone). */
  const isoToDisplayDate = (iso: string): Date => {
    const d = new Date(iso);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0);
  };

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
  const [confirmValidating, setConfirmValidating] = useState(false);
  const [mode, setMode] = useState<'manual' | 'days'>('manual'); // 'manual' = sélection manuelle, 'days' = nombre de jours
  const [rentalDays, setRentalDays] = useState<string>('1');
  const [tempStartDate, setTempStartDate] = useState<Date>(() => {
    if (startDateTime) return normalizeToMinuteSlot(isoToDisplayDate(startDateTime));
    return roundUpToNextMinuteSlot(new Date());
  });
  const [tempEndDate, setTempEndDate] = useState<Date>(() => {
    if (endDateTime) return normalizeToMinuteSlot(isoToDisplayDate(endDateTime));
    const base = roundUpToNextMinuteSlot(new Date());
    base.setHours(base.getHours() + 1);
    return base;
  });

  const datesScrollRef = useRef<GHScrollView | ScrollView>(null);
  const hoursScrollRef = useRef<GHScrollView | ScrollView>(null);
  const minutesScrollRef = useRef<GHScrollView | ScrollView>(null);
  const [parentScrollEnabled, setParentScrollEnabled] = useState(true);

  const PickerScrollView = Platform.OS === 'android' ? GHScrollView : ScrollView;

  const pickerScrollHandlers = {
    onScrollBeginDrag: () => setParentScrollEnabled(false),
    onScrollEndDrag: () => setParentScrollEnabled(true),
    onMomentumScrollEnd: () => setParentScrollEnabled(true),
  };

  const switchToDaysMode = () => {
    setActiveTab('start');
    setMode('days');
  };

  const switchToManualMode = () => {
    setMode('manual');
  };

  // Générer les dates à afficher (1 an à partir d'aujourd'hui)
  const generateDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Aujourd'hui
    dates.push(new Date(today));
    
    // 365 jours après (1 an)
    for (let i = 1; i <= 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const dates = generateDates();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 30];

  const currentDate = (mode === 'days' || activeTab === 'start') ? tempStartDate : tempEndDate;
  const effectiveTab = mode === 'days' ? 'start' : activeTab;

  const handleDateSelect = (date: Date) => {
    console.log(`📅 [VehicleDateTimePickerModal] handleDateSelect - activeTab: ${effectiveTab}, date sélectionnée:`, date.toISOString());
    const newDate = new Date(date);
    // Préserver l'heure et la minute du sélecteur courant.
    const currentHour = effectiveTab === 'start' ? tempStartDate.getHours() : tempEndDate.getHours();
    const currentMinute = effectiveTab === 'start' ? tempStartDate.getMinutes() : tempEndDate.getMinutes();
    newDate.setHours(currentHour, currentMinute, 0, 0);
    
    console.log(`📅 [VehicleDateTimePickerModal] handleDateSelect - Heure préservée: ${currentHour}, nouvelle date:`, newDate.toISOString());
    
    // Si c'est la date de début et que c'est aujourd'hui, arrondir à l'heure supérieure
    if (effectiveTab === 'start') {
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
    console.log(`🕐 [VehicleDateTimePickerModal] handleHourSelect - activeTab: ${effectiveTab}, heure sélectionnée: ${hour}`);
    
    // Utiliser la date actuelle selon l'onglet (tempStartDate ou tempEndDate)
    const currentDateToUse = effectiveTab === 'start' ? tempStartDate : tempEndDate;
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
    
    if (effectiveTab === 'start') {
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
    const currentDateToUse = effectiveTab === 'start' ? tempStartDate : tempEndDate;
    const newDate = new Date(currentDateToUse);
    newDate.setMinutes(minute, 0, 0);

    if (effectiveTab === 'start') {
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
      return date.getFullYear() !== today.getFullYear() ? `Demain (${date.getFullYear()})` : "Demain";
    }
    
    const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const year = date.getFullYear();
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${year}`;
  };

  const formatTime = (date: Date): string => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  /**
   * Alignée sur computeVehicleRentalDurationFromIso (inclusif long séjour + correction 24 h).
   * Mode « nombre de jours » : libellé du bouton = valeur saisie.
   */
  const calculateDuration = (): { days: number; hours: number } => {
    const diff = tempEndDate.getTime() - tempStartDate.getTime();
    if (diff <= 0) return { days: 0, hours: 0 };

    const startISO = displayDateToVehicleBookingIso(tempStartDate);
    const endISO = displayDateToVehicleBookingIso(tempEndDate);
    const d = computeVehicleRentalDurationFromIso(startISO, endISO);

    if (d.totalHours < 24) {
      return { days: 0, hours: d.remainingHours };
    }

    if (mode === 'days' && rentalDays) {
      const n = parseInt(rentalDays, 10);
      if (!Number.isNaN(n) && n >= 1) {
        return { days: n, hours: d.remainingHours };
      }
    }

    return { days: d.rentalDays, hours: d.remainingHours };
  };

  const handleConfirm = async () => {
    if (confirmValidating) return;
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
    
    // Validation finale : end doit être strictement après start
    // IMPORTANT : on compare les datetime complets.
    // Sinon, en mode horaire (même jour), une fin à 20h30 serait corrigée à tort en start+1h.
    if (finalEndDate.getTime() <= finalStartDate.getTime()) {
      finalEndDate.setTime(finalStartDate.getTime());
      // Conserver les minutes (00/30) et forcer +1h minimum
      finalEndDate.setHours(finalEndDate.getHours() + 1, finalEndDate.getMinutes(), 0, 0);
      console.log(`⚠️ [VehicleDateTimePickerModal] Date de fin ajustée car <= date de début (datetime)`);
    }
    
    // Vérifier que la date de début n'est pas dans le passé
    const now = new Date();
    if (finalStartDate.getTime() < now.getTime()) {
      finalStartDate.setTime(roundUpToNextMinuteSlot(now).getTime());
      console.log(`⚠️ [VehicleDateTimePickerModal] Date de début ajustée car dans le passé`);
    }
    
    // Heure affichée = heure stockée : on encode en ISO sans conversion timezone (évite -2h en base)
    const startISO = new Date(Date.UTC(
      finalStartDate.getFullYear(),
      finalStartDate.getMonth(),
      finalStartDate.getDate(),
      finalStartDate.getHours(),
      finalStartDate.getMinutes(),
      0,
      0
    )).toISOString();
    const endISO = new Date(Date.UTC(
      finalEndDate.getFullYear(),
      finalEndDate.getMonth(),
      finalEndDate.getDate(),
      finalEndDate.getHours(),
      finalEndDate.getMinutes(),
      0,
      0
    )).toISOString();
    
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

    if (beforeConfirm) {
      setConfirmValidating(true);
      try {
        const ok = await beforeConfirm(startISO, endISO);
        if (!ok) return;
      } finally {
        setConfirmValidating(false);
      }
    }

    const rentalDaysIntent =
      mode === 'days'
        ? Math.min(365, Math.max(1, parseInt(rentalDays, 10) || 1))
        : undefined;
    onConfirm(startISO, endISO, rentalDaysIntent);
    onClose();
  };

  // Calculer automatiquement la date de fin si on est en mode "jours"
  // N jours inclusifs = début + (N − 1) jours calendaires (N = 1 → même jour, aligné web)
  useEffect(() => {
    if (mode === 'days' && rentalDays) {
      const n = parseInt(rentalDays, 10) || 1;
      const calculatedEndDate = new Date(tempStartDate);
      const extraCalendarDays = Math.max(0, n - 1);
      calculatedEndDate.setDate(calculatedEndDate.getDate() + extraCalendarDays);
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

  // Scroll initial à l'ouverture ou au changement de mode / onglet (pas à chaque tap)
  useEffect(() => {
    if (!visible) return;
    if (mode === 'manual') {
      scrollToDateAndHour(currentDate, 250);
    } else {
      scrollToDateAndHour(tempStartDate, 250);
    }
  }, [visible, mode, activeTab]);

  const renderPickerColumns = () => {
    const dateSource = mode === 'days' ? tempStartDate : currentDate;

    return (
      <>
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

        <View style={styles.pickerContainer}>
          <View style={styles.pickerColumn}>
            <PickerScrollView
              ref={datesScrollRef}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              snapToInterval={46}
              decelerationRate="fast"
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              {...pickerScrollHandlers}
            >
              {dates.map((date, index) => {
                const isDateSelected =
                  date.getDate() === dateSource.getDate() &&
                  date.getMonth() === dateSource.getMonth() &&
                  date.getFullYear() === dateSource.getFullYear();

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dateToCheck = new Date(date);
                dateToCheck.setHours(0, 0, 0, 0);
                const isPast = dateToCheck.getTime() < today.getTime();
                const disablePast = mode === 'days' || activeTab === 'start';

                return (
                  <TouchableOpacity
                    key={`date-${index}`}
                    style={[
                      styles.pickerItem,
                      isDateSelected && styles.pickerItemSelected,
                      isPast && disablePast && styles.pickerItemDisabled,
                    ]}
                    onPress={() => {
                      if (!(isPast && disablePast)) {
                        if (mode === 'days') {
                          setActiveTab('start');
                        }
                        handleDateSelect(date);
                      }
                    }}
                    disabled={isPast && disablePast}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        isDateSelected && styles.pickerTextSelected,
                        isPast && disablePast && styles.pickerTextDisabled,
                      ]}
                    >
                      {formatDate(date)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </PickerScrollView>
          </View>

          <View style={styles.pickerColumn}>
            <PickerScrollView
              ref={hoursScrollRef}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              snapToInterval={46}
              decelerationRate="fast"
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              {...pickerScrollHandlers}
            >
              {hours.map((hour) => {
                const isHourSelected = dateSource.getHours() === hour;
                return (
                  <TouchableOpacity
                    key={`hour-${hour}`}
                    style={[styles.pickerItem, isHourSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      if (mode === 'days') {
                        setActiveTab('start');
                      }
                      handleHourSelect(hour);
                    }}
                  >
                    <Text style={[styles.pickerText, isHourSelected && styles.pickerTextSelected]}>
                      {hour.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </PickerScrollView>
          </View>

          <View style={styles.pickerColumn}>
            <PickerScrollView
              ref={minutesScrollRef}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              snapToInterval={46}
              decelerationRate="fast"
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              {...pickerScrollHandlers}
            >
              {minutes.map((minute) => {
                const isMinuteSelected = dateSource.getMinutes() === minute;
                return (
                  <TouchableOpacity
                    key={`minute-${minute}`}
                    style={[styles.pickerItem, isMinuteSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      if (mode === 'days') {
                        setActiveTab('start');
                      }
                      handleMinuteSelect(minute);
                    }}
                  >
                    <Text style={[styles.pickerText, isMinuteSelected && styles.pickerTextSelected]}>
                      {minute.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </PickerScrollView>
          </View>
        </View>
      </>
    );
  };

  // Mettre à jour tempStartDate et tempEndDate UNIQUEMENT quand le modal s'ouvre (visible passe de false à true)
  // ou quand startDateTime/endDateTime changent depuis l'extérieur
  // Ne pas réinitialiser quand on change d'onglet (activeTab)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (visible && !hasInitializedRef.current) {
      // Première ouverture : initialiser depuis les props (ISO = heure affichée, pas conversion tz)
      if (startDateTime) {
        const newStartDate = normalizeToMinuteSlot(isoToDisplayDate(startDateTime));
        setTempStartDate(newStartDate);
        console.log(`🔄 [VehicleDateTimePickerModal] Initialisation tempStartDate depuis props:`, {
          startDateTime,
          newStartDate: newStartDate.toISOString(),
          heures: newStartDate.getHours(),
        });
      }
      if (endDateTime) {
        const newEndDate = normalizeToMinuteSlot(isoToDisplayDate(endDateTime));
        setTempEndDate(newEndDate);
        console.log(`🔄 [VehicleDateTimePickerModal] Initialisation tempEndDate depuis props:`, {
          endDateTime,
          newEndDate: newEndDate.toISOString(),
          heures: newEndDate.getHours(),
        });
      }
      if (startDateTime && endDateTime) {
        const ns = normalizeToMinuteSlot(isoToDisplayDate(startDateTime));
        const ne = normalizeToMinuteSlot(isoToDisplayDate(endDateTime));
        const parts = computeVehicleRentalDurationFromIso(
          displayDateToVehicleBookingIso(ns),
          displayDateToVehicleBookingIso(ne)
        );
        if (parts.totalHours >= 24 && parts.rentalDays >= 1) {
          setRentalDays(String(parts.rentalDays));
        }
      }
      hasInitializedRef.current = true;
    } else if (!visible) {
      // Modal fermé : réinitialiser le flag pour la prochaine ouverture
      hasInitializedRef.current = false;
    }
  }, [visible, startDateTime, endDateTime]);
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
              nestedScrollEnabled
              scrollEnabled={parentScrollEnabled}
              keyboardShouldPersistTaps="handled"
            >
          {/* Sélecteur de mode */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'days' && styles.modeButtonActive]}
              onPress={switchToDaysMode}
            >
              <Ionicons name="calendar-number-outline" size={18} color={mode === 'days' ? TRAVELER_COLORS.primary : '#666'} />
              <Text style={[styles.modeButtonText, mode === 'days' && styles.modeButtonTextActive]}>
                Par nombre de jours
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
              onPress={switchToManualMode}
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
            </>
          )}
            </ScrollView>

            <View style={styles.pickerSection}>{renderPickerColumns()}</View>

            {mode === 'days' ? (
              <View style={styles.calculatedEndContainer}>
                <Ionicons name="information-circle-outline" size={20} color={TRAVELER_COLORS.primary} />
                <View style={styles.calculatedEndContent}>
                  <Text style={styles.calculatedEndLabel}>Date et heure de fin (calculée automatiquement)</Text>
                  <Text style={styles.calculatedEndValue}>
                    {formatDate(tempEndDate)} à {formatTime(tempEndDate)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Bouton de confirmation fixé en bas (toujours visible) */}
          <View style={styles.confirmButtonWrapper}>
            <TouchableOpacity
              style={[styles.confirmButton, confirmValidating && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={confirmValidating}
            >
              {confirmValidating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  Rechercher pour {durationText}
                </Text>
              )}
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
    height: SCREEN_HEIGHT * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.85,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
  },
  contentScroll: {
    flex: 1,
    minHeight: 0,
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
  pickerSection: {
    flexShrink: 0,
    paddingBottom: 4,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
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
  confirmButtonDisabled: {
    opacity: 0.75,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonWrapper: {
    flexShrink: 0,
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
