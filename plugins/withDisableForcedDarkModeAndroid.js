const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

/**
 * Désactive le « force dark » Android (Xiaomi, Samsung, etc.) qui peut rendre
 * le texte des TextInput blanc sur fond clair.
 */
function withDisableForcedDarkModeAndroid(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:forceDarkAllowed',
      value: 'false',
    });
    return config;
  });
}

module.exports = withDisableForcedDarkModeAndroid;
