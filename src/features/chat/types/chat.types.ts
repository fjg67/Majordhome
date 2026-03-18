// ═══════════════════════════════════════════════════════════
// Chat Types — MajordHome
// ═══════════════════════════════════════════════════════════

export type ChatMessageType = 'text' | 'image' | 'audio' | 'system';

export interface ChatMessageRaw {
  id: string;
  household_id: string;
  sender_id: string | null;
  type: ChatMessageType;
  content: string | null;
  media_url: string | null;
  media_thumb: string | null;
  audio_duration: number | null;
  reply_to_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  householdId: string;
  senderId: string | null;
  senderName: string;
  senderColor: string;
  senderEmoji: string;
  type: ChatMessageType;
  content?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  audioDuration?: number;
  replyToId?: string;
  replyTo?: MessageReplyPreview;
  reactions: MessageReaction[];
  reads: MessageRead[];
  isEdited: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  // UI state
  isOwn: boolean;
  showAvatar: boolean;
  showTimestamp: boolean;
}

export interface MessageReplyPreview {
  id: string;
  type: ChatMessageType;
  content?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  audioDuration?: number;
  senderName: string;
  senderColor: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  userColor: string;
  emoji: string;
}

export interface MessageReactionRaw {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface MessageRead {
  messageId: string;
  userId: string;
  userName: string;
  readAt: Date;
}

export interface MessageReadRaw {
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
  userColor: string;
  userEmoji: string;
}

export interface TypingIndicatorRaw {
  household_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
}

// ── Context Menu ──
export interface ContextMenuState {
  message: Message;
  position: { x: number; y: number };
}

// ── Grouped reactions ──
export interface GroupedReaction {
  emoji: string;
  users: Array<{
    userId: string;
    userName: string;
    userColor: string;
  }>;
}

// ── Chat Colors ──
export const CHAT_COLORS = {
  bgDeep: '#1A0E00',
  bgMid: '#261400',
  bgSurface: '#2E1A00',
  bgElevated: '#3A2200',

  amber: '#F5A623',
  amberSoft: 'rgba(245,166,35,0.15)',
  amberGlow: 'rgba(245,166,35,0.30)',
  amberBorder: 'rgba(245,166,35,0.22)',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
  textMuted: 'rgba(255,255,255,0.32)',

  // Membres
  member1: '#FF6B6B',
  member2: '#4ECDC4',
  member3: '#A78BFA',
  member4: '#FFA07A',

  // Chat spécifique
  myBubble: '#F5A623',
  myBubbleText: '#1A0E00',
  theirBubble: '#2E1A00',
  theirBorder: 'rgba(245,166,35,0.18)',
  systemMsg: 'rgba(255,255,255,0.25)',

  // Additional UI
  border: 'rgba(255,255,255,0.07)',
  danger: '#FF4444',
} as const;

export const EMOJI_OPTIONS = ['❤️', '😂', '👍', '🔥', '😮', '😢'] as const;

export const MAX_MESSAGE_LENGTH = 2000;
export const MESSAGES_PER_PAGE = 50;
export const MAX_AUDIO_DURATION_SECONDS = 180; // 3 minutes
export const IMAGE_MAX_WIDTH = 1200;
export const IMAGE_QUALITY = 0.85;
