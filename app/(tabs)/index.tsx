import React, { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { Clock3, MapPinned, Route, UserRound } from "lucide-react-native";

import { riderService } from "@/services/rider.service";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { ActionCard } from "@/components/ui/ActionCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Colors, Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import { RiderAssignedOrderSummary, RiderProfile } from "@/types/api";

type AvailabilityStatus = "available" | "busy" | "offline";

export default function RiderDashboardTab() {
  const { user } = useAuth();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [orders, setOrders] = useState<RiderAssignedOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const [profileResponse, ordersResponse] = await Promise.all([
        riderService.getProfile(),
        riderService.getAssignedOrders(),
      ]);

      if (profileResponse.IsSuccess && profileResponse.Result) {
        setProfile(profileResponse.Result);
      }

      if (ordersResponse.IsSuccess && ordersResponse.Result) {
        setOrders(ordersResponse.Result);
      }
    } catch {
      Alert.alert("Error", "Failed to load rider dashboard");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const updateStatus = async (status: AvailabilityStatus) => {
    setIsUpdatingStatus(true);
    try {
      const response = await riderService.updateAvailability({ status });
      if (response.IsSuccess) {
        await loadDashboard();
      } else {
        Alert.alert("Error", "Failed to update availability");
      }
    } catch {
      Alert.alert("Error", "Failed to update availability");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusText = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const currentStatus = profile?.availability_status || "offline";
  const activeOrders = orders.filter(
    (order) => order.order_status !== "delivered",
  );
  const latestOrder = orders[0];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topHeader}>
        <Text style={styles.headerEyebrow}>Rider Workspace</Text>
        <Text style={styles.headerTitle}>
          Welcome back, {user?.first_name || "Rider"}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + Spacing.lg },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>You are currently on shift</Text>
          <Text style={styles.heroSubtitle}>
            Track assignments, update your status, and keep delivery flow
            moving.
          </Text>
          {profile ? (
            <View style={styles.badgeRow}>
              <StatusBadge
                status={profile.operational_status}
                label={getStatusText(profile.operational_status)}
              />
              <StatusBadge
                status={profile.availability_status}
                label={getStatusText(profile.availability_status)}
              />
            </View>
          ) : null}
        </View>

        {profile ? (
          <View style={styles.card}>
            <SectionHeader title="Quick Availability" />
            <View style={styles.quickActions}>
              <Button
                title="Available"
                variant={currentStatus === "available" ? "primary" : "outline"}
                onPress={() => updateStatus("available")}
                isLoading={isUpdatingStatus}
                size="sm"
                style={styles.quickButton}
              />
              <Button
                title="Busy"
                variant={currentStatus === "busy" ? "primary" : "outline"}
                onPress={() => updateStatus("busy")}
                isLoading={isUpdatingStatus}
                size="sm"
                style={styles.quickButton}
              />
              <Button
                title="Offline"
                variant={currentStatus === "offline" ? "primary" : "outline"}
                onPress={() => updateStatus("offline")}
                isLoading={isUpdatingStatus}
                size="sm"
                style={styles.quickButton}
              />
            </View>
            <Text style={styles.helperText}>
              Vehicle: {getStatusText(profile.vehicle_type)} •{" "}
              {profile.vehicle_number}
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Clock3 size={20} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.statNumber}>{orders.length}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
          <View style={styles.statCard}>
            <Route size={20} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.statNumber}>{activeOrders.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader title="Quick Actions" />
          <ActionCard
            icon={Clock3}
            title="Open Assigned Orders"
            subtitle={
              latestOrder
                ? `Latest ${latestOrder.order_number}`
                : "Review your delivery queue"
            }
            onPress={() => router.push("/(tabs)/orders")}
          />
          <ActionCard
            icon={MapPinned}
            title="Open Live Map"
            subtitle="Navigate pickup routes and share location"
            onPress={() => router.push("/(tabs)/pickup-map")}
          />
          <ActionCard
            icon={UserRound}
            title="Manage Profile"
            subtitle="Update emergency and vehicle details"
            onPress={() => router.push("/(tabs)/profile")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  headerEyebrow: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.xs,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSizes["2xl"],
    fontWeight: "800",
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  heroCard: {
    backgroundColor: Colors.primaryLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: Colors.mutedForeground,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: "flex-start",
    gap: 2,
  },
  statNumber: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: "800",
    marginTop: Spacing.xs,
  },
  statLabel: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
  quickActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  quickButton: {
    flex: 1,
  },
  helperText: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.sm,
  },
});
