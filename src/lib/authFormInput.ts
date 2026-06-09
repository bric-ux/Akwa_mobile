import { Platform, TextStyle } from 'react-native';

/** Texte saisi lisible sur fond clair (autofill / dark mode forcé Android). */
export const AUTH_FORM_TEXT_COLOR = '#111827';

export const AUTH_FORM_PLACEHOLDER_COLOR = '#6b7280';

export const authFormInputTextStyle: TextStyle = {
  color: AUTH_FORM_TEXT_COLOR,
  ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
};
