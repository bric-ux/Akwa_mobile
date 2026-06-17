import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MediaThumb from './MediaThumb';
import { isVideoUrl } from '../utils/media';
import { HOTEL_COLORS } from '../constants/colors';

interface HotelMediaPickerRowProps {
  label: string;
  hint?: string;
  mediaUris: string[];
  onChange: (uris: string[]) => void;
  maxTotal: number;
  maxVideos: number;
}

const HotelMediaPickerRow: React.FC<HotelMediaPickerRowProps> = ({
  label,
  hint,
  mediaUris,
  onChange,
  maxTotal,
  maxVideos,
}) => {
  const videoCount = mediaUris.filter((u) => isVideoUrl(u)).length;
  const remaining = maxTotal - mediaUris.length;

  const ensurePermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Accès à la galerie nécessaire.');
      return false;
    }
    return true;
  };

  const pickPhotos = async () => {
    if (!(await ensurePermission())) return;
    if (remaining <= 0) {
      Alert.alert('Limite', `Maximum ${maxTotal} médias (photos + vidéos).`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      onChange([...mediaUris, ...result.assets.map((a) => a.uri)]);
    }
  };

  const pickVideos = async () => {
    if (!(await ensurePermission())) return;
    if (remaining <= 0) {
      Alert.alert('Limite', `Maximum ${maxTotal} médias (photos + vidéos).`);
      return;
    }
    if (videoCount >= maxVideos) {
      Alert.alert('Limite vidéos', `Maximum ${maxVideos} vidéo(s).`);
      return;
    }
    const limit = Math.min(remaining, maxVideos - videoCount);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos',
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length) {
      onChange([...mediaUris, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removeAt = (index: number) => {
    onChange(mediaUris.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Text style={styles.meta}>
        {mediaUris.length}/{maxTotal} médias · {videoCount}/{maxVideos} vidéo(s)
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.addBtn} onPress={() => void pickPhotos()}>
          <Ionicons name="images-outline" size={20} color={HOTEL_COLORS.primary} />
          <Text style={styles.addBtnText}>Photos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => void pickVideos()}>
          <Ionicons name="videocam-outline" size={20} color={HOTEL_COLORS.primary} />
          <Text style={styles.addBtnText}>Vidéos</Text>
        </TouchableOpacity>
      </View>
      {mediaUris.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          {mediaUris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.thumbWrap}>
              <MediaThumb uri={uri} style={styles.thumb} />
              {isVideoUrl(uri) ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={10} color="#fff" />
                </View>
              ) : null}
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeAt(index)}>
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { marginTop: 8 },
  label: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 13, color: '#64748b', marginTop: 4 },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HOTEL_COLORS.primary,
    backgroundColor: HOTEL_COLORS.light,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: HOTEL_COLORS.primary },
  row: { marginTop: 12 },
  thumbWrap: { marginRight: 10, position: 'relative' },
  thumb: { width: 90, height: 90, borderRadius: 8 },
  videoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    padding: 2,
  },
  removeBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 11 },
});

export default HotelMediaPickerRow;
