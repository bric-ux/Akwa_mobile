import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCommissionRates } from '../lib/commissions';

interface VehicleDateTimeSelectorProps {
  startDateTime?: string; // ISO string
  endDateTime?: string; // ISO string
  onDateTimeChange: (startDateTime: string, endDateTime: string) => void;
  isDateUnavailable?: (date: Date) => boolean;
  hourlyRentalEnabled?: boolean; // Si false, mode simplifié : nombre de jours + date/heure départ
  // Props pour la prévisualisation du prix
  pricePerDay?: number;
  pricePerHour?: number;
  discountConfig?: {
    enabled?: boolean;
    minNights?: number | null;
    percentage?: number | null;
  };
  longStayDiscountConfig?: {
    enabled?: boolean;
    minNights?: number | null;
    percentage?: number | null;
  };
}

export const VehicleDateTimeSelector: React.FC<VehicleDateTimeSelectorProps> = ({
  startDateTime,
  endDateTime,
  onDateTimeChange,
  isDateUnavailable,
  hourlyRentalEnabled = false,
  pricePerDay = 0,
  pricePerHour = 0,
  discountConfig,
  longStayDiscountConfig,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [pickingField, setPickingField] = useState<'startDate' | 'startTime' | 'endDate' | 'endTime' | 'rentalDays' | null>(null);
  
  // Mode simplifié : nombre de jours de location
  const [rentalDays, setRentalDays] = useState<string>('1');
  
  // AMÉLIORATION: Mode durée personnalisée (jours + heures)
  const [customRentalHours, setCustomRentalHours] = useState<string>('0');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  
  // Mode rapide : sélection rapide de date
  const [quickDateMode, setQuickDateMode] = useState<'today' | 'tomorrow' | 'custom' | null>(null);
  
  // Heures suggérées
  const suggestedHours = [8, 9, 10, 14, 18];
  
  // Durées suggérées (pour mode rapide)
  const suggestedDurations = [
    { label: '1 jour', days: 1, hours: 0 },
    { label: '2 jours', days: 2, hours: 0 },
    { label: '3 jours', days: 3, hours: 0 },
    { label: '1 semaine', days: 7, hours: 0 },
  ];
  
  // Fonction pour créer une date avec une heure par défaut
  const createDefaultDateTime = (date: Date, defaultHour: number, defaultMinute: number = 0): Date => {
    const newDate = new Date(date);
    newDate.setHours(defaultHour, defaultMinute, 0, 0);
    return newDate;
  };

  // États temporaires - initialiser avec des heures par défaut (09:00 et 18:00)
  const getInitialStartDate = (): Date => {
    if (startDateTime) {
      return new Date(startDateTime);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const getInitialStartTime = (): Date => {
    if (startDateTime) {
      return new Date(startDateTime);
    }
    const now = new Date();
    // Utiliser l'heure actuelle arrondie à l'heure supérieure
    const defaultTime = new Date(now);
    defaultTime.setHours(now.getHours() + 1, 0, 0, 0); // Heure actuelle + 1 heure
    return defaultTime;
  };

  const getInitialEndDate = (): Date => {
    if (endDateTime) {
      return new Date(endDateTime);
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const getInitialEndTime = (): Date => {
    if (endDateTime) {
      return new Date(endDateTime);
    }
    const now = new Date();
    // Utiliser l'heure actuelle + 1 heure (pour la date de fin, qui est généralement demain)
    const defaultTime = new Date(now);
    defaultTime.setHours(now.getHours() + 1, 0, 0, 0); // Heure actuelle + 1 heure
    return defaultTime;
  };

  const [tempStartDate, setTempStartDate] = useState<Date>(getInitialStartDate());
  const [tempStartTime, setTempStartTime] = useState<Date>(getInitialStartTime());
  const [tempEndDate, setTempEndDate] = useState<Date>(getInitialEndDate());
  const [tempEndTime, setTempEndTime] = useState<Date>(getInitialEndTime());

  // Mettre à jour les états temporaires quand les props changent
  useEffect(() => {
    if (startDateTime) {
      const start = new Date(startDateTime);
      setTempStartDate(start);
      setTempStartTime(start);
    }
    if (endDateTime) {
      const end = new Date(endDateTime);
      setTempEndDate(end);
      setTempEndTime(end);
    }
    
    // Calculer le nombre de jours si on est en mode simplifié et qu'on a des dates
    if (!hourlyRentalEnabled && startDateTime && endDateTime) {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        setRentalDays(diffDays.toString());
      }
    }
  }, [startDateTime, endDateTime, hourlyRentalEnabled]);
  
  // Calculer automatiquement la date/heure de rendu dans le mode simplifié
  useEffect(() => {
    if (!hourlyRentalEnabled && tempStartDate && tempStartTime && rentalDays) {
      const days = parseInt(rentalDays) || 1;
      // AMÉLIORATION: Permettre d'ajouter des heures même si hourlyRentalEnabled est false
      // (pour le calcul de la date de fin, même si le prix sera calculé uniquement sur les jours)
      const hours = useCustomDuration ? (parseInt(customRentalHours) || 0) : 0;
      
      // Calculer la date/heure de fin
      const calculatedEndDate = new Date(tempStartDate);
      const calculatedEndTime = new Date(tempStartTime);
      
      // Ajouter les jours
      calculatedEndDate.setDate(calculatedEndDate.getDate() + days);
      
      // Ajouter les heures si spécifiées (même si location horaire non activée)
      if (hours > 0) {
        calculatedEndTime.setHours(calculatedEndTime.getHours() + hours);
        // Si les heures dépassent minuit, ajuster la date
        if (calculatedEndTime.getHours() < tempStartTime.getHours()) {
          calculatedEndDate.setDate(calculatedEndDate.getDate() + 1);
        }
      }
      
      setTempEndDate(calculatedEndDate);
      setTempEndTime(calculatedEndTime);
    }
  }, [hourlyRentalEnabled, tempStartDate, tempStartTime, rentalDays, customRentalHours, useCustomDuration]);
  
  // AMÉLIORATION: Calculer automatiquement l'heure de rendu = heure départ (même en mode complet)
  useEffect(() => {
    if (hourlyRentalEnabled && tempStartDate && tempStartTime) {
      // Si la date de fin est différente de la date de début, ajuster l'heure de fin = heure début
      const startDateOnly = new Date(tempStartDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(tempEndDate);
      endDateOnly.setHours(0, 0, 0, 0);
      
      // Si les dates sont différentes, synchroniser l'heure de fin avec l'heure de début
      if (endDateOnly.getTime() !== startDateOnly.getTime()) {
        const newEndTime = new Date(tempStartTime);
        setTempEndTime(newEndTime);
      }
    }
  }, [hourlyRentalEnabled, tempStartDate, tempStartTime, tempEndDate]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setPickingField(null);
      return;
    }
    
    if (!selectedDate) {
      if (Platform.OS === 'android') {
        setPickingField(null);
      }
      return;
    }

    const now = new Date();
    
    switch (pickingField) {
      case 'startDate':
        const startDateOnly = new Date(selectedDate);
        startDateOnly.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        setTempStartDate(selectedDate);
        
        // Si c'est aujourd'hui, ajuster l'heure à maintenant + 1 heure
        if (startDateOnly.getTime() === today.getTime()) {
          const minTime = new Date(now);
          minTime.setHours(minTime.getHours() + 1);
          minTime.setMinutes(0);
          setTempStartTime(minTime);
        }
        
        // Si la date de fin est avant ou égale à la nouvelle date de début, ajuster au lendemain
        const endDateOnly = new Date(tempEndDate);
        endDateOnly.setHours(0, 0, 0, 0);
        if (endDateOnly.getTime() <= startDateOnly.getTime()) {
          // Forcer la date de fin à être au moins le lendemain
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          setTempEndDate(nextDay);
        }
        
        if (Platform.OS === 'android') {
          setPickingField(null);
        }
        break;
        
      case 'startTime':
        const startCombined = new Date(tempStartDate);
        startCombined.setHours(selectedDate.getHours());
        startCombined.setMinutes(selectedDate.getMinutes());
        startCombined.setSeconds(0);
        startCombined.setMilliseconds(0);
        
        // Vérifier que l'heure est dans le futur si c'est aujourd'hui
        const startDateCheck = new Date(tempStartDate);
        startDateCheck.setHours(0, 0, 0, 0);
        const todayCheck = new Date(now);
        todayCheck.setHours(0, 0, 0, 0);
        
        if (startDateCheck.getTime() === todayCheck.getTime() && startCombined <= now) {
          const minTime = new Date(now);
          minTime.setHours(minTime.getHours() + 1);
          minTime.setMinutes(0);
          setTempStartTime(minTime);
        } else {
          setTempStartTime(startCombined);
        }
        
        // Si même date, forcer la date de fin au lendemain
        const endDateCheck = new Date(tempEndDate);
        endDateCheck.setHours(0, 0, 0, 0);
        if (endDateCheck.getTime() === startDateCheck.getTime()) {
          // Forcer la date de fin au lendemain
          const nextDay = new Date(tempStartDate);
          nextDay.setDate(nextDay.getDate() + 1);
          setTempEndDate(nextDay);
          // Ajuster l'heure de fin à la même heure que l'heure de début
          setTempEndTime(startCombined);
        }
        
        if (Platform.OS === 'android') {
          setPickingField(null);
        }
        break;
        
      case 'endDate':
        const newEndDateOnly = new Date(selectedDate);
        newEndDateOnly.setHours(0, 0, 0, 0);
        const startDateOnlyCheck = new Date(tempStartDate);
        startDateOnlyCheck.setHours(0, 0, 0, 0);
        
        if (newEndDateOnly.getTime() < startDateOnlyCheck.getTime()) {
          alert('La date de fin ne peut pas être avant la date de début');
          if (Platform.OS === 'android') {
            setPickingField(null);
          }
          return;
        }
        
        // Si même date, forcer au lendemain
        if (newEndDateOnly.getTime() === startDateOnlyCheck.getTime()) {
          alert('La date de rendu doit être strictement supérieure à la date de prise. La date de fin a été ajustée au lendemain.');
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          setTempEndDate(nextDay);
          // Ajuster l'heure de fin à la même heure que l'heure de début
          const startCombined = new Date(tempStartDate);
          startCombined.setHours(tempStartTime.getHours());
          startCombined.setMinutes(tempStartTime.getMinutes());
          setTempEndTime(startCombined);
        } else {
          setTempEndDate(selectedDate);
        }
        
        if (Platform.OS === 'android') {
          setPickingField(null);
        }
        break;
        
      case 'endTime':
        const endCombined = new Date(tempEndDate);
        endCombined.setHours(selectedDate.getHours());
        endCombined.setMinutes(selectedDate.getMinutes());
        endCombined.setSeconds(0);
        endCombined.setMilliseconds(0);
        
        // Vérifier que l'heure de fin est après l'heure de début
        const startFull = new Date(tempStartDate);
        startFull.setHours(tempStartTime.getHours());
        startFull.setMinutes(tempStartTime.getMinutes());
        
        if (endCombined <= startFull) {
          const minEndTime = new Date(startFull);
          minEndTime.setHours(minEndTime.getHours() + 1);
          minEndTime.setMinutes(0);
          setTempEndTime(minEndTime);
        } else {
          setTempEndTime(endCombined);
        }
        
        if (Platform.OS === 'android') {
          setPickingField(null);
        }
        break;
    }
  };

  const handleConfirm = () => {
    // Mode simplifié : calculer automatiquement la date/heure de rendu
    if (!hourlyRentalEnabled) {
      const days = parseInt(rentalDays) || 1;
      if (days < 1) {
        alert('Le nombre de jours doit être au moins 1');
        return;
      }
      
      // AMÉLIORATION: Prendre en compte les heures supplémentaires si activées
      const hours = useCustomDuration ? (parseInt(customRentalHours) || 0) : 0;
      
      // Calculer la date de rendu
      const calculatedEndDate = new Date(tempStartDate);
      const calculatedEndTime = new Date(tempStartTime);
      
      // Ajouter les jours
      calculatedEndDate.setDate(calculatedEndDate.getDate() + days);
      
      // Ajouter les heures supplémentaires si spécifiées
      if (hours > 0) {
        calculatedEndTime.setHours(calculatedEndTime.getHours() + hours);
        // Si les heures dépassent minuit, ajuster la date
        if (calculatedEndTime.getHours() < tempStartTime.getHours()) {
          calculatedEndDate.setDate(calculatedEndDate.getDate() + 1);
        }
      }
      
      setTempEndDate(calculatedEndDate);
      setTempEndTime(calculatedEndTime);
    }
    
    // Combiner date et heure pour start
    const startYear = tempStartDate.getFullYear();
    const startMonth = tempStartDate.getMonth();
    const startDay = tempStartDate.getDate();
    const startHours = tempStartTime.getHours();
    const startMinutes = tempStartTime.getMinutes();
    
    // Créer une date UTC avec l'heure locale (Côte d'Ivoire = GMT+0, donc UTC = heure locale)
    const start = new Date(Date.UTC(startYear, startMonth, startDay, startHours, startMinutes, 0, 0));

    // Combiner date et heure pour end
    const endYear = tempEndDate.getFullYear();
    const endMonth = tempEndDate.getMonth();
    const endDay = tempEndDate.getDate();
    const endHours = tempEndTime.getHours();
    const endMinutes = tempEndTime.getMinutes();
    
    // Créer une date UTC avec l'heure locale
    const end = new Date(Date.UTC(endYear, endMonth, endDay, endHours, endMinutes, 0, 0));

    // Vérifications finales
    const now = new Date();
    if (start <= now) {
      alert('L\'heure de début doit être dans le futur');
      return;
    }

    // Vérifier que la date de fin est strictement supérieure à la date de début
    const startDateOnly = new Date(startYear, startMonth, startDay);
    const endDateOnly = new Date(endYear, endMonth, endDay);
    
    if (startDateOnly.getTime() >= endDateOnly.getTime()) {
      alert('La date de rendu doit être strictement supérieure à la date de prise. Vous ne pouvez pas commencer et terminer la location le même jour.');
      return;
    }

    if (end <= start) {
      alert('L\'heure de fin doit être après l\'heure de début');
      return;
    }

    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diffHours < 1) {
      alert('La durée minimum de location est de 1 heure');
      return;
    }

    onDateTimeChange(start.toISOString(), end.toISOString());
    setShowModal(false);
    setPickingField(null);
  };

  const handleCancel = () => {
    setShowModal(false);
    setPickingField(null);
    // Réinitialiser les valeurs temporaires avec les valeurs par défaut
    if (startDateTime) {
      const start = new Date(startDateTime);
      setTempStartDate(start);
      setTempStartTime(start);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setTempStartDate(today);
      const defaultStartTime = new Date(today);
      defaultStartTime.setHours(9, 0, 0, 0);
      setTempStartTime(defaultStartTime);
    }
    if (endDateTime) {
      const end = new Date(endDateTime);
      setTempEndDate(end);
      setTempEndTime(end);
    } else {
      const endDate = new Date(tempStartDate);
      endDate.setDate(endDate.getDate() + 1);
      setTempEndDate(endDate);
      const defaultEndTime = new Date(endDate);
      defaultEndTime.setHours(18, 0, 0, 0);
      setTempEndTime(defaultEndTime);
    }
  };

  const openModal = () => {
    // Initialiser les valeurs temporaires avec des valeurs par défaut cohérentes
    if (startDateTime) {
      const start = new Date(startDateTime);
      setTempStartDate(start);
      setTempStartTime(start);
    } else {
      // Date de début : aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setTempStartDate(today);
      // Heure par défaut : 09:00 (au lieu de l'heure actuelle)
      const defaultStartTime = new Date(today);
      defaultStartTime.setHours(9, 0, 0, 0);
      setTempStartTime(defaultStartTime);
    }
    
    if (endDateTime) {
      const end = new Date(endDateTime);
      setTempEndDate(end);
      setTempEndTime(end);
    } else {
      // Date de fin : jour suivant la date de début
      const endDate = new Date(tempStartDate);
      endDate.setDate(endDate.getDate() + 1);
      setTempEndDate(endDate);
      // Heure par défaut : 18:00
      const defaultEndTime = new Date(endDate);
      defaultEndTime.setHours(18, 0, 0, 0);
      setTempEndTime(defaultEndTime);
    }
    
    setShowModal(true);
  };

  const getMinimumDate = (): Date => {
    if (pickingField === 'startDate') {
      return new Date();
    } else if (pickingField === 'endDate') {
      return tempStartDate;
    }
    return new Date();
  };

  const getMinimumTime = (): Date | undefined => {
    if (pickingField === 'startTime') {
      const now = new Date();
      const startDateOnly = new Date(tempStartDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      if (startDateOnly.getTime() === today.getTime()) {
        const minTime = new Date(now);
        minTime.setHours(minTime.getHours() + 1);
        minTime.setMinutes(0);
        return minTime;
      }
    } else if (pickingField === 'endTime') {
      const startDateOnly = new Date(tempStartDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(tempEndDate);
      endDateOnly.setHours(0, 0, 0, 0);
      
      if (startDateOnly.getTime() === endDateOnly.getTime()) {
        const startCombined = new Date(tempStartDate);
        startCombined.setHours(tempStartTime.getHours());
        startCombined.setMinutes(tempStartTime.getMinutes());
        const minTime = new Date(startCombined);
        minTime.setHours(minTime.getHours() + 1);
        minTime.setMinutes(0);
        return minTime;
      }
    }
    return undefined;
  };

  const getPickerValue = (): Date => {
    switch (pickingField) {
      case 'startDate':
        return tempStartDate;
      case 'startTime':
        return tempStartTime;
      case 'endDate':
        return tempEndDate;
      case 'endTime':
        return tempEndTime;
      default:
        return new Date();
    }
  };

  const getPickerMode = (): 'date' | 'time' => {
    return pickingField === 'startDate' || pickingField === 'endDate' ? 'date' : 'time';
  };

  // Fonction pour calculer la durée à partir de dates/heures
  const calculateDuration = (start: Date, end: Date) => {
    const totalHours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    
    const fullDaysFromHours = Math.floor(totalHours / 24);
    
    // Logique corrigée : utiliser les heures réelles comme base principale
    // Si totalHours >= 24 : utiliser fullDaysFromHours (basé sur les heures réelles)
    // Si totalHours < 24 : facturer 1 jour minimum
    let days: number;
    let hours: number;
    
    if (totalHours < 24) {
      days = 1;
      hours = 0;
    } else {
      // Utiliser directement les jours calculés à partir des heures (plus précis)
      days = fullDaysFromHours;
      const hoursInFullDays = fullDaysFromHours * 24;
      hours = totalHours - hoursInFullDays;
    }
    
    return { diffDays: days, diffHours: hours };
  };

  // Calculer la durée pour l'affichage dans le sélecteur (utiliser les props)
  const displayDuration = startDateTime && endDateTime
    ? calculateDuration(new Date(startDateTime), new Date(endDateTime))
    : { diffDays: 0, diffHours: 0 };

  // Calculer la durée pour l'aperçu dans le modal (utiliser les valeurs temporaires)
  const startFull = new Date(tempStartDate);
  startFull.setHours(tempStartTime.getHours());
  startFull.setMinutes(tempStartTime.getMinutes());
  const endFull = new Date(tempEndDate);
  endFull.setHours(tempEndTime.getHours());
  endFull.setMinutes(tempEndTime.getMinutes());
  const previewDuration = calculateDuration(startFull, endFull);
  const diffDays = previewDuration.diffDays;
  const diffHours = previewDuration.diffHours;
  
  // AMÉLIORATION: Fonction pour sélectionner une heure suggérée
  const handleSuggestedHour = (hour: number) => {
    const newTime = new Date(tempStartTime);
    newTime.setHours(hour, 0, 0, 0);
    
    // Vérifier que l'heure est dans le futur si c'est aujourd'hui
    const now = new Date();
    const startDateOnly = new Date(tempStartDate);
    startDateOnly.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    if (startDateOnly.getTime() === today.getTime() && newTime <= now) {
      // Si c'est aujourd'hui et l'heure est passée, utiliser l'heure actuelle + 1
      const minTime = new Date(now);
      minTime.setHours(minTime.getHours() + 1, 0, 0, 0);
      setTempStartTime(minTime);
      // Synchroniser l'heure de fin
      if (!hourlyRentalEnabled || tempEndDate.getTime() !== tempStartDate.getTime()) {
        setTempEndTime(new Date(minTime));
      }
    } else {
      setTempStartTime(newTime);
      // AMÉLIORATION: Synchroniser automatiquement l'heure de fin avec l'heure de début
      if (!hourlyRentalEnabled || tempEndDate.getTime() !== tempStartDate.getTime()) {
        setTempEndTime(new Date(newTime));
      }
    }
  };
  
  // AMÉLIORATION: Fonction pour calculer le prix estimé
  const calculateEstimatedPrice = (): number => {
    if (pricePerDay === 0) return 0;
    
    // Utiliser les valeurs de durée personnalisée si activées
    let days = diffDays || 1;
    let hours = diffHours || 0;
    
    // Si on est en mode simplifié avec durée personnalisée, utiliser ces valeurs
    if (!hourlyRentalEnabled && useCustomDuration) {
      days = parseInt(rentalDays) || 1;
      hours = parseInt(customRentalHours) || 0;
    }
    
    // Calculer le prix de base
    let basePrice = pricePerDay * days;
    
    // IMPORTANT: Si hourlyRentalEnabled est false, on ne facture PAS les heures supplémentaires
    // Les heures sont utilisées uniquement pour calculer la date de fin précise
    // Le prix est calculé uniquement sur les jours
    if (hourlyRentalEnabled && hours > 0 && pricePerHour > 0) {
      basePrice += pricePerHour * hours;
    } else if (!hourlyRentalEnabled && hours > 0) {
      // Si on a des heures mais que la location horaire n'est pas activée,
      // on peut arrondir au jour supérieur si les heures sont significatives
      // Par exemple: 4 jours + 8 heures = 5 jours de facturation
      // Mais pour l'instant, on facture uniquement les jours
      // (l'utilisateur peut voir la durée exacte dans la prévisualisation)
    }
    
    // Appliquer les réductions si disponibles
    if (discountConfig || longStayDiscountConfig) {
      let discountAmount = 0;
      
      // Priorité à la réduction long séjour
      if (longStayDiscountConfig?.enabled && longStayDiscountConfig.minNights && longStayDiscountConfig.percentage) {
        if (days >= longStayDiscountConfig.minNights) {
          discountAmount = Math.round(basePrice * (longStayDiscountConfig.percentage / 100));
        }
      } else if (discountConfig?.enabled && discountConfig.minNights && discountConfig.percentage) {
        if (days >= discountConfig.minNights) {
          discountAmount = Math.round(basePrice * (discountConfig.percentage / 100));
        }
      }
      
      basePrice -= discountAmount;
    }
    
    // Ajouter les frais de service (12% avec TVA)
    const commissionRates = getCommissionRates('vehicle');
    const serviceFeeHT = Math.round(basePrice * (commissionRates.travelerFeePercent / 100));
    const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
    const totalPrice = basePrice + serviceFeeHT + serviceFeeVAT;
    
    return totalPrice;
  };
  
  const estimatedPrice = calculateEstimatedPrice();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.selector} onPress={openModal}>
        <Ionicons name="calendar-outline" size={20} color="#e67e22" />
        <View style={styles.textContainer}>
          {startDateTime && endDateTime ? (
            <>
              <Text style={styles.label}>
                {!hourlyRentalEnabled ? 'Départ' : 'Prise'}: {formatDate(new Date(startDateTime))} à {formatTime(new Date(startDateTime))}
              </Text>
              <Text style={styles.label}>
                {!hourlyRentalEnabled ? 'Retour' : 'Rendu'}: {formatDate(new Date(endDateTime))} à {formatTime(new Date(endDateTime))}
              </Text>
            </>
          ) : (
            <Text style={styles.placeholder}>
              {!hourlyRentalEnabled 
                ? 'Sélectionner la durée et la date/heure de départ'
                : 'Sélectionner dates et heures de prise/rendu'}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContent} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancel}>
                <Text style={styles.cancelButton}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Dates et heures</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={styles.confirmButton}>Valider</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Mode simplifié : Nombre de jours + Date/Heure départ */}
              {!hourlyRentalEnabled ? (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Durée de location</Text>
                    
                    {/* AMÉLIORATION: Durées suggérées rapides */}
                    <View style={styles.suggestedDurationsContainer}>
                      <Text style={styles.suggestedDurationsLabel}>Durées rapides :</Text>
                      <View style={styles.suggestedDurationsRow}>
                        {suggestedDurations.map((duration) => {
                          const isSelected = parseInt(rentalDays) === duration.days && 
                                            (!useCustomDuration || parseInt(customRentalHours) === duration.hours);
                          return (
                            <TouchableOpacity
                              key={duration.label}
                              style={[
                                styles.suggestedDurationButton,
                                isSelected && styles.suggestedDurationButtonSelected
                              ]}
                              onPress={() => {
                                setRentalDays(duration.days.toString());
                                setCustomRentalHours('0');
                                setUseCustomDuration(false);
                              }}
                            >
                              <Text style={[
                                styles.suggestedDurationText,
                                isSelected && styles.suggestedDurationTextSelected
                              ]}>
                                {duration.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    
                    {/* Sélection manuelle de la durée */}
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldButton}>
                        <Ionicons name="calendar-number-outline" size={20} color="#e67e22" />
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>Nombre de jours</Text>
                          <TextInput
                            style={styles.numberInput}
                            value={rentalDays}
                            onChangeText={(text) => {
                              const num = parseInt(text) || 0;
                              if (num >= 1) {
                                setRentalDays(text);
                              } else if (text === '') {
                                setRentalDays('');
                              }
                            }}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor="#999"
                          />
                        </View>
                      </View>
                    </View>
                    
                    {/* AMÉLIORATION: Option pour ajouter des heures supplémentaires */}
                    {/* Permettre d'ajouter des heures même si hourlyRentalEnabled est false */}
                    {/* (pour le calcul précis de la date de fin, même si le prix sera sur les jours uniquement) */}
                    <View style={styles.fieldRow}>
                      <TouchableOpacity
                        style={[
                          styles.checkboxButton,
                          useCustomDuration && styles.checkboxButtonSelected
                        ]}
                        onPress={() => setUseCustomDuration(!useCustomDuration)}
                      >
                        <Ionicons 
                          name={useCustomDuration ? "checkbox" : "square-outline"} 
                          size={20} 
                          color={useCustomDuration ? "#e67e22" : "#666"} 
                        />
                        <Text style={[
                          styles.checkboxLabel,
                          useCustomDuration && styles.checkboxLabelSelected
                        ]}>
                          {hourlyRentalEnabled 
                            ? 'Ajouter des heures supplémentaires' 
                            : 'Ajouter des heures (pour date de fin précise)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    {useCustomDuration && (
                      <View style={styles.fieldRow}>
                        <View style={styles.fieldButton}>
                          <Ionicons name="time-outline" size={20} color="#e67e22" />
                          <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>
                              {hourlyRentalEnabled 
                                ? 'Heures supplémentaires' 
                                : 'Heures (date de fin précise)'}
                            </Text>
                            <TextInput
                              style={styles.numberInput}
                              value={customRentalHours}
                              onChangeText={(text) => {
                                const num = parseInt(text) || 0;
                                if (num >= 0 && num <= 23) {
                                  setCustomRentalHours(text);
                                } else if (text === '') {
                                  setCustomRentalHours('');
                                }
                              }}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#999"
                            />
                          </View>
                        </View>
                        {!hourlyRentalEnabled && (
                          <View style={styles.hoursInfoBox}>
                            <Ionicons name="information-circle-outline" size={16} color="#0369a1" />
                            <Text style={styles.hoursInfoText}>
                              Les heures sont utilisées pour calculer la date de fin précise. 
                              Le prix est facturé uniquement sur les jours.
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Date et heure de départ</Text>
                    
                    <View style={styles.fieldRow}>
                      <TouchableOpacity
                        style={styles.fieldButton}
                        onPress={() => setPickingField('startDate')}
                      >
                        <Ionicons name="calendar-outline" size={20} color="#e67e22" />
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>Date de départ</Text>
                          <Text style={styles.fieldValue}>{formatDate(tempStartDate)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fieldRow}>
                      <TouchableOpacity
                        style={styles.fieldButton}
                        onPress={() => setPickingField('startTime')}
                      >
                        <Ionicons name="time-outline" size={20} color="#e67e22" />
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>Heure de départ</Text>
                          <Text style={styles.fieldValue}>{formatTime(tempStartTime)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    </View>
                    
                    {/* AMÉLIORATION: Suggestions d'heures rapides */}
                    <View style={styles.suggestedHoursContainer}>
                      <Text style={styles.suggestedHoursLabel}>Heures suggérées :</Text>
                      <View style={styles.suggestedHoursRow}>
                        {suggestedHours.map((hour) => {
                          const isSelected = tempStartTime.getHours() === hour;
                          return (
                            <TouchableOpacity
                              key={hour}
                              style={[
                                styles.suggestedHourButton,
                                isSelected && styles.suggestedHourButtonSelected
                              ]}
                              onPress={() => handleSuggestedHour(hour)}
                            >
                              <Text style={[
                                styles.suggestedHourText,
                                isSelected && styles.suggestedHourTextSelected
                              ]}>
                                {hour.toString().padStart(2, '0')}:00
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* Aperçu de la date/heure de rendu (calculée automatiquement) */}
                  <View style={styles.infoSection}>
                    <Ionicons name="information-circle-outline" size={20} color="#0369a1" />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoTitle}>Date et heure de rendu (calculée automatiquement)</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(tempEndDate)} à {formatTime(tempEndTime)}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* Mode complet : Date/Heure départ + Date/Heure rendu */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Prise du véhicule</Text>
                    
                    <View style={styles.fieldRow}>
                      <TouchableOpacity
                        style={styles.fieldButton}
                        onPress={() => setPickingField('startDate')}
                      >
                        <Ionicons name="calendar-outline" size={20} color="#e67e22" />
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>Date</Text>
                          <Text style={styles.fieldValue}>{formatDate(tempStartDate)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fieldRow}>
                      <TouchableOpacity
                        style={styles.fieldButton}
                        onPress={() => setPickingField('startTime')}
                      >
                        <Ionicons name="time-outline" size={20} color="#e67e22" />
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>Heure</Text>
                          <Text style={styles.fieldValue}>{formatTime(tempStartTime)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    </View>
                    
                    {/* AMÉLIORATION: Suggestions d'heures rapides */}
                    <View style={styles.suggestedHoursContainer}>
                      <Text style={styles.suggestedHoursLabel}>Heures suggérées :</Text>
                      <View style={styles.suggestedHoursRow}>
                        {suggestedHours.map((hour) => {
                          const isSelected = tempStartTime.getHours() === hour;
                          return (
                            <TouchableOpacity
                              key={hour}
                              style={[
                                styles.suggestedHourButton,
                                isSelected && styles.suggestedHourButtonSelected
                              ]}
                              onPress={() => handleSuggestedHour(hour)}
                            >
                              <Text style={[
                                styles.suggestedHourText,
                                isSelected && styles.suggestedHourTextSelected
                              ]}>
                                {hour.toString().padStart(2, '0')}:00
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rendu du véhicule</Text>
                    
                    <View style={styles.fieldRow}>
                      <TouchableOpacity
                        style={styles.fieldButton}
                        onPress={() => setPickingField('endDate')}
                      >
                        <Ionicons name="calendar-outline" size={20} color="#e67e22" />
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>Date</Text>
                          <Text style={styles.fieldValue}>{formatDate(tempEndDate)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fieldRow}>
                      <TouchableOpacity
                        style={styles.fieldButton}
                        onPress={() => setPickingField('endTime')}
                      >
                        <Ionicons name="time-outline" size={20} color="#e67e22" />
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>Heure</Text>
                          <Text style={styles.fieldValue}>{formatTime(tempEndTime)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    </View>
                    
                    {/* AMÉLIORATION: Indication que l'heure de rendu = heure départ (par défaut) */}
                    {tempEndTime.getHours() === tempStartTime.getHours() && 
                     tempEndTime.getMinutes() === tempStartTime.getMinutes() &&
                     tempEndDate.getTime() !== tempStartDate.getTime() && (
                      <View style={styles.autoTimeInfo}>
                        <Ionicons name="information-circle-outline" size={16} color="#0369a1" />
                        <Text style={styles.autoTimeText}>
                          Heure de rendu = heure de départ (calculée automatiquement)
                        </Text>
                        <TouchableOpacity
                          onPress={() => setPickingField('endTime')}
                          style={styles.modifyTimeButton}
                        >
                          <Text style={styles.modifyTimeText}>Modifier</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* AMÉLIORATION: Prévisualisation en temps réel (durée + prix) */}
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Récapitulatif</Text>
                <View style={styles.previewContent}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Durée :</Text>
                    <Text style={styles.previewValue}>
                      {(() => {
                        // Afficher la durée selon le mode
                        let displayDays = diffDays || 1;
                        let displayHours = diffHours || 0;
                        
                        if (!hourlyRentalEnabled && useCustomDuration) {
                          displayDays = parseInt(rentalDays) || 1;
                          displayHours = parseInt(customRentalHours) || 0;
                        }
                        
                        let durationText = displayDays > 0 
                          ? `${displayDays} jour${displayDays > 1 ? 's' : ''}` 
                          : '1 jour';
                        if (displayHours > 0) {
                          durationText += ` et ${displayHours} heure${displayHours > 1 ? 's' : ''}`;
                        }
                        return durationText;
                      })()}
                    </Text>
                  </View>
                  {estimatedPrice > 0 && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Prix estimé :</Text>
                      <Text style={styles.previewPrice}>
                        {estimatedPrice.toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Picker pour iOS */}
            {Platform.OS === 'ios' && pickingField && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={getPickerValue()}
                  mode={getPickerMode()}
                  display="spinner"
                  onChange={handlePickerChange}
                  minimumDate={getPickerMode() === 'date' ? getMinimumDate() : undefined}
                  minimumTime={getPickerMode() === 'time' ? getMinimumTime() : undefined}
                  locale="fr_FR"
                />
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Picker pour Android */}
      {Platform.OS === 'android' && pickingField && (
        <DateTimePicker
          value={getPickerValue()}
          mode={getPickerMode()}
          display="default"
          onChange={handlePickerChange}
          minimumDate={getPickerMode() === 'date' ? getMinimumDate() : undefined}
          minimumTime={getPickerMode() === 'time' ? getMinimumTime() : undefined}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginVertical: 2,
  },
  duration: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  placeholder: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  confirmButton: {
    fontSize: 16,
    color: '#e67e22',
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fieldContent: {
    flex: 1,
    marginLeft: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  pickerContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  previewSection: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  previewTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0369a1',
  },
  numberInput: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minWidth: 60,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 12,
    color: '#0369a1',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
  // AMÉLIORATION: Styles pour les heures suggérées
  suggestedHoursContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  suggestedHoursLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  suggestedHoursRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedHourButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestedHourButtonSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  suggestedHourText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  suggestedHourTextSelected: {
    color: '#fff',
  },
  // AMÉLIORATION: Styles pour l'indication heure auto
  autoTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  autoTimeText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    marginLeft: 8,
  },
  modifyTimeButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0369a1',
  },
  modifyTimeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  // AMÉLIORATION: Styles pour la prévisualisation améliorée
  previewContent: {
    marginTop: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
  },
  previewPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  // AMÉLIORATION: Styles pour les durées suggérées
  suggestedDurationsContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  suggestedDurationsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  suggestedDurationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedDurationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestedDurationButtonSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  suggestedDurationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  suggestedDurationTextSelected: {
    color: '#fff',
  },
  // AMÉLIORATION: Styles pour la checkbox d'heures supplémentaires
  checkboxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkboxButtonSelected: {
    backgroundColor: '#fff3e0',
    borderColor: '#e67e22',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  checkboxLabelSelected: {
    color: '#e67e22',
    fontWeight: '500',
  },
  // AMÉLIORATION: Style pour l'info sur les heures (quand location horaire non activée)
  hoursInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  hoursInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    marginLeft: 8,
    lineHeight: 16,
  },
});
