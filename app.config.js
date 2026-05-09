export default {
  expo: {
    name: "rider-app",
    slug: "rider-app",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "riderapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.munalpoudel.riderapp",
      infoPlist: {
        NSCameraUsageDescription:
          "Allow access to the camera to capture proof of delivery.",
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
      },
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.munalpoudel.riderapp",
      permissions: ["android.permission.CAMERA"],
    },
    web: {
      output: "static",
    },
    plugins: ["expo-router", "expo-camera"],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "b29416cb-3143-4d56-b7db-b60b60a3a793",
      },
    },
  },
};
