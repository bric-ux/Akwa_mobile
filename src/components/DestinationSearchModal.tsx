import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export interface DestinationSuggestion {
  id: string;
  text: string;
  type: 'city' | 'neighborhood' | 'commune' | 'property' | 'recent' | 'popular' | 'nearby';
  subtitle?: string;
  latitude?: number;
  longitude?: number;
}

const POPULAR_DESTINATIONS = ['Abidjan', 'Yamoussoukro', 'Grand-Bassam', 'San-Pédro', 'Bouaké'];

interface DestinationSearchModalProps {
  visible: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSelect: (suggestion: DestinationSuggestion) => void;
  onNearbyPress?: () => void;
  nearbyLoading?: boolean;
  /** Overlay plein écran dans un Modal parent — évite les Modals imbriqués (Android). */
  embedded?: boolean;
}

const DestinationSearchModal: React.FC<DestinationSearchModalProps> = ({
  visible,
  initialQuery = '',
  onClose,
  onSelect,
  onNearbyPress,
  nearbyLoading = false,
  embedded = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches] = useState<string[]>(['Abidjan', 'Yamoussoukro', 'Grand-Bassam', 'San-Pédro']);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setResults(buildDefaultSuggestions(initialQuery));
    }
  }, [visible, initialQuery]);

  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  // Android : bouton retour ferme la sélection de destination, pas le formulaire parent.
  useEffect(() => {
    if (!visible || !embedded || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, embedded, onClose]);

  const buildDefaultSuggestions = (filter = ''): DestinationSuggestion[] => {
    const term = filter.trim().toLowerCase();
    const items: DestinationSuggestion[] = [];

    recentSearches.forEach((search, index) => {
      if (!term || search.toLowerCase().includes(term)) {
        items.push({
          id: `recent_${index}`,
          text: search,
          type: 'recent',
          subtitle: 'Recherche récente',
        });
      }
    });

    POPULAR_DESTINATIONS.forEach((city, index) => {
      if (!term || city.toLowerCase().includes(term)) {
        if (!items.some((i) => i.text === city)) {
          items.push({
            id: `popular_${index}`,
            text: city,
            type: 'popular',
            subtitle: 'Destination populaire',
          });
        }
      }
    });

    return items.slice(0, 10);
  };

  const searchDestinations = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults(buildDefaultSuggestions(trimmed));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const suggestions: DestinationSuggestion[] = [];

      recentSearches.forEach((search, index) => {
        if (search.toLowerCase().includes(trimmed.toLowerCase())) {
          suggestions.push({
            id: `recent_${index}`,
            text: search,
            type: 'recent',
            subtitle: 'Recherche récente',
          });
        }
      });

      const { data: cities } = await supabase
        .from('locations')
        .select('id, name, type, latitude, longitude')
        .eq('type', 'city')
        .ilike('name', `%${trimmed}%`)
        .limit(5);

      cities?.forEach((city) => {
        suggestions.push({
          id: `city_${city.id}`,
          text: city.name,
          type: 'city',
          subtitle: 'Ville',
          latitude: city.latitude ?? undefined,
          longitude: city.longitude ?? undefined,
        });
      });

      const { data: communes } = await supabase
        .from('locations')
        .select('id, name, type, latitude, longitude')
        .eq('type', 'commune')
        .ilike('name', `%${trimmed}%`)
        .limit(5);

      communes?.forEach((commune) => {
        suggestions.push({
          id: `commune_${commune.id}`,
          text: commune.name,
          type: 'commune',
          subtitle: 'Commune',
          latitude: commune.latitude ?? undefined,
          longitude: commune.longitude ?? undefined,
        });
      });

      const { data: neighborhoods } = await supabase
        .from('locations')
        .select('id, name, type, parent_id, latitude, longitude')
        .eq('type', 'neighborhood')
        .ilike('name', `%${trimmed}%`)
        .limit(5);

      if (neighborhoods?.length) {
        const parentIds = neighborhoods.map((n) => n.parent_id).filter(Boolean) as string[];
        let parentNames: Record<string, string> = {};
        if (parentIds.length > 0) {
          const { data: parents } = await supabase
            .from('locations')
            .select('id, name')
            .in('id', parentIds);
          parents?.forEach((p) => { parentNames[p.id] = p.name; });
        }
        neighborhoods.forEach((neighborhood) => {
          const communeName = neighborhood.parent_id ? parentNames[neighborhood.parent_id] : '';
          suggestions.push({
            id: `neighborhood_${neighborhood.id}`,
            text: neighborhood.name,
            type: 'neighborhood',
            subtitle: communeName ? `${communeName} • Quartier` : 'Quartier',
            latitude: neighborhood.latitude ?? undefined,
            longitude: neighborhood.longitude ?? undefined,
          });
        });
      }

      setResults(suggestions.slice(0, 12));
    } catch (error) {
      console.error('Erreur recherche destination:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [recentSearches]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length < 2) {
      setResults(buildDefaultSuggestions(text));
      setLoading(false);
      return;
    }
    setLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      searchDestinations(text);
    }, 300);
  };

  const handleSelect = (item: DestinationSuggestion) => {
    Keyboard.dismiss();
    onSelect(item);
    onClose();
  };

  const iconForType = (type: DestinationSuggestion['type']) => {
    switch (type) {
      case 'nearby': return 'navigate';
      case 'recent': return 'time-outline';
      case 'popular': return 'star-outline';
      case 'commune': return 'business-outline';
      case 'neighborhood': return 'home-outline';
      case 'property': return 'home-outline';
      default: return 'location-outline';
    }
  };

  const colorForType = (type: DestinationSuggestion['type']) => {
    switch (type) {
      case 'nearby': return '#2E7D32';
      case 'recent': return '#6b7280';
      case 'popular': return '#e67e22';
      case 'commune': return '#8b5cf6';
      case 'neighborhood': return '#10b981';
      default: return '#2563eb';
    }
  };

  const renderItem = ({ item }: { item: DestinationSuggestion }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <Ionicons name={iconForType(item.type)} size={22} color={colorForType(item.type)} />
      <View style={styles.resultText}>
        <Text style={styles.resultName}>{item.text}</Text>
        {item.subtitle ? <Text style={styles.resultSubtitle}>{item.subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </TouchableOpacity>
  );

  const showEmpty = !loading && query.trim().length >= 2 && results.length === 0;

  const content = (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fermer">
              <Ionicons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Choisir une destination</Text>
            <View style={styles.closeBtn} />
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Ville, commune ou quartier"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleQueryChange('')}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {onNearbyPress ? (
            <TouchableOpacity
              style={styles.nearbyBtn}
              onPress={onNearbyPress}
              disabled={nearbyLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Rechercher autour de moi"
            >
              <View style={styles.nearbyIconWrap}>
                {nearbyLoading ? (
                  <ActivityIndicator size="small" color="#2E7D32" />
                ) : (
                  <Ionicons name="navigate" size={22} color="#2E7D32" />
                )}
              </View>
              <View style={styles.nearbyTextWrap}>
                <Text style={styles.nearbyTitle}>Près de moi</Text>
                <Text style={styles.nearbySubtitle}>Utiliser ma position actuelle</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.loadingText}>Recherche...</Text>
            </View>
          )}

          {!loading && query.trim().length < 2 && results.length > 0 && (
            <Text style={styles.sectionLabel}>Suggestions</Text>
          )}

          <FlatList
            style={styles.list}
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'android' ? 'on-drag' : 'none'}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              showEmpty ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>Aucun résultat pour « {query} »</Text>
                </View>
              ) : null
            }
          />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (!visible) return null;

  if (embedded) {
    return <View style={styles.embeddedOverlay}>{content}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  embeddedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 24,
    backgroundColor: '#fff',
  },
  list: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    padding: 0,
  },
  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  nearbyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyTextWrap: {
    flex: 1,
  },
  nearbyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
  },
  nearbySubtitle: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default DestinationSearchModal;
