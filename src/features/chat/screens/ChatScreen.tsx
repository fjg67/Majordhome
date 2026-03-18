import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert as RNAlert,
  Dimensions,
  AppState,
  Keyboard,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '@features/auth/store/authStore';
import { notificationService } from '@services/notifications';

// ─── Chat feature imports ───
import type { Message } from '../types/chat.types';
import { CHAT_COLORS as C } from '../types/chat.types';
import { useChatStore } from '../store/chatStore';
import { useMessages } from '../hooks/useMessages';
import { useTyping } from '../hooks/useTyping';

// ─── Components ───
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { TypingIndicator } from '../components/TypingIndicator';
import { DateSeparator } from '../components/DateSeparator';
import { SystemMessage } from '../components/SystemMessage';
import { MessageContextMenu } from '../components/MessageContextMenu';
import { ImageViewerScreen } from './ImageViewerScreen';

// ═══════════════════════════════════════════════════════════
// BACKGROUND ANIMATIONS
// ═══════════════════════════════════════════════════════════
const { height: SH } = Dimensions.get('window');

const AmberHalos: React.FC = () => {
  const r1 = useSharedValue(140);
  const r2 = useSharedValue(100);

  useEffect(() => {
    r1.value = withRepeat(
      withTiming(190, { duration: 5000, easing: Easing.inOut(Easing.sin) }), -1, true
    );
    r2.value = withDelay(1500, withRepeat(
      withTiming(140, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true
    ));
    return () => { r1.value = 140; r2.value = 100; };
  }, [r1, r2]);

  const halo1 = useAnimatedStyle(() => ({
    width: r1.value * 2, height: r1.value * 2, borderRadius: r1.value,
  }));
  const halo2 = useAnimatedStyle(() => ({
    width: r2.value * 2, height: r2.value * 2, borderRadius: r2.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{
        position: 'absolute', top: -50, alignSelf: 'center',
        backgroundColor: 'rgba(245,166,35,0.08)',
      }, halo1]} />
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.4, right: -60,
        backgroundColor: 'rgba(232,146,10,0.05)',
      }, halo2]} />
    </View>
  );
};

const AmberParticle: React.FC<{
  top: number; left: number; size: number; delay: number;
}> = ({ top, left, size, delay }) => {
  const opacity = useSharedValue(0.15);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withTiming(0.6, { duration: 3000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin) }),
      -1, true
    ));
    return () => { opacity.value = 0.15; };
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{
      position: 'absolute', top, left,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.amber,
    }, style]} pointerEvents="none" />
  );
};

const PARTICLES = [
  { top: 180, left: 40, size: 3, delay: 0 },
  { top: 350, left: 300, size: 2.5, delay: 800 },
  { top: 500, left: 80, size: 4, delay: 1500 },
  { top: 250, left: 320, size: 2, delay: 400 },
];

// ═══════════════════════════════════════════════════════════
// CHAT SCREEN
// ═══════════════════════════════════════════════════════════
export const ChatScreen: React.FC = () => {
  const household = useAuthStore((s) => s.household);
  const members = useAuthStore((s) => s.members);
  const tabBarHeight = useBottomTabBarHeight();

  const flatListRef = useRef<FlatList>(null);

  // ─── Store state ───
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const isLoadingMore = useChatStore((s) => s.isLoadingMore);
  const hasMore = useChatStore((s) => s.hasMore);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const contextMenu = useChatStore((s) => s.contextMenu);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const setContextMenu = useChatStore((s) => s.setContextMenu);

  // ─── Image viewer ───
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // ─── Scroll state ───
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // ─── Keyboard height (Android) ───
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Hooks ───
  const {
    loadMoreMessages,
    sendTextMessage,
    sendImageMessage,
    sendAudioMessage,
    deleteMessage,
    editMessage,
    addReaction,
  } = useMessages(household?.id);

  const { typingUsers, onTextChange, stopTyping } = useTyping(household?.id);

  // ─── Suppress notifications when chat focused AND app in foreground ───
  const isFocused = useIsFocused();
  useEffect(() => {
    // Active seulement si l'écran est visible ET l'app au premier plan
    const update = () => {
      notificationService.isChatScreenActive =
        isFocused && AppState.currentState === 'active';
    };
    update();
    const sub = AppState.addEventListener('change', update);
    return () => {
      sub.remove();
      notificationService.isChatScreenActive = false;
    };
  }, [isFocused]);

  // ─── Interleave messages with date separators ───
  type ListItem =
    | { type: 'date'; date: Date; key: string }
    | { type: 'message'; message: Message; key: string }
    | { type: 'system'; message: Message; key: string };

  const listData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    let lastDate = '';

    // Messages are in desc order (newest first due to inverted)
    // We need to add date separators when dates change
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const dateStr = msg.createdAt.toISOString().split('T')[0];

      if (dateStr !== lastDate) {
        items.push({
          type: 'date',
          date: msg.createdAt,
          key: `date-${dateStr}`,
        });
        lastDate = dateStr;
      }

      if (msg.type === 'system') {
        items.push({ type: 'system', message: msg, key: msg.id });
      } else {
        items.push({ type: 'message', message: msg, key: msg.id });
      }
    }

    // Reverse for inverted FlatList (newest at bottom → first in array)
    return items.reverse();
  }, [messages]);

  // ─── Handlers (defined before renderItem to avoid use-before-declaration) ───
  const handleLongPress = useCallback(
    (message: Message, position: { x: number; y: number }) => {
      setContextMenu({ message, position });
    },
    [setContextMenu],
  );

  const handleReactionPress = useCallback(
    (message: Message) => {
      // Open context menu centered on message for reactions
      setContextMenu({ message, position: { x: 100, y: 300 } });
    },
    [setContextMenu],
  );

  const handleImagePress = useCallback((imageUrl: string) => {
    setViewingImage(imageUrl);
  }, []);

  // ─── Render item ───
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'date') {
        return <DateSeparator date={item.date} />;
      }
      if (item.type === 'system') {
        return <SystemMessage message={item.message} />;
      }
      return (
        <MessageBubble
          message={item.message}
          onLongPress={handleLongPress}
          onReactionPress={handleReactionPress}
          onImagePress={handleImagePress}
        />
      );
    },
    [handleLongPress, handleReactionPress, handleImagePress],
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  const handleReact = useCallback(
    (emoji: string) => {
      if (!contextMenu) return;
      addReaction(contextMenu.message.id, emoji);
      setContextMenu(null);
    },
    [contextMenu, addReaction, setContextMenu],
  );

  const handleReply = useCallback(() => {
    if (!contextMenu) return;
    setReplyingTo(contextMenu.message);
    setContextMenu(null);
  }, [contextMenu, setReplyingTo, setContextMenu]);

  const handleCopy = useCallback(() => {
    // Clipboard handled in MessageContextMenu
  }, []);

  const handleEdit = useCallback(() => {
    if (!contextMenu) return;
    // For simplicity, prompt with Alert
    // In production, this would be an inline edit mode
    if (Platform.OS === 'ios') {
      RNAlert.prompt(
        'Modifier le message',
        '',
        (newText: string) => {
          if (newText?.trim()) {
            editMessage(contextMenu.message.id, newText.trim());
          }
        },
        'plain-text',
        contextMenu.message.content,
      );
    }
    setContextMenu(null);
  }, [contextMenu, editMessage, setContextMenu]);

  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    deleteMessage(contextMenu.message.id);
    setContextMenu(null);
  }, [contextMenu, deleteMessage, setContextMenu]);

  const handleSendText = useCallback(
    async (content: string, replyToId?: string) => {
      await sendTextMessage(content, replyToId);
      stopTyping();
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    },
    [sendTextMessage, stopTyping],
  );

  const handleSendImage = useCallback(
    async (uri: string, caption?: string) => {
      await sendImageMessage(uri, caption);
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    },
    [sendImageMessage],
  );

  const handleSendAudio = useCallback(
    async (uri: string, duration: number) => {
      await sendAudioMessage(uri, duration);
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    },
    [sendAudioMessage],
  );

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadMoreMessages();
    }
  }, [isLoadingMore, hasMore, loadMoreMessages]);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      setShowScrollToBottom(offsetY > 300);
    },
    [],
  );

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // ─── Online count (placeholder for Supabase Presence) ───
  // const onlineCount = members.length;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient
        colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={StyleSheet.absoluteFill}
      />
      
      <AmberHalos />
      {PARTICLES.map((p, i) => <AmberParticle key={i} {...p} />)}

      {/* ─── HEADER ─── */}
      <Animated.View entering={FadeInDown.duration(500)}>
        <View style={styles.header}>
          {/* Center: household info */}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              💬 {household?.name ?? 'Chat'}
            </Text>
            <View style={styles.headerMeta}>
              {/* Member avatars (overlapping) */}
              <View style={styles.memberAvatars}>
                {members.slice(0, 5).map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      styles.headerAvatar,
                      {
                        backgroundColor: `${m.color ?? C.amber}25`,
                        borderColor: m.color ?? C.amber,
                        marginLeft: i > 0 ? -8 : 0,
                        zIndex: members.length - i,
                      },
                    ]}
                  >
                    <Text style={styles.headerAvatarEmoji}>
                      {m.avatar_emoji}
                    </Text>
                  </View>
                ))}
              </View>
              {/* Status */}
              <View style={styles.onlineIndicator}>
                <View style={styles.onlineDot} />
                <Text style={styles.headerStatus}>
                  {members.length} membre{members.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ─── MESSAGES + INPUT ─── */}
      <KeyboardAvoidingView
        style={[
          styles.flex1,
          {
            paddingBottom: Platform.OS === 'android'
              ? keyboardHeight > 0 ? keyboardHeight : tabBarHeight
              : tabBarHeight,
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Messages list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.amber} />
            <Text style={styles.loadingText}>Chargement des messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Animated.View 
              entering={FadeInUp.delay(200).duration(600).springify().damping(16)}
              style={styles.emptyCard}
            >
              <LinearGradient
                colors={['rgba(245,166,35,0.15)', 'rgba(245,166,35,0.02)']}
                style={StyleSheet.absoluteFill}
                start={{x: 0, y: 0}}
                end={{x: 0, y: 1}}
              />
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Animated.View style={styles.emptyGlow} />
              </View>
              <Text style={styles.emptyTitle}>Lancez la discussion !</Text>
              <Text style={styles.emptySubtitle}>
                Partagez un message, une photo ou une note vocale avec {household?.name ?? 'votre foyer'} ✨
              </Text>
            </Animated.View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            inverted
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={C.amber} />
                </View>
              ) : null
            }
          />
        )}

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <Animated.View
            entering={FadeIn.springify()}
            exiting={FadeOut.duration(200)}
            style={styles.scrollToBottomContainer}
          >
            <TouchableOpacity
              onPress={scrollToBottom}
              activeOpacity={0.7}
              style={styles.scrollToBottomBtn}
            >
              <Text style={styles.scrollToBottomIcon}>↓</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Typing indicator */}
        <TypingIndicator typingUsers={typingUsers} />

        {/* Input bar */}
        <MessageInput
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendAudio={handleSendAudio}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onTypingChange={onTextChange}
        />
      </KeyboardAvoidingView>

      {/* ─── CONTEXT MENU ─── */}
      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          onReact={handleReact}
          onReply={handleReply}
          onCopy={handleCopy}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ─── IMAGE VIEWER ─── */}
      {viewingImage && (
        <ImageViewerScreen
          imageUrl={viewingImage}
          onClose={() => setViewingImage(null)}
        />
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgDeep,
  },
  flex1: {
    flex: 1,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,166,35,0.15)',
  },
  headerCenter: {
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'Nunito-Bold',
    fontSize: 22,
    color: C.textPrimary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatars: {
    flexDirection: 'row',
  },
  headerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarEmoji: {
    fontSize: 10,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  headerStatus: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
  },

  // List
  listContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: C.textSecondary,
  },
  loadingMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.12)',
    backgroundColor: 'rgba(26,14,0,0.6)',
    width: '100%',
    overflow: 'hidden',
  },
  emptyIconWrap: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlow: {
    position: 'absolute',
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245,166,35,0.2)',
  },
  emptyEmoji: {
    fontSize: 48,
    zIndex: 2,
  },
  emptyTitle: {
    fontFamily: 'Nunito-Bold',
    fontSize: 20,
    color: C.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Scroll to bottom
  scrollToBottomContainer: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    zIndex: 100,
  },
  scrollToBottomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.amberBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scrollToBottomIcon: {
    fontSize: 18,
    color: C.amber,
    fontWeight: 'bold',
  },
});
