import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PasswordValidationProps {
  password: string;
}

interface ValidationRule {
  text: string;
  isValid: boolean;
  icon: string;
}

const PasswordValidation: React.FC<PasswordValidationProps> = ({ password }) => {
  const rules: ValidationRule[] = [
    {
      text: 'Au moins 8 caractères',
      isValid: password.length >= 8,
      icon: 'checkmark-circle'
    },
    {
      text: 'Une majuscule',
      isValid: /[A-Z]/.test(password),
      icon: 'checkmark-circle'
    },
    {
      text: 'Une minuscule',
      isValid: /[a-z]/.test(password),
      icon: 'checkmark-circle'
    },
    {
      text: 'Un chiffre',
      isValid: /\d/.test(password),
      icon: 'checkmark-circle'
    },
    {
      text: 'Un caractère spécial (@$!%*?&)',
      isValid: /[@$!%*?&]/.test(password),
      icon: 'checkmark-circle'
    }
  ];

  const allValid = rules.every(rule => rule.isValid);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Exigences du mot de passe :</Text>
      {rules.map((rule, index) => (
        <View key={index} style={styles.rule}>
          <Ionicons
            name={rule.isValid ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={rule.isValid ? '#4CAF50' : '#F44336'}
            style={styles.icon}
          />
          <Text style={[
            styles.ruleText,
            rule.isValid ? styles.validText : styles.invalidText
          ]}>
            {rule.text}
          </Text>
        </View>
      ))}
      {allValid && (
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          <Text style={styles.successText}>Mot de passe valide !</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 8,
  },
  ruleText: {
    fontSize: 12,
    flex: 1,
  },
  validText: {
    color: '#4CAF50',
  },
  invalidText: {
    color: '#F44336',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
});

export default PasswordValidation;

