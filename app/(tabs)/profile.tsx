import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { CircleAlert, Truck, UserRound } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { riderService } from "@/services/rider.service";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Colors, Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import { RiderProfile } from "@/types/api";
import { usePolling } from "@/hooks/usePolling";

export default function ProfileTab() {
  const { logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const response = await riderService.getProfile();
      if (response.IsSuccess && response.Result) {
        setProfile(response.Result);
        setEmergencyContactName(response.Result.emergency_contact_name || "");
        setEmergencyContactPhone(response.Result.emergency_contact_phone || "");
        setVehicleModel(response.Result.vehicle_model || "");
        setVehicleColor(response.Result.vehicle_color || "");
      }
    } catch {
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Auto-refresh profile every 20 s so availability_status stays current.
  usePolling(loadProfile, 20_000);

  const getStatusText = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await riderService.updateProfile({
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
        vehicle_model: vehicleModel,
        vehicle_color: vehicleColor,
      });

      if (response.IsSuccess && response.Result) {
        setProfile(response.Result);
        setIsEditing(false);
        Alert.alert("Success", "Profile updated successfully");
      } else {
        Alert.alert("Error", "Unable to update profile");
      }
    } catch {
      Alert.alert("Error", "Unable to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEmergencyContactName(profile.emergency_contact_name || "");
      setEmergencyContactPhone(profile.emergency_contact_phone || "");
      setVehicleModel(profile.vehicle_model || "");
      setVehicleColor(profile.vehicle_color || "");
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <EmptyState
          Icon={CircleAlert}
          title="Profile unavailable"
          subtitle="We could not load your rider profile right now."
          actionLabel="Retry"
          onAction={loadProfile}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadProfile} />
      }
    >
      <View style={styles.headerCard}>
        <View style={styles.headerIconWrap}>
          <UserRound size={24} color={Colors.primary} strokeWidth={2.2} />
        </View>
        <Text style={styles.name}>
          {profile.first_name} {profile.last_name}
        </Text>
        <Text style={styles.email}>{profile.email}</Text>
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
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          {!isEditing && (
            <Button
              title="Edit"
              variant="outline"
              size="sm"
              onPress={() => setIsEditing(true)}
            />
          )}
        </View>
        {isEditing ? (
          <>
            <Input
              label="Contact Name"
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              placeholder="Emergency contact name"
            />
            <Input
              label="Contact Phone"
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              placeholder="Emergency contact phone"
              keyboardType="phone-pad"
            />
          </>
        ) : (
          <>
            <Text style={styles.itemLabel}>Name</Text>
            <Text style={styles.itemValue}>
              {profile.emergency_contact_name || "Not provided"}
            </Text>
            <Text style={styles.itemLabel}>Phone</Text>
            <Text style={styles.itemValue}>
              {profile.emergency_contact_phone || "Not provided"}
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Vehicle" />
        <View style={styles.vehicleInfoChip}>
          <Truck size={16} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.vehicleInfoText}>
            {getStatusText(profile.vehicle_type)}
          </Text>
        </View>
        <Text style={styles.itemLabel}>Type</Text>
        <Text style={styles.itemValue}>
          {getStatusText(profile.vehicle_type)}
        </Text>
        <Text style={styles.itemLabel}>Number</Text>
        <Text style={styles.itemValue}>{profile.vehicle_number}</Text>

        {isEditing ? (
          <>
            <Input
              label="Model"
              value={vehicleModel}
              onChangeText={setVehicleModel}
              placeholder="Vehicle model"
            />
            <Input
              label="Color"
              value={vehicleColor}
              onChangeText={setVehicleColor}
              placeholder="Vehicle color"
            />
          </>
        ) : (
          <>
            <Text style={styles.itemLabel}>Model</Text>
            <Text style={styles.itemValue}>
              {profile.vehicle_model || "Not provided"}
            </Text>
            <Text style={styles.itemLabel}>Color</Text>
            <Text style={styles.itemValue}>
              {profile.vehicle_color || "Not provided"}
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Rider Workspace" />
        <Button
          title="Open Assigned Orders"
          variant="outline"
          onPress={() => router.push("/(tabs)/orders" as any)}
        />
        <Button
          title="Open Live Pickup Map"
          variant="outline"
          onPress={() => router.push("/(tabs)/pickup-map" as any)}
        />
      </View>

      {isEditing ? (
        <View style={styles.editActions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={handleCancel}
            style={styles.halfButton}
          />
          <Button
            title="Save"
            onPress={handleSave}
            isLoading={isSaving}
            style={styles.halfButton}
          />
        </View>
      ) : (
        <Button
          title="Logout"
          variant="outline"
          onPress={logout}
          style={styles.logoutButton}
        />
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
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  headerCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  name: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: "800",
  },
  email: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.sm,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginTop: Spacing.xs,
  },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  sectionHeader: {
    marginBottom: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  vehicleInfoChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginBottom: Spacing.xs,
  },
  vehicleInfoText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  itemLabel: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  itemValue: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: "500",
  },
  editActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  halfButton: {
    flex: 1,
  },
  logoutButton: {
    marginBottom: Spacing.sm,
  },
});
