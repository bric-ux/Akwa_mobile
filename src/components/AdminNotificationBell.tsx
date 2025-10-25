import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

interface AdminNotificationBellProps {
  onNavigate?: (path: string) => void;
}

export const AdminNotificationBell: React.FC<AdminNotificationBellProps> = ({ onNavigate }) => {
  const navigation = useNavigation();
  const { unreadCount, notifications } = useAdminNotifications();

  const handlePress = () => {
    if (onNavigate) {
      onNavigate('AdminNotifications');
    } else {
      navigation.navigate('AdminNotifications' as never);
    }
  };

  const getLatestNotification = () => {
    if (notifications.length === 0) return null;
    return notifications[0];
  };

  const latestNotification = getLatestNotification();

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <View style={styles.bellContainer}>
        <Ionicons 
          name="notifications-outline" 
          size={24} 
          color={unreadCount > 0 ? '#3b82f6' : '#6b7280'} 
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
      
      {latestNotification && (
        <View style={styles.notificationPreview}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {latestNotification.title}
          </Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {latestNotification.message}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bellContainer: {
    position: 'relative',
    marginRight: 12,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationPreview: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
});

export default AdminNotificationBell;

