/**
 * Reusable Button Component
 */

import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";
import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";

interface ButtonProps extends TouchableOpacityProps {
  title?: string;
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = ({
  title,
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) => {
  const getBackgroundColor = () => {
    if (disabled || isLoading) return Colors.muted;
    switch (variant) {
      case "primary":
        return Colors.primary;
      case "secondary":
        return Colors.secondary;
      case "destructive":
        return Colors.errorBg;
      case "outline":
      case "ghost":
        return "transparent";
      default:
        return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled || isLoading) return Colors.mutedForeground;
    switch (variant) {
      case "primary":
        return Colors.primaryForeground;
      case "secondary":
        return Colors.secondaryForeground;
      case "destructive":
        return Colors.error;
      case "outline":
      case "ghost":
        return Colors.primary;
      default:
        return Colors.primaryForeground;
    }
  };

  const getPadding = () => {
    switch (size) {
      case "sm":
        return {
          minHeight: 36,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md - 2,
        };
      case "lg":
        return {
          minHeight: 44,
          paddingVertical: Spacing.sm + 2,
          paddingHorizontal: Spacing.lg - 2,
        };
      default:
        return {
          minHeight: 40,
          paddingVertical: Spacing.sm + 1,
          paddingHorizontal: Spacing.md,
        };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return FontSizes.sm;
      case "lg":
        return FontSizes.md;
      default:
        return FontSizes.sm;
    }
  };

  const label =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : title;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === "outline" ? Colors.border : "transparent",
          borderWidth: variant === "outline" ? 1 : 0,
          width: fullWidth ? "100%" : "auto",
          ...getPadding(),
        },
        style,
      ]}
      disabled={disabled || isLoading}
      activeOpacity={0.86}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : label ? (
        <Text
          style={[
            styles.text,
            { color: getTextColor(), fontSize: getFontSize() },
          ]}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    fontWeight: "600",
    letterSpacing: 0.15,
    textAlign: "center",
  },
});
