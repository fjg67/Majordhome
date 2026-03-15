import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  Share,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Animated, {
  FadeInDown, FadeInUp, FadeIn,
  useAnimatedStyle, useSharedValue, withRepeat, withTiming,
  interpolate, Easing, ZoomIn, FadeOut, SlideOutDown,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Canvas, RoundedRect, Circle, Line as SkLine, vec, Path } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@features/auth/store/authStore';

const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium (DO NOT MODIFY)
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:      '#1A0E00',
  bgMid:       '#261400',
  bgSurface:   '#2E1A00',
  bgElevated:  '#3A2200',

  amber:       '#F5A623',
  amberSoft:   'rgba(245,166,35,0.15)',
  amberGlow:   'rgba(245,166,35,0.30)',
  amberBorder: 'rgba(245,166,35,0.22)',

  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
  textMuted:     'rgba(255,255,255,0.32)',

  danger:  '#FF4444',
  success: '#34D399',
};

// ═══════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════
const SectionHeader: React.FC<{ icon: string; title: string; count?: number }> = ({ icon, title, count }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, paddingHorizontal: 4,
  }}>
    <Text style={{ fontSize: 16 }}>{icon}</Text>
    <Text style={{
      fontFamily: 'Nunito-Bold', fontSize: 13, color: C.amber,
      letterSpacing: 2, textTransform: 'uppercase',
    }}>{title}</Text>
    {count !== undefined && (
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
        shadowColor: C.amber, shadowRadius: 6, shadowOpacity: 0.5, elevation: 4,
      }}>
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 11, color: C.bgDeep }}>{count}</Text>
      </View>
    )}
  </View>
);

// ═══════════════════════════════════════════════════════════
// SETTING ROW
// ═══════════════════════════════════════════════════════════
const SettingRow: React.FC<{
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  skiaIcon?: React.ReactNode;
}> = ({ icon, label, value, onPress, danger, skiaIcon }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: 'rgba(245,166,35,0.08)',
    }, pressed && onPress && { backgroundColor: 'rgba(245,166,35,0.06)', borderRadius: 12 }]}
  >
    {/* Icon container */}
    <View style={{
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: danger ? 'rgba(255,68,68,0.12)' : C.amberSoft,
      borderWidth: 1, borderColor: danger ? 'rgba(255,68,68,0.22)' : C.amberBorder,
      alignItems: 'center', justifyContent: 'center',
    }}>
      {skiaIcon ?? <Text style={{ fontSize: 16 }}>{icon}</Text>}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{
        fontFamily: 'DMSans-Medium', fontSize: 15,
        color: danger ? C.danger : C.textPrimary,
      }}>{label}</Text>
      {value ? (
        <Text style={{
          fontFamily: 'DMSans-Regular', fontSize: 12,
          color: C.textMuted, marginTop: 2,
        }}>{value}</Text>
      ) : null}
    </View>
    {onPress && (
      <View style={{
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: 'rgba(245,166,35,0.08)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 14, color: danger ? C.danger : 'rgba(245,166,35,0.5)' }}>›</Text>
      </View>
    )}
  </Pressable>
);

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const member = useAuthStore(s => s.member);
  const household = useAuthStore(s => s.household);
  const members = useAuthStore(s => s.members);
  const signOut = useAuthStore(s => s.signOut);
  const navigation = useNavigation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Avatar ring animation
  const ringPulse = useSharedValue(0);
  useEffect(() => {
    ringPulse.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true,
    );
    return () => { ringPulse.value = 0; };
  }, [ringPulse]);
  const ringStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(ringPulse.value, [0, 1], [0.3, 0.7]),
    shadowRadius: interpolate(ringPulse.value, [0, 1], [8, 18]),
  }));

  const handleCopyCode = useCallback(() => {
    if (household?.invite_code) {
      Clipboard.setString(household.invite_code);
      Alert.alert('Copié !', `Code : ${household.invite_code}`);
    }
  }, [household]);

  const handleShareCode = useCallback(async () => {
    if (household?.invite_code) {
      try {
        await Share.share({
          message: `Rejoins notre foyer "${household.name}" sur MajordHome ! Code d'invitation : ${household.invite_code}`,
        });
      } catch (_) { /* user cancelled */ }
    }
  }, [household]);

  const handleSignOut = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmSignOut = useCallback(async () => {
    setIsLoggingOut(true);
    await signOut();
    setShowLogoutModal(false);
    setIsLoggingOut(false);
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }),
    );
  }, [signOut, navigation]);

  const mc = member?.color || C.amber;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ══════ PROFILE HERO ══════ */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient
            colors={['rgba(245,166,35,0.10)', 'rgba(245,166,35,0.02)', 'transparent']}
            style={{
              paddingTop: insets.top + 16, paddingBottom: 28,
              alignItems: 'center',
            }}
          >
            {/* Page title */}
            <Text style={{
              fontFamily: 'Nunito-Bold', fontSize: 13, color: C.amber,
              letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20,
            }}>⚙️ Réglages</Text>

            {/* Avatar with glow ring */}
            <Animated.View style={[ringStyle, {
              shadowColor: mc,
              shadowOffset: { width: 0, height: 0 },
              marginBottom: 14,
            }]}>
              <View style={{
                width: 96, height: 96, borderRadius: 28,
                backgroundColor: mc + '20',
                borderWidth: 2.5, borderColor: mc,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: mc, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
              }}>
                <Text style={{ fontSize: 44 }}>{member?.avatar_emoji ?? '😊'}</Text>
              </View>
              {/* Role badge overlay */}
              <View style={{
                position: 'absolute', bottom: -6, alignSelf: 'center',
                backgroundColor: member?.role === 'admin' ? C.bgElevated : C.bgSurface,
                borderWidth: 1.5,
                borderColor: member?.role === 'admin' ? C.amber : 'rgba(255,255,255,0.15)',
                borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
              }}>
                <Text style={{
                  fontFamily: 'DMSans-Medium', fontSize: 10,
                  color: member?.role === 'admin' ? C.amber : C.textSecondary,
                  letterSpacing: 0.5,
                }}>
                  {member?.role === 'admin' ? '👑 Admin' : '👤 Membre'}
                </Text>
              </View>
            </Animated.View>

            {/* Name */}
            <Text style={{
              fontFamily: 'Nunito-Bold', fontSize: 26, color: C.textPrimary,
              letterSpacing: -0.5, marginTop: 4,
              textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 0 },
            }}>{member?.display_name ?? 'Utilisateur'}</Text>

            {/* Email */}
            <Text style={{
              fontFamily: 'DMSans-Regular', fontSize: 14,
              color: C.textSecondary, marginTop: 4,
            }}>{user?.email ?? ''}</Text>

            {/* Decorative separator */}
            <View style={{ marginTop: 16, width: 60, overflow: 'hidden' }}>
              <LinearGradient
                colors={['transparent', C.amber + '60', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 1 }}
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ══════ FOYER SECTION ══════ */}
        <Animated.View entering={FadeInUp.delay(120).duration(450).springify()}
          style={{ marginHorizontal: 16, marginBottom: 14 }}
        >
          <View style={{
            backgroundColor: C.bgSurface, borderRadius: 22,
            borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)',
            padding: 16, overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.30, shadowRadius: 16, elevation: 8,
          }}>
            {/* Highlight line */}
            <LinearGradient
              colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1, position: 'absolute', top: 0, left: 0, right: 0 }}
            />

            <SectionHeader icon="🏠" title="Foyer" />

            <SettingRow icon="✏️" label="Nom du foyer" value={household?.name ?? '—'} />
            <SettingRow
              icon="🔑"
              label="Code d'invitation"
              value={household?.invite_code ?? '—'}
              onPress={handleCopyCode}
            />
            <SettingRow icon="📤" label="Partager le code" onPress={handleShareCode} />
          </View>
        </Animated.View>

        {/* ══════ MEMBERS SECTION ══════ */}
        <Animated.View entering={FadeInUp.delay(240).duration(450).springify()}
          style={{ marginHorizontal: 16, marginBottom: 14 }}
        >
          <View style={{
            backgroundColor: C.bgSurface, borderRadius: 22,
            borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)',
            padding: 16, overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.30, shadowRadius: 16, elevation: 8,
          }}>
            <LinearGradient
              colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1, position: 'absolute', top: 0, left: 0, right: 0 }}
            />

            <SectionHeader icon="👨‍👩‍👧" title="Membres" count={members.length} />

            {members.map((m, idx) => {
              const mCol = m.color || C.amber;
              return (
                <Animated.View key={m.id}
                  entering={FadeInUp.delay(300 + idx * 60).duration(350)}
                >
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 12, paddingHorizontal: 4,
                    borderBottomWidth: idx < members.length - 1 ? 1 : 0,
                    borderBottomColor: 'rgba(245,166,35,0.08)',
                  }}>
                    {/* Avatar */}
                    <View style={{ position: 'relative' }}>
                      <View style={{
                        width: 46, height: 46, borderRadius: 14,
                        backgroundColor: mCol + '22',
                        borderWidth: 2, borderColor: mCol,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 20 }}>{m.avatar_emoji || m.display_name.charAt(0)}</Text>
                      </View>
                      {/* Role indicator */}
                      {m.role === 'admin' && (
                        <View style={{
                          position: 'absolute', top: -4, right: -4,
                          width: 18, height: 18, borderRadius: 6,
                          backgroundColor: C.bgElevated,
                          borderWidth: 1.5, borderColor: C.amber,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 9 }}>👑</Text>
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontFamily: 'Nunito-SemiBold', fontSize: 16,
                        color: C.textPrimary,
                      }}>{m.display_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <View style={{
                          backgroundColor: m.role === 'admin' ? C.amberSoft : 'rgba(255,255,255,0.06)',
                          borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                        }}>
                          <Text style={{
                            fontFamily: 'DMSans-Regular', fontSize: 11,
                            color: m.role === 'admin' ? C.amber : C.textMuted,
                          }}>{m.role === 'admin' ? 'Admin' : 'Membre'}</Text>
                        </View>
                        {!m.user_id && (
                          <View style={{
                            backgroundColor: 'rgba(255,68,68,0.10)',
                            borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                          }}>
                            <Text style={{
                              fontFamily: 'DMSans-Regular', fontSize: 11,
                              color: 'rgba(255,68,68,0.7)',
                            }}>Sans compte</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Color indicator */}
                    <View style={{
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: mCol,
                      shadowColor: mCol, shadowRadius: 6, shadowOpacity: 0.6, elevation: 3,
                    }} />
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* ══════ ACCOUNT SECTION ══════ */}
        <Animated.View entering={FadeInUp.delay(380).duration(450).springify()}
          style={{ marginHorizontal: 16, marginBottom: 14 }}
        >
          <View style={{
            backgroundColor: C.bgSurface, borderRadius: 22,
            borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)',
            padding: 16, overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.30, shadowRadius: 16, elevation: 8,
          }}>
            <LinearGradient
              colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1, position: 'absolute', top: 0, left: 0, right: 0 }}
            />

            <SectionHeader icon="⚙️" title="Compte" />

            <SettingRow icon="📧" label="Email" value={user?.email ?? '—'} />
          </View>
        </Animated.View>

        {/* ══════ SIGN OUT BUTTON ══════ */}
        <Animated.View entering={FadeInUp.delay(480).duration(400)}
          style={{ marginHorizontal: 16, marginBottom: 14 }}
        >
          <Pressable onPress={handleSignOut}>
            <View style={{
              backgroundColor: 'rgba(255,68,68,0.08)', borderRadius: 18,
              borderWidth: 1, borderColor: 'rgba(255,68,68,0.22)',
              paddingVertical: 16, alignItems: 'center', flexDirection: 'row',
              justifyContent: 'center', gap: 10,
              shadowColor: '#FF4444', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
            }}>
              <Text style={{ fontSize: 18 }}>🚪</Text>
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 16, color: C.danger,
              }}>Se déconnecter</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* ══════ APP VERSION ══════ */}
        <Animated.View entering={FadeIn.delay(600).duration(500)}>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{
              fontFamily: 'DMSans-Regular', fontSize: 11,
              color: C.textMuted, letterSpacing: 0.5,
            }}>MajordHome v1.0</Text>
            <View style={{ marginTop: 6, width: 40, overflow: 'hidden' }}>
              <LinearGradient
                colors={['transparent', C.amber + '40', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 1 }}
              />
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════ */}
      {/* LOGOUT CONFIRMATION MODAL                            */}
      {/* ══════════════════════════════════════════════════════ */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !isLoggingOut && setShowLogoutModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => !isLoggingOut && setShowLogoutModal(false)}
        >
          <Pressable onPress={() => {}}>
            <Animated.View
              entering={ZoomIn.duration(350).springify().damping(15)}
              style={{
                width: SCREEN_W - 48,
                backgroundColor: C.bgSurface,
                borderRadius: 28,
                borderWidth: 1.5,
                borderColor: 'rgba(255,68,68,0.25)',
                overflow: 'hidden',
                shadowColor: '#FF4444',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.3,
                shadowRadius: 30,
                elevation: 20,
              }}
            >
              {/* Top danger glow bar */}
              <LinearGradient
                colors={['rgba(255,68,68,0.40)', 'rgba(255,68,68,0.08)', 'transparent']}
                style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}
              >
                {/* Icon container with pulsing ring */}
                <View style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: 'rgba(255,68,68,0.12)',
                  borderWidth: 2, borderColor: 'rgba(255,68,68,0.35)',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#FF4444',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5, shadowRadius: 20,
                }}>
                  <Text style={{ fontSize: 36 }}>🚪</Text>
                </View>
              </LinearGradient>

              {/* Content */}
              <View style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 28, alignItems: 'center' }}>
                <Text style={{
                  fontFamily: 'Nunito-Bold', fontSize: 22, color: C.textPrimary,
                  textAlign: 'center', letterSpacing: -0.3,
                }}>Se déconnecter ?</Text>

                <Text style={{
                  fontFamily: 'DMSans-Regular', fontSize: 14, color: C.textSecondary,
                  textAlign: 'center', marginTop: 10, lineHeight: 20,
                  paddingHorizontal: 8,
                }}>
                  Tu seras déconnecté de ton compte{'\n'}et redirigé vers la page de connexion.
                </Text>

                {/* User info card */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  marginTop: 20, marginBottom: 24,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 16, padding: 14,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
                  alignSelf: 'stretch',
                }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 14,
                    backgroundColor: mc + '20',
                    borderWidth: 1.5, borderColor: mc,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 22 }}>{member?.avatar_emoji ?? '😊'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: 'Nunito-SemiBold', fontSize: 15, color: C.textPrimary,
                    }}>{member?.display_name ?? 'Utilisateur'}</Text>
                    <Text style={{
                      fontFamily: 'DMSans-Regular', fontSize: 12, color: C.textMuted,
                      marginTop: 1,
                    }}>{user?.email ?? ''}</Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
                  {/* Cancel */}
                  <Pressable
                    onPress={() => setShowLogoutModal(false)}
                    disabled={isLoggingOut}
                    style={({ pressed }) => ({
                      flex: 1, paddingVertical: 14, borderRadius: 16,
                      backgroundColor: pressed ? 'rgba(245,166,35,0.12)' : 'rgba(245,166,35,0.06)',
                      borderWidth: 1.5, borderColor: C.amberBorder,
                      alignItems: 'center', justifyContent: 'center',
                    })}
                  >
                    <Text style={{
                      fontFamily: 'Nunito-Bold', fontSize: 15, color: C.amber,
                    }}>Annuler</Text>
                  </Pressable>

                  {/* Confirm logout */}
                  <Pressable
                    onPress={confirmSignOut}
                    disabled={isLoggingOut}
                    style={({ pressed }) => ({
                      flex: 1, paddingVertical: 14, borderRadius: 16,
                      overflow: 'hidden',
                    })}
                  >
                    <LinearGradient
                      colors={
                        isLoggingOut
                          ? ['rgba(255,68,68,0.3)', 'rgba(200,40,40,0.3)']
                          : ['#FF4444', '#CC2222']
                      }
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        borderRadius: 16,
                      }}
                    />
                    <View style={{
                      alignItems: 'center', justifyContent: 'center',
                      paddingVertical: 14,
                    }}>
                      <Text style={{
                        fontFamily: 'Nunito-Bold', fontSize: 15,
                        color: isLoggingOut ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
                      }}>{isLoggingOut ? 'Déconnexion...' : 'Confirmer'}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
