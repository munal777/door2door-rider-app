import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import {
  ChevronDown,
  ChevronUp,
  Layers3,
  LocateFixed,
  Navigation,
  Package,
  Truck,
} from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  BorderRadius,
  Colors,
  FontSizes,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { riderService } from "@/services/rider.service";
import { storage } from "@/services/storage.service";
import {
  RiderAssignedOrderDetail,
  RiderAssignedOrderSummary,
  RiderLocationUpdatePayload,
} from "@/types/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type LatLng = { latitude: number; longitude: number };

type SocketMessage = {
  type?: string;
  latitude?: string | number;
  longitude?: string | number;
  [key: string]: any;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["heading_to_pickup", "out_for_delivery"];

/**
 * After pickup the rider heads to delivery — navigation target switches.
 * heading_to_pickup remains pre-delivery; out_for_delivery navigates to DELIVERY.
 */
const DELIVERY_PHASE_STATUSES = ["out_for_delivery"];

const AUTO_REFRESH_MS = 30_000;
const ROUTE_REFETCH_THRESHOLD_M = 150;
const CARD_BG = "rgba(255,255,255,0.97)";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0,
    lat = 0,
    lng = 0;
  while (index < encoded.length) {
    let shift = 0,
      result = 0,
      byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

function parseCoord(lat?: string | null, lng?: string | null): LatLng | null {
  if (!lat || !lng) return null;
  const la = Number(lat),
    lo = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(lo)) return null;
  return { latitude: la, longitude: lo };
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(
        Math.sin(Δφ / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2,
      ),
    )
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PickupMapTab() {
  const { orderNumber } = useLocalSearchParams<{
    orderNumber?: string | string[];
  }>();
  const requestedOrder = Array.isArray(orderNumber)
    ? orderNumber[0]
    : orderNumber;
  const insets = useSafeAreaInsets();

  // ── State ──────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<RiderAssignedOrderSummary[]>([]);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(
    null,
  );
  const [orderDetail, setOrderDetail] =
    useState<RiderAssignedOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [riderLocation, setRiderLocation] = useState<LatLng | null>(null);
  const [routePoints, setRoutePoints] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState("");
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [bottomExpanded, setBottomExpanded] = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const socketRef = useRef<WebSocket | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const lastDirectionOriginRef = useRef<LatLng | null>(null);
  const lastDirectionDestRef = useRef<string>(""); // stringified dest for change detection

  // ── Pulse animation ────────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.8,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const pickupLocation = useMemo(
    () =>
      parseCoord(
        orderDetail?.sender_latitude ?? null,
        orderDetail?.sender_longitude ?? null,
      ),
    [orderDetail],
  );

  const deliveryLocation = useMemo(
    () =>
      parseCoord(
        orderDetail?.receiver_latitude ?? null,
        orderDetail?.receiver_longitude ?? null,
      ),
    [orderDetail],
  );

  /**
   * Phase-aware:
   *  heading_to_pickup → navigate to PICKUP
   *  out_for_delivery → navigate to DELIVERY
   */
  const isDeliveryPhase = orderDetail
    ? DELIVERY_PHASE_STATUSES.includes(orderDetail.order_status)
    : false;

  const isTracking = orderDetail
    ? ACTIVE_STATUSES.includes(orderDetail.order_status)
    : false;

  const navigationTarget = isTracking
    ? isDeliveryPhase
      ? deliveryLocation
      : pickupLocation
    : null;
  const directionDestination = navigationTarget;

  const selectedOrder = useMemo(
    () => orders.find((o) => o.order_number === selectedOrderNumber) ?? null,
    [orders, selectedOrderNumber],
  );

  // ── Realtime tracking ──────────────────────────────────────────────────────
  const stopRealtimeTracking = useCallback(async () => {
    locationWatchRef.current?.remove();
    locationWatchRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const startRealtimeTracking = useCallback(
    async (orderNum: string) => {
      await stopRealtimeTracking();
      const token = await storage.getAccessToken();
      if (!token) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Location permission is needed for live tracking.",
        );
        return;
      }

      const socket = riderService.createOrderLocationSocket(orderNum, token);
      socketRef.current = socket;

      const buildPayload = (
        c: Location.LocationObjectCoords,
      ): RiderLocationUpdatePayload => ({
        latitude: c.latitude,
        longitude: c.longitude,
        accuracy_meters: c.accuracy ?? undefined,
        speed_kmh:
          typeof c.speed === "number" && c.speed >= 0
            ? c.speed * 3.6
            : undefined,
        heading_degrees:
          typeof c.heading === "number" && c.heading >= 0
            ? c.heading
            : undefined,
      });

      const send = async (p: RiderLocationUpdatePayload) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: "location.update", ...p }));
        } else {
          await riderService.sendOrderLocationHttp(orderNum, p);
        }
      };

      const init = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const initP = buildPayload(init.coords);
      setRiderLocation({
        latitude: initP.latitude,
        longitude: initP.longitude,
      });
      await send(initP);

      socket.onmessage = (event) => {
        try {
          const msg: SocketMessage = JSON.parse(event.data);
          if (msg.type === "location.update" && msg.latitude && msg.longitude) {
            const la = Number(msg.latitude),
              lo = Number(msg.longitude);
            if (!Number.isNaN(la) && !Number.isNaN(lo))
              setRiderLocation({ latitude: la, longitude: lo });
          }
        } catch {
          /* ignore */
        }
      };

      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        async (pos) => {
          const p = buildPayload(pos.coords);
          setRiderLocation({ latitude: p.latitude, longitude: p.longitude });
          await send(p);
        },
      );
    },
    [stopRealtimeTracking],
  );

  // ── Directions ─────────────────────────────────────────────────────────────
  const fetchDirections = useCallback(
    async (origin: LatLng, destination: LatLng) => {
      try {
        const data = await riderService.getPickupRouteDirections(
          origin,
          destination,
        );
        if (data.status === "OK" && data.routes?.length) {
          setRoutePoints(
            decodePolyline(data.routes[0].overview_polyline?.points ?? ""),
          );
          const leg = data.routes[0].legs?.[0];
          setRouteSummary(
            leg?.distance?.text && leg?.duration?.text
              ? `${leg.distance.text} · ${leg.duration.text}`
              : "",
          );
        } else {
          setRoutePoints([origin, destination]);
          setRouteSummary("");
        }
      } catch {
        setRoutePoints([origin, destination]);
        setRouteSummary("");
      }
      lastDirectionOriginRef.current = origin;
      lastDirectionDestRef.current = `${destination.latitude},${destination.longitude}`;
    },
    [],
  );

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    const res = await riderService.getAssignedOrders();
    if (res.IsSuccess && res.Result) {
      setOrders(res.Result);
      setSelectedOrderNumber((prev) => {
        if (prev || res.Result.length === 0) return prev;
        const req = requestedOrder
          ? res.Result.find((o) => o.order_number === requestedOrder)
          : null;
        return req?.order_number ?? res.Result[0].order_number;
      });
    }
  }, [requestedOrder]);

  const loadOrderDetail = useCallback(async (orderNum: string) => {
    const res = await riderService.getAssignedOrderDetail(orderNum);
    if (res.IsSuccess && res.Result) setOrderDetail(res.Result);
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadOrders();
      setIsLoading(false);
    })();
    return () => {
      stopRealtimeTracking();
    };
  }, [loadOrders, stopRealtimeTracking]);

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(async () => {
      setIsAutoRefreshing(true);
      try {
        await loadOrders();
        if (selectedOrderNumber) await loadOrderDetail(selectedOrderNumber);
      } finally {
        setIsAutoRefreshing(false);
      }
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadOrders, loadOrderDetail, selectedOrderNumber]);

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedOrderNumber) {
      setOrderDetail(null);
      return;
    }
    loadOrderDetail(selectedOrderNumber);
  }, [loadOrderDetail, selectedOrderNumber]);

  // Honor deep-link
  useEffect(() => {
    if (!requestedOrder || orders.length === 0) return;
    if (selectedOrderNumber === requestedOrder) return;
    if (orders.some((o) => o.order_number === requestedOrder)) {
      setSelectedOrderNumber(requestedOrder);
    }
  }, [requestedOrder, orders, selectedOrderNumber]);

  // Start/stop live tracking
  useEffect(() => {
    if (!orderDetail || !selectedOrderNumber) return;
    if (ACTIVE_STATUSES.includes(orderDetail.order_status)) {
      startRealtimeTracking(selectedOrderNumber);
    } else {
      stopRealtimeTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDetail?.order_status, selectedOrderNumber]);

  /**
   * Route refetch:
   * - Refetch when destination changes (pickup → delivery phase switch)
   * - Refetch when rider moves >150m from last fetch origin
   */
  useEffect(() => {
    if (!directionDestination) {
      setRoutePoints([]);
      setRouteSummary("");
      lastDirectionOriginRef.current = null;
      lastDirectionDestRef.current = "";
      return;
    }

    // Guard: if riderLocation is (0,0) it means GPS hasn't fixed yet — don't
    // use it as the route origin or Google Maps will route from Africa.
    const isValidRiderLocation =
      riderLocation !== null &&
      !(riderLocation.latitude === 0 && riderLocation.longitude === 0);

    const origin = isValidRiderLocation ? riderLocation! : directionDestination;
    const last = lastDirectionOriginRef.current;
    const destKey = `${directionDestination.latitude},${directionDestination.longitude}`;
    const destChanged = destKey !== lastDirectionDestRef.current;

    if (
      !last ||
      destChanged ||
      haversineM(last, origin) > ROUTE_REFETCH_THRESHOLD_M
    ) {
      fetchDirections(origin, directionDestination);
    }
  }, [directionDestination, riderLocation, fetchDirections]);

  // Fit map to route
  useEffect(() => {
    if (!mapRef.current || routePoints.length < 2) return;
    mapRef.current.fitToCoordinates(routePoints, {
      edgePadding: { top: 160, right: 48, bottom: 260, left: 48 },
      animated: true,
    });
  }, [routePoints]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleHeadingToPickup = async () => {
    if (!selectedOrderNumber || !orderDetail) return;
    const res = await riderService.updateAssignedOrderStatus(
      selectedOrderNumber,
      {
        status: "heading_to_pickup",
        remarks: "Rider is on the way to pick up your parcel.",
        location_city: orderDetail.sender_city,
      },
    );
    if (res.IsSuccess) {
      await loadOrderDetail(selectedOrderNumber);
      Alert.alert("Updated", "Status updated: heading to pickup.");
    } else {
      Alert.alert("Update failed", "Could not update order status.");
    }
  };

  const handleMarkPickedUp = async () => {
    if (!selectedOrderNumber || !orderDetail) return;
    const res = await riderService.updateAssignedOrderStatus(
      selectedOrderNumber,
      {
        status: "picked_up",
        remarks: "Rider picked up the parcel from sender.",
        location_city: orderDetail.sender_city,
      },
    );
    if (res.IsSuccess) {
      await loadOrderDetail(selectedOrderNumber);
      Alert.alert("Updated", "Order marked as picked up.");
    } else {
      Alert.alert("Update failed", "Could not update order status.");
    }
  };

  const handleStartDelivery = async () => {
    if (!selectedOrderNumber || !orderDetail) return;
    const res = await riderService.updateAssignedOrderStatus(
      selectedOrderNumber,
      {
        status: "out_for_delivery",
        remarks: "Rider is out for delivery with the parcel.",
        location_city: orderDetail.receiver_city,
      },
    );
    if (res.IsSuccess) {
      await loadOrderDetail(selectedOrderNumber);
      Alert.alert("Updated", "Order is now out for delivery.");
    } else {
      Alert.alert("Update failed", "Could not update order status.");
    }
  };

  const handleMarkDelivered = async () => {
    if (!selectedOrderNumber || !orderDetail) return;
    const res = await riderService.updateAssignedOrderStatus(
      selectedOrderNumber,
      {
        status: "delivered",
        remarks: "Rider successfully delivered the parcel.",
        location_city: orderDetail.receiver_city,
      },
    );
    if (res.IsSuccess) {
      await loadOrderDetail(selectedOrderNumber);
      Alert.alert("Updated", "Order marked as delivered.");
    } else {
      Alert.alert("Update failed", "Could not update order status.");
    }
  };

  const handleNavigate = () => {
    if (!navigationTarget) {
      Alert.alert("Unavailable", "Coordinates not available for navigation.");
      return;
    }
    const { latitude, longitude } = navigationTarget;
    const androidUrl = `google.navigation:q=${latitude},${longitude}&mode=d`;
    const iosUrl = `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`;
    const webUrl = `https://maps.google.com/maps?daddr=${latitude},${longitude}`;
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

  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (routePoints.length > 1) {
      mapRef.current.fitToCoordinates(routePoints, {
        edgePadding: { top: 160, right: 56, bottom: 260, left: 56 },
        animated: true,
      });
      return;
    }
    const anchor = riderLocation ?? navigationTarget;
    if (!anchor) return;
    mapRef.current.animateToRegion(
      {
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      },
      400,
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading live map…</Text>
      </View>
    );
  }

  const mapInitialRegion = pickupLocation
    ? {
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }
    : undefined;

  return (
    <View style={styles.container}>
      {/* ── Full-screen map ── */}
      {pickupLocation ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          mapType={mapType}
          initialRegion={mapInitialRegion}
        >
          {/* Always show pickup marker */}
          <Marker coordinate={pickupLocation} title="Pickup">
            <View style={styles.markerPickup}>
              <Package size={14} color={Colors.primaryForeground} />
            </View>
          </Marker>

          {/* Delivery marker — only visible after pickup */}
          {isDeliveryPhase && deliveryLocation && (
            <Marker coordinate={deliveryLocation} title="Delivery">
              <View style={styles.markerDelivery}>
                <Truck size={14} color={Colors.primaryForeground} />
              </View>
            </Marker>
          )}

          {/* Rider location */}
          {riderLocation && (
            <Marker coordinate={riderLocation} title="You" pinColor="blue" />
          )}

          {/* Route polyline */}
          {routePoints.length > 1 && (
            <Polyline
              coordinates={routePoints}
              strokeColor={isDeliveryPhase ? Colors.success : Colors.primary}
              strokeWidth={5}
            />
          )}
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Package size={52} color={Colors.mutedForeground} />
          <Text style={styles.placeholderTitle}>No Location Available</Text>
          <Text style={styles.placeholderSub}>
            Pickup coordinates are unavailable for this order.
          </Text>
        </View>
      )}

      {/* ── Top floating overlay ── */}
      <View style={[styles.topOverlay, { top: insets.top + Spacing.sm }]}>
        <View style={styles.topCard}>
          {/* Live indicator row */}
          <View style={styles.topCardHeader}>
            <View style={styles.liveRow}>
              <View style={styles.liveDotContainer}>
                <Animated.View
                  style={[
                    styles.liveDotPulse,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: isTracking ? 0.35 : 0,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.liveDot,
                    {
                      backgroundColor: isTracking
                        ? Colors.success
                        : Colors.mutedForeground,
                    },
                  ]}
                />
              </View>
              <Text style={styles.liveLabel}>
                {isTracking
                  ? isDeliveryPhase
                    ? "Delivering"
                    : orderDetail?.order_status === "heading_to_pickup"
                      ? "On My Way \ud83d\udef5"
                      : "Head to Pickup"
                  : "Standby"}
              </Text>
              {isAutoRefreshing && (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
            <Text style={styles.orderCountText}>
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {/* Order chips */}
          {orders.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {orders.map((o) => {
                  const active = selectedOrderNumber === o.order_number;
                  return (
                    <TouchableOpacity
                      key={o.order_number}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedOrderNumber(o.order_number)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {o.order_number}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.noOrderText}>No orders assigned.</Text>
          )}

          {/* Destination address */}
          {orderDetail && (
            <Text style={styles.destText} numberOfLines={1}>
              📍{" "}
              {isDeliveryPhase
                ? orderDetail.receiver_address
                : orderDetail.sender_address}
            </Text>
          )}
        </View>
      </View>

      {/* ── Map controls ── */}
      <View style={[styles.mapControls, { top: insets.top + 170 }]}>
        <Pressable
          style={styles.controlBtn}
          onPress={() =>
            setMapType((p) => (p === "standard" ? "satellite" : "standard"))
          }
        >
          <Layers3 size={20} color={Colors.primary} strokeWidth={2.2} />
        </Pressable>
        <Pressable style={styles.controlBtn} onPress={handleRecenter}>
          <LocateFixed size={20} color={Colors.primary} strokeWidth={2.2} />
        </Pressable>
        {navigationTarget && (
          <Pressable
            style={[styles.controlBtn, styles.controlBtnNav]}
            onPress={handleNavigate}
          >
            <Navigation
              size={20}
              color={Colors.primaryForeground}
              strokeWidth={2.2}
            />
          </Pressable>
        )}
      </View>

      {/* ── Bottom floating sheet ── */}
      <View
        style={[styles.bottomSheet, { bottom: insets.bottom + Spacing.sm }]}
      >
        {/* Collapse handle */}
        <TouchableOpacity
          style={styles.collapseHandle}
          onPress={() => setBottomExpanded((p) => !p)}
          activeOpacity={0.7}
        >
          <View style={styles.handleBar} />
          {bottomExpanded ? (
            <ChevronDown size={14} color={Colors.mutedForeground} />
          ) : (
            <ChevronUp size={14} color={Colors.mutedForeground} />
          )}
        </TouchableOpacity>

        {/* Route summary — always visible */}
        <View style={styles.routeRow}>
          <View
            style={[
              styles.navIconWrap,
              isDeliveryPhase && styles.navIconWrapDelivery,
            ]}
          >
            <Navigation size={18} color={Colors.primaryForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeTitle}>
              {routeSummary ||
                (isDeliveryPhase ? "Route to delivery" : "Route to pickup")}
            </Text>
            {orderDetail && (
              <Text style={styles.routeSub} numberOfLines={1}>
                {isDeliveryPhase
                  ? `→ ${orderDetail.receiver_city}`
                  : `→ ${orderDetail.sender_city}`}
              </Text>
            )}
          </View>
          {orderDetail && (
            <StatusBadge
              status={orderDetail.order_status}
              label={orderDetail.order_status.replace(/_/g, " ")}
              size="sm"
            />
          )}
        </View>

        {/* Expanded section */}
        {bottomExpanded && orderDetail && (
          <View style={styles.expandedSection}>
            <View style={styles.infoRow}>
              <Package size={14} color={Colors.primary} />
              <Text style={styles.infoText}>{orderDetail.sender_name}</Text>
              <Text style={styles.infoSub}>{orderDetail.sender_phone}</Text>
            </View>

            {orderDetail.order_status === "pickup_assigned" && (
              <Button
                title="I'm On My Way 🛵"
                onPress={handleHeadingToPickup}
              />
            )}
            {orderDetail.order_status === "heading_to_pickup" && (
              <Button title="Mark as Picked Up" onPress={handleMarkPickedUp} />
            )}
            {orderDetail.order_status === "delivery_assigned" && (
              <Button title="Start Delivery" onPress={handleStartDelivery} />
            )}
            {orderDetail.order_status === "out_for_delivery" && (
              <Button title="Mark as Delivered" onPress={handleMarkDelivered} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.muted },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
  },

  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.muted,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  placeholderTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  placeholderSub: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  // Top overlay
  topOverlay: { position: "absolute", left: Spacing.md, right: Spacing.md },
  topCard: {
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.xs,
    ...Shadows.md,
  },
  topCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDotContainer: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDotPulse: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  liveLabel: { color: Colors.text, fontSize: FontSizes.xs, fontWeight: "700" },
  orderCountText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    backgroundColor: Colors.secondary,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: "700",
  },
  chipTextActive: { color: Colors.primaryForeground },
  noOrderText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: "center",
    paddingVertical: Spacing.xs,
  },
  destText: {
    color: Colors.mutedForeground,
    fontSize: FontSizes.xs,
    paddingHorizontal: Spacing.xs,
  },

  // Custom markers
  markerPickup: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primaryForeground,
    ...Shadows.sm,
  },
  markerDelivery: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primaryForeground,
    ...Shadows.sm,
  },

  // Map controls
  mapControls: { position: "absolute", right: Spacing.md, gap: Spacing.sm },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },
  controlBtnNav: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  // Bottom sheet
  bottomSheet: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  collapseHandle: { alignItems: "center", gap: 2, paddingBottom: 2 },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  navIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  navIconWrapDelivery: { backgroundColor: Colors.success },
  routeTitle: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: "700" },
  routeSub: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  expandedSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  infoText: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: "700",
  },
  infoSub: { color: Colors.mutedForeground, fontSize: FontSizes.xs },
});
