import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

const DISMISS_KEY = 'listing_draft_resume_dismissed_v1';

type DraftItem = {
  kind: 'hotel' | 'monthly';
  id: string;
  title: string;
  updatedAt: string;
};

/**
 * Bulle à l’entrée de l’app : propose de reprendre un brouillon hôtel / bail.
 */
export default function DraftResumeBubble() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setDraft(null);
      setVisible(false);
      return;
    }
    try {
      const dismissedRaw = await AsyncStorage.getItem(DISMISS_KEY);
      const dismissed: Record<string, string> = dismissedRaw
        ? JSON.parse(dismissedRaw)
        : {};

      const [hotelRes, monthlyRes] = await Promise.all([
        supabase
          .from('hotel_establishments')
          .select('id, title, updated_at')
          .eq('host_id', user.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1),
        supabase
          .from('monthly_rental_listings')
          .select('id, title, updated_at')
          .eq('owner_id', user.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1),
      ]);

      const hotel = hotelRes.data?.[0];
      const monthly = monthlyRes.data?.[0];
      let next: DraftItem | null = null;
      if (hotel && monthly) {
        const hTs = new Date(hotel.updated_at || 0).getTime();
        const mTs = new Date(monthly.updated_at || 0).getTime();
        next =
          hTs >= mTs
            ? { kind: 'hotel', id: hotel.id, title: hotel.title, updatedAt: hotel.updated_at || '' }
            : { kind: 'monthly', id: monthly.id, title: monthly.title, updatedAt: monthly.updated_at || '' };
      } else if (hotel) {
        next = { kind: 'hotel', id: hotel.id, title: hotel.title, updatedAt: hotel.updated_at || '' };
      } else if (monthly) {
        next = { kind: 'monthly', id: monthly.id, title: monthly.title, updatedAt: monthly.updated_at || '' };
      }

      if (!next) {
        setDraft(null);
        setVisible(false);
        return;
      }
      const sig = `${next.kind}:${next.id}:${next.updatedAt}`;
      if (dismissed[sig]) {
        setDraft(null);
        setVisible(false);
        return;
      }
      setDraft(next);
      setVisible(true);
    } catch {
      setDraft(null);
      setVisible(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const dismiss = async () => {
    if (!draft) {
      setVisible(false);
      return;
    }
    const sig = `${draft.kind}:${draft.id}:${draft.updatedAt}`;
    try {
      const raw = await AsyncStorage.getItem(DISMISS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[sig] = new Date().toISOString();
      await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const continueDraft = () => {
    if (!draft) return;
    setVisible(false);
    if (draft.kind === 'hotel') {
      navigation.navigate('AddHotelEstablishment', { establishmentId: draft.id });
    } else {
      navigation.navigate('EditMonthlyRentalListing', { listingId: draft.id });
    }
  };

  if (!visible || !draft) return null;

  const kindLabel = draft.kind === 'hotel' ? 'établissement hôtel' : 'annonce bail longue durée';

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => void dismiss()}>
      <Pressable style={styles.backdrop} onPress={() => void dismiss()}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="document-text-outline" size={22} color="#0d9488" />
          </View>
          <Text style={styles.title}>Brouillon en cours</Text>
          <Text style={styles.body}>
            Vous avez un {kindLabel} non terminé : « {draft.title || 'Sans titre'} ». Reprendre
            maintenant ?
          </Text>
          <TouchableOpacity style={styles.primary} onPress={continueDraft} activeOpacity={0.9}>
            <Text style={styles.primaryText}>Continuer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => void dismiss()} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>Plus tard</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginBottom: 18,
  },
  primary: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
});
