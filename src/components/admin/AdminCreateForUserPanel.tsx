import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

export type AdminTargetUser = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  email_masked: string | null;
  phone_masked: string | null;
  is_phone_only: boolean;
};

type Props = {
  assetKind: 'property' | 'vehicle';
  targetUser: AdminTargetUser | null;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  onTargetUserChange: (u: AdminTargetUser | null) => void;
};

const AdminCreateForUserPanel: React.FC<Props> = ({
  assetKind,
  targetUser,
  enabled,
  onEnabledChange,
  onTargetUserChange,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindLabel = assetKind === 'vehicle' ? 'véhicule' : 'résidence';

  const verify = async () => {
    setError(null);
    onTargetUserChange(null);
    const id = identifier.trim();
    if (id.length < 3) {
      setError('Renseignez un email ou un numéro de téléphone.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-lookup-user', {
        body: { identifier: id },
      });
      if (invokeError) {
        const msg =
          (invokeError as { context?: { error?: string }; message?: string })?.context?.error ||
          (invokeError as { message?: string })?.message ||
          'Recherche impossible.';
        setError(typeof msg === 'string' ? msg : 'Aucun compte trouvé.');
        return;
      }
      if (!data?.user_id) {
        setError('Aucun compte trouvé avec cet identifiant.');
        return;
      }
      onTargetUserChange(data as AdminTargetUser);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur réseau.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setIdentifier('');
    onTargetUserChange(null);
    setError(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Ionicons name="shield-checkmark" size={20} color="#2c3e50" />
          <View style={styles.headerLabels}>
            <Text style={styles.title}>Mode administrateur</Text>
            <Text style={styles.subtitle}>
              Créer cette {kindLabel} pour le compte d'un autre utilisateur.
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={(v) => {
            onEnabledChange(v);
            if (!v) clear();
          }}
          trackColor={{ false: '#d1d5db', true: '#2E7D32' }}
          thumbColor="#fff"
        />
      </View>

      {enabled && (
        <View style={styles.body}>
          <Text style={styles.fieldLabel}>Email ou numéro de téléphone du propriétaire</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, (loading || !!targetUser) && styles.inputDisabled]}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="exemple@email.com ou +225..."
              editable={!loading && !targetUser}
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={() => {
                if (!targetUser) verify();
              }}
            />
            {targetUser ? (
              <TouchableOpacity style={styles.actionBtn} onPress={clear} disabled={loading}>
                <Text style={styles.actionBtnText}>Changer</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={verify}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Vérifier</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="close-circle" size={14} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {targetUser ? (
            <View style={styles.userCard}>
              {targetUser.avatar_url ? (
                <Image source={{ uri: targetUser.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={22} color="#6b7280" />
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {targetUser.full_name}
                </Text>
                <Text style={styles.userMeta} numberOfLines={1}>
                  {targetUser.is_phone_only
                    ? `Compte téléphone · ${targetUser.phone_masked || ''}`
                    : [targetUser.email_masked, targetUser.phone_masked].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            </View>
          ) : (
            <Text style={styles.hint}>
              Tant que l'utilisateur n'est pas vérifié, vous ne pouvez pas créer la {kindLabel}.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  headerLabels: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  body: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#1f2937',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  actionBtnPrimary: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  actionBtnTextPrimary: {
    color: '#fff',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  userMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
  },
});

export default AdminCreateForUserPanel;
