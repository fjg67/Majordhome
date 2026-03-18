import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  Clipboard,
  Alert,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import type { Message } from '../types/chat.types';
import { EMOJI_OPTIONS, CHAT_COLORS as C } from '../types/chat.types';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

interface MessageContextMenuProps {
  message: Message;
  position: { x: number; y: number };
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  show?: boolean;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  show = true,
  danger = false,
}) => {
  if (!show) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={styles.menuItem}
    >
      <Text style={styles.menuItemIcon}>{icon}</Text>
      <Text
        style={[
          styles.menuItemLabel,
          danger && { color: C.danger },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  position,
  onReact,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onClose,
}) => {
  const isOwn = message.isOwn;

  // Position the menu above or below the finger tap position
  const menuPosition = useMemo(() => {
    const menuHeight = 280;
    const menuWidth = 260;
    const isTop = position.y > SCREEN_H / 2;

    return {
      top: isTop
        ? Math.max(60, position.y - menuHeight)
        : Math.min(position.y + 10, SCREEN_H - menuHeight - 60),
      left: Math.min(
        Math.max(16, position.x - menuWidth / 2),
        SCREEN_W - menuWidth - 16,
      ),
    };
  }, [position]);

  const handleCopy = useCallback(() => {
    if (message.content) {
      Clipboard.setString(message.content);
    }
    onCopy();
    onClose();
  }, [message.content, onCopy, onClose]);

  const handleReply = useCallback(() => {
    onReply();
    onClose();
  }, [onReply, onClose]);

  const handleEdit = useCallback(() => {
    onEdit();
    onClose();
  }, [onEdit, onClose]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer le message',
      'Voulez-vous vraiment supprimer ce message ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ],
    );
  }, [onDelete, onClose]);

  const handleReact = useCallback(
    (emoji: string) => {
      onReact(emoji);
      onClose();
    },
    [onReact, onClose],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
      </Animated.View>

      {/* Menu */}
      <Animated.View
        entering={ZoomIn.springify().damping(20)}
        exiting={FadeOut.duration(150)}
        style={[styles.contextMenu, menuPosition]}
      >
        {/* Emoji row */}
        <View style={styles.emojiRow}>
          {EMOJI_OPTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleReact(emoji)}
              activeOpacity={0.6}
              style={styles.emojiOption}
            >
              <Text style={styles.emojiOptionText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Separator */}
        <View style={styles.menuSeparator} />

        {/* Actions */}
        <MenuItem
          icon="↩️"
          label="Répondre"
          onPress={handleReply}
        />
        <MenuItem
          icon="📋"
          label="Copier"
          onPress={handleCopy}
          show={message.type === 'text'}
        />
        <MenuItem
          icon="✏️"
          label="Modifier"
          onPress={handleEdit}
          show={isOwn && message.type === 'text'}
        />
        <MenuItem
          icon="🗑️"
          label="Supprimer"
          onPress={handleDelete}
          show={isOwn}
          danger
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.50)',
    zIndex: 999,
  },
  contextMenu: {
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: C.bgMid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.amberBorder,
    paddingTop: 10,
    overflow: 'hidden',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 16,
  },

  // Emoji row
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  emojiOption: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionText: {
    fontSize: 26,
  },

  // Separator
  menuSeparator: {
    height: 1,
    backgroundColor: 'rgba(245,166,35,0.12)',
    marginHorizontal: 12,
  },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemIcon: {
    fontSize: 18,
  },
  menuItemLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: C.textPrimary,
  },
});
