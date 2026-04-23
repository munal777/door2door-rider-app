import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Boxes, ChevronRight, Clock, MapPin, Package } from "lucide-react-native";

import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BorderRadius, Colors, FontSizes, Shadows, Spacing } from "@/constants/theme";
import { riderService } from "@/services/rider.service";
import { RiderAssignedOrderSummary } from "@/types/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pickup_assigned: "Pickup Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

const PACKAGE_ICONS: Record<string, string> = {
  document: "📄",
  parcel: "📦",
  fragile: "🔮",
  electronics: "💻",
  clothing: "👕",
  food: "🍱",
};

function getStatusText(status: string) {
  return (
    STATUS_LABELS[status] ||
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " · " +
      d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onPress,
}: {
  order: RiderAssignedOrderSummary;
  onPress: () => void;
}) {
  const packageEmoji = PACKAGE_ICONS[order.package_type] ?? "📦";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Left: package icon */}
      <View style={styles.cardIconWrap}>
        <Text style={styles.cardIconEmoji}>{packageEmoji}</Text>
      </View>

      {/* Center: order info */}
      <View style={styles.cardBody}>
        {/* Top row: order number + status */}
        <View style={styles.cardTopRow}>
          <Text style={styles.cardOrderNumber}>{order.order_number}</Text>
          <StatusBadge
            status={order.order_status}
            label={getStatusText(order.order_status)}
            size="sm"
          />
        </View>

        {/* Pickup location */}
        <View style={styles.cardMetaRow}>
          <MapPin size={12} color={Colors.primary} strokeWidth={2.5} />
          <Text style={styles.cardMetaText} numberOfLines={1}>
            {order.sender_name} · {order.sender_city}
          </Text>
        </View>

        {/* Package type + time */}
        <View style={styles.cardMetaRow}>
          <Package size={12} color={Colors.mutedForeground} strokeWidth={2.5} />
          <Text style={styles.cardMetaTextMuted}>
            {order.package_type.charAt(0).toUpperCase() + order.package_type.slice(1)}
          </Text>
          <View style={styles.cardMetaDot} />
          <Clock size={11} color={Colors.mutedForeground} strokeWidth={2.5} />
          <Text style={styles.cardMetaTextMuted}>
            {formatTime(order.assigned_at)}
          </Text>
        </View>

        {/* Notes pill */}
        {order.notes ? (
          <Text style={styles.cardNote} numberOfLines={1}>
            📝 {order.notes}
          </Text>
        ) : null}
      </View>

      {/* Right: chevron */}
      <ChevronRight size={18} color={Colors.border} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersTab() {
  const router = useRouter();

  const [orders, setOrders] = useState<RiderAssignedOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const res = await riderService.getAssignedOrders();
      if (res.IsSuccess && res.Result) {
        setOrders(res.Result);
      }
    } catch {
      // silent on background refresh
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadOrders();
      setIsLoading(false);
    })();
  }, [loadOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const openOrder = (orderNumber: string) => {
    router.push(`/order/${orderNumber}` as any);
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading orders…</Text>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.listContent,
        orders.length === 0 && styles.listContentEmpty,
      ]}
      data={orders}
      keyExtractor={(item) => item.order_number}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderTitle}>
            {orders.length} Active Order{orders.length !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.listHeaderSub}>
            Tap an order to view details and navigate
          </Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          Icon={Boxes}
          title="No Active Orders"
          subtitle="New assignments will appear here once your dispatcher assigns a delivery."
        />
      }
      renderItem={({ item }) => (
        <OrderCard
          order={item}
          onPress={() => openOrder(item.order_number)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: "center",
  },

  // Header
  listHeader: {
    marginBottom: Spacing.sm,
  },
  listHeaderTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
  },
  listHeaderSub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardIconEmoji: {
    fontSize: 24,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.xs,
  },
  cardOrderNumber: {
    fontSize: FontSizes.sm,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.3,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardMetaText: {
    fontSize: FontSizes.xs,
    color: Colors.text,
    fontWeight: "600",
    flex: 1,
  },
  cardMetaTextMuted: {
    fontSize: FontSizes.xs,
    color: Colors.mutedForeground,
  },
  cardMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 2,
  },
  cardNote: {
    fontSize: FontSizes.xs,
    color: Colors.mutedForeground,
    fontStyle: "italic",
  },

  // Separator
  separator: {
    height: Spacing.sm,
  },

  // Loading
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
});
