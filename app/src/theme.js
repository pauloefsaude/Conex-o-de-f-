import { Platform } from 'react-native';

export const colors = {
  navy: '#0E1B3D',
  navy2: '#1B2C5A',
  navySoft: '#2E4277',
  gold: '#C9A24B',
  goldSoft: '#F3E8CC',
  paper: '#F7F4EE',
  white: '#FFFFFF',
  ink: '#1D2433',
  mute: '#6B7280',
  line: '#E5E1D8',
  red: '#A3261B',
  redSoft: '#FBEAE8',
  green: '#1F7A4D',
};

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
};

export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };
export const space = (n) => n * 4;
