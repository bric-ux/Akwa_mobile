import Constants from 'expo-constants';

/** Version affichée = `expo.version` dans app.json (build EAS / dev). */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.1.3';
