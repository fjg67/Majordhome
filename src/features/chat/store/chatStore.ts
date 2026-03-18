import { create } from 'zustand';
import type { Message, ContextMenuState, TypingUser } from '../types/chat.types';

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  replyingTo: Message | null;
  contextMenu: ContextMenuState | null;
  typingUsers: TypingUser[];
  unreadCount: number;

  // Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  prependMessages: (messages: Message[]) => void;
  setIsLoading: (loading: boolean) => void;
  setIsLoadingMore: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setReplyingTo: (message: Message | null) => void;
  setContextMenu: (state: ContextMenuState | null) => void;
  setTypingUsers: (users: TypingUser[]) => void;
  addTypingUser: (user: TypingUser) => void;
  removeTypingUser: (userId: string) => void;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
  addReactionToMessage: (messageId: string, reaction: Message['reactions'][0]) => void;
  removeReactionFromMessage: (messageId: string, reactionId: string) => void;
  reset: () => void;
}

const initialState = {
  messages: [] as Message[],
  isLoading: true,
  isLoadingMore: false,
  hasMore: true,
  replyingTo: null as Message | null,
  contextMenu: null as ContextMenuState | null,
  typingUsers: [] as TypingUser[],
  unreadCount: 0,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages],
    })),

  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg,
      ),
    })),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId),
    })),

  prependMessages: (newMessages) =>
    set((state) => ({
      messages: [...state.messages, ...newMessages],
    })),

  setIsLoading: (isLoading) => set({ isLoading }),
  setIsLoadingMore: (isLoadingMore) => set({ isLoadingMore }),
  setHasMore: (hasMore) => set({ hasMore }),
  setReplyingTo: (replyingTo) => set({ replyingTo }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setTypingUsers: (typingUsers) => set({ typingUsers }),

  addTypingUser: (user) =>
    set((state) => {
      if (state.typingUsers.find((u) => u.userId === user.userId)) {
        return state;
      }
      return { typingUsers: [...state.typingUsers, user] };
    }),

  removeTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u.userId !== userId),
    })),

  setUnreadCount: (unreadCount) => set({ unreadCount }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),

  addReactionToMessage: (messageId, reaction) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, reactions: [...msg.reactions, reaction] }
          : msg,
      ),
    })),

  removeReactionFromMessage: (messageId, reactionId) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              reactions: msg.reactions.filter((r) => r.id !== reactionId),
            }
          : msg,
      ),
    })),

  reset: () => set(initialState),
}));
