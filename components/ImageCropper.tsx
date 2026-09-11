/**
 * ImageCropper — best-in-class, cross-platform crop for avatars and banners.
 *
 * Bad cropping was a legacy Minds onboarding killer, so this enforces a
 * guaranteed-good result: pan + pinch-zoom over a fixed-aspect frame, with the
 * image ALWAYS covering the frame (no empty edges), a minimum-resolution guard,
 * and deterministic output at exact spec dims (avatar 400x400, banner 1500x500)
 * via expo-image-manipulator.
 *
 * NOTE: expo-image-manipulator is a native module — adding it requires a native
 * rebuild (`npx expo install expo-image-manipulator`, then a dev/EAS build).
 * Gesture feel (momentum, zoom limits) should be tuned on-device.
 */
import * as React from 'react';
import { View, Modal, Pressable, Platform, useWindowDimensions, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withTiming } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text } from './Text';
import { useColors } from '../lib/theme';
import { spacing } from '../constants/theme';

export type CropSpec = { aspect: number; outWidth: number; outHeight: number; label: string; round?: boolean };
export const CROP_AVATAR: CropSpec = { aspect: 1, outWidth: 400, outHeight: 400, label: 'Profile photo', round: true };
export const CROP_BANNER: CropSpec = { aspect: 3, outWidth: 1500, outHeight: 500, label: 'Cover photo' };

type Props = {
  uri: string | null;
  spec: CropSpec;
  onCancel: () => void;
  onDone: (result: { uri: string; width: number; height: number }) => void;
};

export function ImageCropper({ uri, spec, onCancel, onDone }: Props) {
  const colors = useColors();
  const { width: winW } = useWindowDimensions();
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [tooSmall, setTooSmall] = React.useState(false);

  // The visible crop frame: full available width (with a gutter), height by aspect.
  const FRAME_W = Math.min(winW - spacing.xl * 2, 520);
  const FRAME_H = FRAME_W / spec.aspect;

  // Natural size of the source (drives the cover-fit + crop math).
  React.useEffect(() => {
    setNatural(null); setTooSmall(false);
    if (!uri) return;
    RNImage.getSize(
      uri,
      (w, h) => {
        setNatural({ w, h });
        // Guard: block sources that can't fill the output without upscaling badly.
        setTooSmall(w < spec.outWidth || h < spec.outHeight);
      },
      () => setNatural(null),
    );
  }, [uri, spec.outWidth, spec.outHeight]);

  // Displayed image size at scale 1 = smallest that COVERS the frame (object-fit: cover).
  const display = React.useMemo(() => {
    if (!natural) return { w: FRAME_W, h: FRAME_H };
    const imgAspect = natural.w / natural.h;
    return imgAspect > spec.aspect
      ? { w: FRAME_H * imgAspect, h: FRAME_H }   // wider than frame -> fit height
      : { w: FRAME_W, h: FRAME_W / imgAspect };  // taller -> fit width
  }, [natural, FRAME_W, FRAME_H, spec.aspect]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startScale = useSharedValue(1);

  // Keep the image covering the frame at all times: bound translate to the
  // overflow half-extents, and scale to [1, 8].
  const clampAll = React.useCallback(() => {
    'worklet';
    const s = Math.min(Math.max(scale.value, 1), 8);
    scale.value = s;
    const maxTx = Math.max(0, (display.w * s - FRAME_W) / 2);
    const maxTy = Math.max(0, (display.h * s - FRAME_H) / 2);
    tx.value = Math.min(Math.max(tx.value, -maxTx), maxTx);
    ty.value = Math.min(Math.max(ty.value, -maxTy), maxTy);
  }, [display.w, display.h, FRAME_W, FRAME_H, scale, tx, ty]);

  const pan = Gesture.Pan()
    .onStart(() => { startTx.value = tx.value; startTy.value = ty.value; })
    .onUpdate((e) => { tx.value = startTx.value + e.translationX; ty.value = startTy.value + e.translationY; })
    .onEnd(() => { clampAll(); });

  const pinch = Gesture.Pinch()
    .onStart(() => { startScale.value = scale.value; })
    .onUpdate((e) => { scale.value = startScale.value * e.scale; })
    .onEnd(() => { clampAll(); });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const doCrop = async () => {
    if (!uri || !natural || busy) return;
    setBusy(true);
    try {
      const s = Math.min(Math.max(scale.value, 1), 8);
      // Map the frame (screen px) into SOURCE pixels. ratio = source-per-display.
      const ratio = natural.w / display.w;
      const cropW = (FRAME_W / s) * ratio;
      const cropH = (FRAME_H / s) * ratio;
      const centerX = natural.w / 2 - (tx.value / s) * ratio;
      const centerY = natural.h / 2 - (ty.value / s) * ratio;
      const originX = Math.min(Math.max(centerX - cropW / 2, 0), natural.w - cropW);
      const originY = Math.min(Math.max(centerY - cropH / 2, 0), natural.h - cropH);

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: { originX, originY, width: cropW, height: cropH } },
          { resize: { width: spec.outWidth, height: spec.outHeight } },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP },
      );
      onDone({ uri: result.uri, width: result.width, height: result.height });
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          {/* Header */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 56, paddingHorizontal: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={onCancel} hitSlop={12}><Text variant="body" color="#fff">Cancel</Text></Pressable>
            <Text variant="bodyMedium" color="#fff">{spec.label}</Text>
            <Pressable onPress={doCrop} disabled={busy || tooSmall} hitSlop={12}>
              <Text variant="bodyMedium" color={busy || tooSmall ? '#888' : colors.accent}>{busy ? '…' : 'Done'}</Text>
            </Pressable>
          </View>

          {/* Crop frame with the image clipped to it; dimmed overflow all around */}
          <View style={{ width: FRAME_W, height: FRAME_H, overflow: 'hidden', borderRadius: spec.round ? FRAME_W / 2 : 12, backgroundColor: '#111' }}>
            <GestureDetector gesture={gesture}>
              <Animated.View style={[{ width: display.w, height: display.h, position: 'absolute', left: (FRAME_W - display.w) / 2, top: (FRAME_H - display.h) / 2 }, imgStyle]}>
                {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
              </Animated.View>
            </GestureDetector>
          </View>

          {/* Hint / guard */}
          <View style={{ position: 'absolute', bottom: 64, paddingHorizontal: spacing.xl }}>
            {tooSmall ? (
              <Text variant="caption" color="#ff6b6b" style={{ textAlign: 'center' }}>
                This image is too small for a crisp {spec.label.toLowerCase()} (needs at least {spec.outWidth}×{spec.outHeight}).
              </Text>
            ) : (
              <Text variant="caption" color="#aaa" style={{ textAlign: 'center' }}>Drag to reposition · pinch to zoom</Text>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
