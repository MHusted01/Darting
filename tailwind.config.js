/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'ds-bg':                 '#fdf8f8',
        'ds-surface':            '#ffffff',
        'ds-surface-low':        '#f7f3f2',
        'ds-surface-container':  '#f1edec',
        'ds-on-surface':         '#1c1b1b',
        'ds-on-surface-variant': '#444748',
        'ds-outline':            '#747878',
        'ds-outline-variant':    '#c4c7c7',
        'ds-red':                '#ba1a1a',
        'ds-red-container':      '#ffdad6',
        'ds-green':              '#b8f0bc',
        'ds-green-dark':         '#1e502a',
      },
      fontFamily: {
        'barlow-condensed':       ['BarlowCondensed_700Bold'],
        'barlow-condensed-xbold': ['BarlowCondensed_800ExtraBold'],
        barlow:                   ['Barlow_400Regular'],
        'barlow-semi':            ['Barlow_600SemiBold'],
        'barlow-bold':            ['Barlow_700Bold'],
      },
    },
  },
  plugins: [],
};
