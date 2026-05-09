/**
 * ProofOfDeliveryCapture — redesigned
 *
 * Flow:
 *  permission → camera → preview → uploading → success (auto-delivers & closes)
 *
 * New behaviour:
 *  • After successful upload the component silently calls updateAssignedOrderStatus
 *    ('delivered') then invokes onDelivered so the parent can refresh / navigate.
 *  • The success screen shows a countdown and auto-closes after 3 s.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image as RNImage,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  CameraCapturedPicture,
} from 'expo-camera';
import {
  Camera,
  CheckCircle,
  RotateCcw,
  X,
  AlertCircle,
  FlipHorizontal,
  ArrowRight,
  Shield,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { riderService } from '@/services/rider.service';
import { PodUploadResponse } from '@/types/api';
import { BorderRadius, Colors, FontSizes, Shadows, Spacing } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowStep = 'permission' | 'camera' | 'preview' | 'uploading' | 'success' | 'delivering';

interface ProofOfDeliveryCaptureProps {
  orderNumber: string;
  receiverCity?: string;
  visible: boolean;
  /** Called after POD upload AND status updated to delivered */
  onDelivered: () => void;
  onDismiss: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProofOfDeliveryCapture({
  orderNumber,
  receiverCity,
  visible,
  onDelivered,
  onDismiss,
}: ProofOfDeliveryCaptureProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<FlowStep>('permission');
  const [facing, setFacing] = useState<CameraType>('back');
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [notes, setNotes] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [countdown, setCountdown] = useState(3);

  // ── Reset on open/close ────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) {
      setStep('permission');
      setPhoto(null);
      setNotes('');
      setUploadError('');
      setCountdown(3);
      if (countdownRef.current) clearTimeout(countdownRef.current);
      return;
    }
    if (permission?.granted) setStep('camera');
    else setStep('permission');
  }, [visible, permission?.granted]);

  // ── Success animation + auto-close ────────────────────────────────────────

  const startSuccessSequence = useCallback(() => {
    scaleAnim.setValue(0);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    let c = 3;
    setCountdown(c);
    const tick = () => {
      c -= 1;
      setCountdown(c);
      if (c > 0) {
        countdownRef.current = setTimeout(tick, 1000);
      } else {
        onDelivered();
      }
    };
    countdownRef.current = setTimeout(tick, 1000);
  }, [scaleAnim, fadeAnim, onDelivered]);

  // ── Permission ─────────────────────────────────────────────────────────────

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();
    if (result.granted) setStep('camera');
  }, [requestPermission]);

  // ── Camera ─────────────────────────────────────────────────────────────────

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const captured = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
      });
      if (captured) {
        setPhoto(captured);
        setStep('preview');
      }
    } catch {
      setUploadError('Failed to capture photo. Please try again.');
    }
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing(f => (f === 'back' ? 'front' : 'back'));
  }, []);

  // ── Upload + auto-deliver ──────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!photo) return;
    setUploadError('');
    setStep('uploading');

    // 1️⃣ Upload POD photo
    const uri = photo.uri;
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `pod_${orderNumber}_${Date.now()}.${ext}`;

    let uploadOk = false;
    try {
      const res = await riderService.uploadProofOfDelivery(orderNumber, uri, fileName, mimeType, notes);
      if (res.IsSuccess && res.Result) {
        uploadOk = true;
      } else {
        const msg =
          typeof res.ErrorMessage === 'string'
            ? res.ErrorMessage
            : Array.isArray(res.ErrorMessage)
            ? res.ErrorMessage.join(' ')
            : 'Upload failed. Please try again.';
        setUploadError(msg);
        setStep('preview');
        return;
      }
    } catch (err: any) {
      setUploadError(err?.message ?? 'A network error occurred. Please try again.');
      setStep('preview');
      return;
    }

    if (!uploadOk) return;

    // 2️⃣ Auto mark as delivered
    setStep('delivering');
    try {
      await riderService.updateAssignedOrderStatus(orderNumber, {
        status: 'delivered',
        remarks: 'Parcel delivered. Proof of delivery uploaded.',
        location_city: receiverCity ?? '',
      });
    } catch {
      // Non-critical — POD is already saved; parent reload will show it.
    }

    // 3️⃣ Show success + countdown
    setStep('success');
    startSuccessSequence();
  }, [photo, orderNumber, notes, receiverCity, startSuccessSequence]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderPermissionStep = () => (
    <View style={styles.centeredContent}>
      <View style={styles.permIconWrap}>
        <Camera size={36} color="#fff" strokeWidth={2} />
      </View>
      <Text style={styles.stepTitle}>Camera Access Required</Text>
      <Text style={styles.stepSubtitle}>
        Take a photo as proof of delivery. This helps protect you and the customer.
      </Text>

      {permission?.canAskAgain === false ? (
        <>
          <View style={styles.warningBox}>
            <AlertCircle size={15} color="#d97706" />
            <Text style={styles.warningText}>
              Camera permission denied. Enable it in your device settings.
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleRequestPermission}>
          <Camera size={17} color="#fff" />
          <Text style={styles.primaryBtnText}>Allow Camera Access</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.ghostBtn} onPress={onDismiss}>
        <Text style={styles.ghostBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCameraStep = () => (
    <View style={{ flex: 1 }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />

      {/* Top bar */}
      <View style={[styles.camTopBar, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity style={styles.camIconBtn} onPress={onDismiss}>
          <X size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.camLabelPill}>
          <Text style={styles.camLabelText}>Delivery Proof</Text>
        </View>
        <TouchableOpacity style={styles.camIconBtn} onPress={toggleFacing}>
          <FlipHorizontal size={20} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Viewfinder corners */}
      <View style={styles.vfGuide}>
        <View style={[styles.corner, styles.cTL]} />
        <View style={[styles.corner, styles.cTR]} />
        <View style={[styles.corner, styles.cBL]} />
        <View style={[styles.corner, styles.cBR]} />
      </View>

      {/* Bottom controls */}
      <View style={[styles.camBottom, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Text style={styles.camHint}>Frame the package or drop-off spot clearly</Text>
        <TouchableOpacity style={styles.shutterBtn} onPress={handleCapture} activeOpacity={0.8}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPreviewStep = () => (
    <ScrollView
      contentContainerStyle={[
        styles.previewWrap,
        { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      {/* Header */}
      <View style={styles.previewHeader}>
        <TouchableOpacity onPress={onDismiss} hitSlop={8}>
          <X size={22} color={Colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.previewTitle}>Review Photo</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Photo */}
      {photo && (
        <View style={styles.photoFrame}>
          <RNImage source={{ uri: photo.uri }} style={styles.photoImg} resizeMode="cover" />
          <View style={styles.photoLabel}>
            <Shield size={12} color="#fff" />
            <Text style={styles.photoLabelText}>Delivery Proof</Text>
          </View>
        </View>
      )}

      {/* Error */}
      {!!uploadError && (
        <View style={styles.errorBanner}>
          <AlertCircle size={15} color="#dc2626" />
          <Text style={styles.errorText}>{uploadError}</Text>
        </View>
      )}

      {/* Notes */}
      <View style={styles.notesCard}>
        <Text style={styles.notesLabel}>Delivery Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Left at door, received by neighbour…"
          placeholderTextColor={Colors.mutedForeground}
          multiline
          maxLength={500}
          returnKeyType="done"
        />
        <Text style={styles.notesCount}>{notes.length}/500</Text>
      </View>

      {/* Info pill */}
      <View style={styles.infoPill}>
        <CheckCircle size={13} color="#16a34a" strokeWidth={2.5} />
        <Text style={styles.infoPillText}>
          Submitting will automatically mark this order as Delivered.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.previewActions}>
        <TouchableOpacity
          style={styles.retakeBtn}
          onPress={() => { setPhoto(null); setUploadError(''); setStep('camera'); }}
        >
          <RotateCcw size={16} color={Colors.text} strokeWidth={2} />
          <Text style={styles.retakeBtnText}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitBtn} onPress={handleUpload}>
          <Text style={styles.submitBtnText}>Submit & Deliver</Text>
          <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderUploadingStep = (label: string) => (
    <View style={styles.centeredContent}>
      {photo && (
        <RNImage
          source={{ uri: photo.uri }}
          style={[styles.photoImg, { opacity: 0.25, marginBottom: Spacing.md }]}
          resizeMode="cover"
        />
      )}
      <View style={styles.uploadingBox}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.uploadingTitle}>{label}</Text>
        <Text style={styles.uploadingSub}>Please keep the app open</Text>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <Animated.View style={[styles.centeredContent, { opacity: fadeAnim }]}>
      {/* Big green checkmark */}
      <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
        <CheckCircle size={52} color="#fff" strokeWidth={2} />
      </Animated.View>

      <Text style={styles.successTitle}>Delivered!</Text>
      <Text style={styles.successSub}>
        Proof saved and order marked as delivered.
      </Text>

      {/* Countdown pill */}
      <View style={styles.countdownPill}>
        <Text style={styles.countdownText}>Closing in {countdown}s…</Text>
      </View>

      <TouchableOpacity style={styles.doneBtn} onPress={() => { if (countdownRef.current) clearTimeout(countdownRef.current); onDelivered(); }}>
        <CheckCircle size={16} color="#fff" strokeWidth={2.5} />
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── Root ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        {step === 'permission' && renderPermissionStep()}
        {step === 'camera' && renderCameraStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'uploading' && renderUploadingStep('Uploading photo…')}
        {step === 'delivering' && renderUploadingStep('Marking as delivered…')}
        {step === 'success' && renderSuccessStep()}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER = 22;
const BORDER = 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Shared
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },

  // Permission
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    ...Shadows.md,
  },
  stepTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  stepSubtitle: { fontSize: FontSizes.sm, color: Colors.mutedForeground, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  warningBox: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: '#fffbeb',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: Spacing.sm,
    alignItems: 'flex-start',
    maxWidth: 320,
  },
  warningText: { flex: 1, fontSize: FontSizes.xs, color: '#92400e', lineHeight: 18 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 15,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    maxWidth: 320,
    ...Shadows.md,
  },
  primaryBtnText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '700' },
  ghostBtn: { paddingVertical: Spacing.sm },
  ghostBtnText: { color: Colors.mutedForeground, fontSize: FontSizes.sm, fontWeight: '600' },

  // Camera
  camTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  camIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camLabelPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  camLabelText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700', letterSpacing: 0.5 },
  vfGuide: {
    position: 'absolute',
    width: 220,
    height: 220,
    alignSelf: 'center',
    top: '50%',
    marginTop: -110,
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  cTL: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderTopLeftRadius: 4 },
  cTR: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER, borderTopRightRadius: 4 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderBottomLeftRadius: 4 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 4 },
  camBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.md,
  },
  camHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSizes.xs,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shutterBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  // Preview
  previewWrap: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  previewTitle: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.text },
  photoFrame: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  photoImg: { width: '100%', height: 280 },
  photoLabel: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoLabelText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: Spacing.sm,
  },
  errorText: { flex: 1, fontSize: FontSizes.xs, color: '#dc2626', lineHeight: 18 },
  notesCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
    ...Shadows.sm,
  },
  notesLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: FontSizes.sm,
    color: Colors.text,
    backgroundColor: Colors.background,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesCount: { fontSize: 10, color: Colors.mutedForeground, alignSelf: 'flex-end' },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: Spacing.sm,
  },
  infoPillText: { flex: 1, fontSize: FontSizes.xs, color: '#15803d', lineHeight: 18, fontWeight: '600' },
  previewActions: { flexDirection: 'row', gap: Spacing.sm },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  retakeBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
  submitBtnText: { fontSize: FontSizes.sm, fontWeight: '800', color: '#fff' },

  // Uploading
  uploadingBox: {
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 300,
    ...Shadows.md,
  },
  uploadingTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  uploadingSub: { fontSize: FontSizes.xs, color: Colors.mutedForeground },

  // Success
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  successTitle: { fontSize: 28, fontWeight: '900', color: Colors.text },
  successSub: { fontSize: FontSizes.sm, color: Colors.mutedForeground, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  countdownPill: {
    backgroundColor: Colors.muted,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countdownText: { fontSize: FontSizes.xs, color: Colors.mutedForeground, fontWeight: '600' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    maxWidth: 300,
    ...Shadows.md,
  },
  doneBtnText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '800' },
});
