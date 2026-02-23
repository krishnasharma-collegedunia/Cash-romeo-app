const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web support
config.resolver.platforms = ['web', 'ios', 'android', 'native'];

module.exports = config;
