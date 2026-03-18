import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '../types/chat.types';
import { CHAT_COLORS as C, MAX_MESSAGE_LENGTH } from '../types/chat.types';
import { VoiceRecorder } from './VoiceRecorder';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

interface MessageInputProps {
  onSendText: (content: string, replyToId?: string) => Promise<void>;
  onSendImage: (uri: string, caption?: string) => Promise<void>;
  onSendAudio: (uri: string, duration: number) => Promise<void>;
  replyingTo: Message | null;
  onCancelReply: () => void;
  onTypingChange?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendText,
  onSendImage,
  onSendAudio,
  replyingTo,
  onCancelReply,
  onTypingChange,
}) => {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const sendBtnScale = useSharedValue(1);

  const hasText = text.trim().length > 0;

  // Focus input when replying
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);
      onTypingChange?.();
    },
    [onTypingChange],
  );

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content) return;

    // Bounce animation
    sendBtnScale.value = withSequence(
      withSpring(0.85, { damping: 10 }),
      withSpring(1, { damping: 12 }),
    );

    setText('');
    await onSendText(content, replyingTo?.id);
    onCancelReply();
  }, [text, replyingTo, onSendText, onCancelReply, sendBtnScale]);

  const handleMediaPress = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.85,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.assets?.[0]?.uri) {
        await onSendImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  }, [onSendImage]);

  const handleCameraPress = useCallback(async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.85,
        maxWidth: 1200,
        maxHeight: 1200,
        saveToPhotos: false,
      });

      if (result.assets?.[0]?.uri) {
        await onSendImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
    }
  }, [onSendImage]);

  const handleAudioReady = useCallback(
    async (uri: string, duration: number) => {
      await onSendAudio(uri, duration);
    },
    [onSendAudio],
  );

  const sendBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendBtnScale.value }],
  }));

  return (
    <View
      style={[
        styles.inputContainer,
        { paddingBottom: insets.bottom + 10 },
      ]}
    >
      {/* REPLY PREVIEW */}
      {replyingTo && (
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          style={styles.replyBar}
        >
          <View
            style={[
              styles.replyIndicator,
              { backgroundColor: replyingTo.senderColor },
            ]}
          />
          <View style={styles.replyContent}>
            <Text
              style={[
                styles.replyBarName,
                { color: replyingTo.senderColor },
              ]}
            >
              Répondre à {replyingTo.senderName}
            </Text>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyingTo.type === 'text'
                ? replyingTo.content
                : replyingTo.type === 'image'
                ? '📷 Photo'
                : '🎤 Message vocal'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelReply}
            style={styles.replyCloseBtn}
          >
            <Text style={styles.replyCloseIcon}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* MAIN INPUT ROW */}
      <View style={styles.inputRow}>
        {/* Camera button */}
        <TouchableOpacity
          onPress={handleCameraPress}
          style={styles.actionBtn}
          activeOpacity={0.6}
        >
          <Text style={styles.cameraIcon}>📷</Text>
        </TouchableOpacity>

        {/* Gallery button */}
        <TouchableOpacity
          onPress={handleMediaPress}
          style={styles.actionBtn}
          activeOpacity={0.6}
        >
          <Text style={styles.galleryIcon}>🖼️</Text>
        </TouchableOpacity>

        {/* Text input */}
        <View
          style={[
            styles.inputWrapper,
            isFocused && styles.inputWrapperFocused,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="rgba(255,255,255,0.22)"
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            returnKeyType="default"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>

        {/* SEND or MIC button */}
        {hasText ? (
          <Animated.View style={sendBtnAnimStyle}>
            <TouchableOpacity
              onPress={handleSend}
              activeOpacity={0.7}
              style={styles.sendBtn}
            >
              <LinearGradient
                colors={['#F5A623', '#E8920A']}
                style={styles.sendBtnGradient}
              >
                <Text style={styles.sendIcon}>➤</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <VoiceRecorder onAudioReady={handleAudioReady} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    backgroundColor: C.bgDeep,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,166,35,0.14)',
    paddingHorizontal: 12,
    paddingTop: 10,
  },

  // Reply bar
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
    backgroundColor: C.bgSurface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  replyIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
  },
  replyBarName: {
    fontFamily: 'Nunito-Bold',
    fontSize: 12,
    marginBottom: 1,
  },
  replyBarText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: C.textMuted,
  },
  replyCloseBtn: {
    padding: 8,
  },
  replyCloseIcon: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.40)',
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  actionBtn: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 20,
    opacity: 0.7,
  },
  galleryIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
  },
  inputWrapperFocused: {
    borderColor: 'rgba(245,166,35,0.35)',
  },
  input: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: C.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },

  // Send button
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendBtnGradient: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  sendIcon: {
    fontSize: 18,
    color: C.myBubbleText,
  },
});
