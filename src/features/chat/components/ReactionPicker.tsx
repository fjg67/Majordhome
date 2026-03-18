import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  withSpring,
  withDelay,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EMOJI_OPTIONS, CHAT_COLORS as C } from '../types/chat.types';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiButton: React.FC<{
  emoji: string;
  index: number;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ emoji, index, onSelect, onClose }) => {
  const scale = useSharedValue(0);

  React.useEffect(() => {
    scale.value = withDelay(
      index * 40,
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
  }, [index, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    // Bounce animation before closing
    scale.value = withSequence(
      withSpring(1.4, { damping: 6 }),
      withTiming(1, { duration: 150 }),
    );
    setTimeout(() => {
      onSelect(emoji);
      onClose();
    }, 200);
  };

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.6}
        style={styles.emojiBtn}
      >
        <Animated.Text style={styles.emojiText}>{emoji}</Animated.Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelect,
  onClose,
}) => {
  return (
    <Animated.View
      entering={FadeIn.duration(200).springify()}
      style={styles.picker}
    >
      {EMOJI_OPTIONS.map((emoji, i) => (
        <EmojiButton
          key={emoji}
          emoji={emoji}
          index={i}
          onSelect={onSelect}
          onClose={onClose}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    backgroundColor: C.bgMid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    padding: 8,
    gap: 4,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 28,
  },
});
