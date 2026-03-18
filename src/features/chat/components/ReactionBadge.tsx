import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useAuthStore } from '@features/auth/store/authStore';
import type { MessageReaction, GroupedReaction } from '../types/chat.types';
import { CHAT_COLORS as C } from '../types/chat.types';

interface ReactionBadgeProps {
  reactions: MessageReaction[];
  onPress: () => void;
  isOwn: boolean;
}

const groupReactions = (reactions: MessageReaction[]): GroupedReaction[] => {
  const map = new Map<string, GroupedReaction>();
  reactions.forEach((r) => {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.users.push({
        userId: r.userId,
        userName: r.userName,
        userColor: r.userColor,
      });
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        users: [
          {
            userId: r.userId,
            userName: r.userName,
            userColor: r.userColor,
          },
        ],
      });
    }
  });
  return Array.from(map.values());
};

export const ReactionBadge: React.FC<ReactionBadgeProps> = ({
  reactions,
  onPress,
  isOwn,
}) => {
  const myMember = useAuthStore((s) => s.member);
  const grouped = useMemo(() => groupReactions(reactions), [reactions]);

  if (grouped.length === 0) return null;

  return (
    <View
      style={[
        styles.reactionsRow,
        isOwn ? styles.reactionsRowOwn : styles.reactionsRowTheir,
      ]}
    >
      {grouped.map((group) => {
        const isMeIncluded = group.users.some(
          (u) => u.userId === myMember?.id || u.userId === myMember?.user_id,
        );

        return (
          <Animated.View
            key={group.emoji}
            entering={ZoomIn.springify().damping(15)}
          >
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.7}
              style={[
                styles.reactionBadge,
                isMeIncluded && styles.reactionBadgeActive,
              ]}
            >
              <Text style={styles.reactionEmoji}>{group.emoji}</Text>
              {group.users.length > 1 && (
                <Text style={styles.reactionCount}>{group.users.length}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: -4,
  },
  reactionsRowOwn: {
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  reactionsRowTheir: {
    justifyContent: 'flex-start',
    paddingLeft: 46, // avatar + gap
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(58,34,0,0.90)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  reactionBadgeActive: {
    borderColor: 'rgba(245,166,35,0.40)',
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    fontFamily: 'DMSans-Medium',
    color: C.textSecondary,
    marginLeft: 2,
  },
});
