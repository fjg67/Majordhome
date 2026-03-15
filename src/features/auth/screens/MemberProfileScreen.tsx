import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '@shared/hooks/useTheme';
import { MEMBER_COLORS } from '@shared/theme/colors';
import { useAuthStore } from '../store/authStore';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@app/navigation/types';

const AVATAR_EMOJIS = [
  '\u{1F60A}', '\u{1F60E}', '\u{1F913}', '\u{1F98A}', '\u{1F431}', '\u{1F436}', '\u{1F981}', '\u{1F43C}',
  '\u{1F31F}', '\u{1F308}', '\u{1F525}', '\u{1F48E}', '\u{1F3A8}', '\u{1F3B5}', '\u{1F355}', '\u{1F338}',
  '\u{1F680}', '\u{26A1}', '\u{1F3AE}', '\u{1F3E0}', '\u{1F33B}', '\u{1F98B}', '\u{1F340}', '\u{2728}',
];

interface FamilyMember {
  name: string;
  color: string;
  emoji: string;
}

interface MemberProfileScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'MemberProfile'>;
}

// ─── Mini color/emoji picker for family members ──────────
const MiniPicker: React.FC<{
  member: FamilyMember;
  index: number;
  onUpdate: (index: number, data: Partial<FamilyMember>) => void;
  onRemove: (index: number) => void;
  theme: any;
  isDark: boolean;
}> = ({ member, index, onUpdate, onRemove, theme, isDark }) => (
  <Animated.View entering={FadeIn.duration(300)} style={[styles.familyCard, {
    backgroundColor: theme.colors.cardBg,
    borderColor: member.color + '40',
  }]}>
    <View style={styles.familyCardHeader}>
      <View style={[styles.familyAvatarSmall, { backgroundColor: member.color + '20', borderColor: member.color }]}>
        <Text style={{ fontSize: 20 }}>{member.emoji}</Text>
      </View>
      <TextInput
        style={[styles.familyNameInput, { color: theme.colors.text, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBg }]}
        placeholder="Prénom..."
        placeholderTextColor={theme.colors.textMuted}
        value={member.name}
        onChangeText={(t) => onUpdate(index, { name: t })}
        maxLength={20}
      />
      <Pressable onPress={() => onRemove(index)} hitSlop={8}>
        <Text style={{ fontSize: 20, color: theme.colors.textMuted }}>{'\u2715'}</Text>
      </Pressable>
    </View>
    <View style={styles.familyColorRow}>
      {MEMBER_COLORS.map((c) => (
        <Pressable key={c} onPress={() => onUpdate(index, { color: c })}>
          <View style={[styles.familyColorDot, { backgroundColor: c },
            member.color === c && { borderColor: isDark ? '#FFF' : '#000', borderWidth: 2, transform: [{ scale: 1.2 }] },
          ]} />
        </Pressable>
      ))}
    </View>
    <View style={styles.familyEmojiRow}>
      {AVATAR_EMOJIS.slice(0, 12).map((e) => (
        <Pressable key={e} onPress={() => onUpdate(index, { emoji: e })}>
          <View style={[styles.familyEmojiDot, {
            backgroundColor: member.emoji === e ? member.color + '20' : 'transparent',
            borderColor: member.emoji === e ? member.color : theme.colors.inputBorder,
          }]}>
            <Text style={{ fontSize: 16 }}>{e}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  </Animated.View>
);

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addFamilyMember = useAuthStore((s) => s.addFamilyMember);
  const isDark = theme.isDark;

  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(MEMBER_COLORS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState('\u{1F60A}');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  // Family members to add
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const avatarScale = useSharedValue(1);
  const avatarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const addNewFamilyMember = useCallback(() => {
    // Pick next available color
    const usedColors = [selectedColor, ...familyMembers.map(m => m.color)];
    const nextColor = MEMBER_COLORS.find(c => !usedColors.includes(c)) || MEMBER_COLORS[1];
    setFamilyMembers(prev => [...prev, { name: '', color: nextColor, emoji: '\u{1F60E}' }]);
  }, [familyMembers, selectedColor]);

  const updateFamilyMember = useCallback((index: number, data: Partial<FamilyMember>) => {
    setFamilyMembers(prev => prev.map((m, i) => i === index ? { ...m, ...data } : m));
  }, []);

  const removeFamilyMember = useCallback((index: number) => {
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('Erreur', 'Choisissez un prénom ou surnom');
      return;
    }
    // Validate family members have names
    const invalidFamily = familyMembers.find(m => !m.name.trim());
    if (invalidFamily) {
      Alert.alert('Erreur', 'Chaque membre doit avoir un prénom');
      return;
    }

    setIsSubmitting(true);

    // Save own profile
    const result = await updateProfile({
      displayName: displayName.trim(),
      color: selectedColor,
      avatarEmoji: selectedEmoji,
    });
    if (result.error) {
      setIsSubmitting(false);
      Alert.alert('Erreur', result.error);
      return;
    }

    // Save family members
    for (const fm of familyMembers) {
      const fmResult = await addFamilyMember({
        displayName: fm.name.trim(),
        color: fm.color,
        avatarEmoji: fm.emoji,
      });
      if (fmResult.error) {
        setIsSubmitting(false);
        Alert.alert('Erreur', `Impossible d'ajouter ${fm.name}: ${fmResult.error}`);
        return;
      }
    }

    setIsSubmitting(false);
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [displayName, selectedColor, selectedEmoji, familyMembers, updateProfile, addFamilyMember, navigation]);

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(700).springify()} style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Votre profil</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Comment les autres vous verront
          </Text>
        </Animated.View>

        {/* Avatar preview */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(700).springify()}
          style={[avatarAnimStyle, styles.avatarPreview]}
        >
          <View style={[styles.avatarRing, { borderColor: selectedColor + '30' }]}>
            <View style={[styles.avatarCircle, {
              backgroundColor: selectedColor + '15',
              borderColor: selectedColor,
              shadowColor: selectedColor,
            }]}>
              <Text style={styles.avatarEmoji}>{selectedEmoji}</Text>
            </View>
          </View>
          <Text style={[styles.previewName, { color: theme.colors.text }]}>
            {displayName || 'Votre nom'}
          </Text>
        </Animated.View>

        {/* Name input */}
        <Animated.View entering={FadeInUp.delay(300).duration(600).springify()}>
          <View style={[styles.section, {
            backgroundColor: theme.colors.cardBg,
            borderColor: theme.colors.cardBorder,
            shadowColor: isDark ? '#7C6BFF' : '#000',
            shadowOpacity: isDark ? 0.10 : 0.05,
          }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Prénom ou surnom</Text>
            <View style={[styles.inputContainer, {
              borderColor: nameFocused ? theme.colors.inputBorderFocused : theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBg,
            }]}>
              <Text style={styles.inputIcon}>{'\u270F\uFE0F'}</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Ex: Alex, Maman, Papa..."
                placeholderTextColor={theme.colors.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                maxLength={30}
              />
            </View>
          </View>
        </Animated.View>

        {/* Color picker */}
        <Animated.View entering={FadeInUp.delay(400).duration(600).springify()}>
          <View style={[styles.section, {
            backgroundColor: theme.colors.cardBg,
            borderColor: theme.colors.cardBorder,
            shadowColor: isDark ? '#7C6BFF' : '#000',
            shadowOpacity: isDark ? 0.10 : 0.05,
          }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Votre couleur</Text>
            <View style={styles.colorGrid}>
              {MEMBER_COLORS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => {
                    setSelectedColor(color);
                    avatarScale.value = withSpring(1.1, {}, () => {
                      avatarScale.value = withSpring(1);
                    });
                  }}
                  style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.9 : 1 }] }]}
                >
                  <View
                    style={[
                      styles.colorCircle,
                      { backgroundColor: color },
                      selectedColor === color && [styles.colorSelected, {
                        borderColor: isDark ? '#FFFFFF' : '#000000',
                        shadowColor: color,
                      }],
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Emoji picker */}
        <Animated.View entering={FadeInUp.delay(500).duration(600).springify()}>
          <View style={[styles.section, {
            backgroundColor: theme.colors.cardBg,
            borderColor: theme.colors.cardBorder,
            shadowColor: isDark ? '#7C6BFF' : '#000',
            shadowOpacity: isDark ? 0.10 : 0.05,
          }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Votre avatar</Text>
            <View style={styles.emojiGrid}>
              {AVATAR_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    setSelectedEmoji(emoji);
                    avatarScale.value = withSpring(1.15, {}, () => {
                      avatarScale.value = withSpring(1);
                    });
                  }}
                  style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.9 : 1 }] }]}
                >
                  <View
                    style={[
                      styles.emojiCircle,
                      {
                        backgroundColor:
                          selectedEmoji === emoji
                            ? selectedColor + '15'
                            : isDark ? 'rgba(255,255,255,0.04)' : theme.colors.inputBg,
                        borderColor:
                          selectedEmoji === emoji
                            ? selectedColor
                            : theme.colors.inputBorder,
                      },
                    ]}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ─── Family members section ─── */}
        <Animated.View entering={FadeInUp.delay(600).duration(600).springify()}>
          <View style={[styles.section, {
            backgroundColor: theme.colors.cardBg,
            borderColor: theme.colors.cardBorder,
            shadowColor: isDark ? '#7C6BFF' : '#000',
            shadowOpacity: isDark ? 0.10 : 0.05,
          }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {'\u{1F46A}'} Membres du foyer
            </Text>
            <Text style={[styles.familySubtitle, { color: theme.colors.textSecondary }]}>
              Ajoutez les membres de votre famille (optionnel)
            </Text>

            {/* Added family members */}
            {familyMembers.map((fm, idx) => (
              <MiniPicker
                key={idx}
                member={fm}
                index={idx}
                onUpdate={updateFamilyMember}
                onRemove={removeFamilyMember}
                theme={theme}
                isDark={isDark}
              />
            ))}

            {/* Add button */}
            <Pressable
              onPress={addNewFamilyMember}
              style={({ pressed }) => [styles.addMemberBtn, {
                borderColor: theme.colors.primary + '40',
                backgroundColor: pressed ? theme.colors.primary + '10' : 'transparent',
              }]}
            >
              <Text style={[styles.addMemberBtnText, { color: theme.colors.primary }]}>
                + Ajouter un membre
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Save button */}
        <Animated.View entering={FadeInUp.delay(700).duration(600).springify()}>
          <Pressable
            onPress={handleSave}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.saveBtn, {
              opacity: isSubmitting ? 0.65 : pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.975 : 1 }],
            }]}
          >
            <LinearGradient
              colors={isDark ? ['#5A4BFF', '#7C6BFF'] : ['#6C5CE7', '#A29BFE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>C'est parti ! {'\u{1F680}'}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: 'Nunito-Bold', fontSize: 32, letterSpacing: -0.8, marginBottom: 6 },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 16, letterSpacing: 0.2 },
  avatarPreview: { alignItems: 'center', marginBottom: 24 },
  avatarRing: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarCircle: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  avatarEmoji: { fontSize: 44 },
  previewName: { fontFamily: 'Nunito-Bold', fontSize: 22 },
  section: {
    padding: 20, marginBottom: 14, borderRadius: 20, borderWidth: 1,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 4,
  },
  sectionTitle: { fontFamily: 'Nunito-SemiBold', fontSize: 16, marginBottom: 12 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', height: 54,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, gap: 10,
  },
  inputIcon: { fontSize: 18 },
  input: { flex: 1, height: 54, fontSize: 16, fontFamily: 'DMSans-Regular' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  colorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'transparent' },
  colorSelected: {
    borderWidth: 3, transform: [{ scale: 1.15 }],
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  emojiCircle: {
    width: 50, height: 50, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 24 },
  // Family members styles
  familySubtitle: { fontFamily: 'DMSans-Regular', fontSize: 13, marginBottom: 14, marginTop: -6 },
  familyCard: {
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10,
  },
  familyCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  familyAvatarSmall: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  familyNameInput: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12,
    fontSize: 15, fontFamily: 'DMSans-Regular',
  },
  familyColorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  familyColorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  familyEmojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  familyEmojiDot: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  addMemberBtn: {
    height: 48, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  addMemberBtnText: { fontFamily: 'DMSans-Medium', fontSize: 15 },
  saveBtn: { marginTop: 6, borderRadius: 16, overflow: 'hidden' },
  saveBtnGradient: {
    height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontFamily: 'Nunito-Bold', fontSize: 18, color: '#FFFFFF' },
});
