import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Boxes,
  ChevronRight,
  Clock,
  FileText,
  History,
  MapPin,
  Package,
} from "lucide-react-native";

import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BorderRadius, Colors, FontSizes, Shadows, Spacing } from "@/constants/theme";
import { riderService } from "@/services/rider.service";
import { RiderAssignedOrderSummary } from "@/types/api";

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = "active" | "history";

const STATUS_LABELS: Record<string, string> = {
  pickup_assigned:   "Pickup Assigned",
  heading_to_pickup: "Heading to Pickup",
  picked_up:         "Picked Up",
  in_transit:        "In Transit",
  out_for_delivery:  "Out for Delivery",
  delivered:         "Delivered",
  returned:          "Returned",
};

function getPackageIcon(packageType: string) {
  switch (packageType) {
    case "document":
      return <FileText size={22} color={Colors.primary} strokeWidth={2} />;
    default:
      return <Package size={22} color={Colors.primary} strokeWidth={2} />;
  }
}

function getHistoryPackageIcon(packageType: string) {
  switch (packageType) {
    case "document":
      return <FileText size={22} color={Colors.mutedForeground} strokeWidth={2} />;
    default:
      return <Package size={22} color={Colors.mutedForeground} strokeWidth={2} />;
  }
}

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
    return (
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " · " +
      d.toLocaleDateString([], { month: "short", day: "numeric" })
    );
  } catch {
    return dateStr;
  }
}

// ─── Tab Switcher ─────────────────────────────────────────────────────────────

function TabBar({
  active,
  onSelect,
  activeCount,
  historyCount,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
  activeCount: number;
  historyCount: number;
}) {
  return (
    <View style={tabStyles.container}>
      <TouchableOpacity
        style={[tabStyles.tab, active === "active" && tabStyles.tabSelected]}
        onPress={() => onSelect("active")}
        activeOpacity={0.75}
      >
        <Package
          size={15}
          color={active === "active" ? Colors.primary : Colors.mutedForeground}
          strokeWidth={2.2}
        />
        <Text
          style={[
            tabStyles.tabLabel,
            active === "active" && tabStyles.tabLabelSelected,
          ]}
        >
          Active
        </Text>
        {activeCount > 0 && (
          <View
            style={[
              tabStyles.badge,
              active === "active" ? tabStyles.badgeSelected : tabStyles.badgeMuted,
            ]}
          >
            <Text
              style={[
                tabStyles.badgeText,
                active === "active" && tabStyles.badgeTextSelected,
              ]}
            >
              {activeCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[tabStyles.tab, active === "history" && tabStyles.tabSelected]}
        onPress={() => onSelect("history")}
        activeOpacity={0.75}
      >
        <History
          size={15}
          color={active === "history" ? Colors.primary : Colors.mutedForeground}
          strokeWidth={2.2}
        />
        <Text
          style={[
            tabStyles.tabLabel,
            active === "history" && tabStyles.tabLabelSelected,
          ]}
        >
          History
        </Text>
        {historyCount > 0 && (
          <View style={[tabStyles.badge, tabStyles.badgeMuted]}>
            <Text style={tabStyles.badgeText}>{historyCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.muted,
    borderRadius: BorderRadius.lg,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  tabSelected: {
    backgroundColor: Colors.card,
    ...Shadows.sm,
  },
  tabLabel: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  tabLabelSelected: {
    color: Colors.primary,
    fontWeight: "700",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeSelected: {
    backgroundColor: Colors.primary,
  },
  badgeMuted: {
    backgroundColor: Colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.mutedForeground,
  },
  badgeTextSelected: {
    color: Colors.primaryForeground,
  },
});

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  isHistory,
  onPress,
}: {
  order: RiderAssignedOrderSummary;
  isHistory: boolean;
  onPress: () => void;
}) {
  const timeLabel = isHistory && order.unassigned_at
    ? `Completed ${formatTime(order.unassigned_at)}`
    : formatTime(order.assigned_at);

  return (
    <TouchableOpacity
      style={[styles.card, isHistory && styles.cardHistory]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Left: package type icon */}
      <View style={[styles.cardIconWrap, isHistory && styles.cardIconWrapHistory]}>
        {isHistory ? getHistoryPackageIcon(order.package_type) : getPackageIcon(order.package_type)}
      </View>

      {/* Center: order info */}
      <View style={styles.cardBody}>
        {/* Top row: order number + status */}
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardOrderNumber, isHistory && styles.cardOrderNumberHistory]}>
            {order.order_number}
          </Text>
          <StatusBadge
            status={order.order_status}
            label={getStatusText(order.order_status)}
            size="sm"
          />
        </View>

        {/* Pickup location */}
        <View style={styles.cardMetaRow}>
          <MapPin
            size={12}
            color={isHistory ? Colors.mutedForeground : Colors.primary}
            strokeWidth={2.5}
          />
          <Text style={[styles.cardMetaText, isHistory && styles.cardMetaTextHistory]} numberOfLines={1}>
            {order.sender_name} · {order.sender_city}
          </Text>
        </View>

        {/* Package type + time */}
        <View style={styles.cardMetaRow}>
          <Clock size={11} color={Colors.mutedForeground} strokeWidth={2.5} />
          <Text style={styles.cardMetaTextMuted}>{timeLabel}</Text>
        </View>
      </View>

      {/* Right: chevron */}
      <ChevronRight size={18} color={Colors.border} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersTab() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [activeOrders, setActiveOrders] = useState<RiderAssignedOrderSummary[]>([]);
  const [historyOrders, setHistoryOrders] = useState<RiderAssignedOrderSummary[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Track if history has been fetched at least once
  const historyFetched = useRef(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadActiveOrders = useCallback(async () => {
    try {
      const res = await riderService.getAssignedOrders();
      if (res.IsSuccess && res.Result) {
        setActiveOrders(res.Result);
      }
    } catch {
      // silent on background refresh
    }
  }, []);

  const loadHistoryOrders = useCallback(async () => {
    try {
      const res = await riderService.getOrderHistory();
      if (res.IsSuccess && res.Result) {
        setHistoryOrders(res.Result);
      }
    } catch {
      // silent on background refresh
    }
  }, []);

  // Initial load — only fetch active orders upfront
  useEffect(() => {
    (async () => {
      setIsLoadingActive(true);
      await loadActiveOrders();
      setIsLoadingActive(false);
    })();
  }, [loadActiveOrders]);

  // Lazy-load history when the tab is first selected
  useEffect(() => {
    if (activeTab === "history" && !historyFetched.current) {
      historyFetched.current = true;
      (async () => {
        setIsLoadingHistory(true);
        await loadHistoryOrders();
        setIsLoadingHistory(false);
      })();
    }
  }, [activeTab, loadHistoryOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === "active") {
      await loadActiveOrders();
    } else {
      await loadHistoryOrders();
    }
    setRefreshing(false);
  };

  const openOrder = (orderNumber: string) => {
    router.push(`/order/${orderNumber}` as any);
  };

  // ── Current list data ─────────────────────────────────────────────────────

  const isLoading = activeTab === "active" ? isLoadingActive : isLoadingHistory;
  const orders = activeTab === "active" ? activeOrders : historyOrders;
  const isHistory = activeTab === "history";

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoadingActive && activeTab === "active") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading orders…</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <TabBar
        active={activeTab}
        onSelect={setActiveTab}
        activeCount={activeOrders.length}
        historyCount={historyOrders.length}
      />

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {isHistory ? "Loading history…" : "Loading orders…"}
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
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
            orders.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>
                  {isHistory
                    ? `${orders.length} Completed Order${orders.length !== 1 ? "s" : ""}`
                    : `${orders.length} Active Order${orders.length !== 1 ? "s" : ""}`}
                </Text>
                <Text style={styles.listHeaderSub}>
                  {isHistory
                    ? "Your completed and returned deliveries"
                    : "Tap an order to view details and navigate"}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            isHistory ? (
              <EmptyState
                Icon={History}
                title="No Order History"
                subtitle="Your completed and returned deliveries will appear here."
              />
            ) : (
              <EmptyState
                Icon={Boxes}
                title="No Active Orders"
                subtitle="New assignments will appear here once your dispatcher assigns a delivery."
              />
            )
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              isHistory={isHistory}
              onPress={() => openOrder(item.order_number)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: "center",
  },

  // Header
  listHeader: {
    marginBottom: Spacing.xs,
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

  // Card (active)
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
  // Card (history — slightly muted)
  cardHistory: {
    backgroundColor: Colors.muted,
    borderColor: Colors.border,
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
  cardIconWrapHistory: {
    backgroundColor: Colors.border,
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
  cardOrderNumberHistory: {
    color: Colors.textSecondary,
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
  cardMetaTextHistory: {
    color: Colors.mutedForeground,
  },
  cardMetaTextMuted: {
    fontSize: FontSizes.xs,
    color: Colors.mutedForeground,
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
