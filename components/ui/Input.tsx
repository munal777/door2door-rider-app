/**
 * Reusable Input Component
 */

import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
}

export const Input = ({
  label,
  error,
  hint,
  isPassword = false,
  leftIcon,
  style,
  secureTextEntry,
  ...props
}: InputProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const shouldMask = isPassword || !!secureTextEntry;
  const borderColor = error
    ? Colors.destructive
    : isFocused
      ? Colors.primary
      : Colors.border;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputWrapper,
          { borderColor, borderWidth: isFocused ? 1.5 : 1 },
        ]}
      >
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : null,
            shouldMask ? styles.inputWithRightIcon : null,
            style,
          ]}
          placeholderTextColor={Colors.mutedForeground}
          secureTextEntry={shouldMask && !isPasswordVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {shouldMask ? (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isPasswordVisible ? (
              <EyeOff
                size={18}
                color={Colors.mutedForeground}
                strokeWidth={2}
              />
            ) : (
              <Eye size={18} color={Colors.mutedForeground} strokeWidth={2} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: Spacing.xl + Spacing.xs,
  },
  leftIcon: {
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
  },
  rightIcon: {
    position: "absolute",
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  error: {
    fontSize: FontSizes.xs,
    color: Colors.destructive,
    marginTop: 5,
    fontWeight: "500",
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.mutedForeground,
    marginTop: 5,
  },
});
