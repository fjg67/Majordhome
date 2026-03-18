import { useState, useCallback, useEffect, useRef } from 'react';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  OutputFormatAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  type AudioSet,
} from 'react-native-audio-recorder-player';
import { Platform, PermissionsAndroid } from 'react-native';
import { MAX_AUDIO_DURATION_SECONDS } from '../types/chat.types';

const audioRecorderPlayer = new AudioRecorderPlayer();

// ─── Audio Recording Hook ───
export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const recordingPathRef = useRef<string>('');
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingNativeRef = useRef(false); // garde native contre double-stop

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        return (
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED
        );
      } catch {
        return false;
      }
    }
    return true; // iOS permissions are handled at system level
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return false;

    try {
      const path = Platform.select({
        ios: `audio_${Date.now()}.m4a`,
        android: undefined, // 'DEFAULT' → cacheDir/sound.mp4 via native
      });

      const audioSet: AudioSet = Platform.select({
        android: {
          AudioSourceAndroid: AudioSourceAndroidType.MIC,
          OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
          AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
          AudioEncodingBitRateAndroid: 128000,
          AudioSamplingRateAndroid: 44100,
        },
        ios: {
          AVFormatIDKeyIOS: AVEncodingOption.aac,
          AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
          AVNumberOfChannelsKeyIOS: 1,
        },
        default: {},
      }) ?? {};

      const result = await audioRecorderPlayer.startRecorder(path, audioSet);
      recordingPathRef.current = result;
      isRecordingNativeRef.current = true;
      setIsRecording(true);
      setRecordDuration(0);

      audioRecorderPlayer.addRecordBackListener((e) => {
        setRecordDuration(Math.floor(e.currentPosition / 1000));
        // Normalized amplitude (0-1)
        const amp = Math.min(1, (e.currentMetering ?? -60 + 60) / 60);
        setAmplitude(Math.max(0, amp));
      });

      // Auto-stop at max duration
      maxDurationTimerRef.current = setTimeout(async () => {
        await stopRecording();
      }, MAX_AUDIO_DURATION_SECONDS * 1000);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }, [requestPermissions]);

  const stopRecording = useCallback(async (): Promise<{
    uri: string;
    duration: number;
  } | null> => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }

    if (!isRecordingNativeRef.current) {
      setIsRecording(false);
      setRecordDuration(0);
      setAmplitude(0);
      return null;
    }

    try {
      isRecordingNativeRef.current = false;
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      const duration = recordDuration;
      setIsRecording(false);
      setRecordDuration(0);
      setAmplitude(0);
      return { uri: result, duration };
    } catch {
      setIsRecording(false);
      setRecordDuration(0);
      setAmplitude(0);
      return null;
    }
  }, [recordDuration]);

  const cancelRecording = useCallback(async () => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (isRecordingNativeRef.current) {
      isRecordingNativeRef.current = false;
      try {
        await audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
    setRecordDuration(0);
    setAmplitude(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
      }
      audioRecorderPlayer.removeRecordBackListener();
      if (isRecordingNativeRef.current) {
        isRecordingNativeRef.current = false;
        audioRecorderPlayer.stopRecorder().catch(() => {});
      }
    };
  }, []);

  return {
    isRecording,
    recordDuration,
    amplitude,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};

// ─── Audio Playback Hook ───
export const useAudioPlayer = (
  mediaUrl?: string,
  httpHeaders?: Record<string, string>,
) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // in seconds
  const [duration, setDuration] = useState(0); // in seconds
  const currentUrlRef = useRef<string | undefined>(undefined);
  // Stable ref pour headers → pas besoin de les inclure dans les deps de useCallback
  const headersRef = useRef<Record<string, string> | undefined>(httpHeaders);
  headersRef.current = httpHeaders;

  const toggle = useCallback(async () => {
    if (!mediaUrl) return;

    if (isPlaying) {
      await audioRecorderPlayer.pausePlayer();
      setIsPlaying(false);
    } else {
      try {
        // If different URL, start fresh
        if (currentUrlRef.current !== mediaUrl) {
          await audioRecorderPlayer.stopPlayer().catch(() => {});
          audioRecorderPlayer.removePlayBackListener();

          await audioRecorderPlayer.startPlayer(mediaUrl, headersRef.current);
          currentUrlRef.current = mediaUrl;

          audioRecorderPlayer.addPlayBackListener((e) => {
            const currentSec = Math.floor(e.currentPosition / 1000);
            const totalSec = Math.floor(e.duration / 1000);
            setProgress(currentSec);
            setDuration(totalSec);

            if (e.currentPosition >= e.duration - 100) {
              setIsPlaying(false);
              setProgress(0);
              audioRecorderPlayer.stopPlayer().catch(() => {});
              currentUrlRef.current = undefined;
            }
          });
        } else {
          await audioRecorderPlayer.resumePlayer();
        }
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
      }
    }
  }, [mediaUrl, isPlaying]);

  const stop = useCallback(async () => {
    try {
      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
    } catch {
      // ignore
    }
    setIsPlaying(false);
    setProgress(0);
    currentUrlRef.current = undefined;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRecorderPlayer.stopPlayer().catch(() => {});
      audioRecorderPlayer.removePlayBackListener();
    };
  }, []);

  return { isPlaying, progress, duration, toggle, stop };
};

// ─── Format duration helper ───
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ─── Generate waveform bars from message ID ───
export const generateWaveformBars = (
  messageId: string,
  barCount: number = 32,
): number[] => {
  // Seed from the message ID to get consistent but unique waveforms
  let hash = 0;
  for (let i = 0; i < messageId.length; i++) {
    const char = messageId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    // Simple seeded pseudo-random
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    const normalized = (hash % 23) + 6; // Between 6 and 28
    bars.push(normalized);
  }
  return bars;
};
