/**
 * Expo config plugin that sets hermesCommand in android/app/build.gradle
 * to point to our wrapper script. The wrapper builds hermesc from source
 * using the Android SDK cmake that is already installed when Gradle runs.
 *
 * hermesCommand is priority #1 in PathUtils.kt — it overrides all fallbacks
 * including the broken 0.12.0 placeholder in sdks/hermesc/linux64-bin/.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');
const path = require('path');

module.exports = function withHermescCommand(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Insert hermesCommand into the react {} block.
    // The path is relative to android/app/ → ../../scripts/hermesc-wrapper.sh
    // which resolves to artifacts/mobile/scripts/hermesc-wrapper.sh.
    // We use $rootDir to anchor it absolutely so it works regardless of cwd.
    const hermesCommandLine =
      '    hermesCommand = "$rootDir/../../scripts/hermesc-wrapper.sh"';

    // Only patch once
    if (contents.includes('hermesc-wrapper.sh')) {
      return config;
    }

    // Insert after "react {" opening brace
    if (contents.includes('react {')) {
      contents = contents.replace('react {', `react {\n${hermesCommandLine}`);
    } else {
      // Fallback: append react block before the android block
      contents = contents.replace(
        /^android\s*\{/m,
        `react {\n${hermesCommandLine}\n}\n\nandroid {`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
