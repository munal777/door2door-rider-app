/**
 * Door2Door Rider App Theme
 * Shared with mobile app for consistent cross-app UX.
 */

import { Platform } from 'react-native';

export const Colors = {
  text: '#111827',
  background: '#FFFFFF',

  primary: '#f57c20',
  primaryForeground: '#FFFFFF',

  secondary: '#fff4ec',
  secondaryForeground: '#1f2937',

  accent: '#fff4ec',
  accentForeground: '#1f2937',

  muted: '#f8fafc',
  mutedForeground: '#6b7280',

  destructive: '#e03e3e',
  destructiveForeground: '#FFFFFF',

  border: '#e5e7eb',
  input: '#FFFFFF',
  ring: '#f57c20',

  card: '#FFFFFF',
  cardForeground: '#111827',

  tabIconDefault: '#9CA3AF',
  tabIconSelected: '#f57c20',
  tint: '#f57c20',
  icon: '#9CA3AF',

  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.10)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.10)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.10)',
  error: '#e03e3e',
  errorBg: 'rgba(224, 62, 62, 0.10)',

  primaryLight: '#fff4ec',
  primaryDark: '#d96918',
  primaryMid: '#ff9a52',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  xxl: 24,
  '3xl': 30,
  xxxl: 30,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    mono: 'Courier New',
  },
  android: {
    sans: 'Roboto',
    mono: 'monospace',
  },
  default: {
    sans: 'system-ui',
    mono: 'monospace',
  },
});
