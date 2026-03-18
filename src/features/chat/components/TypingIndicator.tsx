import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { TypingUser } from '../types/chat.types';
import { CHAT_COLORS as C } from '../types/chat.types';

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

const TypingDot: React.FC<{ index: number }> = ({ index }) => {
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(
      index * 180,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) }),
          withTiming(0.6, { duration: 280, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.4 + scale.value * 0.6,
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
};

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;

  const first = typingUsers[0];
  const label =
    typingUsers.length === 1
      ? first.userName
      : `${typingUsers.length} personnes`;

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify().damping(20)}
      exiting={FadeOutDown.duration(150)}
      style={styles.container}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: `${first.userColor}22`,
            borderColor: first.userColor,
          },
        ]}
      >
        <Text style={styles.avatarEmoji}>{first.userEmoji}</Text>
      </View>

      {/* Bulle avec dots animés */}
      <View style={styles.bubble}>
        <TypingDot index={0} />
        <TypingDot index={1} />
        <TypingDot index={2} />
      </View>

      {/* Nom */}
      <Text style={styles.name} numberOfLines={1}>
        <Text style={[styles.nameBold, { color: first.userColor }]}>{label}</Text>
        <Text style={styles.nameAction}> écrit...</Text>
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 13,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.theirBubble,
    borderWidth: 1,
    borderColor: C.theirBorder,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.amber,
  },
  name: {
    fontSize: 11,
    flexShrink: 1,
  },
  nameBold: {
    fontFamily: 'Nunito-Bold',
  },
  nameAction: {
    fontFamily: 'DMSans-Regular',
    color: C.textMuted,
    fontStyle: 'italic',
  },
});
