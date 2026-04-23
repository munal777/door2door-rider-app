import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Your computer's local IP address.
// Reads from EXPO_PUBLIC_API_IP env var first, falls back to the hardcoded value.
// To update: change the value in rider-app/.env  (run `ipconfig` on Windows to find your IP)
const PHYSICAL_DEVICE_IP = process.env.EXPO_PUBLIC_API_IP || '192.168.18.11';

const LOCAL_API_URL = 'http://localhost:8000/api';         // iOS Simulator / Web
const ANDROID_EMULATOR_URL = 'http://10.0.2.2:8000/api';  // Android Emulator
const PHYSICAL_DEVICE_URL = `http://${PHYSICAL_DEVICE_IP}:8000/api`; // Physical device

// Automatically select the correct base URL.
//
// FIX: Constants.appOwnership was deprecated in Expo SDK 46 and always returns
// null in SDK 54, so the old check never worked on physical devices.
// The correct API is Constants.executionEnvironment:
//   - 'storeClient'  → Expo Go (physical device)
//   - 'bare'         → bare React Native / Expo dev build
//   - 'standalone'   → production standalone build
const getBaseUrl = () => {
    const env = Constants.executionEnvironment;

    // Running in Expo Go on a real phone → need the machine's LAN IP
    if (env === ExecutionEnvironment.StoreClient) {
        return PHYSICAL_DEVICE_URL;
    }

    // Dev build or bare RN on a real Android device also can't use localhost
    if (env === ExecutionEnvironment.Bare && Platform.OS === 'android') {
        return PHYSICAL_DEVICE_URL;
    }

    // Emulator / Simulator
    return Platform.OS === 'android' ? ANDROID_EMULATOR_URL : LOCAL_API_URL;
};

export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  TIMEOUT: 30000,
  GOOGLE_MAPS_API_KEY:
    (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)
      ?.googleMapsApiKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "",
  ENDPOINTS: {
    // Auth endpoints
    LOGIN: '/accounts/auth/login/rider/',
    CHANGE_PASSWORD: '/accounts/auth/change-password/',
    SEND_OTP: '/accounts/auth/send-otp/',
    VALIDATE_OTP: '/accounts/auth/validate-otp/',

    // Rider endpoints
    RIDER_REGISTER: '/accounts/riders/register/',
    RIDER_PROFILE: '/riders/app/profile/',
    RIDER_AVAILABILITY: '/riders/app/availability/',
    RIDER_ASSIGNED_ORDERS: '/riders/app/orders/',
    RIDER_ASSIGNED_ORDER_DETAIL: (orderNumber: string) =>
      `/riders/app/orders/${orderNumber}/`,
    RIDER_ASSIGNED_ORDER_STATUS: (orderNumber: string) =>
      `/riders/app/orders/${orderNumber}/status/`,
    RIDER_ASSIGNED_ORDER_LOCATION_HTTP: (orderNumber: string) =>
      `/riders/app/orders/${orderNumber}/location/`,
  },
};
