import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import PhoneNumberField from '../PhoneNumberField';
import {
  buildE164,
  E164_REGEX,
  PASSWORD_REGEX,
  PASSWORD_EXAMPLE,
} from '../../lib/phoneAuth';
import { getEdgeFunctionErrorMessage } from '../../lib/edgeFunctionError';

type Mode = 'signin' | 'forgot-send' | 'forgot-verify';

type Props = {
  onSuccess: () => void | Promise<void>;
};

const PhoneSignInForm: React.FC<Props> = ({ onSuccess }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [dial, setDial] = useState('+225');
  const [local, setLocal] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    const phoneE164 = buildE164(dial, local);
    if (!E164_REGEX.test(phoneE164)) {
      setError('Numéro invalide. Vérifiez le pays et le numéro.');
      return;
    }
    if (!password) {
      setError('Saisissez votre mot de passe');
      return;
    }
    setLoading(true);
    try {
      const { data, error: resolveErr } = await supabase.functions.invoke('resolve-phone-email', {
        body: { phone: phoneE164 },
      });
      const resolvedEmail =
        data && typeof data === 'object' && 'email' in data ? (data as { email?: string }).email : null;
      if (resolveErr || !resolvedEmail) {
        const msg =
          (data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: string }).error)
            : null) ||
          resolveErr?.message ||
          'Aucun compte associé à ce numéro';
        setError(msg);
        return;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });
      if (signErr) {
        setError('Numéro ou mot de passe incorrect');
        return;
      }
      await onSuccess();
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async () => {
    setError(null);
    const phoneE164 = buildE164(dial, local);
    if (!E164_REGEX.test(phoneE164)) {
      setError('Numéro invalide. Vérifiez le pays et le numéro.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: sendErr } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone: phoneE164, purpose: 'reset' },
      });
      if (sendErr || (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error)) {
        setError(await getEdgeFunctionErrorMessage(data, sendErr, "Erreur d'envoi du SMS"));
        return;
      }
      setNormalizedPhone(phoneE164);
      setMode('forgot-verify');
      Alert.alert('Code envoyé', `SMS envoyé au ${phoneE164}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyResetCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Code à 6 chiffres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setError('Mot de passe trop faible (maj, min, chiffre, @$!%*?&)');
      return;
    }
    setLoading(true);
    try {
      const { data, error: vErr } = await supabase.functions.invoke('verify-phone-otp', {
        body: { phone: normalizedPhone, code, purpose: 'reset', newPassword },
      });
      if (vErr || data?.error || !data?.email) {
        setError(data?.error || 'Code incorrect ou expiré');
        return;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: newPassword,
      });
      if (signErr) {
        Alert.alert('Mot de passe modifié', 'Connectez-vous avec le nouveau mot de passe.');
        setMode('signin');
        setPassword('');
        return;
      }
      await onSuccess();
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'forgot-send') {
    return (
      <View style={styles.wrap}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Saisissez votre numéro pour recevoir un code SMS de réinitialisation.
          </Text>
        </View>
        <Text style={styles.label}>Numéro de téléphone</Text>
        <PhoneNumberField dial={dial} local={local} onDialChange={setDial} onLocalChange={setLocal} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={sendResetCode} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Recevoir le code SMS</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setMode('signin'); setError(null); }}>
          <Text style={styles.link}>← Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'forgot-verify') {
    return (
      <View style={styles.wrap}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Code envoyé à <Text style={styles.bold}>{normalizedPhone}</Text>
          </Text>
        </View>
        <Text style={styles.label}>Code de vérification</Text>
        <TextInput
          style={styles.otpInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          placeholderTextColor="#999"
        />
        <Text style={styles.label}>Nouveau mot de passe</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
            placeholder={PASSWORD_EXAMPLE}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Ex. {PASSWORD_EXAMPLE} — 8 car. min., maj., min., chiffre, @$!%*?&</Text>
        <Text style={styles.label}>Confirmer</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            placeholder={PASSWORD_EXAMPLE}
            placeholderTextColor="#999"
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={verifyResetCode} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Valider et se connecter</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setMode('forgot-send'); setError(null); setCode(''); }}>
          <Text style={styles.link}>← Modifier le numéro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Numéro de téléphone</Text>
      <PhoneNumberField dial={dial} local={local} onDialChange={setDial} onLocalChange={setLocal} />
      <View style={styles.labelRow}>
        <Text style={styles.label}>Mot de passe</Text>
        <TouchableOpacity onPress={() => { setMode('forgot-send'); setError(null); setPassword(''); }}>
          <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          placeholder="••••••••"
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Se connecter</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  infoBox: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  infoText: { fontSize: 14, color: '#9a3412', lineHeight: 20 },
  bold: { fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  forgotLink: { fontSize: 13, fontWeight: '600', color: '#ea580c' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#333' },
  otpInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    color: '#333',
  },
  hint: { fontSize: 12, color: '#6b7280', marginTop: -4 },
  errorText: { color: '#dc2626', fontSize: 14 },
  primaryBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#666', fontSize: 14, marginTop: 8 },
});

export default PhoneSignInForm;
