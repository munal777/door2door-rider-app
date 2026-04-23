import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";

function getStatusStyle(status: string): { text: string; bg: string } {
  const value = status.toLowerCase();

  if (value === "delivered" || value === "active" || value === "available") {
    return { text: Colors.success, bg: Colors.successBg };
  }
  if (value === "suspended" || value === "inactive" || value === "offline") {
    return { text: Colors.error, bg: Colors.errorBg };
  }
  if (
    value === "in_transit" ||
    value === "out_for_delivery" ||
    value === "busy"
  ) {
    return { text: Colors.info, bg: Colors.infoBg };
  }
  if (
    value === "pickup_assigned" ||
    value === "pending_documents" ||
    value === "under_review" ||
    value === "picked_up"
  ) {
    return { text: Colors.warning, bg: Colors.warningBg };
  }

  return { text: Colors.primary, bg: Colors.primaryLight };
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "sm" }: StatusBadgeProps) {
  const { text, bg } = getStatusStyle(status);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        size === "md" && styles.badgeMd,
      ]}
    >
      <Text
        style={[styles.text, { color: text }, size === "md" && styles.textMd]}
      >
        {label || status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  badgeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  text: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "capitalize",
  },
  textMd: {
    fontSize: FontSizes.sm,
  },
});
