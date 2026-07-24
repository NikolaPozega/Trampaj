/**
 * Expo config plugin that replaces the default hermesCommand in
 * android/app/build.gradle with our wrapper script.
 *
 * The Expo 54 template already writes:
 *   hermesCommand = new File(["node", "--print", ...]).getParentFile()
 *                   .getAbsolutePath() + "/sdks/hermesc/%OS-BIN%/hermesc"
 *
 * That resolves to the broken RN 0.81.5 placeholder hermesc (v0.12.0)
 * which does not support async arrow functions.
 *
 * This plugin replaces THAT assignment with our wrapper script which
 * builds a working hermesc from source during the Gradle build (cmake
 * is available at that point — it gets installed by configureCMake tasks
 * that run concurrently with Metro bundling).
 *
 * Path note:
 *   rootDir    = <mobile>/android/         (contains settings.gradle)
 *   projectDir = <mobile>/android/app/
 *   Wrapper is at: <mobile>/scripts/hermesc-wrapper.sh
 *   → "$rootDir/../scripts/hermesc-wrapper.sh"
 */
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withHermescCommand(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const WRAPPER = '"$rootDir/../scripts/hermesc-wrapper.sh"';

    // Already patched
    if (contents.includes('hermesc-wrapper.sh')) {
      return config;
    }

    // The Expo template writes a dynamic hermesCommand that ends with
    // "/sdks/hermesc/%OS-BIN%/hermesc" — replace that entire assignment.
    const templateRegex =
      /hermesCommand = new File\(\["node",[\s\S]*?\/sdks\/hermesc\/%OS-BIN%\/hermesc"/;

    if (templateRegex.test(contents)) {
      contents = contents.replace(
        templateRegex,
        `hermesCommand = ${WRAPPER}`
      );
    } else if (contents.includes('react {')) {
      // Fallback: insert at top of react {} block
      contents = contents.replace(
        'react {',
        `react {\n    hermesCommand = ${WRAPPER}`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
