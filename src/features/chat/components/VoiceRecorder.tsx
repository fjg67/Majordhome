import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
  SlideInDown,
  FadeOut,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAudioRecorder, formatDuration } from '../hooks/useAudio';
import { CHAT_COLORS as C } from '../types/chat.types';

interface VoiceRecorderProps {
  onAudioReady: (uri: string, duration: number) => void;
}

// ─── Live Waveform (during recording) ───
const LiveWaveform: React.FC<{ amplitude: number }> = ({ amplitude }) => {
  return (
    <View style={styles.liveWaveform}>
      {Array.from({ length: 20 }).map((_, i) => {
        const baseHeight = 4 + Math.random() * 12;
        const amplifiedHeight = baseHeight + amplitude * 20;
        return (
          <View
            key={i}
            style={[
              styles.liveWaveBar,
              { height: Math.min(28, amplifiedHeight) },
            ]}
          />
        );
      })}
    </View>
  );
};

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onAudioReady,
}) => {
  const {
    isRecording,
    recordDuration,
    amplitude,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const cancelSwipe = useSharedValue(0);
  const micScale = useSharedValue(1);
  const recDotOpacity = useSharedValue(1);

  // Pulsing mic + red dot when recording
  useEffect(() => {
    if (isRecording) {
      micScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      recDotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        true,
      );
    } else {
      micScale.value = withSpring(1);
      recDotOpacity.value = 1;
    }
  }, [isRecording, micScale, recDotOpacity]);

  const handleStartRecording = useCallback(async () => {
    await startRecording();
  }, [startRecording]);

  const handleStopAndSend = useCallback(async () => {
    const result = await stopRecording();
    if (result && result.duration > 0) {
      onAudioReady(result.uri, result.duration);
    }
  }, [stopRecording, onAudioReady]);

  const handleCancel = useCallback(async () => {
    await cancelRecording();
  }, [cancelRecording]);

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      runOnJS(handleStartRecording)();
    })
    .onEnd(() => {
      if (cancelSwipe.value < -80) {
        runOnJS(handleCancel)();
      } else {
        runOnJS(handleStopAndSend)();
      }
      cancelSwipe.value = 0;
    });

  const panGesture = Gesture.Pan().onChange((e) => {
    cancelSwipe.value = Math.min(0, e.translationX);
  });

  const micBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
    backgroundColor: isRecording ? C.amber : C.bgSurface,
  }));

  const recordingOverlayStyle = useAnimatedStyle(() => ({
    opacity: isRecording ? 1 : 0,
    transform: [{ translateX: cancelSwipe.value }],
  }));

  const recDotAnimStyle = useAnimatedStyle(() => ({
    opacity: recDotOpacity.value,
  }));

  return (
    <View>
      {/* Recording overlay */}
      {isRecording && (
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={FadeOut.duration(200)}
          style={[styles.recordingOverlay]}
        >
          <Animated.View style={recordingOverlayStyle}>
            <View style={styles.recordingContent}>
              {/* Red dot + duration */}
              <View style={styles.recordingIndicator}>
                <Animated.View style={[styles.recDot, recDotAnimStyle]} />
                <Text style={styles.recDuration}>
                  {formatDuration(recordDuration)}
                </Text>
              </View>

              {/* Live waveform */}
              <LiveWaveform amplitude={amplitude} />

              {/* Cancel hint */}
              <Text style={styles.cancelHint}>← Glisser pour annuler</Text>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Mic button */}
      <GestureDetector
        gesture={Gesture.Simultaneous(longPressGesture, panGesture)}
      >
        <Animated.View style={[styles.micBtn, micBtnAnimStyle]}>
          <Text
            style={[
              styles.micIcon,
              { color: isRecording ? C.myBubbleText : 'rgba(245,166,35,0.70)' },
            ]}
          >
            🎤
          </Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  micIcon: {
    fontSize: 20,
  },

  // Recording overlay
  recordingOverlay: {
    position: 'absolute',
    bottom: 48,
    left: -280,
    right: -12,
    height: 52,
    backgroundColor: C.bgDeep,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,166,35,0.20)',
    justifyContent: 'center',
  },
  recordingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
  },
  recDuration: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: C.textPrimary,
    minWidth: 36,
  },
  liveWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 2,
  },
  liveWaveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(245,166,35,0.50)',
  },
  cancelHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: C.textMuted,
    fontStyle: 'italic',
  },
});
