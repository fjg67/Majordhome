import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, ScrollView,
  TouchableOpacity, StatusBar, Dimensions, Switch, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, SlideInDown, SlideOutDown, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence, withDelay,
  Easing, interpolate, cancelAnimation,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';

dayjs.extend(relativeTime);
dayjs.locale('fr');
const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:    '#1A0E00', bgMid:    '#261400',
  bgSurface: '#2E1A00', bgElev:   '#3A2200',
  amber:     '#F5A623', amberBrd: 'rgba(245,166,35,0.22)',
  border:    'rgba(255,255,255,0.07)',
  text:      '#FFFFFF', textSec:  'rgba(255,255,255,0.58)',
  textMut:   'rgba(255,255,255,0.32)',
  green:  '#34D399', teal:   '#4ECDC4',
  purple: '#A78BFA', orange: '#FF8C00', red: '#FF6B6B',
  gold:   '#FFD700',
};

const OPTION_COLORS = [
  '#F5A623', '#4ECDC4', '#FF6B6B', '#A78BFA', '#34D399', '#FFA07A',
];

type PollCategory = 'food' | 'activity' | 'purchase' | 'general' | 'fun';
type PollStatus   = 'active' | 'closed';

const CATEGORY_CONFIG: Record<PollCategory, { label: string; emoji: string; color: string }> = {
  food:     { label: 'Repas',    emoji: '🍽️', color: '#FF6B6B' },
  activity: { label: 'Activité', emoji: '🎯', color: '#4ECDC4' },
  purchase: { label: 'Achat',    emoji: '🛍️', color: '#A78BFA' },
  general:  { label: 'Général',  emoji: '🗳️', color: '#F5A623' },
  fun:      { label: 'Fun',      emoji: '🎉', color: '#34D399' },
};

const POLL_SUGGESTIONS = [
  { question: 'On mange quoi ce soir ?', emoji: '🍽️', category: 'food' as PollCategory, options: ['Pizza 🍕', 'Pasta 🍝', 'Burger 🍔', 'Salade 🥗'] },
  { question: 'Film du soir ?',          emoji: '🎬', category: 'fun' as PollCategory,  options: ['Action 💥', 'Comédie 😂', 'Horreur 😱', 'Romance 💕'] },
  { question: 'Activité du weekend ?',   emoji: '🗓️', category: 'activity' as PollCategory, options: ['Sortie en ville 🏙️', 'Randonnée 🌿', 'Ciné 🎭', 'Resto 🍷'] },
  { question: 'Destination vacances ?',  emoji: '✈️', category: 'activity' as PollCategory, options: ['Montagne ⛰️', 'Mer 🏖️', 'Ville 🏛️', 'Campagne 🌾'] },
];

const POLL_EMOJIS = ['🗳️', '🍽️', '🎬', '🎯', '🛍️', '🎉', '💬', '🏠'];

// ═══════════════════════════════════════════════════════════
// DATA TYPES
// ═══════════════════════════════════════════════════════════
interface VoterInfo { userId: string; displayName: string; color: string; avatarEmoji: string; }
interface RichOption {
  id: string; pollId: string; text: string; emoji?: string;
  color: string; sortOrder: number;
  voteCount: number; pct: number; voters: VoterInfo[];
  isWinner: boolean; hasMyVote: boolean;
}
interface RichPoll {
  id: string; householdId: string;
  createdById: string; createdByName: string; createdByColor: string; createdByEmoji: string;
  question: string; emoji: string; category: PollCategory;
  isAnonymous: boolean; isMultiple: boolean;
  expiresAt?: string; status: PollStatus;
  options: RichOption[];
  createdAt: string;
  totalVotes: number; hasVoted: boolean; myVotes: string[];
  allVoted: boolean; membersCount: number;
  isExpired: boolean; timeRemaining?: string;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const getTimeRemaining = (expiresAt: string): string => {
  const diff = dayjs(expiresAt).diff(dayjs(), 'minute');
  if (diff <= 0)    return 'Expiré';
  if (diff < 60)    return `${diff}min`;
  if (diff < 1440)  return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}j`;
};

// ═══════════════════════════════════════════════════════════
// VOTER AVATARS
// ═══════════════════════════════════════════════════════════
const VoterAvatars: React.FC<{ voters: VoterInfo[]; totalMembers: number; compact?: boolean }> = ({ voters, totalMembers, compact = false }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {voters.slice(0, 4).map((v, i) => (
      <View key={v.userId} style={{
        width: compact ? 22 : 26, height: compact ? 22 : 26,
        borderRadius: compact ? 7 : 8, backgroundColor: v.color + '28',
        borderWidth: 1.5, borderColor: v.color,
        alignItems: 'center', justifyContent: 'center',
        marginLeft: i > 0 ? -6 : 0, zIndex: voters.length - i,
      }}>
        <Text style={{ fontSize: compact ? 10 : 12 }}>{v.avatarEmoji}</Text>
      </View>
    ))}
    {totalMembers - voters.length > 0 && (
      <View style={{ width: compact ? 22 : 26, height: compact ? 22 : 26, borderRadius: compact ? 7 : 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginLeft: voters.length > 0 ? -6 : 0 }}>
        <Text style={{ fontSize: 8, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.50)' }}>+{totalMembers - voters.length}</Text>
      </View>
    )}
  </View>
);

// ═══════════════════════════════════════════════════════════
// POLL OPTION — Vote mode
// ═══════════════════════════════════════════════════════════
const PollOptionVote: React.FC<{
  option: RichOption; index: number; onVote: () => void;
}> = ({ option, index, onVote }) => {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.93, { damping: 6 }), withSpring(1, { damping: 10 }));
    onVote();
  };

  return (
    <Animated.View entering={FadeInUp.duration(250).delay(index * 45)} style={scaleStyle}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={{
        backgroundColor: `${option.color}12`,
        borderWidth: 1.5,
        borderColor: `${option.color}50`,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: option.color,
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      }}>
        {/* Radio button visible */}
        <View style={{
          width: 24, height: 24, borderRadius: 12,
          borderWidth: 2, borderColor: option.color,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'transparent',
        }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'transparent' }} />
        </View>

        {option.emoji && <Text style={{ fontSize: 20 }}>{option.emoji}</Text>}
        <Text style={{ flex: 1, fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }}>
          {option.text}
        </Text>

        {/* Bouton "Voter" explicite */}
        <View style={{
          backgroundColor: option.color,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 5,
        }}>
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Voter</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// POLL OPTION — Result mode
// ═══════════════════════════════════════════════════════════
const PollOptionResult: React.FC<{
  option: RichOption; index: number; isAnonymous: boolean;
}> = ({ option, index, isAnonymous }) => {
  const barW = useSharedValue(0);
  useEffect(() => {
    barW.value = withDelay(index * 80, withTiming(option.pct, { duration: 600, easing: Easing.out(Easing.quad) }));
  }, [option.pct, index, barW]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barW.value}%` }));

  return (
    <Animated.View entering={FadeIn.duration(280).delay(index * 50)} style={{
      backgroundColor: option.isWinner ? 'rgba(255,215,0,0.08)' : option.color + '0F',
      borderRadius: 14, borderWidth: option.isWinner ? 1.5 : 1,
      borderColor: option.isWinner ? 'rgba(255,215,0,0.35)' : option.color + '35',
      padding: 12, marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Background fill bar */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 14 }, barStyle]}>
        <LinearGradient colors={[option.color + '28', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {option.isWinner && (
          <Animated.Text entering={ZoomIn.springify().delay(700)} style={{ fontSize: 16 }}>🏆</Animated.Text>
        )}
        {option.emoji && <Text style={{ fontSize: 16 }}>{option.emoji}</Text>}
        <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Nunito-Bold', color: option.isWinner ? C.gold : option.hasMyVote ? option.color : C.text }} numberOfLines={2}>
          {option.text}
        </Text>
        {option.hasMyVote && (
          <Animated.View entering={FadeIn.duration(200).delay(400)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 4 }}>
            <Text style={{ fontSize: 10, color: C.green }}>✓</Text>
            <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.green }}>Mon vote</Text>
          </Animated.View>
        )}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: option.isWinner ? 18 : 15, fontFamily: 'Nunito-Bold', color: option.isWinner ? C.gold : option.color }}>
            {Math.round(option.pct)}%
          </Text>
          <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>{option.voteCount} vote{option.voteCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {!isAnonymous && option.voters.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <VoterAvatars voters={option.voters} totalMembers={option.voters.length} compact />
        </View>
      )}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// POLL CARD
// ═══════════════════════════════════════════════════════════
const PollCard: React.FC<{
  poll: RichPoll; index: number;
  onVote: (pollId: string, optionId: string) => Promise<void>;
  onClose: (pollId: string) => void;
  myUserId: string;
}> = ({ poll, index, onVote, onClose, myUserId }) => {
  const [showResults, setShowResults] = useState(poll.hasVoted || poll.status === 'closed');
  const cat     = CATEGORY_CONFIG[poll.category] ?? CATEGORY_CONFIG.general;
  const isActive = poll.status === 'active' && !poll.isExpired;
  const allVoters = useMemo(() => {
    const seen = new Set<string>();
    const out: VoterInfo[] = [];
    poll.options.forEach(o => o.voters.forEach(v => { if (!seen.has(v.userId)) { seen.add(v.userId); out.push(v); } }));
    return out;
  }, [poll.options]);
  const isExpiringSoon = poll.expiresAt && dayjs(poll.expiresAt).diff(dayjs(), 'minute') < 60;

  const handleVote = async (optionId: string) => {
    await onVote(poll.id, optionId);
    setShowResults(true);
  };

  return (
    <Animated.View entering={FadeInUp.duration(350).delay(index * 70)}>
      <View style={{
        backgroundColor: C.bgSurface, borderRadius: 24, borderWidth: 1,
        borderColor: isActive ? 'rgba(52,211,153,0.22)' : C.border,
        marginHorizontal: 16, marginBottom: 12, overflow: 'hidden',
        shadowColor: isActive ? C.green : '#000',
        shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.20, shadowRadius: 14, elevation: 7,
      }}>
        <LinearGradient
          colors={isActive ? ['rgba(52,211,153,0.30)', 'transparent'] : poll.status === 'closed' && poll.options.find(o => o.isWinner) ? ['rgba(255,215,0,0.25)', 'transparent'] : ['rgba(255,255,255,0.07)', 'transparent']}
          style={{ height: 1 }} />

        {/* Header */}
        <View style={{ padding: 16, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: cat.color + '20', borderWidth: 1, borderColor: cat.color + '35', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>{poll.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                {/* Category badge */}
                <View style={{ backgroundColor: cat.color + '18', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 9 }}>{cat.emoji}</Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: cat.color }}>{cat.label}</Text>
                </View>
                {/* Status badge */}
                {isActive ? (
                  <View style={{ backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
                    <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: C.green }}>ACTIF</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: C.textSec }}>✓ TERMINÉ</Text>
                  </View>
                )}
                {poll.isAnonymous && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textSec }}>🔒 Anonyme</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 17, fontFamily: 'Nunito-Bold', color: C.text, lineHeight: 23 }}>{poll.question}</Text>
            </View>
            {poll.createdById === myUserId && isActive && (
              <Pressable onPress={() => onClose(poll.id)} hitSlop={8} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 6 }}>
                <Text style={{ fontSize: 12, color: C.textMut }}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Meta row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: poll.createdByColor }} />
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>par {poll.createdByName.split(' ')[0]}</Text>
            <Text style={{ fontSize: 10, color: C.textMut }}>·</Text>
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: isExpiringSoon ? C.orange : C.textMut }}>
              {poll.expiresAt ? (isExpiringSoon ? `⏰ ${poll.timeRemaining}` : `Expire ${poll.timeRemaining}`) : dayjs(poll.createdAt).fromNow()}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
              {poll.totalVotes} / {poll.membersCount} ont voté
            </Text>
          </View>
        </View>

        {/* Divider */}
        <LinearGradient colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, marginHorizontal: 16 }} />

        {/* Content */}
        <View style={{ padding: 14 }}>
          {isActive && !showResults ? (
            <>
              {poll.options.map((opt, i) => (
                <PollOptionVote key={opt.id} option={opt} index={i} onVote={() => handleVote(opt.id)} />
              ))}
              {poll.totalVotes > 0 && (
                <Pressable onPress={() => setShowResults(true)}>
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: 'rgba(245,166,35,0.60)', textAlign: 'center', marginTop: 4 }}>
                    Voir les résultats partiels →
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              {poll.options.map((opt, i) => (
                <PollOptionResult key={opt.id} option={opt} index={i} isAnonymous={poll.isAnonymous} />
              ))}

              {/* Voters summary */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <VoterAvatars voters={allVoters} totalMembers={poll.membersCount} />
                {poll.allVoted ? (
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.green }}>Tout le monde a voté ! 🎉</Text>
                ) : (
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                    {poll.membersCount - poll.totalVotes} en attente
                  </Text>
                )}
              </View>

              {/* Show vote button if active and shown results preview */}
              {isActive && !poll.hasVoted && showResults && (
                <Pressable onPress={() => setShowResults(false)} style={{ marginTop: 10, backgroundColor: 'rgba(245,166,35,0.10)', borderRadius: 12, borderWidth: 1, borderColor: C.amberBrd, paddingVertical: 9, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.amber }}>← Revenir voter</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════
const PollsEmptyState: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 }}>
    <Text style={{ fontSize: 72, marginBottom: 16 }}>🗳️</Text>
    <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 8 }}>Aucun sondage</Text>
    <Text style={{ fontSize: 14, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', textAlign: 'center', marginBottom: 6 }}>
      "On mange quoi ce soir ?"
    </Text>
    <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center', marginBottom: 28 }}>
      Crée ton premier sondage et vote ensemble !
    </Text>
    <Pressable onPress={onCreate} style={{ backgroundColor: 'rgba(245,166,35,0.12)', borderRadius: 14, borderWidth: 1, borderColor: C.amberBrd, paddingHorizontal: 20, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 16 }}>🗳️</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>Créer un sondage</Text>
    </Pressable>
  </Animated.View>
);

// ═══════════════════════════════════════════════════════════
// ADD POLL MODAL
// ═══════════════════════════════════════════════════════════
const AddPollModal: React.FC<{
  visible: boolean; onClose: () => void;
  onSubmit: (data: { question: string; emoji: string; category: PollCategory; options: string[]; isAnonymous: boolean; isMultiple: boolean; expiresAt?: Date }) => Promise<void>;
  initialData?: { question: string; emoji: string; category: PollCategory; options: string[] } | null;
}> = ({ visible, onClose, onSubmit, initialData }) => {
  const [question,    setQuestion]    = useState('');
  const [emoji,       setEmoji]       = useState('🗳️');
  const [category,    setCategory]    = useState<PollCategory>('general');
  const [options,     setOptions]     = useState<string[]>(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isMultiple,  setIsMultiple]  = useState(false);
  const [expireHrs,   setExpireHrs]   = useState<number | null>(null);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (initialData) {
      setQuestion(initialData.question);
      setEmoji(initialData.emoji);
      setCategory(initialData.category);
      setOptions([...initialData.options, '', ''].slice(0, Math.max(initialData.options.length, 2)));
    }
  }, [initialData]);

  const reset = () => { setQuestion(''); setEmoji('🗳️'); setCategory('general'); setOptions(['', '']); setIsAnonymous(false); setIsMultiple(false); setExpireHrs(null); setSaving(false); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const filledOpts = options.filter(o => o.trim().length > 0);
    if (!question.trim() || filledOpts.length < 2) return;
    setSaving(true);
    try {
      let expiresAt: Date | undefined;
      if (expireHrs) expiresAt = dayjs().add(expireHrs, 'hour').toDate();
      await onSubmit({ question: question.trim(), emoji, category, options: filledOpts, isAnonymous, isMultiple, expiresAt });
      handleClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur création', msg);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = question.trim().length > 0 && options.filter(o => o.trim()).length >= 2;
  const EXPIRE_OPTS = [{ label: '1h', val: 1 }, { label: '3h', val: 3 }, { label: '24h', val: 24 }, { label: '1 sem', val: 168 }, { label: 'Jamais', val: null }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.70)', justifyContent: 'flex-end' }}>
        <Pressable onPress={handleClose} style={{ flex: 1 }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ maxHeight: '92%', backgroundColor: C.bgMid, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
            <LinearGradient colors={['rgba(245,166,35,0.25)', 'transparent']} style={{ height: 1 }} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              contentContainerStyle={{ padding: 22, paddingBottom: 50 }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 18 }} />

              <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 18 }}>Nouveau sondage</Text>

              {/* Suggestions rapides */}
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Suggestions</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
                {POLL_SUGGESTIONS.map((s, i) => (
                  <Pressable key={i} onPress={() => { setQuestion(s.question); setEmoji(s.emoji); setCategory(s.category); setOptions([...s.options]); }} style={{ backgroundColor: 'rgba(245,166,35,0.08)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec, maxWidth: 120 }} numberOfLines={1}>{s.question}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Question */}
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Question</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: C.amberBrd, padding: 14, marginBottom: 18 }}>
                <TextInput value={question} onChangeText={t => setQuestion(t.slice(0, 100))} placeholder="Posez votre question..." placeholderTextColor={C.textMut} style={{ fontSize: 17, fontFamily: 'Nunito-Bold', color: C.text, padding: 0 }} maxLength={100} />
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 6, textAlign: 'right' }}>{question.length}/100</Text>
              </View>

              {/* Emoji */}
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Emoji</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                {POLL_EMOJIS.map(e => (
                  <Pressable key={e} onPress={() => setEmoji(e)} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: emoji === e ? 'rgba(245,166,35,0.18)' : 'rgba(255,255,255,0.05)', borderWidth: emoji === e ? 1.5 : 1, borderColor: emoji === e ? C.amber : C.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: emoji === e ? 22 : 18 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Category */}
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Catégorie</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {(Object.entries(CATEGORY_CONFIG) as [PollCategory, typeof CATEGORY_CONFIG[PollCategory]][]).map(([key, cfg]) => (
                  <Pressable key={key} onPress={() => setCategory(key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: category === key ? cfg.color + '28' : C.bgElev, borderWidth: 1, borderColor: category === key ? cfg.color : C.border }}>
                    <Text style={{ fontSize: 13 }}>{cfg.emoji}</Text>
                    <Text style={{ fontSize: 12, fontFamily: category === key ? 'Nunito-Bold' : 'DMSans-Regular', color: category === key ? cfg.color : C.textSec }}>{cfg.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Options */}
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Réponses possibles</Text>
              {options.map((opt, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OPTION_COLORS[i] ?? OPTION_COLORS[0] }} />
                  <TextInput
                    value={opt} onChangeText={t => { const nxt = [...options]; nxt[i] = t; setOptions(nxt); }}
                    placeholder={`Option ${i + 1}...`} placeholderTextColor={C.textMut}
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 12, color: C.text, fontSize: 14, fontFamily: 'DMSans-Regular' }} />
                  {options.length > 2 && (
                    <Pressable onPress={() => setOptions(options.filter((_, j) => j !== i))} hitSlop={8}>
                      <Text style={{ fontSize: 16, color: C.textMut }}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              {options.length < 6 && (
                <Pressable onPress={() => setOptions([...options, ''])} style={{ backgroundColor: 'rgba(245,166,35,0.06)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(245,166,35,0.28)', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(245,166,35,0.65)' }}>+ Ajouter une option</Text>
                </Pressable>
              )}

              {/* Advanced */}
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Options avancées</Text>
              <View style={{ backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.65)' }}>Choix multiples</Text>
                  <Switch value={isMultiple} onValueChange={setIsMultiple} trackColor={{ false: C.border, true: C.amber + '60' }} thumbColor={isMultiple ? C.amber : '#888'} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.65)' }}>Votes anonymes</Text>
                  <Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ false: C.border, true: C.amber + '60' }} thumbColor={isAnonymous ? C.amber : '#888'} />
                </View>
              </View>

              {/* Expiration */}
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Expiration</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {EXPIRE_OPTS.map(e => (
                  <Pressable key={String(e.val)} onPress={() => setExpireHrs(e.val)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: expireHrs === e.val ? 'rgba(245,166,35,0.18)' : C.bgElev, borderWidth: 1, borderColor: expireHrs === e.val ? C.amber : C.border }}>
                    <Text style={{ fontSize: 12, fontFamily: expireHrs === e.val ? 'Nunito-Bold' : 'DMSans-Regular', color: expireHrs === e.val ? C.amber : C.textSec }}>{e.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Submit */}
              <Pressable onPress={handleSubmit} disabled={!canSubmit || saving} style={{ borderRadius: 16, overflow: 'hidden', opacity: canSubmit && !saving ? 1 : 0.5 }}>
                <LinearGradient colors={[C.amber, '#E8920A']} style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16, shadowColor: C.amber, shadowRadius: 12, shadowOpacity: 0.45, elevation: 6 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>
                    {saving ? 'Publication...' : 'Publier le sondage 🗳️'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════
// VOTE TOAST
// ═══════════════════════════════════════════════════════════
const VoteToast: React.FC<{ name: string; color: string; emoji: string; onDismiss: () => void }> = ({ name, color, emoji, onDismiss }) => {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown.springify()} style={{
      position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 150,
      backgroundColor: color + '18', borderRadius: 18,
      borderWidth: 1.5, borderColor: color, padding: 14,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      shadowColor: color, shadowRadius: 16, shadowOpacity: 0.40, elevation: 10,
    }}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <View>
        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color }}>{name} a voté !</Text>
        <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec }}>Les résultats ont été mis à jour</Text>
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const PollsScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [polls,       setPolls]       = useState<RichPoll[]>([]);
  const [activeTab,   setActiveTab]   = useState<'active' | 'closed'>('active');
  const [showModal,   setShowModal]   = useState(false);
  const [preData,     setPreData]     = useState<typeof POLL_SUGGESTIONS[0] | null>(null);
  const [voteToast,   setVoteToast]   = useState<{ name: string; color: string; emoji: string } | null>(null);
  const [fabOpen,     setFabOpen]     = useState(false);

  const myUserId = user?.id ?? '';

  // ── Enrich ──
  const enrichPoll = useCallback((raw: Record<string, unknown>): RichPoll => {
    const opts = (raw.options as Record<string, unknown>[]) ?? [];
    const mem  = members.find(m => m.user_id === raw.created_by || m.id === raw.created_by);

    const enrichedOpts: RichOption[] = opts.map((o, i) => {
      const votes    = (o.votes as Record<string, unknown>[]) ?? [];
      const voters: VoterInfo[] = votes.map(v => {
        const vm = (v.voter ?? members.find(m => m.user_id === v.user_id || m.id === v.user_id)) as Record<string, unknown> | undefined;
        return { userId: v.user_id as string, displayName: (vm?.display_name as string) ?? 'Inconnu', color: (vm?.color as string) ?? C.amber, avatarEmoji: (vm?.avatar_emoji as string) ?? '?' };
      });
      return {
        id: o.id as string, pollId: raw.id as string, text: o.text as string, emoji: o.emoji as string | undefined,
        color: (o.color as string) ?? OPTION_COLORS[i % OPTION_COLORS.length],
        sortOrder: (o.sort_order as number) ?? i,
        voteCount: votes.length, pct: 0, voters,
        isWinner: false, hasMyVote: votes.some(v => v.user_id === myUserId),
      };
    });

    // Calculate pct and winner
    const totalV = enrichedOpts.reduce((s, o) => s + o.voteCount, 0);
    const maxV   = Math.max(...enrichedOpts.map(o => o.voteCount), 0);
    enrichedOpts.forEach(o => {
      o.pct      = totalV > 0 ? Math.round((o.voteCount / totalV) * 100 * 10) / 10 : 0;
      o.isWinner = o.voteCount === maxV && o.voteCount > 0;
    });

    const allVoterIds = new Set<string>();
    enrichedOpts.forEach(o => o.voters.forEach(v => allVoterIds.add(v.userId)));
    const isExpired = !!raw.expires_at && dayjs(raw.expires_at as string).isBefore(dayjs());

    return {
      id: raw.id as string,
      householdId: raw.household_id as string,
      createdById: raw.created_by as string,
      createdByName: mem?.display_name ?? 'Inconnu',
      createdByColor: mem?.color ?? C.amber,
      createdByEmoji: mem?.avatar_emoji ?? '?',
      question: raw.question as string,
      emoji: (raw.emoji as string) ?? '🗳️',
      category: (raw.category as PollCategory) ?? 'general',
      isAnonymous: (raw.is_anonymous as boolean) ?? false,
      isMultiple: (raw.is_multiple as boolean) ?? false,
      expiresAt: raw.expires_at as string | undefined,
      status: (raw.status as PollStatus) ?? 'active',
      options: enrichedOpts,
      createdAt: raw.created_at as string,
      totalVotes: totalV,
      hasVoted: allVoterIds.has(myUserId),
      myVotes: enrichedOpts.filter(o => o.hasMyVote).map(o => o.id),
      allVoted: allVoterIds.size >= members.length && members.length > 0,
      membersCount: members.length,
      isExpired,
      timeRemaining: raw.expires_at ? getTimeRemaining(raw.expires_at as string) : undefined,
    };
  }, [members, myUserId]);

  // ── Fetch ──
  const fetchPolls = useCallback(async () => {
    if (!household?.id) return;

    // Fetch polls
    const { data: rawPolls, error: pollsErr } = await supabase
      .from('polls')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });

    if (pollsErr) {
      console.warn('[fetchPolls] polls error:', pollsErr.message);
    }

    if (!rawPolls || rawPolls.length === 0) {
      setPolls([]);
      return;
    }

    const pollIds = rawPolls.map((p: Record<string, unknown>) => p.id as string);

    // Utiliser le RPC SECURITY DEFINER pour éviter les problèmes RLS
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'get_poll_options_with_votes',
      { p_poll_ids: pollIds },
    );

    let options: Record<string, unknown>[] = [];
    let votes: Record<string, unknown>[] = [];

    if (rpcErr || !rpcData) {
      console.warn('[fetchPolls] RPC error, fallback:', rpcErr?.message);
      // Fallback : requêtes directes
      const [{ data: rawOptions }, { data: rawVotes }] = await Promise.all([
        supabase.from('poll_options').select('*').in('poll_id', pollIds).order('sort_order'),
        supabase.from('poll_votes').select('*').in('poll_id', pollIds),
      ]);
      options = (rawOptions ?? []) as Record<string, unknown>[];
      votes   = (rawVotes   ?? []) as Record<string, unknown>[];
    } else {
      // RPC retourne les options avec votes imbriqués
      options = (rpcData as Record<string, unknown>[]).map(row => ({
        ...row,
        votes: row.votes as Record<string, unknown>[],
      }));
      // Pour la compatibilité, on aplatit les votes
      options.forEach(o => {
        const optVotes = (o.votes as Record<string, unknown>[]) ?? [];
        votes.push(...optVotes);
      });
    }

    // Joindre manuellement (compatible avec les deux sources)
    const pollsWithOptions = (rawPolls as Record<string, unknown>[]).map(poll => {
      const pollOpts = options
        .filter(o => String(o.poll_id) === String(poll.id))
        .map(o => ({
          ...o,
          votes: (o.votes as Record<string, unknown>[]) ??
            votes.filter(v => String(v.option_id) === String(o.id)),
        }));
      return { ...poll, options: pollOpts };
    });

    setPolls(pollsWithOptions.map(enrichPoll));
  }, [household?.id, enrichPoll]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  // ── Realtime ──
  useEffect(() => {
    if (!household?.id) return;
    const sub = supabase.channel(`polls-rt-${household.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' }, (payload) => {
        const raw = payload.new as Record<string, unknown>;
        if (String(raw.user_id) !== String(myUserId)) {
          // Vote d'un autre membre → toast + refresh
          const mem = members.find(m => m.user_id === raw.user_id || m.id === raw.user_id);
          if (mem) setVoteToast({ name: mem.display_name.split(' ')[0], color: mem.color, emoji: mem.avatar_emoji });
          fetchPolls();
        }
        // Mon propre vote est déjà géré par handleVote → pas de refresh ici
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls', filter: `household_id=eq.${household.id}` }, () => fetchPolls())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'polls', filter: `household_id=eq.${household.id}` }, () => fetchPolls())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [household?.id, myUserId, members, fetchPolls]);

  // ── Mise à jour optimiste locale du vote ──
  const applyOptimisticVote = useCallback((pollId: string, optionId: string) => {
    const myMember = members.find(m => m.user_id === myUserId || m.id === myUserId);
    const myVoterInfo: VoterInfo = {
      userId: myUserId,
      displayName: myMember?.display_name ?? 'Moi',
      color: myMember?.color ?? '#F5A623',
      avatarEmoji: myMember?.avatar_emoji ?? '👤',
    };

    setPolls(prev => prev.map(p => {
      if (p.id !== pollId) return p;

      const newOptions = p.options.map(o => {
        if (!p.isMultiple) {
          // Vote unique : retirer mon vote des autres options
          const myVoteRemoved = o.voters.filter(v => v.userId !== myUserId);
          if (o.id === optionId) {
            const alreadyIn = o.voters.some(v => v.userId === myUserId);
            const newVoters = alreadyIn ? o.voters : [...o.voters, myVoterInfo];
            return { ...o, voters: newVoters, voteCount: newVoters.length, hasMyVote: true };
          }
          return { ...o, voters: myVoteRemoved, voteCount: myVoteRemoved.length, hasMyVote: false };
        } else {
          // Vote multiple
          if (o.id === optionId) {
            const alreadyIn = o.voters.some(v => v.userId === myUserId);
            const newVoters = alreadyIn
              ? o.voters.filter(v => v.userId !== myUserId)
              : [...o.voters, myVoterInfo];
            return { ...o, voters: newVoters, voteCount: newVoters.length, hasMyVote: !alreadyIn };
          }
          return o;
        }
      });

      // Recalculer les pourcentages
      const totalV = newOptions.reduce((s, o) => s + o.voteCount, 0);
      const maxV = Math.max(...newOptions.map(o => o.voteCount), 0);
      const recalculated = newOptions.map(o => ({
        ...o,
        pct: totalV > 0 ? Math.round((o.voteCount / totalV) * 100 * 10) / 10 : 0,
        isWinner: o.voteCount === maxV && o.voteCount > 0,
      }));

      const allVoterIds = new Set<string>();
      recalculated.forEach(o => o.voters.forEach(v => allVoterIds.add(v.userId)));

      return {
        ...p,
        options: recalculated,
        totalVotes: totalV,
        hasVoted: allVoterIds.has(myUserId),
        myVotes: recalculated.filter(o => o.hasMyVote).map(o => o.id),
        allVoted: allVoterIds.size >= p.membersCount && p.membersCount > 0,
      };
    }));
  }, [myUserId, members]);

  // ── Actions ──
  const handleVote = useCallback(async (pollId: string, optionId: string) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll || !myUserId) return;

    const pId = String(pollId);
    const oId = String(optionId);
    const uId = String(myUserId);
    const isMultiple = poll.isMultiple;
    const alreadyVotedThisOption = poll.options.find(o => o.id === oId)?.hasMyVote;

    // 1. Mise à jour optimiste immédiate
    applyOptimisticVote(pollId, optionId);

    // 2. Désélection d'une option déjà votée (mode multiple)
    if (isMultiple && alreadyVotedThisOption) {
      await supabase.from('poll_votes').delete()
        .eq('poll_id', pId).eq('option_id', oId).eq('user_id', uId);
      await fetchPolls();
      return;
    }

    // 3. Tenter l'insert direct — méthode la plus fiable
    let saved = false;

    // 3a. Pour vote unique : supprimer les votes précédents d'abord
    if (!isMultiple) {
      await supabase.from('poll_votes').delete()
        .eq('poll_id', pId).eq('user_id', uId);
    }

    // 3b. Insérer le nouveau vote
    const { error: insertErr } = await supabase.from('poll_votes').insert({
      poll_id: pId,
      option_id: oId,
      user_id: uId,
    });

    if (!insertErr) {
      saved = true;
    } else {
      // 3c. Fallback upsert si l'insert échoue (conflit unique)
      const { error: upsertErr } = await supabase.from('poll_votes').upsert(
        { poll_id: pId, option_id: oId, user_id: uId },
        { onConflict: 'poll_id,option_id,user_id' },
      );
      if (!upsertErr) {
        saved = true;
      }
    }

    // 3d. Fallback RPC si les deux échouent
    if (!saved) {
      await supabase.rpc('cast_poll_vote', {
        p_poll_id: pId, p_option_id: oId, p_user_id: uId, p_replace: !isMultiple,
      });
    }

    // 4. Resynchroniser avec la BDD après la sauvegarde
    await fetchPolls();
  }, [polls, myUserId, applyOptimisticVote, fetchPolls]);

  const handleClose = useCallback(async (pollId: string) => {
    await supabase.from('polls').update({ status: 'closed' }).eq('id', pollId);
    await fetchPolls();
  }, [fetchPolls]);

  const handleCreate = useCallback(async (formData: { question: string; emoji: string; category: PollCategory; options: string[]; isAnonymous: boolean; isMultiple: boolean; expiresAt?: Date }) => {
    if (!household?.id || !myUserId) {
      throw new Error('Foyer ou utilisateur introuvable');
    }

    const optionsPayload = formData.options.map((text, i) => ({
      text,
      label:      text,  // colonne label NOT NULL dans la table existante
      color:      OPTION_COLORS[i % OPTION_COLORS.length],
      sort_order: i,
    }));

    // Tentative 1 : RPC SECURITY DEFINER (contourne le RLS)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_poll_with_options', {
      p_household_id: String(household.id),
      p_created_by:   String(myUserId),
      p_question:     formData.question,
      p_emoji:        formData.emoji,
      p_category:     formData.category,
      p_is_anonymous: formData.isAnonymous,
      p_is_multiple:  formData.isMultiple,
      p_expires_at:   formData.expiresAt?.toISOString() ?? null,
      p_options:      optionsPayload,
    });

    if (!rpcErr && rpcResult && (rpcResult as Record<string, unknown>).success) {
      // Succès via RPC
      await fetchPolls();
      return;
    }

    // Tentative 2 : INSERT direct (si RPC pas encore déployé)
    const { data: poll, error: pollErr } = await supabase.from('polls').insert({
      household_id: household.id,
      created_by:   myUserId,
      question:     formData.question,
      emoji:        formData.emoji,
      category:     formData.category,
      is_anonymous: formData.isAnonymous,
      is_multiple:  formData.isMultiple,
      expires_at:   formData.expiresAt?.toISOString() ?? null,
      status:       'active',
    }).select().single();

    if (pollErr || !poll) {
      const hint = rpcErr ? ` (RPC: ${rpcErr.message})` : '';
      throw new Error(`${pollErr?.message ?? 'Sondage non créé'}${hint}\n\nExécute la migration SQL dans Supabase → SQL Editor.`);
    }

    const pollRow = poll as Record<string, unknown>;

    const { error: optsErr } = await supabase.from('poll_options').insert(
      optionsPayload.map(o => ({ ...o, poll_id: pollRow.id }))
    );

    if (optsErr) {
      await supabase.from('polls').delete().eq('id', pollRow.id);
      throw new Error(`Options non sauvegardées : ${optsErr.message}\n\nExécute la migration SQL dans Supabase → SQL Editor.`);
    }

    await fetchPolls();
  }, [household?.id, myUserId, fetchPolls]);

  const activePolls = useMemo(() => polls.filter(p => p.status === 'active' && !p.isExpired), [polls]);
  const closedPolls = useMemo(() => polls.filter(p => p.status === 'closed' || p.isExpired), [polls]);
  const displayedPolls = activeTab === 'active' ? activePolls : closedPolls;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* ══ HEADER ══ */}
      <Animated.View entering={FadeInDown.duration(450)}>
        <LinearGradient colors={['rgba(245,166,35,0.08)', 'rgba(245,166,35,0.02)', 'transparent']} style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <Text style={{ fontSize: 28 }}>🗳️</Text>
            <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>Sondages</Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
            Votez ensemble en un tap
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* ══ TABS ══ */}
      <Animated.View entering={FadeIn.duration(400).delay(80)} style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
        {[
          { key: 'active' as const, label: 'Actifs',   emoji: '🗳️', count: activePolls.length, countColor: C.green },
          { key: 'closed' as const, label: 'Terminés', emoji: '✅', count: closedPolls.length, countColor: 'rgba(255,255,255,0.35)' },
        ].map(tab => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 5, paddingVertical: 9, borderRadius: 20,
              backgroundColor: active ? C.amber : C.bgElev,
              borderWidth: 1, borderColor: active ? C.amber : 'rgba(245,166,35,0.15)',
              shadowColor: active ? C.amber : 'transparent',
              shadowOffset: { width: 0, height: 4 }, shadowOpacity: active ? 0.45 : 0,
              shadowRadius: 12, elevation: active ? 6 : 0,
            }}>
              <Text style={{ fontSize: 13 }}>{tab.emoji}</Text>
              <Text style={{ fontSize: 13, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular', color: active ? '#1A0E00' : C.textSec }}>{tab.label}</Text>
              {tab.count > 0 && (
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: active ? 'rgba(26,14,0,0.30)' : tab.countColor + '30', borderWidth: 1, borderColor: active ? 'rgba(26,14,0,0.30)' : tab.countColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: active ? '#1A0E00' : tab.countColor }}>{tab.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </Animated.View>

      {/* ══ LIST ══ */}
      <FlatList
        data={displayedPolls}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <PollCard poll={item} index={index} onVote={handleVote} onClose={handleClose} myUserId={myUserId} />
        )}
        ListEmptyComponent={<PollsEmptyState onCreate={() => setShowModal(true)} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
      />

      {/* ══ FAB ══ */}
      <Animated.View entering={FadeInUp.duration(400).delay(400)} style={{ position: 'absolute', bottom: 90, right: 16 }}>
        {/* Speed dial items */}
        {fabOpen && POLL_SUGGESTIONS.slice(0, 3).map((s, i) => (
          <Animated.View key={i} entering={FadeInUp.duration(250).delay(i * 55)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 8 }}>
            <View style={{ backgroundColor: C.bgElev, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.amberBrd }}>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec }}>{s.question}</Text>
            </View>
            <Pressable onPress={() => { setFabOpen(false); setPreData(s); setShowModal(true); }} style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.bgElev, borderWidth: 1, borderColor: C.amberBrd, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
            </Pressable>
          </Animated.View>
        ))}

        <Pressable
          onPress={() => { if (fabOpen) { setFabOpen(false); } else { setPreData(null); setShowModal(true); } }}
          onLongPress={() => setFabOpen(f => !f)}
          style={{ width: 58, height: 58, borderRadius: 18, overflow: 'hidden', shadowColor: C.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.55, shadowRadius: 14, elevation: 10 }}>
          <LinearGradient colors={[C.amber, '#E8920A']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }}>
            <Text style={{ fontSize: 26 }}>{fabOpen ? '✕' : '🗳️'}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Backdrop for speed dial */}
      {fabOpen && (
        <Pressable onPress={() => setFabOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} />
      )}

      {/* ══ MODALS & TOASTS ══ */}
      <AddPollModal
        visible={showModal}
        onClose={() => { setShowModal(false); setPreData(null); }}
        onSubmit={handleCreate}
        initialData={preData}
      />

      {voteToast && (
        <VoteToast
          name={voteToast.name}
          color={voteToast.color}
          emoji={voteToast.emoji}
          onDismiss={() => setVoteToast(null)}
        />
      )}
    </View>
  );
};
