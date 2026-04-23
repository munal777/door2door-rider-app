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
    },
    web: {
      output: "static",
    },
    plugins: ["expo-router"],
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