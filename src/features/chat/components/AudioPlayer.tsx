import React, { useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAudioPlayer, formatDuration, generateWaveformBars } from '../hooks/useAudio';
import { CHAT_COLORS as C } from '../types/chat.types';
import type { Message } from '../types/chat.types';
import { supabase } from '@services/supabase';

// URL de base Supabase Storage (endpoint authenticated = pas de token dans l'URL)
const SUPABASE_STORAGE_URL = 'https://yxqsgqbrzesmnpughynd.supabase.co/storage/v1';

interface AudioPlayerProps {
  message: Message;
  isOwn: boolean;
}

// Extrait le chemin relatif depuis une URL Supabase Storage
const extractStoragePath = (url: string): string | null => {
  try {
    const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/chat-media\/(.+?)(?:\?|$)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ message, isOwn }) => {
  // authUrl = endpoint authenticated, authHeaders = Bearer token
  const [authUrl, setAuthUrl] = useState<string | undefined>(undefined);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>(undefined);
  const pendingPlayRef = useRef(false);

  const { isPlaying, progress, duration, toggle } = useAudioPlayer(authUrl, authHeaders);

  // Préparer l'URL authenticated puis lancer la lecture
  const handleToggle = useCallback(async () => {
    // Si déjà prêt → lecture/pause directe
    if (authUrl && authHeaders) {
      toggle();
      return;
    }

    if (!message.mediaUrl) return;

    const path = extractStoragePath(message.mediaUrl);
    if (!path) return;

    // Récupérer le token de session courant
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('[AudioPlayer] Pas de session auth');
      return;
    }

    // Endpoint /authenticated/ = pas de ?token dans l'URL, header Authorization à la place
    const url = `${SUPABASE_STORAGE_URL}/object/authenticated/chat-media/${path}`;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    pendingPlayRef.current = true;
    setAuthHeaders(headers);
    setAuthUrl(url);
  }, [authUrl, authHeaders, message.mediaUrl, toggle]);

  // Dès que authUrl + authHeaders sont prêts et qu'une lecture est en attente, la déclencher
  React.useEffect(() => {
    if (authUrl && authHeaders && pendingPlayRef.current) {
      pendingPlayRef.current = false;
      toggle();
    }
  }, [authUrl, authHeaders, toggle]);

  const waveformBars = useMemo(
    () => generateWaveformBars(message.id, 32),
    [message.id],
  );

  const totalDuration = message.audioDuration ?? duration ?? 0;
  const progressRatio =
    totalDuration > 0 ? progress / totalDuration : 0;
  const progressIndex = Math.floor(progressRatio * waveformBars.length);

  const playedColor = isOwn ? C.myBubbleText : C.amber;
  const unplayedColor = isOwn
    ? 'rgba(26,14,0,0.35)'
    : 'rgba(245,166,35,0.30)';

  return (
    <View style={styles.audioContainer}>
      {/* Play/Pause button */}
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.7}
        style={[
          styles.playBtn,
          {
            backgroundColor: isOwn
              ? 'rgba(26,14,0,0.25)'
              : 'rgba(245,166,35,0.20)',
          },
        ]}
      >
        <Text
          style={[
            styles.playIcon,
            { color: isOwn ? C.myBubbleText : C.amber },
          ]}
        >
          {isPlaying ? '⏸' : '▶'}
        </Text>
      </TouchableOpacity>

      {/* Waveform */}
      <View style={styles.waveform}>
        {waveformBars.map((height, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              {
                height,
                backgroundColor:
                  i < progressIndex ? playedColor : unplayedColor,
              },
            ]}
          />
        ))}
      </View>

      {/* Duration */}
      <Text
        style={[
          styles.audioDuration,
          {
            color: isOwn
              ? 'rgba(26,14,0,0.65)'
              : 'rgba(255,255,255,0.45)',
          },
        ]}
      >
        {isPlaying
          ? formatDuration(progress)
          : formatDuration(totalDuration)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 16,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  audioDuration: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    minWidth: 32,
    textAlign: 'right',
  },
});
