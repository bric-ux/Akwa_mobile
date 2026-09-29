import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchPublicOwnerInfo, type PublicOwnerInfo } from '../utils/publicOwnerInfo';

type Props = {
  ownerId: string;
  accentColor?: string;
  onOpenVitrine: () => void;
};

/** Carte propriétaire publique (nom, bio, lien vitrine). */
const PublicOwnerCard: React.FC<Props> = ({
  ownerId,
  accentColor = '#0d9488',
  onOpenVitrine,
}) => {
  const [owner, setOwner] = useState<PublicOwnerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicOwnerInfo(ownerId)
      .then((info) => {
        if (!cancelled) setOwner(info);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    );
  }

  if (!owner) return null;

  const name =
    `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || 'Propriétaire';
  const initials =
    `${(owner.first_name?.[0] || '').toUpperCase()}${(owner.last_name?.[0] || '').toUpperCase()}` ||
    'P';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Propriétaire</Text>
      <View style={styles.row}>
        {owner.avatar_url ? (
          <Image source={{ uri: owner.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: accentColor + '22' }]}>
            <Text style={[styles.initials, { color: accentColor }]}>{initials}</Text>
          </View>
        )}
        <View style={styles.textCol}>
          <Text style={styles.name}>{name}</Text>
          {owner.bio ? (
            <Text style={styles.bio} numberOfLines={3}>
              {owner.bio}
            </Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.vitrineBtn, { borderColor: accentColor }]}
        onPress={onOpenVitrine}
        activeOpacity={0.8}
      >
        <Ionicons name="person-outline" size={18} color={accentColor} />
        <Text style={[styles.vitrineBtnText, { color: accentColor }]}>Voir la vitrine</Text>
        <Ionicons name="chevron-forward" size={16} color={accentColor} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e2e8f0' },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 16, fontWeight: '700' },
  textCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  bio: { marginTop: 4, fontSize: 13, lineHeight: 18, color: '#64748b' },
  vitrineBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#fff',
  },
  vitrineBtnText: { fontSize: 14, fontWeight: '700', flex: 1 },
});

export default PublicOwnerCard;
