import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@services/supabase';
import Animated, {
  SlideInRight,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import dayjs from 'dayjs';
import { useAuthStore } from '@features/auth/store/authStore';
import type { Message } from '../types/chat.types';
import { CHAT_COLORS as C } from '../types/chat.types';
import { ReactionBadge } from './ReactionBadge';
import { AudioPlayer } from './AudioPlayer';

interface MessageBubbleProps {
  message: Message;
  onLongPress: (message: Message, position: { x: number; y: number }) => void;
  onReactionPress: (message: Message) => void;
  onImagePress?: (mediaUrl: string) => void;
  onReplyPress?: (messageId: string) => void;
}

// ─── Reply Preview ───
const ReplyPreview: React.FC<{
  reply: Message['replyTo'];
  isOwn: boolean;
}> = ({ reply, isOwn }) => {
  if (!reply) return null;

  return (
    <View
      style={[
        styles.replyPreview,
        {
          borderLeftColor: reply.senderColor,
          backgroundColor: isOwn
            ? 'rgba(26,14,0,0.20)'
            : 'rgba(245,166,35,0.08)',
        },
      ]}
    >
      <Text style={[styles.replyName, { color: reply.senderColor }]}>
        {reply.senderName}
      </Text>
      {reply.type === 'text' && (
        <Text
          style={[
            styles.replyText,
            { color: isOwn ? 'rgba(26,14,0,0.65)' : C.textMuted },
          ]}
          numberOfLines={1}
        >
          {reply.content}
        </Text>
      )}
      {reply.type === 'image' && (
        <Text
          style={[
            styles.replyText,
            { color: isOwn ? 'rgba(26,14,0,0.65)' : C.textMuted },
          ]}
        >
          📷 Photo
        </Text>
      )}
      {reply.type === 'audio' && (
        <Text
          style={[
            styles.replyText,
            { color: isOwn ? 'rgba(26,14,0,0.65)' : C.textMuted },
          ]}
        >
          🎤 Message vocal
        </Text>
      )}
    </View>
  );
};

// ─── Text Content ───
const TextContent: React.FC<{ message: Message; isOwn: boolean }> = ({
  message,
  isOwn,
}) => {
  const content = message.content ?? '';

  // Check if message is emoji-only (1-3 emojis)
  const emojiRegex =
    /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}[\uFE0F]?){1,3}$/u;
  const strippedContent = content.replace(/\s/g, '');
  const isEmojiOnly = emojiRegex.test(strippedContent) && strippedContent.length <= 12;

  if (isEmojiOnly) {
    return (
      <Text style={styles.emojiOnlyText}>{content}</Text>
    );
  }

  return (
    <Text
      style={[
        styles.textContent,
        { color: isOwn ? C.myBubbleText : C.textPrimary },
      ]}
    >
      {content}
    </Text>
  );
};

// ─── Image Content ───

const extractChatMediaPath = (url: string): string | null => {
  const match = url.match(/\/chat-media\/(.+?)(?:\?|$)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const ImageContent: React.FC<{
  message: Message;
  onImagePress?: (url: string) => void;
}> = ({ message, onImagePress }) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    if (!message.mediaUrl) { setLoading(false); setError(true); return; }
    let cancelled = false;

    const resolve = async () => {
      const rawUrl = message.mediaUrl!;
      const path   = extractChatMediaPath(rawUrl);

      if (!path) {
        // URL directe stockée — essai direct
        if (!cancelled) setImageUri(rawUrl);
        return;
      }

      // ── Tentative 1 : signed URL (fonctionne bucket privé ET public) ──
      const { data: signed } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(path, 60 * 60); // valide 1h

      if (!cancelled && signed?.signedUrl) {
        setImageUri(signed.signedUrl);
        return;
      }

      // ── Tentative 2 : URL publique directe ──
      const { data: pub } = supabase.storage
        .from('chat-media')
        .getPublicUrl(path);

      if (!cancelled && pub?.publicUrl) {
        setImageUri(pub.publicUrl);
        return;
      }

      // ── Tentative 3 : normaliser l'URL stockée ──
      const normalised = rawUrl
        .replace('/object/authenticated/', '/object/public/')
        .split('?')[0];

      if (!cancelled) setImageUri(normalised);
    };

    resolve().catch(() => {
      if (!cancelled) { setLoading(false); setError(true); }
    });

    return () => { cancelled = true; };
  }, [message.mediaUrl]);

  const handlePress = useCallback(() => {
    const url = imageUri ?? message.mediaUrl;
    if (url && onImagePress) onImagePress(url);
  }, [imageUri, message.mediaUrl, onImagePress]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>

        {/* Spinner pendant la résolution / chargement */}
        {loading && !error && (
          <View style={[styles.messageImage, styles.imagePlaceholder]}>
            <ActivityIndicator color="#F5A623" size="large" />
          </View>
        )}

        {/* Image rendue dès que l'URI est disponible */}
        {imageUri != null && !error && (
          <Image
            source={{ uri: imageUri }}
            style={styles.messageImage}
            resizeMode="cover"
            onLoadStart={() => setLoading(true)}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        )}

        {/* État erreur */}
        {error && (
          <View style={[styles.messageImage, styles.imagePlaceholder]}>
            <Text style={{ fontSize: 28 }}>🖼️</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6, textAlign: 'center', paddingHorizontal: 8 }}>
              Image indisponible
            </Text>
          </View>
        )}

        {/* Gradient décoratif */}
        {!loading && !error && imageUri && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.45)']}
            style={styles.imageGradient}
          />
        )}
      </View>
      {message.content ? (
        <Text style={styles.imageCaption}>{message.content}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

// ─── Read Receipts Indicator (style WhatsApp) ───
const CheckMark: React.FC<{ color: string; style?: object }> = ({ color, style }) => (
  <Text style={[{ fontSize: 11, color, lineHeight: 14 }, style]}>✓</Text>
);

const ReadReceiptsIndicator: React.FC<{
  reads: Message['reads'];
}> = ({ reads }) => {
  const members = useAuthStore((s) => s.members);
  const totalOthers = Math.max(members.length - 1, 1);

  const allRead = reads.length >= totalOthers;
  const someRead = reads.length > 0;

  // ✓ simple gris = envoyé
  if (!someRead) {
    return (
      <View style={styles.checksRow}>
        <CheckMark color="rgba(26,14,0,0.40)" />
      </View>
    );
  }

  // ✓✓ coloré ambre = tout le monde a lu
  if (allRead) {
    return (
      <View style={styles.checksRow}>
        <CheckMark color={C.amber} />
        <CheckMark color={C.amber} style={{ marginLeft: -5 }} />
      </View>
    );
  }

  // ✓✓ gris partiel = lu par certains
  return (
    <View style={styles.checksRow}>
      <CheckMark color="rgba(26,14,0,0.60)" />
      <CheckMark color="rgba(26,14,0,0.40)" style={{ marginLeft: -5 }} />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onLongPress,
  onReactionPress,
  onImagePress,
}) => {
  const { isOwn } = message;
  const bubbleScale = useSharedValue(1);

  const handleLongPress = useCallback(
    (msg: Message, position: { x: number; y: number }) => {
      onLongPress(msg, position);
    },
    [onLongPress],
  );

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onStart((e) => {
      bubbleScale.value = withSpring(0.97, { damping: 15 });
      runOnJS(handleLongPress)(message, {
        x: e.absoluteX,
        y: e.absoluteY,
      });
    })
    .onEnd(() => {
      bubbleScale.value = withSpring(1, { damping: 15 });
    });

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bubbleScale.value }],
  }));

  // Check if emoji only
  const content = message.content ?? '';
  const emojiRegex =
    /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}[\uFE0F]?){1,3}$/u;
  const isEmojiOnly =
    message.type === 'text' &&
    emojiRegex.test(content.replace(/\s/g, '')) &&
    content.replace(/\s/g, '').length <= 12;

  const enterAnim = isOwn
    ? SlideInRight.duration(300).springify().damping(18)
    : SlideInLeft.duration(300).springify().damping(18);

  return (
    <View style={styles.rowWrapper}>
      <Animated.View
        entering={enterAnim}
        style={[styles.row, isOwn ? styles.rowOwn : styles.rowTheir]}
      >
      {/* AVATAR (their side only, if showAvatar) */}
      {!isOwn && message.showAvatar && (
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: `${message.senderColor}22`,
              borderColor: message.senderColor,
            },
          ]}
        >
          <Text style={styles.avatarEmoji}>{message.senderEmoji}</Text>
        </View>
      )}
      {!isOwn && !message.showAvatar && <View style={styles.avatarSpacer} />}

      <GestureDetector gesture={longPressGesture}>
        <Animated.View
          style={[
            styles.bubbleContainer,
            isOwn ? styles.bubbleContainerOwn : styles.bubbleContainerTheir,
            bubbleAnimStyle,
          ]}
        >
          {/* SENDER NAME (first msg in group, both sides) */}
          {message.showAvatar && (
            <Text
              style={[
                styles.senderName,
                { color: isOwn ? 'rgba(245,166,35,0.70)' : message.senderColor },
                isOwn && styles.senderNameOwn,
              ]}
            >
              {message.senderName}
            </Text>
          )}

          {/* REPLY PREVIEW */}
          {message.replyTo && (
            <ReplyPreview reply={message.replyTo} isOwn={isOwn} />
          )}

          {/* MAIN BUBBLE */}
          {isEmojiOnly ? (
            <View style={styles.emojiOnlyContainer}>
              <TextContent message={message} isOwn={isOwn} />
              <Text
                style={[
                  styles.timestamp,
                  styles.timestampTheir,
                ]}
              >
                {dayjs(message.createdAt).format('HH:mm')}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.bubble,
                isOwn ? styles.bubbleOwn : styles.bubbleTheir,
                message.showAvatar && !isOwn && styles.bubbleFirstTheir,
                message.showAvatar && isOwn && styles.bubbleFirstOwn,
              ]}
            >
              {/* CONTENT by type */}
              {message.type === 'text' && (
                <TextContent message={message} isOwn={isOwn} />
              )}
              {message.type === 'image' && (
                <ImageContent
                  message={message}
                  onImagePress={onImagePress}
                />
              )}
              {message.type === 'audio' && (
                <AudioPlayer message={message} isOwn={isOwn} />
              )}

              {/* TIMESTAMP + STATUS */}
              <View style={styles.meta}>
                {message.isEdited && (
                  <Text
                    style={[
                      styles.editedLabel,
                      {
                        color: isOwn
                          ? 'rgba(26,14,0,0.50)'
                          : C.textMuted,
                      },
                    ]}
                  >
                    modifié
                  </Text>
                )}
                <Text
                  style={[
                    styles.timestamp,
                    isOwn ? styles.timestampOwn : styles.timestampTheir,
                  ]}
                >
                  {dayjs(message.createdAt).format('HH:mm')}
                </Text>
                {isOwn && <ReadReceiptsIndicator reads={message.reads} />}
              </View>
            </View>
          )}

          {/* REACTIONS */}
          {message.reactions.length > 0 && (
            <ReactionBadge
              reactions={message.reactions}
              onPress={() => onReactionPress(message)}
              isOwn={isOwn}
            />
          )}
        </Animated.View>
      </GestureDetector>
      </Animated.View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  rowWrapper: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowTheir: {
    justifyContent: 'flex-start',
  },

  // Avatar
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginTop: 4,
  },
  avatarEmoji: {
    fontSize: 14,
  },
  avatarSpacer: {
    width: 38,
  },

  // Bubble container
  bubbleContainer: {
    maxWidth: '78%',
  },
  bubbleContainerOwn: {
    alignItems: 'flex-end',
  },
  bubbleContainerTheir: {
    alignItems: 'flex-start',
  },

  // Sender name
  senderName: {
    fontFamily: 'Nunito-Bold',
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 4,
  },
  senderNameOwn: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 4,
  },

  // Bubble
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 6,
  },
  bubbleOwn: {
    backgroundColor: C.myBubble,
    borderBottomRightRadius: 6,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  bubbleTheir: {
    backgroundColor: C.theirBubble,
    borderWidth: 1,
    borderColor: C.theirBorder,
    borderBottomLeftRadius: 6,
  },
  bubbleFirstOwn: {
    borderTopRightRadius: 20,
  },
  bubbleFirstTheir: {
    borderTopLeftRadius: 20,
  },

  // Text content
  textContent: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    lineHeight: 22,
  },

  // Emoji-only
  emojiOnlyContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  emojiOnlyText: {
    fontSize: 48,
  },

  // Image content
  imageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    maxWidth: 220,
    minHeight: 140,
  },
  messageImage: {
    width: 220,
    height: 200,
    borderRadius: 14,
  },
  imagePlaceholder: {
    backgroundColor: 'rgba(245,166,35,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  imageCaption: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: C.textPrimary,
    marginTop: 4,
    paddingHorizontal: 4,
  },

  // Reply preview
  replyPreview: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 8,
    paddingLeft: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  replyName: {
    fontFamily: 'Nunito-Bold',
    fontSize: 11,
    marginBottom: 1,
  },
  replyText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
  },

  // Meta (timestamp + read receipts)
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 4,
  },
  editedLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 9,
    fontStyle: 'italic',
  },
  timestamp: {
    fontFamily: 'DMSans-Regular',
    fontSize: 9,
  },
  timestampOwn: {
    color: 'rgba(26,14,0,0.50)',
  },
  timestampTheir: {
    color: C.textMuted,
  },

  // Read receipts
  checksRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
