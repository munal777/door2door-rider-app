import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function ProfileRouteRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(tabs)/profile" as any);
  }, [router]);

  return null;
}
