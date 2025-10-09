import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DateGuestsSelectorProps {
  checkIn?: string;
  checkOut?: string;
  adults: number;
  children: number;
  babies: number;
  onDateGuestsChange: (dates: { checkIn?: string; checkOut?: string }, guests: { adults: number; children: number; babies: number }) => void;
}

export const DateGuestsSelector: React.FC<DateGuestsSelectorProps> = ({
  checkIn,
  checkOut,
  adults,
  children,
  babies,
  onDateGuestsChange,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [tempCheckIn, setTempCheckIn] = useState(checkIn);
  const [tempCheckOut, setTempCheckOut] = useState(checkOut);
  const [tempAdults, setTempAdults] = useState(adults);
  const [tempChildren, setTempChildren] = useState(children);
  const [tempBabies, setTempBabies] = useState(babies);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Choisir';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getTotalGuests = () => {
    return tempAdults + tempChildren + tempBabies;
  };

  const getGuestsText = () => {
    const total = getTotalGuests();
    if (total === 0) {
      return 'Choisir';
    } else if (total === 1) {
      return '1 voyageur';
    } else {
      return `${total} voyageurs`;
    }
  };

  const handleApply = () => {
    onDateGuestsChange(
      { checkIn: tempCheckIn, checkOut: tempCheckOut },
      { adults: tempAdults, children: tempChildren, babies: tempBabies }
    );
    setShowModal(false);
  };

  const handleReset = () => {
    setTempCheckIn(undefined);
    setTempCheckOut(undefined);
    setTempAdults(1);
    setTempChildren(0);
    setTempBabies(0);
  };

  const incrementGuests = (type: 'adults' | 'children' | 'babies') => {
    switch (type) {
      case 'adults':
        if (tempAdults < 16) setTempAdults(tempAdults + 1);
        break;
      case 'children':
        if (tempChildren < 10) setTempChildren(tempChildren + 1);
        break;
      case 'babies':
        if (tempBabies < 5) setTempBabies(tempBabies + 1);
        break;
    }
  };

  const decrementGuests = (type: 'adults' | 'children' | 'babies') => {
    switch (type) {
      case 'adults':
        if (tempAdults > 1) setTempAdults(tempAdults - 1);
        break;
      case 'children':
        if (tempChildren > 0) setTempChildren(tempChildren - 1);
        break;
      case 'babies':
        if (tempBabies > 0) setTempBabies(tempBabies - 1);
        break;
    }
  };

  const openCalendar = (mode: 'checkIn' | 'checkOut') => {
    setCalendarMode(mode);
    setShowCalendar(true);
  };

  const openGuestsModal = () => {
    setShowModal(true);
  };

  // Fonctions pour le calendrier
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const isToday = (day: number) => {
    const today = new Date();
    const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return today.toDateString() === currentDate.toDateString();
  };

  const isSelected = (day: number) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return dateStr === tempCheckIn || dateStr === tempCheckOut;
  };

  const isInRange = (day: number) => {
    if (!tempCheckIn || !tempCheckOut) return false;
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return dateStr > tempCheckIn && dateStr < tempCheckOut;
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    
    if (calendarMode === 'checkIn') {
      setTempCheckIn(selectedDate);
      // Si la date de départ est antérieure à la date d'arrivée, la réinitialiser
      if (tempCheckOut && selectedDate >= tempCheckOut) {
        setTempCheckOut(undefined);
      }
    } else {
      setTempCheckOut(selectedDate);
    }
    
    setShowCalendar(false);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Jours du mois précédent (pour remplir la première semaine)
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <View key={`empty-${i}`} style={styles.calendarDay} />
      );
    }

    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelectedDay = isSelected(day);
      const isTodayDay = isToday(day);
      const isInRangeDay = isInRange(day);
      
      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isTodayDay && styles.todayDay,
            isSelectedDay && styles.selectedDay,
            isInRangeDay && styles.rangeDay,
          ]}
          onPress={() => handleDateSelect(day)}
        >
          <Text style={[
            styles.dayText,
            isTodayDay && styles.todayText,
            isSelectedDay && styles.selectedText,
            isInRangeDay && styles.rangeText,
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  return (
    <>
      <View style={styles.container}>
        {/* Arrivée */}
        <TouchableOpacity
          style={styles.item}
          onPress={() => openCalendar('checkIn')}
        >
          <Text style={styles.label}>Arrivée</Text>
          <Text style={styles.value}>{formatDate(tempCheckIn)}</Text>
        </TouchableOpacity>

        {/* Séparateur */}
        <View style={styles.separator} />

        {/* Départ */}
        <TouchableOpacity
          style={styles.item}
          onPress={() => openCalendar('checkOut')}
        >
          <Text style={styles.label}>Départ</Text>
          <Text style={styles.value}>{formatDate(tempCheckOut)}</Text>
        </TouchableOpacity>

        {/* Séparateur */}
        <View style={styles.separator} />

        {/* Voyageurs */}
        <TouchableOpacity
          style={styles.item}
          onPress={openGuestsModal}
        >
          <Text style={styles.label}>Voyageurs</Text>
          <Text style={styles.value}>{getGuestsText()}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal du calendrier */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.calendarModalContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => setShowCalendar(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.calendarTitle}>
              {calendarMode === 'checkIn' ? 'Date d\'arrivée' : 'Date de départ'}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.calendarContainer}>
            {/* Navigation du mois */}
            <View style={styles.monthNavigation}>
              <TouchableOpacity onPress={() => navigateMonth('prev')}>
                <Ionicons name="chevron-back" size={24} color="#2E7D32" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{getMonthName(currentMonth)}</Text>
              <TouchableOpacity onPress={() => navigateMonth('next')}>
                <Ionicons name="chevron-forward" size={24} color="#2E7D32" />
              </TouchableOpacity>
            </View>

            {/* Jours de la semaine */}
            <View style={styles.weekDays}>
              {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
                <Text key={day} style={styles.weekDayText}>{day}</Text>
              ))}
            </View>

            {/* Calendrier */}
            <View style={styles.calendar}>
              {renderCalendar()}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal pour les voyageurs */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>Réinitialiser</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nombre de voyageurs</Text>
            <TouchableOpacity onPress={handleApply}>
              <Text style={styles.applyText}>Valider</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Adultes */}
            <View style={styles.guestCard}>
              <View style={styles.guestInfo}>
                <Ionicons name="person" size={20} color="#2E7D32" />
                <View style={styles.guestDetails}>
                  <Text style={styles.guestLabel}>Adultes</Text>
                  <Text style={styles.guestSubLabel}>13 ans et plus</Text>
                </View>
              </View>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={[styles.guestButton, tempAdults <= 1 && styles.guestButtonDisabled]}
                  onPress={() => decrementGuests('adults')}
                  disabled={tempAdults <= 1}
                >
                  <Ionicons name="remove" size={18} color={tempAdults <= 1 ? '#ccc' : '#333'} />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{tempAdults}</Text>
                <TouchableOpacity
                  style={[styles.guestButton, tempAdults >= 16 && styles.guestButtonDisabled]}
                  onPress={() => incrementGuests('adults')}
                  disabled={tempAdults >= 16}
                >
                  <Ionicons name="add" size={18} color={tempAdults >= 16 ? '#ccc' : '#333'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Enfants */}
            <View style={styles.guestCard}>
              <View style={styles.guestInfo}>
                <Ionicons name="person-outline" size={20} color="#2E7D32" />
                <View style={styles.guestDetails}>
                  <Text style={styles.guestLabel}>Enfants</Text>
                  <Text style={styles.guestSubLabel}>2 à 12 ans</Text>
                </View>
              </View>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={[styles.guestButton, tempChildren <= 0 && styles.guestButtonDisabled]}
                  onPress={() => decrementGuests('children')}
                  disabled={tempChildren <= 0}
                >
                  <Ionicons name="remove" size={18} color={tempChildren <= 0 ? '#ccc' : '#333'} />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{tempChildren}</Text>
                <TouchableOpacity
                  style={[styles.guestButton, tempChildren >= 10 && styles.guestButtonDisabled]}
                  onPress={() => incrementGuests('children')}
                  disabled={tempChildren >= 10}
                >
                  <Ionicons name="add" size={18} color={tempChildren >= 10 ? '#ccc' : '#333'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Bébés */}
            <View style={styles.guestCard}>
              <View style={styles.guestInfo}>
                <Ionicons name="baby" size={20} color="#2E7D32" />
                <View style={styles.guestDetails}>
                  <Text style={styles.guestLabel}>Bébés</Text>
                  <Text style={styles.guestSubLabel}>Moins de 2 ans</Text>
                </View>
              </View>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={[styles.guestButton, tempBabies <= 0 && styles.guestButtonDisabled]}
                  onPress={() => decrementGuests('babies')}
                  disabled={tempBabies <= 0}
                >
                  <Ionicons name="remove" size={18} color={tempBabies <= 0 ? '#ccc' : '#333'} />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{tempBabies}</Text>
                <TouchableOpacity
                  style={[styles.guestButton, tempBabies >= 5 && styles.guestButtonDisabled]}
                  onPress={() => incrementGuests('babies')}
                  disabled={tempBabies >= 5}
                >
                  <Ionicons name="add" size={18} color={tempBabies >= 5 ? '#ccc' : '#333'} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.totalCard}>
              <Ionicons name="people-circle" size={24} color="#2E7D32" />
              <Text style={styles.totalText}>
                Total: {getTotalGuests()} voyageur{getTotalGuests() > 1 ? 's' : ''}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  calendarModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  calendarContainer: {
    flex: 1,
    padding: 20,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingVertical: 10,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  todayDay: {
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
  },
  selectedDay: {
    backgroundColor: '#2E7D32',
    borderRadius: 20,
  },
  rangeDay: {
    backgroundColor: '#f0f8f0',
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  todayText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  selectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  rangeText: {
    color: '#2E7D32',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  resetText: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  applyText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  guestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  guestDetails: {
    marginLeft: 15,
  },
  guestLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  guestSubLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  guestControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonDisabled: {
    backgroundColor: '#f8f8f8',
  },
  guestCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    minWidth: 30,
    textAlign: 'center',
  },
  totalCard: {
    backgroundColor: '#f0f8f0',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginLeft: 10,
  },
});

export default DateGuestsSelector;