import { jest } from '@jest/globals';

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

require('react-native-reanimated').setUpTests();

jest.mock('expo-haptics');
