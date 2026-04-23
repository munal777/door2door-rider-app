import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { riderService } from "@/services/rider.service";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Colors, Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import { RiderProfile } from "@/types/api";

type AvailabilityStatus = "available" | "busy" | "offline";

export default function AvailabilityTab() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async () => {
    try {
      const response = await riderService.getProfile();
      if (response.IsSuccess && response.Result) {
        setProfile(response.Result);
      }
    } catch {
      Alert.alert("Error", "Failed to load rider status");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateStatus = async (status: AvailabilityStatus) => {
    setIsUpdating(true);
    try {
      const response = await riderService.updateAvailability({ status });
      if (response.IsSuccess) {
        Alert.alert("Success", `Availability updated to ${status}`);
        await loadProfile();
      } else {
        Alert.alert("Error", "Failed to update availability");
      }
    } catch {
      Alert.alert("Error", "Failed to update availability");
    } finally {
      setIsUpdating(false);
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
        <Text style={styles.loadingText}>Loading status...</Text>
      </View>
    );
  }

  const currentStatus = profile?.availability_status || "offline";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadProfile} />
      }
    >
      <View style={styles.card}>
        <SectionHeader title="Availability Control" />
        <StatusBadge
          status={currentStatus}
          label={getStatusText(currentStatus)}
          size="md"
        />

        <View style={styles.buttonGroup}>
          <Button
            title="Available"
            variant={currentStatus === "available" ? "primary" : "outline"}
            onPress={() => updateStatus("available")}
            isLoading={isUpdating}
          />
          <Button
            title="Busy"
            variant={currentStatus === "busy" ? "primary" : "outline"}
            onPress={() => updateStatus("busy")}
            isLoading={isUpdating}
          />
          <Button
            title="Offline"
            variant={currentStatus === "offline" ? "primary" : "outline"}
            onPress={() => updateStatus("offline")}
            isLoading={isUpdating}
          />
        </View>
      </View>

      {profile && (
        <View style={styles.card}>
          <SectionHeader title="Operational State" />
          <StatusBadge
            status={profile.operational_status}
            label={getStatusText(profile.operational_status)}
            size="md"
          />
          <Text style={styles.helperText}>
            You can only receive assignments while operational status is active.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    display: "none",
  },
  subtitle: {
    display: "none",
  },
  helperText: {
    fontSize: FontSizes.sm,
    color: Colors.mutedForeground,
  },
  buttonGroup: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
