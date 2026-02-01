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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface VehicleDateTimeSelectorProps {
  startDateTime?: string; // ISO string
  endDateTime?: string; // ISO string
  onDateTimeChange: (startDateTime: string, endDateTime: string) => void;
  isDateUnavailable?: (date: Date) => boolean;
}

export const VehicleDateTimeSelector: React.FC<VehicleDateTimeSelectorProps> = ({
  startDateTime,
  endDateTime,
  onDateTimeChange,
  isDateUnavailable,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [pickingField, setPickingField] = useState<'startDate' | 'startTime' | 'endDate' | 'endTime' | null>(null);
  
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
    const defaultTime = new Date(now);
    defaultTime.setHours(9, 0, 0, 0); // 09:00 par défaut
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
    const defaultTime = new Date();
    defaultTime.setHours(18, 0, 0, 0); // 18:00 par défaut
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
  }, [startDateTime, endDateTime]);

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
        
        // Si la date de fin est avant la nouvelle date de début, ajuster
        const endDateOnly = new Date(tempEndDate);
        endDateOnly.setHours(0, 0, 0, 0);
        if (endDateOnly.getTime() < startDateOnly.getTime()) {
          setTempEndDate(selectedDate);
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
        
        // Si même date, ajuster l'heure de fin
        const endDateCheck = new Date(tempEndDate);
        endDateCheck.setHours(0, 0, 0, 0);
        if (endDateCheck.getTime() === startDateCheck.getTime()) {
          const minEndTime = new Date(startCombined);
          minEndTime.setHours(minEndTime.getHours() + 1);
          minEndTime.setMinutes(0);
          if (tempEndTime.getTime() <= minEndTime.getTime()) {
            setTempEndTime(minEndTime);
          }
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
        
        setTempEndDate(selectedDate);
        
        // Si même date, ajuster l'heure de fin
        if (newEndDateOnly.getTime() === startDateOnlyCheck.getTime()) {
          const startCombined = new Date(tempStartDate);
          startCombined.setHours(tempStartTime.getHours());
          startCombined.setMinutes(tempStartTime.getMinutes());
          const minEndTime = new Date(startCombined);
          minEndTime.setHours(minEndTime.getHours() + 1);
          minEndTime.setMinutes(0);
          setTempEndTime(minEndTime);
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
    // Combiner date et heure pour start
    // Créer la date en UTC directement avec l'heure locale pour éviter les conversions
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

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.selector} onPress={openModal}>
        <Ionicons name="calendar-outline" size={20} color="#e67e22" />
        <View style={styles.textContainer}>
          {startDateTime && endDateTime ? (
            <>
              <Text style={styles.label}>
                Prise: {formatDate(new Date(startDateTime))} à {formatTime(new Date(startDateTime))}
              </Text>
              <Text style={styles.label}>
                Rendu: {formatDate(new Date(endDateTime))} à {formatTime(new Date(endDateTime))}
              </Text>
            </>
          ) : (
            <Text style={styles.placeholder}>Sélectionner dates et heures de prise/rendu</Text>
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
              {/* Prise du véhicule */}
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
              </View>

              {/* Rendu du véhicule */}
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
              </View>

              {/* Aperçu de la durée */}
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Durée de location</Text>
                <Text style={styles.previewValue}>
                  {diffDays > 0 ? `${diffDays} jour${diffDays > 1 ? 's' : ''}` : '1 jour'}
                  {diffHours > 0 ? ` et ${diffHours} heure${diffHours > 1 ? 's' : ''}` : ''}
                </Text>
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
});
