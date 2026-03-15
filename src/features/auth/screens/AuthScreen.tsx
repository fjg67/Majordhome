import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Modal,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
  interpolate,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { nativeFetch } from '@services/nativeFetch';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@app/navigation/types';

const { width: SW, height: SH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium (DO NOT MODIFY)
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:      '#1A0E00',
  bgMid:       '#261400',
  bgSurface:   '#2E1A00',
  bgElevated:  '#3A2200',

  amber:       '#F5A623',
  amberWarm:   '#E8920A',
  amberSoft:   'rgba(245,166,35,0.15)',
  amberGlow:   'rgba(245,166,35,0.30)',
  amberBorder: 'rgba(245,166,35,0.22)',

  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
  textMuted:     'rgba(255,255,255,0.32)',

  inputBg:       'rgba(255,255,255,0.06)',
  inputBorder:   'rgba(255,255,255,0.12)',
  inputFocus:    'rgba(245,166,35,0.45)',
  inputError:    'rgba(255,68,68,0.55)',

  success: '#34D399',
  error:   '#FF4444',
};

const ICON_COLORS = {
  email:    '#4ECDC4',
  password: '#A78BFA',
  confirm:  '#34D399',
};

// ═══════════════════════════════════════════════════════════
// SKIA BACKGROUND — Animated Amber Halos
// ═══════════════════════════════════════════════════════════
const AmberHalos: React.FC = () => {
  const r1 = useSharedValue(160);
  const r2 = useSharedValue(120);
  const r3 = useSharedValue(80);

  useEffect(() => {
    r1.value = withRepeat(
      withTiming(200, { duration: 4000, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    r2.value = withDelay(2000, withRepeat(
      withTiming(160, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true,
    ));
    r3.value = withDelay(1000, withRepeat(
      withTiming(120, { duration: 5000, easing: Easing.inOut(Easing.sin) }), -1, true,
    ));
    return () => { r1.value = 160; r2.value = 120; r3.value = 80; };
  }, []);

  const halo1 = useAnimatedStyle(() => ({
    width: r1.value * 2, height: r1.value * 2, borderRadius: r1.value,
  }));
  const halo2 = useAnimatedStyle(() => ({
    width: r2.value * 2, height: r2.value * 2, borderRadius: r2.value,
  }));
  const halo3 = useAnimatedStyle(() => ({
    width: r3.value * 2, height: r3.value * 2, borderRadius: r3.value,
  }));

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View style={[{
        position: 'absolute', top: 80, alignSelf: 'center',
        backgroundColor: 'rgba(245,166,35,0.12)',
      }, halo1]} />
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.65, right: -40,
        backgroundColor: 'rgba(232,146,10,0.08)',
      }, halo2]} />
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.40, left: -30,
        backgroundColor: 'rgba(255,107,107,0.05)',
      }, halo3]} />

      {[
        { top: 120, left: SW * 0.2, size: 3, delay: 0 },
        { top: 160, left: SW * 0.7, size: 2, delay: 500 },
        { top: 200, left: SW * 0.5, size: 4, delay: 1000 },
        { top: 100, left: SW * 0.85, size: 2.5, delay: 1500 },
        { top: 240, left: SW * 0.3, size: 3, delay: 700 },
      ].map((p, i) => <AmberParticle key={i} {...p} />)}
    </View>
  );
};

const AmberParticle: React.FC<{
  top: number; left: number; size: number; delay: number;
}> = ({ top, left, size, delay }) => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withTiming(0.8, { duration: 2000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
    return () => { opacity.value = 0.3; };
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{
      position: 'absolute', top, left,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.amber,
    }, style]} />
  );
};

// ═══════════════════════════════════════════════════════════
// PASSWORD STRENGTH INDICATOR
// ═══════════════════════════════════════════════════════════
const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const strength = useMemo(() => {
    if (!password || password.length < 2) return 0;
    let s = 1;
    if (password.length >= 6) s = 2;
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) s = 3;
    if (s === 3 && /[^A-Za-z0-9]/.test(password)) s = 4;
    return s;
  }, [password]);

  const labels = ['', 'Trop court', 'Faible', 'Moyen', 'Fort 🔥'];
  const colors = ['', C.error, '#FF8C00', C.amber, C.success];

  if (!password) return null;

  return (
    <View style={{ marginTop: 6, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[1, 2, 3, 4].map(i => (
          <Animated.View
            key={i}
            entering={FadeIn.delay(i * 80).duration(300)}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              backgroundColor: i <= strength
                ? (strength === 4 ? C.success : colors[strength])
                : 'rgba(255,255,255,0.10)',
            }}
          />
        ))}
      </View>
      <Text style={{
        fontFamily: 'DMSans-Regular', fontSize: 11,
        color: colors[strength] || C.textMuted, marginTop: 4,
      }}>{labels[strength]}</Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// INPUT FIELD — "Warm Frosted"
// ═══════════════════════════════════════════════════════════
const InputField: React.FC<{
  label: string;
  icon: string;
  iconColor: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureEntry?: boolean;
  showToggle?: boolean;
  showSecure?: boolean;
  onToggleSecure?: () => void;
  error?: string | null;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences';
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
  accessibilityLabel?: string;
}> = ({
  label, icon, iconColor, value, onChangeText, placeholder,
  secureEntry, showToggle, showSecure, onToggleSecure,
  error, keyboardType = 'default', autoCapitalize = 'none',
  returnKeyType = 'next', onSubmitEditing, inputRef, accessibilityLabel,
}) => {
  const isFocused = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? C.inputError
      : interpolateColor(isFocused.value, [0, 1], [C.inputBorder, C.inputFocus]);
    return {
      borderColor,
      shadowColor: error ? C.error : C.amber,
      shadowOpacity: error ? 0.15 : interpolate(isFocused.value, [0, 1], [0, 0.20]),
      shadowRadius: error ? 6 : interpolate(isFocused.value, [0, 1], [0, 8]),
      shadowOffset: { width: 0, height: 0 },
      elevation: isFocused.value > 0.5 ? 4 : 0,
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      isFocused.value, [0, 1],
      ['rgba(255,255,255,0.55)', 'rgba(245,166,35,0.80)'],
    ),
  }));

  return (
    <View style={{ marginBottom: error ? 4 : 14 }}>
      <Animated.Text style={[{
        fontFamily: 'Nunito-Bold', fontSize: 11,
        letterSpacing: 1.5, textTransform: 'uppercase',
        marginBottom: 6, marginLeft: 2,
      }, labelStyle]}>{label}</Animated.Text>

      <Animated.View style={[{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.inputBg,
        borderRadius: 16, borderWidth: 1.5,
        paddingHorizontal: 14, paddingVertical: 13,
      }, borderStyle]}>
        <View style={{
          width: 32, height: 32, borderRadius: 9,
          backgroundColor: iconColor + '22',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 15 }}>{icon}</Text>
        </View>
        <TextInput
          ref={inputRef}
          style={{
            flex: 1, marginLeft: 10,
            fontFamily: 'DMSans-Regular', fontSize: 15,
            color: C.textPrimary, padding: 0,
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.22)"
          selectionColor={C.amber}
          secureTextEntry={secureEntry && !showSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => { isFocused.value = withTiming(1, { duration: 200 }); }}
          onBlur={() => { isFocused.value = withTiming(0, { duration: 200 }); }}
          accessibilityLabel={accessibilityLabel || label}
        />
        {showToggle && (
          <Pressable onPress={onToggleSecure} hitSlop={10}>
            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>
              {showSecure ? '🙈' : '👁️'}
            </Text>
          </Pressable>
        )}
      </Animated.View>
      {error && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 6 }}
        >
          <Text style={{ fontSize: 11 }}>⚠️</Text>
          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: C.error }}>{error}</Text>
        </Animated.View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT — AuthScreen "Ember Gate"
// ═══════════════════════════════════════════════════════════
interface AuthScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'Auth'>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const sendMagicLink = useAuthStore(s => s.sendMagicLink);
  const verifyOtp = useAuthStore(s => s.verifyOtp);
  const loadHousehold = useAuthStore(s => s.loadHousehold);

  // ─── State ──────────────────────────────────────────────
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string; password?: string; confirm?: string;
  }>({});
  const [toggleWidth, setToggleWidth] = useState(0);

  // ─── Magic Link State ───────────────────────────────────
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [magicStep, setMagicStep] = useState<1 | 2>(1);
  const [magicEmail, setMagicEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [magicSuccess, setMagicSuccess] = useState<string | null>(null);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // ─── Animations ─────────────────────────────────────────
  const thumbX = useSharedValue(0);
  const ctaScale = useSharedValue(1);
  const ctaShadow = useSharedValue(0.50);
  const errorOpacity = useSharedValue(0);
  const errorShake = useSharedValue(0);
  const shimmerX = useSharedValue(-80);
  const sparkleScale = useSharedValue(1);
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withDelay(200, withSpring(1, { damping: 16, stiffness: 160 }));
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    return () => { logoScale.value = 0.5; logoOpacity.value = 0; };
  }, []);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withSequence(
        withDelay(3000, withTiming(SW + 80, { duration: 700, easing: Easing.inOut(Easing.ease) })),
        withTiming(-80, { duration: 0 }),
      ), -1,
    );
    return () => { shimmerX.value = -80; };
  }, []);

  useEffect(() => {
    sparkleScale.value = withRepeat(withSequence(
      withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
    ), -1);
    return () => { sparkleScale.value = 1; };
  }, []);

  useEffect(() => {
    if (toggleWidth > 0) {
      const thumbW = (toggleWidth - 8) / 2;
      thumbX.value = withSpring(isLogin ? 0 : thumbW, { damping: 20, stiffness: 220 });
    }
  }, [isLogin, toggleWidth]);

  useEffect(() => {
    if (errorMsg) {
      errorOpacity.value = withTiming(1, { duration: 250 });
      errorShake.value = withSequence(
        withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }),
        withTiming(-4, { duration: 50 }), withTiming(4, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      const timer = setTimeout(() => {
        errorOpacity.value = withTiming(0, { duration: 300 });
        setTimeout(() => setErrorMsg(null), 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [errorMsg]);

  // ─── Animated styles ──────────────────────────────────
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.value }] }));
  const errorBannerStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [
      { translateX: errorShake.value },
      { translateY: interpolate(errorOpacity.value, [0, 1], [-10, 0]) },
    ],
  }));
  const ctaBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
    shadowOpacity: ctaShadow.value,
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { rotate: '15deg' }],
  }));
  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }], opacity: logoOpacity.value,
  }));
  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
  }));

  // ─── Validation ─────────────────────────────────────────
  useEffect(() => {
    if (!isLogin && confirmPassword) {
      setFieldErrors(prev => ({
        ...prev,
        confirm: confirmPassword !== password ? 'Les mots de passe ne correspondent pas' : undefined,
      }));
    }
  }, [confirmPassword, password, isLogin]);

  // ─── Timeout helper ──────────────────────────────────────
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('__TIMEOUT__')), ms),
      ),
    ]);

  // ─── Submit ─────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setErrorMsg('Entrez votre adresse email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Adresse email invalide'); return;
    }
    if (!password) { setErrorMsg('Entrez votre mot de passe'); return; }
    if (!isLogin && password.length < 6) {
      setErrorMsg('Le mot de passe doit faire au moins 6 caractères'); return;
    }
    if (!isLogin && password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas'); return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = isLogin
        ? await withTimeout(signIn(trimmedEmail, password), 15000)
        : await withTimeout(signUp(trimmedEmail, password), 15000);

      if (result.error) {
        const map: Record<string, string> = {
          'Invalid login credentials': 'Email ou mot de passe incorrect',
          'User already registered': 'Un compte existe déjà avec cet email',
          'Email not confirmed': 'Veuillez confirmer votre email',
          'Password should be at least 6 characters': 'Minimum 6 caractères',
        };
        setErrorMsg(map[result.error] || result.error);
        return;
      }

      try { await withTimeout(loadHousehold(), 8000); } catch (_) { /* ok */ }

      const state = useAuthStore.getState();
      const nextRoute = !state.hasHousehold
        ? 'HouseholdSetup'
        : !state.hasProfile
        ? 'MemberProfile'
        : 'WelcomeMembers';

      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthSuccess', params: { nextRoute, mode: isLogin ? 'login' : 'register' } }],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === '__TIMEOUT__') {
        setErrorMsg('Le serveur ne répond pas. Vérifiez votre connexion.');
      } else if (msg.includes('Network') || msg.includes('network') || msg.includes('fetch')) {
        setErrorMsg('Pas de connexion internet.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, confirmPassword, isLogin, signIn, signUp, loadHousehold, navigation]);

  // ─── Toggle mode ────────────────────────────────────────
  const switchMode = useCallback((login: boolean) => {
    setIsLogin(login);
    setErrorMsg(null);
    setPassword('');
    setConfirmPassword('');
    setFieldErrors({});
  }, []);

  // ─── Network diagnostic ─────────────────────────────────
  const [diagResult, setDiagResult] = useState<string | null>(null);
  const runDiag = useCallback(async () => {
    setDiagResult('Test en cours...');
    const results: string[] = [];
    const t1 = Date.now();
    try {
      const r = await nativeFetch('https://www.google.com/generate_204', { method: 'GET' });
      results.push(`1.Google: OK ${r.status} (${Date.now() - t1}ms)`);
    } catch (e: any) {
      results.push(`1.Google: ${e?.message || 'ERR'} (${Date.now() - t1}ms)`);
    }
    const t2 = Date.now();
    try {
      const r = await nativeFetch('https://yxqsgqbrzesmnpughynd.supabase.co/auth/v1/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4cXNncWJyemVzbW5wdWdoeW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDc4NDAsImV4cCI6MjA4ODk4Mzg0MH0.nqhxrNaDPDOidRcYoaeeZK_qYL3zeioVqEPci9nM9co',
        },
        body: JSON.stringify({ email: 'diagtest@test.com', password: 'test123456' }),
      });
      const txt = await r.text();
      results.push(`2.Supabase: ${r.status} ${txt.substring(0, 60)} (${Date.now() - t2}ms)`);
    } catch (e: any) {
      results.push(`2.Supabase: ${e?.message || 'ERR'} (${Date.now() - t2}ms)`);
    }
    setDiagResult(results.join('\n'));
  }, []);

  // ─── Magic Link Handlers ─────────────────────────────
  const openMagicModal = useCallback(() => {
    setMagicEmail(email.trim());
    setOtpCode(['', '', '', '', '', '']);
    setMagicStep(1);
    setMagicError(null);
    setMagicSuccess(null);
    setShowMagicModal(true);
  }, [email]);

  const closeMagicModal = useCallback(() => {
    setShowMagicModal(false);
    setMagicLoading(false);
    setMagicError(null);
    setMagicSuccess(null);
  }, []);

  const handleSendOtp = useCallback(async () => {
    const trimmed = magicEmail.trim();
    if (!trimmed) { setMagicError('Entrez votre adresse email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMagicError('Adresse email invalide'); return;
    }
    setMagicLoading(true);
    setMagicError(null);
    try {
      const result = await withTimeout(sendMagicLink(trimmed), 15000);
      if (result.error) {
        setMagicError(result.error);
      } else {
        setMagicSuccess('Code envoyé ! Vérifiez votre boîte mail.');
        setMagicStep(2);
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMagicError(msg === '__TIMEOUT__' ? 'Le serveur ne répond pas.' : msg);
    } finally {
      setMagicLoading(false);
    }
  }, [magicEmail, sendMagicLink]);

  const handleOtpChange = useCallback((text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    setOtpCode(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleOtpKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otpCode]);

  const handleVerifyOtp = useCallback(async () => {
    const code = otpCode.join('');
    if (code.length !== 6) { setMagicError('Entrez le code à 6 chiffres'); return; }
    setMagicLoading(true);
    setMagicError(null);
    try {
      const result = await withTimeout(verifyOtp(magicEmail.trim(), code), 15000);
      if (result.error) {
        setMagicError(result.error);
        setOtpCode(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      } else {
        setShowMagicModal(false);
        try { await withTimeout(loadHousehold(), 8000); } catch (_) { /* ok */ }
        const state = useAuthStore.getState();
        const nextRoute = !state.hasHousehold
          ? 'HouseholdSetup'
          : !state.hasProfile
          ? 'MemberProfile'
          : 'WelcomeMembers';
        navigation.reset({
          index: 0,
          routes: [{ name: 'AuthSuccess', params: { nextRoute, mode: 'login' } }],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMagicError(msg === '__TIMEOUT__' ? 'Le serveur ne répond pas.' : msg);
    } finally {
      setMagicLoading(false);
    }
  }, [otpCode, magicEmail, verifyOtp, loadHousehold, navigation]);

  const subtitleText = isLogin ? 'Content de vous revoir ! 👋' : 'Créez votre espace ✨';

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <AmberHalos />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1, justifyContent: 'center',
            paddingHorizontal: 20,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ══════ HEADER ══════ */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            {/* Logo */}
            <Animated.View style={[{
              shadowColor: C.amber,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55, shadowRadius: 22, elevation: 14,
              marginBottom: 16,
            }, logoAnimStyle]}>
              <View style={{
                width: 88, height: 88, borderRadius: 24,
                backgroundColor: C.bgElevated,
                borderWidth: 1.5, borderColor: 'rgba(245,166,35,0.40)',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                <View style={{
                  position: 'absolute', width: 88, height: 88,
                  borderRadius: 24, backgroundColor: 'rgba(245,166,35,0.15)',
                }} />
                <Text style={{
                  fontSize: 38,
                  textShadowColor: 'rgba(245,166,35,0.60)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 12,
                }}>🏠</Text>
                <Animated.Text style={[{
                  position: 'absolute', top: 4, right: 8, fontSize: 14,
                  color: '#FFD060',
                }, sparkleStyle]}>✦</Animated.Text>
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.Text
              entering={FadeInDown.delay(350).duration(500).springify().damping(18)}
              style={{
                fontFamily: 'Nunito-Bold', fontSize: 36, color: C.textPrimary,
                letterSpacing: -0.8,
                textShadowColor: 'rgba(245,166,35,0.40)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 12,
              }}
            >MajordHome</Animated.Text>

            {/* Subtitle */}
            <Animated.Text
              key={subtitleText}
              entering={FadeIn.delay(440).duration(300)}
              style={{
                fontFamily: 'DMSans-Regular', fontSize: 15,
                color: 'rgba(255,255,255,0.48)', marginTop: 6,
              }}
            >{subtitleText}</Animated.Text>
          </View>

          {/* ══════ CARD PRINCIPALE — Glassmorphism ══════ */}
          <Animated.View entering={FadeInUp.delay(540).duration(600).springify().damping(18)}>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.055)',
              borderRadius: 28, borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.45, shadowRadius: 32, elevation: 16,
            }}>
              {/* Top highlight */}
              <LinearGradient
                colors={['transparent', 'rgba(245,166,35,0.50)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 1, position: 'absolute', top: 0, left: 20, right: 20 }}
              />
              {/* Deco segments */}
              <View style={{
                position: 'absolute', top: 4, left: 16, right: 16,
                flexDirection: 'row', gap: 4, height: 2,
              }}>
                <View style={{ flex: 3, backgroundColor: C.amber, borderRadius: 1 }} />
                <View style={{ flex: 4, backgroundColor: C.amberWarm, borderRadius: 1 }} />
                <View style={{ flex: 3, backgroundColor: 'rgba(245,166,35,0.4)', borderRadius: 1 }} />
              </View>

              <View style={{ padding: 20, paddingTop: 24 }}>
                {/* ── TOGGLE PILL ── */}
                <Animated.View entering={FadeIn.delay(700).duration(300)}>
                  <View
                    onLayout={e => setToggleWidth(e.nativeEvent.layout.width)}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 22, borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.10)',
                      padding: 4, marginBottom: 24, position: 'relative',
                    }}
                  >
                    <Animated.View style={[{
                      position: 'absolute', top: 4, left: 4,
                      height: 42, borderRadius: 18,
                      backgroundColor: C.amber,
                      width: toggleWidth > 0 ? (toggleWidth - 8) / 2 : '48%',
                      shadowColor: C.amber,
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
                    }, thumbStyle]} />

                    <Pressable
                      onPress={() => switchMode(true)}
                      style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
                      accessibilityLabel="Mode connexion"
                    >
                      <Text style={{
                        fontFamily: isLogin ? 'Nunito-Bold' : 'DMSans-Medium',
                        fontSize: 14,
                        color: isLogin ? C.bgDeep : 'rgba(255,255,255,0.40)',
                      }}>{isLogin ? '🔑 ' : ''}Connexion</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => switchMode(false)}
                      style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
                      accessibilityLabel="Mode inscription"
                    >
                      <Text style={{
                        fontFamily: !isLogin ? 'Nunito-Bold' : 'DMSans-Medium',
                        fontSize: 14,
                        color: !isLogin ? C.bgDeep : 'rgba(255,255,255,0.40)',
                      }}>{!isLogin ? '⭐ ' : ''}Inscription</Text>
                    </Pressable>
                  </View>
                </Animated.View>

                {/* ── ERROR BANNER ── */}
                {errorMsg && (
                  <Animated.View style={[{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 14, paddingVertical: 11,
                    borderRadius: 14, borderWidth: 1,
                    backgroundColor: 'rgba(255,68,68,0.10)',
                    borderColor: 'rgba(255,68,68,0.30)',
                    marginBottom: 16,
                  }, errorBannerStyle]}>
                    <Text style={{ fontSize: 14 }}>⚠️</Text>
                    <Text style={{
                      flex: 1, fontFamily: 'DMSans-Medium', fontSize: 13,
                      color: C.error, lineHeight: 18,
                    }}>{errorMsg}</Text>
                  </Animated.View>
                )}

                {/* ── FIELDS ── */}
                <Animated.View entering={FadeIn.delay(780).duration(300)}>
                  <InputField
                    label="Adresse email" icon="📧" iconColor={ICON_COLORS.email}
                    value={email}
                    onChangeText={t => { setEmail(t); setFieldErrors(p => ({ ...p, email: undefined })); }}
                    placeholder="vous@email.com"
                    keyboardType="email-address" returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    error={fieldErrors.email}
                  />
                </Animated.View>

                <Animated.View entering={FadeIn.delay(840).duration(300)}>
                  <InputField
                    label="Mot de passe" icon="🔒" iconColor={ICON_COLORS.password}
                    value={password}
                    onChangeText={t => { setPassword(t); setFieldErrors(p => ({ ...p, password: undefined })); }}
                    placeholder="••••••••"
                    secureEntry showToggle showSecure={showPassword}
                    onToggleSecure={() => setShowPassword(!showPassword)}
                    returnKeyType={isLogin ? 'done' : 'next'}
                    onSubmitEditing={() => {
                      if (isLogin) handleSubmit();
                      else confirmRef.current?.focus();
                    }}
                    inputRef={passwordRef}
                    error={fieldErrors.password}
                  />
                </Animated.View>

                {/* Forgot password (login) */}
                {isLogin && (
                  <Animated.View entering={FadeIn.delay(860).duration(200)}>
                    <Pressable
                      style={{ alignSelf: 'flex-end', marginBottom: 8, marginTop: -8 }}
                      accessibilityLabel="Mot de passe oublié"
                    >
                      <Text style={{
                        fontFamily: 'DMSans-Regular', fontSize: 12,
                        color: 'rgba(245,166,35,0.60)',
                      }}>Mot de passe oublié ?</Text>
                    </Pressable>
                  </Animated.View>
                )}

                {/* Confirm + strength (register) */}
                {!isLogin && (
                  <Animated.View entering={FadeIn.duration(300)}>
                    <InputField
                      label="Confirmer le mot de passe" icon="🔐"
                      iconColor={ICON_COLORS.confirm}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      secureEntry showToggle showSecure={showPassword}
                      onToggleSecure={() => setShowPassword(!showPassword)}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                      inputRef={confirmRef}
                      error={fieldErrors.confirm}
                    />
                    <PasswordStrength password={password} />
                    <Text style={{
                      fontFamily: 'DMSans-Regular', fontSize: 11,
                      color: C.textMuted, textAlign: 'center',
                      marginBottom: 4, lineHeight: 16,
                    }}>
                      En créant un compte, vous acceptez les{' '}
                      <Text style={{ color: 'rgba(245,166,35,0.65)' }}>conditions d'utilisation</Text>
                    </Text>
                  </Animated.View>
                )}

                {/* ── CTA BUTTON — "Ember Button" ── */}
                <Animated.View
                  entering={FadeInUp.delay(960).duration(400).springify()}
                  style={[{
                    marginTop: 12, borderRadius: 18,
                    shadowColor: C.amber,
                    shadowOffset: { width: 0, height: 8 },
                    shadowRadius: 18, elevation: 12,
                  }, ctaBtnStyle]}
                >
                  <Pressable
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    onPressIn={() => {
                      ctaScale.value = withSpring(0.97, { damping: 12, stiffness: 200 });
                      ctaShadow.value = withTiming(0.3, { duration: 80 });
                    }}
                    onPressOut={() => {
                      ctaScale.value = withSpring(1, { damping: 10, stiffness: 180 });
                      ctaShadow.value = withTiming(0.5, { duration: 150 });
                    }}
                    style={{ borderRadius: 18, overflow: 'hidden' }}
                    accessibilityLabel={isLogin ? 'Se connecter' : 'Créer mon compte'}
                  >
                    <LinearGradient
                      colors={isSubmitting
                        ? ['rgba(245,166,35,0.5)', 'rgba(232,146,10,0.5)']
                        : [C.amber, C.amberWarm]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{
                        height: 58, borderRadius: 18,
                        alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'row', gap: 8,
                      }}
                    >
                      {/* Shimmer */}
                      {!isSubmitting && (
                        <Animated.View style={[{
                          position: 'absolute', width: 50, height: '100%',
                          backgroundColor: 'rgba(255,255,255,0.22)',
                        }, shimmerStyle]} />
                      )}
                      {isSubmitting ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <ActivityIndicator color={C.bgDeep} size="small" />
                          <Text style={{
                            fontFamily: 'Nunito-Bold', fontSize: 17, color: C.bgDeep,
                          }}>{isLogin ? 'Connexion...' : 'Création...'}</Text>
                        </View>
                      ) : (
                        <Text style={{
                          fontFamily: 'Nunito-Bold', fontSize: 17,
                          color: C.bgDeep, letterSpacing: 0.2,
                        }}>{isLogin ? '🚀  Se connecter' : '✨  Créer mon compte'}</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          {/* ══════ SEPARATOR ══════ */}
          <Animated.View
            entering={FadeIn.delay(1000).duration(400)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              marginVertical: 20, paddingHorizontal: 4,
            }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.18)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ flex: 1, height: 1 }}
            />
            <Text style={{
              fontFamily: 'DMSans-Regular', fontSize: 12,
              color: 'rgba(255,255,255,0.30)', marginHorizontal: 12,
            }}>ou</Text>
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ flex: 1, height: 1 }}
            />
          </Animated.View>

          {/* ══════ MAGIC LINK BUTTON ══════ */}
          <Animated.View entering={FadeIn.delay(1040).duration(400)}>
            <Pressable
              onPress={openMagicModal}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, height: 50, borderRadius: 16,
                borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)',
                backgroundColor: 'rgba(167,139,250,0.08)',
                shadowColor: '#A78BFA',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.20, shadowRadius: 10, elevation: 4,
              }}
              accessibilityLabel="Connexion par lien magique"
            >
              <Animated.Text style={[{ fontSize: 16 }, sparkleStyle]}>✨</Animated.Text>
              <Text style={{
                fontFamily: 'Nunito-SemiBold', fontSize: 15,
                color: 'rgba(167,139,250,0.85)',
              }}>Lien magique</Text>
            </Pressable>
          </Animated.View>

          {/* ══════ FOOTER ══════ */}
          <Animated.View
            entering={FadeIn.delay(1100).duration(500)}
            style={{ alignItems: 'center', marginTop: 28 }}
          >
            <Text style={{
              fontFamily: 'DMSans-Regular', fontSize: 12,
              color: 'rgba(255,255,255,0.22)',
            }}>Votre foyer, synchronisé 🏠</Text>

            {__DEV__ && (
              <Pressable
                onPress={runDiag}
                style={{
                  marginTop: 12, paddingHorizontal: 16, paddingVertical: 8,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                  borderRadius: 12,
                }}
              >
                <Text style={{
                  fontFamily: 'DMSans-Regular', fontSize: 11,
                  color: 'rgba(255,255,255,0.30)',
                }}>🔍 Test réseau</Text>
              </Pressable>
            )}

            {diagResult && (
              <View style={{
                marginTop: 8, backgroundColor: 'rgba(0,0,0,0.5)',
                padding: 12, borderRadius: 10, width: '100%',
              }}>
                <Text style={{
                  fontFamily: 'DMSans-Regular', fontSize: 11,
                  color: C.textSecondary, lineHeight: 18,
                }}>{diagResult}</Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ══════ MAGIC LINK MODAL ══════ */}
      <Modal
        visible={showMagicModal}
        transparent
        animationType="fade"
        onRequestClose={closeMagicModal}
        statusBarTranslucent
      >
        <Pressable
          onPress={closeMagicModal}
          style={{
            flex: 1, backgroundColor: 'rgba(0,0,0,0.70)',
            justifyContent: 'center', alignItems: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 380,
              backgroundColor: C.bgSurface,
              borderRadius: 28, borderWidth: 1,
              borderColor: 'rgba(167,139,250,0.25)',
              overflow: 'hidden',
              shadowColor: '#A78BFA',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.25, shadowRadius: 32, elevation: 20,
            }}
          >
            {/* Top accent */}
            <LinearGradient
              colors={['transparent', 'rgba(167,139,250,0.50)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1.5, position: 'absolute', top: 0, left: 24, right: 24 }}
            />

            {/* Header */}
            <LinearGradient
              colors={['rgba(167,139,250,0.15)', 'rgba(167,139,250,0.03)']}
              style={{ paddingTop: 28, paddingBottom: 20, alignItems: 'center' }}
            >
              <View style={{
                width: 64, height: 64, borderRadius: 20,
                backgroundColor: 'rgba(167,139,250,0.12)',
                borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 30 }}>{magicStep === 1 ? '✨' : '🔑'}</Text>
              </View>
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 22,
                color: C.textPrimary, marginBottom: 6,
              }}>{magicStep === 1 ? 'Lien magique' : 'Code de vérification'}</Text>
              <Text style={{
                fontFamily: 'DMSans-Regular', fontSize: 13,
                color: C.textSecondary, textAlign: 'center',
                paddingHorizontal: 20, lineHeight: 19,
              }}>
                {magicStep === 1
                  ? 'Recevez un code à 6 chiffres par email pour vous connecter sans mot de passe.'
                  : `Code envoyé à ${magicEmail}`}
              </Text>
            </LinearGradient>

            <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 4 }}>
              {/* Error */}
              {magicError && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(255,68,68,0.10)',
                  borderRadius: 12, borderWidth: 1,
                  borderColor: 'rgba(255,68,68,0.25)',
                  paddingHorizontal: 12, paddingVertical: 10,
                  marginBottom: 14,
                }}>
                  <Text style={{ fontSize: 13 }}>⚠️</Text>
                  <Text style={{
                    flex: 1, fontFamily: 'DMSans-Medium', fontSize: 12,
                    color: C.error, lineHeight: 17,
                  }}>{magicError}</Text>
                </View>
              )}

              {/* Success */}
              {magicSuccess && magicStep === 2 && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(52,211,153,0.10)',
                  borderRadius: 12, borderWidth: 1,
                  borderColor: 'rgba(52,211,153,0.25)',
                  paddingHorizontal: 12, paddingVertical: 10,
                  marginBottom: 14,
                }}>
                  <Text style={{ fontSize: 13 }}>✅</Text>
                  <Text style={{
                    flex: 1, fontFamily: 'DMSans-Medium', fontSize: 12,
                    color: C.success, lineHeight: 17,
                  }}>{magicSuccess}</Text>
                </View>
              )}

              {/* Step 1: Email */}
              {magicStep === 1 && (
                <View>
                  <Text style={{
                    fontFamily: 'Nunito-Bold', fontSize: 11,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    color: 'rgba(167,139,250,0.65)', marginBottom: 6, marginLeft: 2,
                  }}>Adresse email</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: C.inputBg,
                    borderRadius: 16, borderWidth: 1.5,
                    borderColor: 'rgba(167,139,250,0.25)',
                    paddingHorizontal: 14, paddingVertical: 13,
                  }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 9,
                      backgroundColor: 'rgba(78,205,196,0.13)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 15 }}>📧</Text>
                    </View>
                    <TextInput
                      style={{
                        flex: 1, marginLeft: 10,
                        fontFamily: 'DMSans-Regular', fontSize: 15,
                        color: C.textPrimary, padding: 0,
                      }}
                      value={magicEmail}
                      onChangeText={t => { setMagicEmail(t); setMagicError(null); }}
                      placeholder="vous@email.com"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      selectionColor="#A78BFA"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSendOtp}
                      autoFocus
                    />
                  </View>
                </View>
              )}

              {/* Step 2: OTP Code */}
              {magicStep === 2 && (
                <View>
                  <Text style={{
                    fontFamily: 'Nunito-Bold', fontSize: 11,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    color: 'rgba(167,139,250,0.65)', marginBottom: 12, marginLeft: 2,
                  }}>Code à 6 chiffres</Text>
                  <View style={{
                    flexDirection: 'row', justifyContent: 'center', gap: 8,
                  }}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <TextInput
                        key={i}
                        ref={ref => { otpRefs.current[i] = ref; }}
                        style={{
                          width: 46, height: 56, borderRadius: 14,
                          backgroundColor: C.inputBg,
                          borderWidth: 1.5,
                          borderColor: otpCode[i]
                            ? 'rgba(167,139,250,0.50)'
                            : 'rgba(255,255,255,0.12)',
                          textAlign: 'center',
                          fontFamily: 'Nunito-Bold', fontSize: 22,
                          color: C.textPrimary,
                        }}
                        value={otpCode[i]}
                        onChangeText={t => handleOtpChange(t, i)}
                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectionColor="#A78BFA"
                        selectTextOnFocus
                      />
                    ))}
                  </View>

                  {/* Resend */}
                  <Pressable
                    onPress={handleSendOtp}
                    disabled={magicLoading}
                    style={{ alignSelf: 'center', marginTop: 14 }}
                  >
                    <Text style={{
                      fontFamily: 'DMSans-Medium', fontSize: 12,
                      color: 'rgba(167,139,250,0.60)',
                    }}>Renvoyer le code</Text>
                  </Pressable>
                </View>
              )}

              {/* Action buttons */}
              <View style={{ marginTop: 20, gap: 10 }}>
                <Pressable
                  onPress={magicStep === 1 ? handleSendOtp : handleVerifyOtp}
                  disabled={magicLoading}
                  style={{ borderRadius: 16, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={magicLoading
                      ? ['rgba(167,139,250,0.4)', 'rgba(139,92,246,0.4)']
                      : ['#A78BFA', '#8B5CF6']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{
                      height: 52, borderRadius: 16,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 8,
                    }}
                  >
                    {magicLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={{
                          fontFamily: 'Nunito-Bold', fontSize: 15, color: '#FFF',
                        }}>{magicStep === 1 ? 'Envoi...' : 'Vérification...'}</Text>
                      </View>
                    ) : (
                      <Text style={{
                        fontFamily: 'Nunito-Bold', fontSize: 15, color: '#FFF',
                      }}>{magicStep === 1 ? '📧  Envoyer le code' : '🔓  Vérifier'}</Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={closeMagicModal}
                  style={{
                    height: 44, borderRadius: 14,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{
                    fontFamily: 'DMSans-Medium', fontSize: 14,
                    color: C.textSecondary,
                  }}>Annuler</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
