module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated v4 plugin (which internally includes worklets)
      'react-native-reanimated/plugin',
    ],
  };
};
