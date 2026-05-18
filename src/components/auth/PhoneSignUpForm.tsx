import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import PhoneNumberField from '../PhoneNumberField';
import PasswordValidation from '../PasswordValidation';
import {
  buildE164,
  dateDdMmYyyyToIso,
  E164_REGEX,
  PASSWORD_REGEX,
  validateAdultAgeDdMmYyyy,
} from '../../lib/phoneAuth';

type Step = 'form' | 'verify';

type Props = {
  onSuccess: () => void | Promise<void>;
};

const PhoneSignUpForm: React.FC<Props> = ({ onSuccess }) => {
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dial: '+225',
    localPhone: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: '',
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [code, setCode] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  const handleDateChange = (text: string) => {
    const numericText = text.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (numericText.length >= 1) formatted = numericText.slice(0, 2);
    if (numericText.length >= 3) formatted += '/' + numericText.slice(2, 4);
    if (numericText.length >= 5) formatted += '/' + numericText.slice(4, 8);
    setForm((p) => ({ ...p, dateOfBirth: formatted }));
    if (formatted.length === 10) {
      const v = validateAdultAgeDdMmYyyy(formatted);
      setDateError(v.isValid ? null : v.message);
    } else {
      setDateError(null);
    }
  };

  const sendCode = async () => {
    setError(null);
    if (!agreeTerms) {
      setError('Vous devez accepter les CGU');
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Prénom et nom requis');
      return;
    }
    if (form.password.length < 8) {
      setError('Mot de passe : 8 caractères minimum');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (!PASSWORD_REGEX.test(form.password)) {
      setError('Mot de passe trop faible (maj, min, chiffre, @$!%*?&)');
      return;
    }
    const age = validateAdultAgeDdMmYyyy(form.dateOfBirth);
    if (!age.isValid) {
      setError(age.message || 'Vous devez avoir au moins 18 ans');
      return;
    }
    const phoneE164 = buildE164(form.dial, form.localPhone);
    if (!E164_REGEX.test(phoneE164)) {
      setError('Numéro invalide. Vérifiez le pays et le numéro.');
      return;
    }
    const dateIso = dateDdMmYyyyToIso(form.dateOfBirth);
    if (!dateIso) {
      setError('Date de naissance invalide');
      return;
    }

    setLoading(true);
    try {
      const { data, error: sendErr } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone: phoneE164, purpose: 'signup' },
      });
      if (sendErr || data?.error) {
        setError(data?.error || "Erreur d'envoi du SMS");
        return;
      }
      setNormalizedPhone(phoneE164);
      setStep('verify');
      Alert.alert('Code envoyé', `SMS envoyé au ${phoneE164}`);
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Code à 6 chiffres');
      return;
    }
    const dateIso = dateDdMmYyyyToIso(form.dateOfBirth);
    if (!dateIso) {
      setError('Date de naissance invalide');
      return;
    }
    setLoading(true);
    try {
      const { data, error: verifyErr } = await supabase.functions.invoke('verify-phone-otp', {
        body: {
          phone: normalizedPhone,
          code,
          purpose: 'signup',
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: dateIso,
        },
      });
      if (verifyErr || data?.error || !data?.email) {
        setError(data?.error || 'Code incorrect');
        return;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: form.password,
      });
      if (signErr) {
        Alert.alert('Compte créé', 'Connectez-vous avec votre numéro.');
        await onSuccess();
        return;
      }
      await onSuccess();
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: sendErr } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone: normalizedPhone, purpose: 'signup' },
      });
      if (sendErr || data?.error) {
        setError(data?.error || "Erreur d'envoi");
      } else {
        Alert.alert('Nouveau code envoyé');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <View style={styles.wrap}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Un code à 6 chiffres a été envoyé à <Text style={styles.bold}>{normalizedPhone}</Text>.
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={verifyCode} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Vérifier et créer mon compte</Text>}
        </TouchableOpacity>
        <View style={styles.rowLinks}>
          <TouchableOpacity onPress={() => setStep('form')}>
            <Text style={styles.link}>← Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resend} disabled={loading}>
            <Text style={[styles.link, styles.linkAccent]}>Renvoyer le code</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.nameRow}>
        <View style={styles.nameCol}>
          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={styles.field}
            value={form.firstName}
            onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))}
            placeholder="Prénom"
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.field}
            value={form.lastName}
            onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))}
            placeholder="Nom"
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <Text style={styles.label}>Numéro de téléphone</Text>
      <PhoneNumberField
        dial={form.dial}
        local={form.localPhone}
        onDialChange={(v) => setForm((p) => ({ ...p, dial: v }))}
        onLocalChange={(v) => setForm((p) => ({ ...p, localPhone: v }))}
      />
      <Text style={styles.hint}>Un code SMS sera envoyé.</Text>

      <Text style={styles.label}>Date de naissance</Text>
      <TextInput
        style={[styles.field, dateError && styles.fieldError]}
        value={form.dateOfBirth}
        onChangeText={handleDateChange}
        placeholder="JJ/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        placeholderTextColor="#999"
      />
      {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}
      <Text style={styles.hint}>18 ans min.</Text>

      <Text style={styles.label}>Mot de passe</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={form.password}
          onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
          secureTextEntry={!showPassword}
          placeholder="••••••••"
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
        </TouchableOpacity>
      </View>
      <PasswordValidation password={form.password} />

      <Text style={styles.label}>Confirmer le mot de passe</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={form.confirmPassword}
          onChangeText={(v) => setForm((p) => ({ ...p, confirmPassword: v }))}
          secureTextEntry={!showPassword}
          placeholder="••••••••"
          placeholderTextColor="#999"
        />
      </View>

      <TouchableOpacity style={styles.termsRow} onPress={() => setAgreeTerms(!agreeTerms)}>
        <View style={[styles.checkbox, agreeTerms && styles.checkboxOn]}>
          {agreeTerms ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        <Text style={styles.termsText}>
          J&apos;accepte les{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://akwahome.com/terms')}>
            CGU
          </Text>
          .
        </Text>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.primaryBtn, (!agreeTerms || loading) && styles.primaryBtnDisabled]}
        onPress={sendCode}
        disabled={loading || !agreeTerms}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Recevoir le code SMS</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  infoBox: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  infoText: { fontSize: 14, color: '#9a3412', lineHeight: 20 },
  bold: { fontWeight: '700' },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameCol: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  field: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fieldError: { borderColor: '#dc2626' },
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
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  termsText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  termsLink: { color: '#ea580c', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rowLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  link: { fontSize: 14, color: '#666' },
  linkAccent: { color: '#ea580c', fontWeight: '600' },
});

export default PhoneSignUpForm;
