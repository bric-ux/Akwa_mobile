const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

/**
 * Désactive le « force dark » Android (Xiaomi, Samsung, etc.) qui peut rendre
 * le texte des TextInput blanc sur fond clair.
 */
function withDisableForcedDarkModeAndroid(config) {
  return withAndroidStyles(config, (config) => {
    const parent = AndroidConfig.Styles.getAppThemeGroup();

    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent,
      name: 'android:forceDarkAllowed',
      value: 'false',
    });

    // Heure / batterie en noir sur fond clair (évite une barre de statut « toute blanche »)
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent,
      name: 'android:windowDrawsSystemBarBackgrounds',
      value: 'true',
    });
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent,
      name: 'android:windowLightStatusBar',
      value: 'true',
    });

    return config;
  });
}

module.exports = withDisableForcedDarkModeAndroid;
