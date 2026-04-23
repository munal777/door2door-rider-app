import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function IndexRouteRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(tabs)" as any);
  }, [router]);

  return null;
}
