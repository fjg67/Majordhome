module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    'react-native-reanimated/plugin',
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@app': './src/app',
          '@features': './src/features',
          '@shared': './src/shared',
          '@services': './src/services',
          '@appTypes': './src/types',
        },
      },
    ],
  ],
};
