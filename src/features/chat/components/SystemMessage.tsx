import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CHAT_COLORS as C } from '../types/chat.types';
import type { Message } from '../types/chat.types';

interface SystemMessageProps {
  message: Message;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
  return (
    <View style={styles.wrapper}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <View style={styles.dot} />
        <Text style={styles.text}>{message.content}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.systemMsg,
  },
  text: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: C.systemMsg,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
