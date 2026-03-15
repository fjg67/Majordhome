import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '@shared/hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@app/navigation/types';

type HouseholdMode = 'choose' | 'create' | 'join';

interface HouseholdSetupScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'HouseholdSetup'>;
}

export const HouseholdSetupScreen: React.FC<HouseholdSetupScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const createHousehold = useAuthStore((s) => s.createHousehold);
  const joinHousehold = useAuthStore((s) => s.joinHousehold);

  const [mode, setMode] = useState<HouseholdMode>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const isDark = theme.isDark;

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Donnez un nom \u00e0 votre foyer');
      return;
    }
    setIsSubmitting(true);
    const result = await createHousehold(name.trim());
    setIsSubmitting(false);
    if (result.error) {
      Alert.alert('Erreur', result.error);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'MemberProfile' }] });
  }, [name, createHousehold, navigation]);

  const handleJoin = useCallback(async () => {
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length !== 8) {
      Alert.alert('Erreur', "Le code d'invitation doit contenir 8 caract\u00e8res");
      return;
    }
    setIsSubmitting(true);
    const result = await joinHousehold(cleaned);
    setIsSubmitting(false);
    if (result.error) {
      Alert.alert('Erreur', result.error);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'MemberProfile' }] });
  }, [code, joinHousehold, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={isDark
          ? ['#0F0F1A', '#1A1A35', '#0F0F1A']
          : ['#EDE8FF', '#F8F4FF', '#F4F5FA']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.content}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(700).springify()} style={styles.header}>
          <LinearGradient
            colors={isDark ? ['#3A2ECC', '#7C6BFF'] : ['#EDE5FF', '#F8F0FF']}
            style={styles.emojiBox}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.emoji}>{'\uD83C\uDFE1'}</Text>
          </LinearGradient>
          <Text style={[styles.title, { color: theme.colors.text }]}>Votre foyer</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {mode === 'choose'
              ? 'Cr\u00e9ez ou rejoignez un foyer'
              : mode === 'create'
              ? 'Donnez un nom \u00e0 votre espace \u2728'
              : "Entrez le code d'invitation \uD83D\uDD17"}
          </Text>
        </Animated.View>

        {/* Choose mode */}
        {mode === 'choose' ? (
          <Animated.View
            entering={FadeInUp.delay(300).duration(700).springify()}
            layout={Layout.springify()}
            style={styles.choiceRow}
          >
            <Pressable
              onPress={() => setMode('create')}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.96 : 1 }] }]}
            >
              <View style={[styles.choiceCard, {
                backgroundColor: theme.colors.cardBg,
                borderColor: theme.colors.cardBorder,
                shadowColor: isDark ? '#7C6BFF' : '#000',
                shadowOpacity: isDark ? 0.12 : 0.06,
              }]}>
                <LinearGradient
                  colors={isDark ? ['rgba(255,159,67,0.15)', 'rgba(255,159,67,0.05)'] : ['rgba(255,159,67,0.10)', 'rgba(255,159,67,0.03)']}
                  style={styles.choiceIconCircle}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.choiceEmoji}>{'\u2728'}</Text>
                </LinearGradient>
                <Text style={[styles.choiceTitle, { color: theme.colors.text }]}>Créer</Text>
                <Text style={[styles.choiceDesc, { color: theme.colors.textSecondary }]}>Nouveau foyer</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setMode('join')}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.96 : 1 }] }]}
            >
              <View style={[styles.choiceCard, {
                backgroundColor: theme.colors.cardBg,
                borderColor: theme.colors.cardBorder,
                shadowColor: isDark ? '#7C6BFF' : '#000',
                shadowOpacity: isDark ? 0.12 : 0.06,
              }]}>
                <LinearGradient
                  colors={isDark ? ['rgba(124,107,255,0.15)', 'rgba(124,107,255,0.05)'] : ['rgba(108,92,231,0.10)', 'rgba(108,92,231,0.03)']}
                  style={styles.choiceIconCircle}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.choiceEmoji}>{'\uD83D\uDD17'}</Text>
                </LinearGradient>
                <Text style={[styles.choiceTitle, { color: theme.colors.text }]}>Rejoindre</Text>
                <Text style={[styles.choiceDesc, { color: theme.colors.textSecondary }]}>Code d'invitation</Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Create form */}
        {mode === 'create' ? (
          <Animated.View entering={FadeInUp.delay(100).duration(600).springify()} layout={Layout.springify()}>
            <View style={[styles.formCard, {
              backgroundColor: theme.colors.cardBg,
              borderColor: theme.colors.cardBorder,
              shadowColor: isDark ? '#7C6BFF' : '#000',
              shadowOpacity: isDark ? 0.12 : 0.06,
            }]}>
              <View style={[styles.accentLine, { backgroundColor: 'transparent' }]}>
                <View style={styles.accentGradient}>
                  <View style={[styles.accentSegment, { backgroundColor: '#FF9F43' }]} />
                  <View style={[styles.accentSegment, { backgroundColor: theme.colors.primary }]} />
                  <View style={[styles.accentSegment, { backgroundColor: '#2ED47A' }]} />
                </View>
              </View>

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>NOM DU FOYER</Text>
              <View style={[styles.inputContainer, {
                borderColor: nameFocused ? theme.colors.inputBorderFocused : theme.colors.inputBorder,
                backgroundColor: theme.colors.inputBg,
              }]}>
                <Text style={styles.inputIcon}>{'\uD83C\uDFE1'}</Text>
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Ex: La maison Dupont"
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
              </View>

              <Pressable
                onPress={handleCreate}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.submitBtn, {
                  opacity: isSubmitting ? 0.65 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.975 : 1 }],
                }]}
              >
                <LinearGradient
                  colors={['#FF9F43', '#FFB86C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>Créer le foyer</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => setMode('choose')}
                style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.backText, { color: theme.colors.textMuted }]}>{'\u2190'} Retour</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {/* Join form */}
        {mode === 'join' ? (
          <Animated.View entering={FadeInUp.delay(100).duration(600).springify()} layout={Layout.springify()}>
            <View style={[styles.formCard, {
              backgroundColor: theme.colors.cardBg,
              borderColor: theme.colors.cardBorder,
              shadowColor: isDark ? '#7C6BFF' : '#000',
              shadowOpacity: isDark ? 0.12 : 0.06,
            }]}>
              <View style={[styles.accentLine, { backgroundColor: 'transparent' }]}>
                <View style={styles.accentGradient}>
                  <View style={[styles.accentSegment, { backgroundColor: theme.colors.primary }]} />
                  <View style={[styles.accentSegment, { backgroundColor: '#2ED47A' }]} />
                  <View style={[styles.accentSegment, { backgroundColor: '#FF6B6B' }]} />
                </View>
              </View>

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>CODE D'INVITATION (8 CARACTÈRES)</Text>
              <View style={[styles.inputContainer, {
                borderColor: codeFocused ? theme.colors.inputBorderFocused : theme.colors.inputBorder,
                backgroundColor: theme.colors.inputBg,
              }]}>
                <Text style={styles.inputIcon}>{'\uD83D\uDD11'}</Text>
                <TextInput
                  style={[styles.input, styles.codeInput, { color: theme.colors.text }]}
                  placeholder="ABCD1234"
                  placeholderTextColor={theme.colors.textMuted}
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase().slice(0, 8))}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  autoFocus
                  autoCapitalize="characters"
                  maxLength={8}
                  returnKeyType="done"
                  onSubmitEditing={handleJoin}
                />
              </View>

              <Pressable
                onPress={handleJoin}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.submitBtn, {
                  opacity: isSubmitting ? 0.65 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.975 : 1 }],
                }]}
              >
                <LinearGradient
                  colors={isDark ? ['#5A4BFF', '#7C6BFF'] : ['#6C5CE7', '#A29BFE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>Rejoindre</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => setMode('choose')}
                style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.backText, { color: theme.colors.textMuted }]}>{'\u2190'} Retour</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  emojiBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  emoji: { fontSize: 36 },
  title: { fontFamily: 'Nunito-Bold', fontSize: 32, letterSpacing: -0.8, marginBottom: 6 },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 16, textAlign: 'center', letterSpacing: 0.2 },
  choiceRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  choiceCard: {
    width: 155,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  choiceIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  choiceEmoji: { fontSize: 28 },
  choiceTitle: { fontFamily: 'Nunito-Bold', fontSize: 18, marginBottom: 4 },
  choiceDesc: { fontFamily: 'DMSans-Regular', fontSize: 13, textAlign: 'center' },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingTop: 0,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  accentLine: { height: 3, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginHorizontal: -24, marginBottom: 20, overflow: 'hidden' },
  accentGradient: { flexDirection: 'row', height: 3 },
  accentSegment: { flex: 1, height: 3 },
  label: { fontFamily: 'DMSans-Medium', fontSize: 11, letterSpacing: 1.5, marginTop: 8, marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputIcon: { fontSize: 18 },
  input: { flex: 1, height: 54, fontSize: 16, fontFamily: 'DMSans-Regular' },
  codeInput: { fontFamily: 'JetBrainsMono-Regular', fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  submitBtn: { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  submitGradient: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: 'Nunito-Bold', fontSize: 16, color: '#FFFFFF', letterSpacing: 0.3 },
  backBtn: { alignSelf: 'center', paddingVertical: 14, marginTop: 4 },
  backText: { fontFamily: 'DMSans-Medium', fontSize: 14 },
});
