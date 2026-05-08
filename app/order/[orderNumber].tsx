import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  History,
  MapPin,
  Navigation,
  Package,
  Truck,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BorderRadius, Colors, FontSizes, Shadows, Spacing } from "@/constants/theme";
import { riderService } from "@/services/rider.service";
import {
  RiderAssignedOrderDetail,
  RiderOrderStatusUpdateRequest,
} from "@/types/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TRANSITION_MAP: Record<string, RiderOrderStatusUpdateRequest["status"][]> = {
  pickup_assigned:   ["heading_to_pickup"],
  heading_to_pickup: ["picked_up"],
  // picked_up: no rider action — parcel goes to courier hub for transit
  out_for_delivery:  ["delivered", "returned"],
};

const STATUS_LABELS: Record<string, string> = {
  pickup_assigned:   "Pickup Assigned",
  heading_to_pickup: "Heading to Pickup",
  picked_up:         "Picked Up",
  in_transit:        "In Transit",
  out_for_delivery:  "Out for Delivery",
  delivered:         "Delivered",
  returned:          "Returned",
};

const DELIVERY_PHASES = ["out_for_delivery", "delivered", "returned"];
const TERMINAL_STATUSES = ["delivered", "returned"];

function getStatusText(status: string) {
  return (
    STATUS_LABELS[status] ||
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

// ─── Modal State Helper ───────────────────────────────────────────────────────

type ModalState = {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger" | "success" | "info";
  onConfirm: () => void;
  onCancel?: () => void;
};

const HIDDEN_MODAL: ModalState = {
  visible: false,
  title: "",
  onConfirm: () => {},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        <Text style={styles.infoRowValue}>{value}</Text>
        {subValue ? <Text style={styles.infoRowSub}>{subValue}</Text> : null}
      </View>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<RiderAssignedOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [modal, setModal] = useState<ModalState>(HIDDEN_MODAL);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const hideModal = () => setModal(HIDDEN_MODAL);

  const showModal = (m: Omit<ModalState, "visible">) =>
    setModal({ ...m, visible: true });

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadDetail = useCallback(async () => {
    if (!orderNumber) return;
    try {
      const res = await riderService.getAssignedOrderDetail(orderNumber);
      if (res.IsSuccess && res.Result) {
        setOrder(res.Result);
      } else {
        showModal({
          title: "Not Found",
          message: "Could not load order details.",
          variant: "danger",
          confirmText: "Go Back",
          onConfirm: () => {
            hideModal();
            router.back();
          },
        });
      }
    } catch {
      showModal({
        title: "Error",
        message: "Could not load order details. Please try again.",
        variant: "danger",
        confirmText: "Close",
        onConfirm: hideModal,
      });
    }
  }, [orderNumber]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadDetail();
      setIsLoading(false);
    })();
  }, [loadDetail]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const availableTransitions = useMemo(() => {
    if (!order) return [];
    return STATUS_TRANSITION_MAP[order.order_status] ?? [];
  }, [order?.order_status]);

  const isDeliveryPhase = order ? DELIVERY_PHASES.includes(order.order_status) : false;
  const isHistorical = order ? TERMINAL_STATUSES.includes(order.order_status) : false;

  // ── Status update ──────────────────────────────────────────────────────────

  const confirmAndUpdateStatus = (nextStatus: RiderOrderStatusUpdateRequest["status"]) => {
    if (!order || !orderNumber) return;

    const isTerminal = TERMINAL_STATUSES.includes(nextStatus);
    showModal({
      title: `Mark as ${getStatusText(nextStatus)}`,
      message: isTerminal
        ? `This will complete the order. The parcel will be recorded as "${getStatusText(nextStatus)}".`
        : `Update this order's status to "${getStatusText(nextStatus)}"?`,
      confirmText: "Confirm",
      cancelText: "Cancel",
      variant: nextStatus === "returned" ? "danger" : "default",
      onConfirm: () => {
        hideModal();
        executeStatusUpdate(nextStatus);
      },
      onCancel: hideModal,
    });
  };

  const executeStatusUpdate = async (nextStatus: RiderOrderStatusUpdateRequest["status"]) => {
    if (!order || !orderNumber) return;
    const locationCity =
      nextStatus === "delivered" ? order.receiver_city : order.sender_city;

    setIsUpdating(true);
    try {
      const res = await riderService.updateAssignedOrderStatus(orderNumber, {
        status: nextStatus,
        remarks: `Status updated to ${getStatusText(nextStatus)} from rider app.`,
        location_city: locationCity,
      });

      if (res.IsSuccess) {
        const isTerminal = TERMINAL_STATUSES.includes(nextStatus);
        showModal({
          title: "Status Updated",
          message: `Order is now "${getStatusText(nextStatus)}".`,
          variant: "success",
          confirmText: isTerminal ? "Back to Orders" : "OK",
          onConfirm: async () => {
            hideModal();
            if (isTerminal) {
              router.back();
            } else {
              await loadDetail();
            }
          },
        });
      } else {
        showModal({
          title: "Update Failed",
          message: "Unable to update order status. Please try again.",
          variant: "danger",
          confirmText: "Close",
          onConfirm: hideModal,
        });
      }
    } catch {
      showModal({
        title: "Update Failed",
        message: "A network error occurred. Please check your connection.",
        variant: "danger",
        confirmText: "Close",
        onConfirm: hideModal,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleNavigate = () => {
    if (!order) return;

    const lat = isDeliveryPhase ? order.receiver_latitude : order.sender_latitude;
    const lng = isDeliveryPhase ? order.receiver_longitude : order.sender_longitude;

    if (!lat || !lng) {
      showModal({
        title: "Unavailable",
        message: "Coordinates are not available for this order.",
        variant: "info",
        confirmText: "OK",
        onConfirm: hideModal,
      });
      return;
    }

    const latN = Number(lat);
    const lngN = Number(lng);

    if (Number.isNaN(latN) || Number.isNaN(lngN) || (latN === 0 && lngN === 0)) {
      showModal({
        title: "Unavailable",
        message: "Valid coordinates are not set for this order.",
        variant: "info",
        confirmText: "OK",
        onConfirm: hideModal,
      });
      return;
    }

    const androidUrl = `google.navigation:q=${latN},${lngN}&mode=d`;
    const iosUrl = `comgooglemaps://?daddr=${latN},${lngN}&directionsmode=driving`;
    const webUrl = `https://maps.google.com/maps?daddr=${latN},${lngN}`;

    if (Platform.OS === "android") {
      Linking.canOpenURL(androidUrl).then((can) =>
        Linking.openURL(can ? androidUrl : webUrl),
      );
    } else {
      Linking.canOpenURL(iosUrl).then((can) =>
        Linking.openURL(can ? iosUrl : webUrl),
      );
    }
  };

  const handleOpenMap = () => {
    router.push({
      pathname: "/(tabs)/pickup-map",
      params: { orderNumber },
    } as any);
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading order details…</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Package size={48} color={Colors.mutedForeground} />
        <Text style={styles.emptyTitle}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
        <ConfirmModal {...modal} />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Custom header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} hitSlop={8}>
          <ArrowLeft size={22} color={Colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.order_number}
          </Text>
          <StatusBadge
            status={order.order_status}
            label={getStatusText(order.order_status)}
            size="sm"
          />
        </View>
        {/* Hide map button for historical read-only orders */}
        {!isHistorical && (
          <TouchableOpacity style={styles.mapButton} onPress={handleOpenMap}>
            <MapPin size={18} color={Colors.primary} strokeWidth={2.2} />
            <Text style={styles.mapButtonText}>Map</Text>
          </TouchableOpacity>
        )}
        {isHistorical && (
          <View style={styles.historyBadge}>
            <History size={14} color={Colors.mutedForeground} strokeWidth={2} />
            <Text style={styles.historyBadgeText}>History</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadDetail();
              setRefreshing(false);
            }}
          />
        }
      >
        {/* ── Navigate CTA (hidden for historical orders) ── */}
        {!isHistorical && (
          <TouchableOpacity
            style={styles.navigateCta}
            onPress={handleNavigate}
            activeOpacity={0.85}
          >
            <View style={styles.navigateCtaIcon}>
              <Navigation size={24} color={Colors.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navigateCtaTitle}>
                {isDeliveryPhase ? "Navigate to Delivery" : "Navigate to Pickup"}
              </Text>
              <Text style={styles.navigateCtaSub}>
                {isDeliveryPhase ? order.receiver_address : order.sender_address}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Package Info ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Package</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoGridCell}>
              <Text style={styles.infoGridLabel}>Type</Text>
              <Text style={styles.infoGridValue}>{order.package_type}</Text>
            </View>
            <View style={styles.infoGridCell}>
              <Text style={styles.infoGridLabel}>Service</Text>
              <Text style={styles.infoGridValue}>{order.service_type}</Text>
            </View>
            <View style={styles.infoGridCell}>
              <Text style={styles.infoGridLabel}>Weight</Text>
              <Text style={styles.infoGridValue}>{order.weight} kg</Text>
            </View>
            <View style={styles.infoGridCell}>
              <Text style={styles.infoGridLabel}>Price</Text>
              <Text style={styles.infoGridValue}>Rs. {order.total_price}</Text>
            </View>
          </View>
          {order.notes ? (
            <Text style={styles.notesText}>Note: {order.notes}</Text>
          ) : null}
          {order.package_description ? (
            <Text style={styles.notesText}>{order.package_description}</Text>
          ) : null}
        </View>

        {/* ── Pickup (Sender) ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup Point</Text>
          <InfoRow
            icon={<Package size={16} color={Colors.primary} />}
            label="Sender"
            value={order.sender_name}
            subValue={order.sender_phone}
          />
          <InfoRow
            icon={<MapPin size={16} color={Colors.primary} />}
            label="Address"
            value={order.sender_address}
            subValue={`${order.sender_city}, ${order.sender_state}`}
          />
        </View>

        {/* ── Delivery (Receiver) — only shown after pickup ── */}
        {isDeliveryPhase && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Point</Text>
            <InfoRow
              icon={<Truck size={16} color={Colors.success} />}
              label="Receiver"
              value={order.receiver_name}
              subValue={order.receiver_phone}
            />
            <InfoRow
              icon={<MapPin size={16} color={Colors.success} />}
              label="Address"
              value={order.receiver_address}
              subValue={`${order.receiver_city}, ${order.receiver_state}`}
            />
          </View>
        )}

        {/* ── Status Actions (hidden for read-only historical orders) ── */}
        {!isHistorical && availableTransitions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Actions</Text>
            {availableTransitions.map((nextStatus) => (
              <Button
                key={nextStatus}
                title={`Mark as ${getStatusText(nextStatus)}`}
                onPress={() => confirmAndUpdateStatus(nextStatus)}
                isLoading={isUpdating}
              />
            ))}
          </View>
        )}

        {/* ── Tracking Timeline ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracking History</Text>
          {order.tracking_history.length === 0 ? (
            <View style={styles.emptyTimeline}>
              <History size={28} color={Colors.mutedForeground} />
              <Text style={styles.emptyTimelineText}>No updates yet</Text>
            </View>
          ) : (
            order.tracking_history.map((item, idx) => {
              const isFirst = idx === 0;
              return (
                <View key={`${item.created_at}-${idx}`} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View
                      style={[
                        styles.timelineDot,
                        isFirst && styles.timelineDotActive,
                      ]}
                    />
                    {idx < order.tracking_history.length - 1 && (
                      <View style={styles.timelineConnector} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <CheckCircle
                        size={14}
                        color={isFirst ? Colors.primary : Colors.mutedForeground}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.timelineStatus,
                          isFirst && { color: Colors.primary },
                        ]}
                      >
                        {getStatusText(item.status)}
                      </Text>
                    </View>
                    {item.remarks ? (
                      <Text style={styles.timelineRemarks}>{item.remarks}</Text>
                    ) : null}
                    <View style={styles.timelineMeta}>
                      {item.location_city ? (
                        <Text style={styles.timelineCity}>{item.location_city}</Text>
                      ) : null}
                      <Clock size={11} color={Colors.mutedForeground} />
                      <Text style={styles.timelineTime}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Custom modal (replaces all Alert.alert calls) */}
      <ConfirmModal {...modal} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    ...Shadows.sm,
  },
  headerBack: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    color: Colors.text,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: "700",
  },
  historyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.muted,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyBadgeText: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.xs,
    fontWeight: "600",
  },

  // Main scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Navigate CTA banner
  navigateCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.md,
  },
  navigateCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  navigateCtaTitle: {
    color: Colors.primaryForeground,
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
  navigateCtaSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: FontSizes.xs,
    marginTop: 2,
  },

  // Cards
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  // Info rows
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  infoRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  infoRowLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoRowValue: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: "700",
    marginTop: 1,
  },
  infoRowSub: {
    fontSize: FontSizes.xs,
    color: Colors.mutedForeground,
    marginTop: 1,
  },

  // Info grid (2×2 package details)
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  infoGridCell: {
    width: "46%",
    backgroundColor: Colors.muted,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  infoGridLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoGridValue: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  notesText: {
    fontSize: FontSizes.sm,
    color: Colors.mutedForeground,
    lineHeight: 20,
  },

  // Timeline
  emptyTimeline: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  emptyTimelineText: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.sm,
  },
  timelineItem: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  timelineLine: {
    alignItems: "center",
    width: 16,
    flexShrink: 0,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    borderWidth: 2,
    borderColor: Colors.mutedForeground,
  },
  timelineDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: 2,
    marginBottom: -4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.md,
    gap: 3,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  timelineStatus: {
    fontSize: FontSizes.sm,
    fontWeight: "700",
    color: Colors.text,
  },
  timelineRemarks: {
    fontSize: FontSizes.xs,
    color: Colors.mutedForeground,
    lineHeight: 18,
  },
  timelineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timelineCity: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: "600",
    marginRight: 4,
  },
  timelineTime: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },

  // Loading / empty
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.text,
  },
  backBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.full,
  },
  backBtnText: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: FontSizes.sm,
  },
});
