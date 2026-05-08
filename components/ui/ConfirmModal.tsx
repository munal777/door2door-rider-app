import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react-native";

import { BorderRadius, Colors, FontSizes, Shadows, Spacing } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfirmModalVariant = "default" | "danger" | "success" | "info";

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Label for the primary / confirm action. Default: "OK" */
  confirmText?: string;
  /** Label for the secondary / cancel action. Omit to show a single-button modal. */
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: ConfirmModalVariant;
}

// ─── Variant Config ──────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ConfirmModalVariant,
  {
    iconColor: string;
    iconBg: string;
    confirmBg: string;
    confirmText: string;
    Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  }
> = {
  default: {
    iconColor: Colors.primary,
    iconBg: Colors.secondary,
    confirmBg: Colors.primary,
    confirmText: Colors.primaryForeground,
    Icon: AlertTriangle,
  },
  danger: {
    iconColor: Colors.destructive,
    iconBg: Colors.errorBg,
    confirmBg: Colors.destructive,
    confirmText: Colors.destructiveForeground,
    Icon: XCircle,
  },
  success: {
    iconColor: Colors.success,
    iconBg: Colors.successBg,
    confirmBg: Colors.success,
    confirmText: "#FFFFFF",
    Icon: CheckCircle2,
  },
  info: {
    iconColor: Colors.info,
    iconBg: Colors.infoBg,
    confirmBg: Colors.info,
    confirmText: "#FFFFFF",
    Icon: Info,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "OK",
  cancelText,
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmModalProps) {
  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 80,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const cfg = VARIANT_CONFIG[variant];
  const { Icon } = cfg;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel ?? onConfirm}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onCancel ?? onConfirm}>
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <View style={styles.centerer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: opacityAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Icon badge */}
          <View style={[styles.iconBadge, { backgroundColor: cfg.iconBg }]}>
            <Icon size={28} color={cfg.iconColor} strokeWidth={2} />
          </View>

          {/* Text */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Actions */}
          <View style={[styles.actions, cancelText ? styles.actionsRow : null]}>
            {cancelText && onCancel ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={onCancel}
                activeOpacity={0.75}
              >
                <Text style={styles.btnCancelText}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnConfirm,
                { backgroundColor: cfg.confirmBg },
                cancelText ? styles.btnFlex : styles.btnFull,
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnConfirmText, { color: cfg.confirmText }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  centerer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  sheet: {
    width: "100%",
    backgroundColor: Colors.card,
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.lg,
  },

  // Icon
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },

  // Text
  title: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: FontSizes.sm,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },

  // Divider
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },

  // Buttons
  actions: {
    width: "100%",
    gap: Spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
  },
  btn: {
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  btnFull: {
    width: "100%",
  },
  btnFlex: {
    flex: 1,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: Colors.muted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnConfirm: {},
  btnCancelText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  btnConfirmText: {
    fontSize: FontSizes.sm,
    fontWeight: "700",
  },
});
