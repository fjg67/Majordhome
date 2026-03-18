import React from 'react';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Text,
  Dimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface ImageViewerScreenProps {
  imageUrl: string;
  onClose: () => void;
}

export const ImageViewerScreen: React.FC<ImageViewerScreenProps> = ({
  imageUrl,
  onClose,
}) => {
  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Close button */}
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeBtn}
        activeOpacity={0.7}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      {/* Full image */}
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2001,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
  },
});
