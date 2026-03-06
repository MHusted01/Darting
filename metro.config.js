const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql'); // Add this line

module.exports = config;