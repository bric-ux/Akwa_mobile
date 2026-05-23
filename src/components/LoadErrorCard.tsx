import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LoadFailureKind } from '../utils/loadError';

type LoadErrorCardProps = {
  kind: LoadFailureKind;
  title: string;
  message: string;
  retryLabel: string;
  onRetry?: () => void;
  compact?: boolean;
};

export default function LoadErrorCard({
  kind,
  title,
  message,
  retryLabel,
  onRetry,
  compact = false,
}: LoadErrorCardProps) {
  const iconName =
    kind === 'offline'
      ? 'cloud-offline-outline'
      : kind === 'not_found'
        ? 'search-outline'
        : 'alert-circle-outline';

  const iconColor = kind === 'offline' ? '#b45309' : kind === 'not_found' ? '#64748b' : '#dc3545';

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Ionicons name={iconName} size={compact ? 40 : 48} color={iconColor} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && kind !== 'not_found' ? (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  cardCompact: {
    marginHorizontal: 0,
    marginVertical: 8,
    padding: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#e67e22',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
