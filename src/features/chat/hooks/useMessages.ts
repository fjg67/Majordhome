import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@features/auth/store/authStore';
import { useChatStore } from '../store/chatStore';
import type {
  Message,
  ChatMessageRaw,
  MessageReaction,
  MessageRead,
  MessageReplyPreview,
  ChatMessageType,
  MESSAGES_PER_PAGE,
} from '../types/chat.types';

// ─── Helper : resolve member info ───
const resolveMember = (
  senderId: string | null,
  members: Array<{ id: string; user_id: string | null; display_name: string; color: string; avatar_emoji: string }>,
): { name: string; color: string; emoji: string } => {
  if (!senderId) return { name: 'Système', color: '#F5A623', emoji: '🏠' };
  const member =
    members.find((m) => m.id === senderId) ??
    members.find((m) => m.user_id === senderId);
  return {
    name: member?.display_name ?? 'Inconnu',
    color: member?.color ?? '#F5A623',
    emoji: member?.avatar_emoji ?? '?',
  };
};

// ─── Helper : enrich raw message ───
const enrichMessage = (
  raw: Record<string, unknown>,
  currentUserId: string,
  members: Array<{ id: string; user_id: string | null; display_name: string; color: string; avatar_emoji: string }>,
): Message => {
  const senderId = raw.sender_id as string | null;
  const sender = resolveMember(senderId, members);

  // Parse reply_to
  let replyTo: MessageReplyPreview | undefined;
  if (raw.reply_to && typeof raw.reply_to === 'object') {
    const rt = raw.reply_to as Record<string, unknown>;
    const replySender = resolveMember(rt.sender_id as string | null, members);
    replyTo = {
      id: rt.id as string,
      type: rt.type as ChatMessageType,
      content: rt.content as string | undefined,
      mediaUrl: rt.media_url as string | undefined,
      mediaThumbnail: rt.media_thumb as string | undefined,
      audioDuration: rt.audio_duration as number | undefined,
      senderName: replySender.name,
      senderColor: replySender.color,
    };
  }

  // Parse reactions
  const rawReactions = (raw.reactions as Array<Record<string, unknown>>) ?? [];
  const reactions: MessageReaction[] = rawReactions.map((r) => {
    const rUser = resolveMember(r.user_id as string, members);
    return {
      id: r.id as string,
      messageId: raw.id as string,
      userId: r.user_id as string,
      userName: rUser.name,
      userColor: rUser.color,
      emoji: r.emoji as string,
    };
  });

  // Parse reads
  const rawReads = (raw.reads as Array<Record<string, unknown>>) ?? [];
  const reads: MessageRead[] = rawReads.map((r) => {
    const rUser = resolveMember(r.user_id as string, members);
    return {
      messageId: raw.id as string,
      userId: r.user_id as string,
      userName: rUser.name,
      readAt: new Date(r.read_at as string),
    };
  });

  // Determine isOwn by matching sender_id to members
  const currentMember = members.find((m) => m.user_id === currentUserId);
  const isOwn = senderId === currentMember?.id || senderId === currentUserId;

  return {
    id: raw.id as string,
    householdId: raw.household_id as string,
    senderId,
    senderName: sender.name,
    senderColor: sender.color,
    senderEmoji: sender.emoji,
    type: (raw.type as ChatMessageType) ?? 'text',
    content: raw.content as string | undefined,
    mediaUrl: raw.media_url as string | undefined,
    mediaThumbnail: raw.media_thumb as string | undefined,
    audioDuration: raw.audio_duration as number | undefined,
    replyToId: raw.reply_to_id as string | undefined,
    replyTo,
    reactions,
    reads,
    isEdited: (raw.is_edited as boolean) ?? false,
    editedAt: raw.edited_at ? new Date(raw.edited_at as string) : undefined,
    deletedAt: raw.deleted_at ? new Date(raw.deleted_at as string) : undefined,
    createdAt: new Date(raw.created_at as string),
    isOwn,
    showAvatar: true,
    showTimestamp: true,
  };
};

// ─── Mark consecutive messages from the same sender ───
const markMessageSeries = (messages: Message[]): Message[] => {
  return messages.map((msg, index) => {
    // Since list is inverted, index 0 is the newest message (bottom)
    // Previous message in display = index + 1 (the one above)
    const nextMsg = index + 1 < messages.length ? messages[index + 1] : null;
    // Next message in display = index - 1 (the one below)
    const prevMsg = index > 0 ? messages[index - 1] : null;

    // Show avatar if sender is different from the message above (nextMsg in array)
    const showAvatar =
      !nextMsg || nextMsg.senderId !== msg.senderId || nextMsg.type === 'system';

    // Show timestamp if it's the last message in a group or time gap > 5 min
    const showTimestamp =
      !prevMsg ||
      prevMsg.senderId !== msg.senderId ||
      Math.abs(msg.createdAt.getTime() - prevMsg.createdAt.getTime()) > 300000;

    return { ...msg, showAvatar, showTimestamp };
  });
};

const PAGE_SIZE = 50;

export const useMessages = (householdId: string | undefined) => {
  const user = useAuthStore((s) => s.user);
  const members = useAuthStore((s) => s.members);
  const myMember = useAuthStore((s) => s.member);

  const {
    setMessages,
    addMessage,
    removeMessage,
    updateMessage,
    prependMessages,
    setIsLoading,
    setIsLoadingMore,
    setHasMore,
    addReactionToMessage,
    removeReactionFromMessage,
  } = useChatStore();

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Fetch single message with relations ───
  const fetchSingleMessage = useCallback(
    async (messageId: string): Promise<Message | null> => {
      if (!user || !householdId) return null;

      const { data } = await supabase
        .from('messages')
        .select(
          `
          *,
          reply_to:reply_to_id(
            id, type, content, media_url, media_thumb,
            audio_duration, sender_id
          ),
          reactions:message_reactions(
            id, emoji, user_id
          ),
          reads:message_reads(user_id, read_at)
        `,
        )
        .eq('id', messageId)
        .is('deleted_at', null)
        .single();

      if (!data) return null;
      return enrichMessage(data as Record<string, unknown>, user.id, members);
    },
    [user, householdId, members],
  );

  // ─── Fetch messages (paginated) ───
  const fetchMessages = useCallback(
    async (before?: string): Promise<Message[]> => {
      if (!user || !householdId) return [];

      let query = supabase
        .from('messages')
        .select(
          `
          *,
          reply_to:reply_to_id(
            id, type, content, media_url, media_thumb,
            audio_duration, sender_id
          ),
          reactions:message_reactions(
            id, emoji, user_id
          ),
          reads:message_reads(user_id, read_at)
        `,
        )
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data } = await query;
      if (!data) return [];

      const enriched = (data as Array<Record<string, unknown>>).map((msg) =>
        enrichMessage(msg, user.id, members),
      );
      return markMessageSeries(enriched);
    },
    [user, householdId, members],
  );

  // ─── Initial load ───
  useEffect(() => {
    if (!householdId || !user) return;

    const loadInitial = async () => {
      setIsLoading(true);
      const msgs = await fetchMessages();
      setMessages(msgs);
      setHasMore(msgs.length >= PAGE_SIZE);
      setIsLoading(false);
    };

    loadInitial();
  }, [householdId, user?.id, fetchMessages, setIsLoading, setMessages, setHasMore]);

  // ─── Load more ───
  const loadMoreMessages = useCallback(async () => {
    const messages = useChatStore.getState().messages;
    if (!messages.length) return;

    setIsLoadingMore(true);
    const oldest = messages[messages.length - 1];
    const olderMsgs = await fetchMessages(oldest.createdAt.toISOString());
    prependMessages(olderMsgs);
    setHasMore(olderMsgs.length >= PAGE_SIZE);
    setIsLoadingMore(false);
  }, [fetchMessages, prependMessages, setIsLoadingMore, setHasMore]);

  // ─── Realtime subscription ───
  useEffect(() => {
    if (!householdId || !user) return;

    const channel = supabase
      .channel(`chat-${householdId}`)
      // New message
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          const fullMsg = await fetchSingleMessage(
            (payload.new as { id: string }).id,
          );
          if (fullMsg) {
            addMessage(fullMsg);
            // Auto-mark as read
            if (!fullMsg.isOwn) {
              markAsRead(fullMsg.id);
            }
          }
        },
      )
      // Reaction added
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const raw = payload.new as {
            id: string;
            message_id: string;
            user_id: string;
            emoji: string;
          };
          const rMember = resolveMember(raw.user_id, members);
          addReactionToMessage(raw.message_id, {
            id: raw.id,
            messageId: raw.message_id,
            userId: raw.user_id,
            userName: rMember.name,
            userColor: rMember.color,
            emoji: raw.emoji,
          });
        },
      )
      // Reaction removed
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const old = payload.old as { id: string; message_id: string };
          removeReactionFromMessage(old.message_id, old.id);
        },
      )
      // Message updated (edit or soft delete)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessageRaw;
          if (updated.deleted_at) {
            removeMessage(updated.id);
          } else if (updated.is_edited) {
            updateMessage(updated.id, {
              content: updated.content ?? undefined,
              isEdited: true,
              editedAt: updated.edited_at
                ? new Date(updated.edited_at)
                : undefined,
            });
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [
    householdId,
    user?.id,
    members,
    fetchSingleMessage,
    addMessage,
    removeMessage,
    updateMessage,
    addReactionToMessage,
    removeReactionFromMessage,
  ]);

  // ─── Send text message ───
  const sendTextMessage = useCallback(
    async (content: string, replyToId?: string) => {
      if (!householdId || !myMember) {
        import('react-native').then(m => m.Alert.alert('Erreur', 'Impossible de trouver le foyer ou le membre.'));
        return;
      }
      const { error } = await supabase.from('messages').insert({
        household_id: householdId,
        sender_id: myMember.id,
        type: 'text',
        content,
        reply_to_id: replyToId ?? null,
      });
      if (error) {
        console.error('Send error:', error);
        import('react-native').then(m => m.Alert.alert('Erreur envoi', error.message));
      }
    },
    [householdId, myMember],
  );

  // ─── Send image message ───
  const sendImageMessage = useCallback(
    async (uri: string, caption?: string) => {
      if (!householdId || !myMember) return;

      const filename = `${householdId}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filename, blob, { contentType: 'image/jpeg' });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat-media').getPublicUrl(filename);

      await supabase.from('messages').insert({
        household_id: householdId,
        sender_id: myMember.id,
        type: 'image',
        content: caption ?? null,
        media_url: publicUrl,
      });
    },
    [householdId, myMember],
  );

  // ─── Send audio message ───
  const sendAudioMessage = useCallback(
    async (uri: string, duration: number) => {
      if (!householdId || !myMember) return;

      // Sur Android, le recorder retourne un chemin absolu sans scheme (ex: /data/.../sound.mp4)
      // fetch() requiert le préfixe file:// pour lire un fichier local
      const fileUri =
        uri.startsWith('file://') || uri.startsWith('content://')
          ? uri
          : `file://${uri}`;

      // Détecter l'extension réelle depuis l'URI (Android → .mp4, iOS → .m4a)
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'mp4';
      const contentType = ext === 'm4a' ? 'audio/m4a' : 'audio/mp4';
      const filename = `${householdId}/${Date.now()}.${ext}`;

      let blob: Blob;
      try {
        const response = await fetch(fileUri);
        if (!response.ok && response.status !== 0) {
          console.error('Audio fetch error:', response.status, fileUri);
          return;
        }
        blob = await response.blob();
        if (blob.size === 0) {
          console.error('Audio blob is empty, uri:', fileUri);
          return;
        }
      } catch (e) {
        console.error('Audio fetch exception:', e, fileUri);
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filename, blob, { contentType });

      if (uploadError) {
        console.error('Audio upload error:', uploadError);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat-media').getPublicUrl(filename);

      await supabase.from('messages').insert({
        household_id: householdId,
        sender_id: myMember.id,
        type: 'audio',
        media_url: publicUrl,
        audio_duration: Math.round(duration),
      });
    },
    [householdId, myMember],
  );

  // ─── Delete message (soft delete) ───
  const deleteMessage = useCallback(
    async (messageId: string) => {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
    },
    [],
  );

  // ─── Edit message ───
  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      await supabase
        .from('messages')
        .update({
          content: newContent,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId);
    },
    [],
  );

  // ─── Add reaction ───
  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!myMember) return;
      await supabase.from('message_reactions').upsert({
        message_id: messageId,
        user_id: myMember.id,
        emoji,
      });
    },
    [myMember],
  );

  // ─── Remove reaction ───
  const removeReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!myMember) return;
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', myMember.id)
        .eq('emoji', emoji);
    },
    [myMember],
  );

  // ─── Mark as read ───
  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!myMember) return;
      await supabase.from('message_reads').upsert({
        message_id: messageId,
        user_id: myMember.id,
        read_at: new Date().toISOString(),
      });
    },
    [myMember],
  );

  return {
    loadMoreMessages,
    sendTextMessage,
    sendImageMessage,
    sendAudioMessage,
    deleteMessage,
    editMessage,
    addReaction,
    removeReaction,
    markAsRead,
  };
};
