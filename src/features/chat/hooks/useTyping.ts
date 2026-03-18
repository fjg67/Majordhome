import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@features/auth/store/authStore';
import { useChatStore } from '../store/chatStore';
import type { TypingUser, TypingIndicatorRaw } from '../types/chat.types';

const TYPING_DEBOUNCE_MS = 500;
const TYPING_TIMEOUT_MS = 3000;

export const useTyping = (householdId: string | undefined) => {
  const user = useAuthStore((s) => s.user);
  const myMember = useAuthStore((s) => s.member);
  const members = useAuthStore((s) => s.members);

  const { typingUsers, addTypingUser, removeTypingUser, setTypingUsers } =
    useChatStore();

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ─── Listen to others typing ───
  useEffect(() => {
    if (!householdId || !user) return;

    const channel = supabase
      .channel(`typing-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const data = payload.new as TypingIndicatorRaw;
          if (!data || !data.user_id) return;

          // Ignore own typing events
          if (
            data.user_id === myMember?.id ||
            data.user_id === user.id
          ) {
            return;
          }

          if (data.is_typing) {
            const member =
              members.find((m) => m.id === data.user_id) ??
              members.find((m) => m.user_id === data.user_id);
            if (member) {
              addTypingUser({
                userId: data.user_id,
                userName: member.display_name,
                userColor: member.color,
                userEmoji: member.avatar_emoji,
              });
            }
          } else {
            removeTypingUser(data.user_id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      setTypingUsers([]);
    };
  }, [householdId, user?.id, myMember?.id, members, addTypingUser, removeTypingUser, setTypingUsers]);

  // ─── Start typing (debounced) ───
  const startTyping = useCallback(async () => {
    if (!householdId || !myMember) return;

    // Debounce: don't spam updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      await supabase.from('typing_indicators').upsert({
        household_id: householdId,
        user_id: myMember.id,
        is_typing: true,
        updated_at: new Date().toISOString(),
      });
    }

    // Auto-stop after timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_TIMEOUT_MS);
  }, [householdId, myMember]);

  // ─── Stop typing ───
  const stopTyping = useCallback(async () => {
    if (!householdId || !myMember) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (isTypingRef.current) {
      isTypingRef.current = false;
      await supabase.from('typing_indicators').upsert({
        household_id: householdId,
        user_id: myMember.id,
        is_typing: false,
        updated_at: new Date().toISOString(),
      });
    }
  }, [householdId, myMember]);

  // ─── Handle text change (for MessageInput) ───
  const onTextChange = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTyping();
    }, TYPING_DEBOUNCE_MS);
  }, [startTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Fire and forget stop
      if (isTypingRef.current && householdId && myMember) {
        supabase.from('typing_indicators').upsert({
          household_id: householdId,
          user_id: myMember.id,
          is_typing: false,
          updated_at: new Date().toISOString(),
        });
      }
    };
  }, [householdId, myMember]);

  return { typingUsers, startTyping, stopTyping, onTextChange };
};
