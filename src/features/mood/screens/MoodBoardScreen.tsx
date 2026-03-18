import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Dimensions, Switch, TouchableOpacity,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, SlideInDown, SlideOutDown, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence, withDelay,
  Easing, interpolate,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import type { MoodValue, DailyMoodV2, WeekMoodData, MoodStat } from '@appTypes/index';
import { MOOD_CONFIGS } from '@appTypes/index';

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
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const getMood = (v: MoodValue) => MOOD_CONFIGS.find(m => m.value === v) ?? MOOD_CONFIGS[2];

const getCurrentWeek = (): string[] => {
  const monday = dayjs().startOf('isoWeek');
  return Array.from({ length: 7 }, (_, i) => monday.add(i, 'day').format('YYYY-MM-DD'));
};
const getPrevWeek = (week: string[]): string[] => {
  const first = dayjs(week[0]).subtract(7, 'day');
  return Array.from({ length: 7 }, (_, i) => first.add(i, 'day').format('YYYY-MM-DD'));
};
const getNextWeek = (week: string[]): string[] => {
  const first = dayjs(week[0]).add(7, 'day');
  return Array.from({ length: 7 }, (_, i) => first.add(i, 'day').format('YYYY-MM-DD'));
};
const isCurrentWeekFn = (week: string[]) =>
  week.includes(dayjs().format('YYYY-MM-DD'));

const getSubtitle = () => {
  const h = dayjs().hour();
  if (h >= 6  && h < 12) return 'Comment te sens-tu ce matin ?';
  if (h >= 12 && h < 18) return 'Comment va le foyer aujourd\'hui ?';
  if (h >= 18 && h < 22) return 'Bonne fin de journée à tous 🌙';
  return 'Comment ça va en ce moment ?';
};

const DAY_ABBR = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

// ═══════════════════════════════════════════════════════════
// MOOD BUTTON
// ═══════════════════════════════════════════════════════════
const MoodButton: React.FC<{
  mood: typeof MOOD_CONFIGS[0];
  isSelected: boolean;
  onPress: () => void;
  index: number;
}> = ({ mood, isSelected, onPress, index }) => {
  const scale  = useSharedValue(1);
  const btnW   = (SW - 32 - 32) / 5;

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(1.22, { damping: 6 }), withSpring(1, { damping: 10 }));
    onPress();
  };

  return (
    <Animated.View entering={FadeInUp.duration(300).delay(index * 55)} style={scaleStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        style={{
          width: btnW, aspectRatio: 0.88, borderRadius: 18,
          backgroundColor: isSelected ? mood.color + '28' : 'rgba(255,255,255,0.04)',
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? mood.color : 'rgba(255,255,255,0.10)',
          alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
          shadowColor: isSelected ? mood.color : 'transparent',
          shadowOffset: { width: 0, height: 0 }, shadowOpacity: isSelected ? 0.55 : 0,
          shadowRadius: isSelected ? 12 : 0, elevation: isSelected ? 8 : 0,
        }}>
        <Text style={{ fontSize: isSelected ? 34 : 26 }}>{mood.emoji}</Text>
        <Text style={{ fontSize: isSelected ? 11 : 10, fontFamily: 'DMSans-Regular', color: isSelected ? mood.color : C.textSec, marginTop: 5 }}>
          {mood.label}
        </Text>
        {isSelected && (
          <Animated.View entering={FadeIn.duration(200)} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mood.color, marginTop: 5 }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MOOD DAY CELL
// ═══════════════════════════════════════════════════════════
const MoodDayCell: React.FC<{
  mood: MoodValue | null;
  isToday: boolean;
  isFuture: boolean;
  isMe: boolean;
  date: string;
  memberName: string;
}> = ({ mood, isToday, isFuture, isMe, date, memberName }) => {
  const [showTip, setShowTip] = useState(false);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isMe && isToday && !mood) {
      pulse.value = withRepeat(withSequence(
        withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 }),
      ), -1, false);
    }
  }, [isMe, isToday, mood, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (isFuture) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 }}>
      <View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
    </View>
  );

  if (!mood) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 }}>
      <Animated.View style={[{
        width: 30, height: 30, borderRadius: 10,
        borderWidth: 1,
        borderColor: isMe && isToday ? 'rgba(245,166,35,0.45)' : 'transparent',
        backgroundColor: isMe && isToday ? 'transparent' : 'rgba(255,255,255,0.04)',
        alignItems: 'center', justifyContent: 'center',
        borderStyle: 'dashed',
      }, isMe && isToday ? pulseStyle : {}]}>
        <Text style={{ fontSize: 11, color: isMe && isToday ? 'rgba(245,166,35,0.55)' : 'rgba(255,255,255,0.18)' }}>
          {isMe && isToday ? '?' : '○'}
        </Text>
      </Animated.View>
    </View>
  );

  const mc = getMood(mood);
  return (
    <TouchableOpacity
      onPress={() => { setShowTip(t => !t); setTimeout(() => setShowTip(false), 2200); }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 }}>
      <Animated.View entering={ZoomIn.duration(250)} style={{
        width: 30, height: 30, borderRadius: 10,
        backgroundColor: mc.color + '22',
        borderWidth: isToday ? 1.5 : 1,
        borderColor: isToday ? mc.color : mc.color + '45',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: isToday ? mc.color : 'transparent',
        shadowRadius: isToday ? 6 : 0, shadowOpacity: isToday ? 0.5 : 0, elevation: isToday ? 3 : 0,
      }}>
        <Text style={{ fontSize: isToday ? 16 : 14 }}>{mc.emoji}</Text>
      </Animated.View>
      {showTip && (
        <Animated.View entering={FadeIn.duration(180)} style={{
          position: 'absolute', bottom: 38, zIndex: 20, backgroundColor: C.bgMid,
          borderRadius: 10, borderWidth: 1, borderColor: C.amberBrd,
          paddingHorizontal: 8, paddingVertical: 5, minWidth: 90,
        }}>
          <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.text, textAlign: 'center' }}>
            {memberName} · {mc.emoji} {mc.label}{'\n'}{dayjs(date).format('D MMM')}
          </Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════════
// WEEK GRID
// ═══════════════════════════════════════════════════════════
const WeekGrid: React.FC<{
  weekDays: string[];
  weekMoods: WeekMoodData[];
  currentUserId: string;
  onPrev: () => void;
  onNext: () => void;
  isCurrent: boolean;
}> = ({ weekDays, weekMoods, currentUserId, onPrev, onNext, isCurrent }) => {
  const today = dayjs().format('YYYY-MM-DD');
  const firstDay = dayjs(weekDays[0]);
  const lastDay  = dayjs(weekDays[6]);
  const label    = firstDay.month() === lastDay.month()
    ? `${firstDay.format('D')} – ${lastDay.format('D MMMM')}`
    : `${firstDay.format('D MMM')} – ${lastDay.format('D MMM')}`;

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(380)} style={{
      backgroundColor: C.bgSurface, borderRadius: 22,
      borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)',
      marginHorizontal: 16, marginTop: 16, overflow: 'hidden',
    }}>
      <LinearGradient colors={['rgba(245,166,35,0.22)', 'transparent']} style={{ height: 1 }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingBottom: 8 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }}>📅 Cette semaine</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={onPrev} style={{ backgroundColor: 'rgba(245,166,35,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.amberBrd }}>
            <Text style={{ color: C.amber, fontSize: 13, fontFamily: 'Nunito-Bold' }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec }}>{label}</Text>
          <TouchableOpacity onPress={onNext} disabled={isCurrent} style={{ backgroundColor: isCurrent ? 'rgba(255,255,255,0.04)' : 'rgba(245,166,35,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: isCurrent ? C.border : C.amberBrd }}>
            <Text style={{ color: isCurrent ? C.textMut : C.amber, fontSize: 13, fontFamily: 'Nunito-Bold' }}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Days header */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 4 }}>
        <View style={{ width: 76 }} />
        {weekDays.map((d, i) => {
          const isT = d === today;
          return (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut, textTransform: 'uppercase', marginBottom: 2 }}>{DAY_ABBR[i]}</Text>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isT ? C.amber : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontFamily: isT ? 'Nunito-Bold' : 'DMSans-Regular', color: isT ? '#1A0E00' : d < today ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.25)' }}>
                  {dayjs(d).format('D')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Member rows */}
      {weekMoods.map(member => (
        <View key={member.userId} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
          <View style={{ width: 76, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 4 }}>
            <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: member.userColor + '28', borderWidth: 1.5, borderColor: member.userColor, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12 }}>{member.userEmoji}</Text>
            </View>
            <Text style={{ fontSize: member.userId === currentUserId ? 12 : 11, fontFamily: 'DMSans-Regular', color: member.userId === currentUserId ? C.text : 'rgba(255,255,255,0.65)', flex: 1 }} numberOfLines={1}>
              {member.userName.split(' ')[0]}
            </Text>
          </View>
          {weekDays.map(d => (
            <MoodDayCell
              key={d}
              mood={member.days[d] ?? null}
              isToday={d === today}
              isFuture={d > today}
              isMe={member.userId === currentUserId}
              date={d}
              memberName={member.userName.split(' ')[0]}
            />
          ))}
        </View>
      ))}
      <View style={{ height: 8 }} />
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// HOUSEHOLD MOOD CARD
// ═══════════════════════════════════════════════════════════
const HouseholdMoodCard: React.FC<{
  globalScore: number | null;
  globalMood: MoodValue | null;
  membersMap: Record<string, MoodValue>;
  members: Array<{ userId: string; name: string; color: string; emoji: string }>;
}> = ({ globalScore, globalMood, membersMap, members }) => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(
      withTiming(1.08, { duration: 1800 }), withTiming(1, { duration: 1800 }),
    ), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const mc       = globalMood ? getMood(globalMood) : null;
  const notSet   = members.filter(m => !membersMap[m.userId]).length;

  return (
    <Animated.View entering={FadeInUp.duration(450).delay(80)} style={{
      backgroundColor: mc ? mc.color + '12' : 'rgba(255,255,255,0.04)',
      borderRadius: 22, borderWidth: 1,
      borderColor: mc ? mc.color + '35' : C.border,
      marginHorizontal: 16, marginTop: 12, overflow: 'hidden',
    }}>
      <LinearGradient
        colors={['transparent', mc ? mc.color + '40' : 'transparent', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Animated.Text style={[{ fontSize: 48, shadowColor: mc?.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 }, mc ? pulseStyle : {}]}>
            {mc ? mc.emoji : '❓'}
          </Animated.Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 3 }}>
              Humeur du foyer
            </Text>
            <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: mc?.color ?? C.textSec }}>
              {mc ? `Le foyer va ${mc.label} !` : 'Pas encore renseigné'}
            </Text>
            {globalScore !== null && (
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.45)' }}>
                Score moyen : {globalScore} / 5
              </Text>
            )}
          </View>
        </View>

        {/* Member avatars */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {members.map(m => {
            const moodVal  = membersMap[m.userId] ?? null;
            const moodConf = moodVal ? getMood(moodVal) : null;
            return (
              <View key={m.userId} style={{ alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: m.color + '25', borderWidth: 1.5, borderColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>{m.emoji}</Text>
                  <View style={{ position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: C.bgMid, borderWidth: 1, borderColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10 }}>{moodConf ? moodConf.emoji : '○'}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.40)', marginTop: 5 }}>{m.name.split(' ')[0]}</Text>
              </View>
            );
          })}
        </View>

        {notSet > 0 && (
          <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', fontStyle: 'italic', color: 'rgba(255,255,255,0.30)', marginTop: 8 }}>
            {notSet} membre{notSet > 1 ? 's' : ''} n'ont pas encore renseigné leur humeur
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MY MOOD SELECTOR
// ═══════════════════════════════════════════════════════════
const MyMoodSelector: React.FC<{
  myMood: DailyMoodV2 | null;
  onSave: (mood: MoodValue, note?: string, shared?: boolean) => Promise<void>;
}> = ({ myMood, onSave }) => {
  const [editing,      setEditing]      = useState(!myMood);
  const [selected,     setSelected]     = useState<MoodValue | null>(myMood?.mood ?? null);
  const [note,         setNote]         = useState(myMood?.note ?? '');
  const [noteShared,   setNoteShared]   = useState(myMood?.isNoteShared ?? false);
  const [saving,       setSaving]       = useState(false);

  const noteH = useSharedValue(0);
  const noteStyle = useAnimatedStyle(() => ({
    height: noteH.value, overflow: 'hidden', opacity: interpolate(noteH.value, [0, 80], [0, 1]),
  }));

  useEffect(() => {
    noteH.value = withTiming(selected ? 100 : 0, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [selected, noteH]);

  useEffect(() => {
    if (myMood) { setEditing(false); setSelected(myMood.mood); setNote(myMood.note ?? ''); }
  }, [myMood]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    await onSave(selected, note || undefined, noteShared);
    setSaving(false);
    setEditing(false);
  };

  const mc = selected ? getMood(selected) : null;

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(200)} style={{
      backgroundColor: C.bgSurface, borderRadius: 24,
      borderWidth: 1, borderColor: C.amberBrd,
      marginHorizontal: 16, marginTop: 12, padding: 18, overflow: 'hidden',
    }}>
      <LinearGradient colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }}>Mon humeur aujourd'hui</Text>
        <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>{dayjs().format('dddd D MMMM')}</Text>
      </View>

      {/* Current mood display */}
      {myMood && !editing ? (
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Animated.Text entering={ZoomIn.springify()} style={{ fontSize: 52, marginBottom: 8, shadowColor: getMood(myMood.mood).color, shadowRadius: 12, shadowOpacity: 0.5 }}>
            {getMood(myMood.mood).emoji}
          </Animated.Text>
          <Text style={{ fontSize: 17, fontFamily: 'Nunito-Bold', color: getMood(myMood.mood).color, marginBottom: 4 }}>
            Tu te sens {getMood(myMood.mood).label} aujourd'hui
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec, marginBottom: 3 }}>
            {getMood(myMood.mood).description}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginBottom: 14 }}>
            Renseigné à {dayjs(myMood.createdAt).format('HH:mm')}
          </Text>
          <Pressable onPress={() => setEditing(true)} style={{ borderRadius: 14, borderWidth: 1, borderColor: C.amberBrd, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.amber }}>Modifier ✎</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Mood buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {MOOD_CONFIGS.map((mood, i) => (
              <MoodButton key={mood.value} mood={mood} isSelected={selected === mood.value}
                onPress={() => setSelected(mood.value)} index={i} />
            ))}
          </View>

          {/* Note section */}
          <Animated.View style={noteStyle}>
            <View style={{ marginTop: 12 }}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Ajouter une note (optionnel)..."
                placeholderTextColor={C.textMut}
                multiline maxLength={200}
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)', padding: 10, color: C.text, fontSize: 13, fontFamily: 'DMSans-Regular', height: 56 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.50)' }}>
                  Partager la note avec le foyer
                </Text>
                <Switch
                  value={noteShared} onValueChange={setNoteShared}
                  trackColor={{ false: C.border, true: C.amber + '60' }}
                  thumbColor={noteShared ? C.amber : '#888'}
                />
              </View>
            </View>
          </Animated.View>

          {/* Save button */}
          {selected && (
            <Animated.View entering={FadeIn.duration(200).delay(100)} style={{ marginTop: 14, borderRadius: 16, overflow: 'hidden' }}>
              <Pressable onPress={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
                <LinearGradient colors={[mc?.color ?? C.amber, (mc?.color ?? C.amber) + 'AA']} style={{ paddingVertical: 13, alignItems: 'center', borderRadius: 16, shadowColor: mc?.color ?? C.amber, shadowRadius: 12, shadowOpacity: 0.45, elevation: 6 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>
                    {saving ? 'Enregistrement...' : `Enregistrer mon humeur ${mc?.emoji ?? ''}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        </>
      )}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MOOD STATS CARD
// ═══════════════════════════════════════════════════════════
const MoodStatsCard: React.FC<{ stats: MoodStat[] }> = ({ stats }) => {
  const dominant    = stats[0] ?? null;
  const totalDays   = stats.reduce((s, st) => s + st.count, 0);
  const avgScore    = stats[0]?.avgScore ?? 0;

  const BAR_WIDTHS = useMemo(() =>
    MOOD_CONFIGS.map(m => {
      const s = stats.find(st => st.mood === m.value);
      return s ? (s.count / Math.max(totalDays, 1)) * 100 : 0;
    }), [stats, totalDays]);

  const bars = MOOD_CONFIGS.map((_, i) => useSharedValue(0));
  useEffect(() => {
    bars.forEach((b, i) => {
      b.value = withDelay(i * 100, withTiming(BAR_WIDTHS[i], { duration: 800, easing: Easing.out(Easing.quad) }));
    });
  }, [BAR_WIDTHS]);

  if (stats.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(500)} style={{
      backgroundColor: C.bgSurface, borderRadius: 22,
      borderWidth: 1, borderColor: C.amberBrd,
      marginHorizontal: 16, marginTop: 12, padding: 18, overflow: 'hidden',
    }}>
      <LinearGradient colors={['rgba(245,166,35,0.22)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }}>📊 Ce mois</Text>
        {avgScore > 0 && (
          <View style={{ backgroundColor: 'rgba(245,166,35,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.amberBrd }}>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.amber }}>⭐ {avgScore} / 5</Text>
          </View>
        )}
      </View>

      {/* Dominant mood */}
      {dominant && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, backgroundColor: getMood(dominant.mood as MoodValue).color + '12', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: getMood(dominant.mood as MoodValue).color + '28' }}>
          <Text style={{ fontSize: 36 }}>{getMood(dominant.mood as MoodValue).emoji}</Text>
          <View>
            <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>Humeur dominante</Text>
            <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: getMood(dominant.mood as MoodValue).color }}>
              {getMood(dominant.mood as MoodValue).label}
            </Text>
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec }}>{dominant.count} jour{dominant.count > 1 ? 's' : ''} ce mois</Text>
          </View>
        </View>
      )}

      {/* Bars */}
      {MOOD_CONFIGS.map((mood, i) => {
        const barStyle = useAnimatedStyle(() => ({ width: `${bars[i].value}%` }));
        const st       = stats.find(s => s.mood === mood.value);
        return (
          <View key={mood.value} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Text style={{ fontSize: 16, width: 24 }}>{mood.emoji}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.60)', width: 46 }}>{mood.label}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: mood.color }, barStyle]} />
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: mood.color, width: 32, textAlign: 'right' }}>
              {st ? `${st.pct}%` : '—'}
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// PARTNER TOAST
// ═══════════════════════════════════════════════════════════
const PartnerMoodToast: React.FC<{ name: string; color: string; mood: MoodValue; onDismiss: () => void }> = ({ name, color, mood, onDismiss }) => {
  const mc = getMood(mood);
  useEffect(() => { const t = setTimeout(onDismiss, 3200); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown.springify()} style={{
      position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 150,
      backgroundColor: color + '18', borderRadius: 18,
      borderWidth: 1.5, borderColor: color, padding: 14,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      shadowColor: color, shadowRadius: 16, shadowOpacity: 0.45, elevation: 10,
    }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: color + '28', borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20 }}>{mc.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color }}>
          {name} a renseigné son humeur
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.text }}>
          Se sent {mc.emoji} {mc.label} aujourd'hui
        </Text>
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const MoodBoardScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [weekDays,      setWeekDays]      = useState<string[]>(getCurrentWeek());
  const [weekMoods,     setWeekMoods]     = useState<WeekMoodData[]>([]);
  const [todayMoods,    setTodayMoods]    = useState<DailyMoodV2[]>([]);
  const [myStats,       setMyStats]       = useState<MoodStat[]>([]);
  const [householdScore, setHouseholdScore] = useState<number | null>(null);
  const [householdMood, setHouseholdMood] = useState<MoodValue | null>(null);
  const [membersMap,    setMembersMap]    = useState<Record<string, MoodValue>>({});
  const [partnerToast,  setPartnerToast]  = useState<{ name: string; color: string; mood: MoodValue } | null>(null);

  const myUserId = user?.id ?? '';
  const today    = dayjs().format('YYYY-MM-DD');
  const myMood   = useMemo(() => todayMoods.find(m => m.userId === myUserId) ?? null, [todayMoods, myUserId]);

  const membersList = useMemo(() => members.map(m => ({
    userId: m.user_id ?? m.id,
    name:   m.display_name,
    color:  m.color,
    emoji:  m.avatar_emoji,
  })), [members]);

  // ── Helpers ──
  const enrichMood = useCallback((raw: Record<string, unknown>): DailyMoodV2 => {
    const mem = members.find(m => m.user_id === raw.user_id || m.id === raw.user_id);
    return {
      id:           raw.id as string,
      householdId:  raw.household_id as string,
      userId:       raw.user_id as string,
      userName:     mem?.display_name ?? 'Inconnu',
      userColor:    mem?.color ?? C.amber,
      userEmoji:    mem?.avatar_emoji ?? '?',
      mood:         raw.mood as MoodValue,
      moodDate:     raw.mood_date as string,
      note:         raw.note as string | undefined,
      isNoteShared: (raw.is_note_shared as boolean) ?? false,
      createdAt:    raw.created_at as string,
    };
  }, [members]);

  // ── Fetch ──
  const fetchToday = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('moods')
      .select('*').eq('household_id', household.id).eq('mood_date', today);
    if (data) {
      const enriched = (data as Record<string, unknown>[]).map(enrichMood);
      setTodayMoods(enriched);
      const map: Record<string, MoodValue> = {};
      enriched.forEach(m => { map[m.userId] = m.mood; });
      setMembersMap(map);
    }
  }, [household?.id, today, enrichMood]);

  const fetchWeek = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('moods').select('*')
      .eq('household_id', household.id)
      .gte('mood_date', weekDays[0]).lte('mood_date', weekDays[6]);
    if (data) {
      const rows = data as Record<string, unknown>[];
      const grid: WeekMoodData[] = membersList.map(m => {
        const days: Record<string, MoodValue | null> = {};
        weekDays.forEach(d => { days[d] = null; });
        rows.filter(r => r.user_id === m.userId).forEach(r => { days[r.mood_date as string] = r.mood as MoodValue; });
        return { userId: m.userId, userName: m.name, userColor: m.color, userEmoji: m.emoji, days };
      });
      setWeekMoods(grid);
    }
  }, [household?.id, weekDays, membersList]);

  const fetchStats = useCallback(async () => {
    if (!household?.id || !myUserId) return;
    const { data } = await supabase.rpc('get_mood_stats', {
      p_household_id: household.id, p_user_id: myUserId,
    });
    if (data) setMyStats((data as Record<string, unknown>[]).map(d => ({
      mood: d.mood as MoodValue, count: d.cnt as number,
      pct: d.pct as number, avgScore: d.avg_score as number,
    })));
  }, [household?.id, myUserId]);

  const fetchHouseholdMood = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.rpc('get_household_mood', { p_household_id: household.id });
    if (data?.[0]) {
      const row = data[0] as Record<string, unknown>;
      setHouseholdScore(row.global_score as number | null);
      setHouseholdMood(row.global_mood as MoodValue | null);
      const mm = (row.members_mood as Record<string, string>) ?? {};
      const out: Record<string, MoodValue> = {};
      Object.entries(mm).forEach(([k, v]) => { out[k] = v as MoodValue; });
      setMembersMap(out);
    }
  }, [household?.id]);

  useEffect(() => { fetchToday(); fetchWeek(); fetchStats(); fetchHouseholdMood(); }, [fetchToday, fetchWeek, fetchStats, fetchHouseholdMood]);

  // ── Realtime ──
  useEffect(() => {
    if (!household?.id) return;
    const sub = supabase.channel(`moods-${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'moods', filter: `household_id=eq.${household.id}` }, (payload) => {
        const raw = payload.new as Record<string, unknown>;
        if (raw.user_id && raw.user_id !== myUserId) {
          const mem = members.find(m => m.user_id === raw.user_id || m.id === raw.user_id);
          if (mem) {
            setPartnerToast({ name: mem.display_name.split(' ')[0], color: mem.color, mood: raw.mood as MoodValue });
          }
        }
        fetchToday(); fetchWeek(); fetchHouseholdMood();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [household?.id, myUserId, members, fetchToday, fetchWeek, fetchHouseholdMood]);

  const handleSaveMood = useCallback(async (mood: MoodValue, note?: string, shared = false) => {
    if (!household?.id || !myUserId) return;
    await supabase.from('moods').upsert({
      household_id: household.id, user_id: myUserId,
      mood, mood_date: today, note: note ?? null, is_note_shared: shared,
    }, { onConflict: 'household_id,user_id,mood_date' });
    await fetchToday(); await fetchHouseholdMood(); await fetchStats();
  }, [household?.id, myUserId, today, fetchToday, fetchHouseholdMood, fetchStats]);

  const isCurrent = isCurrentWeekFn(weekDays);

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ══ HEADER ══ */}
        <Animated.View entering={FadeInDown.duration(450)}>
          <LinearGradient colors={['rgba(245,166,35,0.08)', 'rgba(245,166,35,0.02)', 'transparent']} style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <Text style={{ fontSize: 28 }}>😊</Text>
              <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>Humeurs</Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
              {getSubtitle()}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ══ HOUSEHOLD MOOD ══ */}
        <HouseholdMoodCard
          globalScore={householdScore}
          globalMood={householdMood}
          membersMap={membersMap}
          members={membersList}
        />

        {/* ══ MY MOOD SELECTOR ══ */}
        <MyMoodSelector myMood={myMood} onSave={handleSaveMood} />

        {/* ══ WEEK GRID ══ */}
        <WeekGrid
          weekDays={weekDays}
          weekMoods={weekMoods}
          currentUserId={myUserId}
          onPrev={() => setWeekDays(getPrevWeek(weekDays))}
          onNext={() => { if (!isCurrent) setWeekDays(getNextWeek(weekDays)); }}
          isCurrent={isCurrent}
        />

        {/* ══ STATS ══ */}
        <MoodStatsCard stats={myStats} />

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ══ PARTNER TOAST ══ */}
      {partnerToast && (
        <PartnerMoodToast
          name={partnerToast.name}
          color={partnerToast.color}
          mood={partnerToast.mood}
          onDismiss={() => setPartnerToast(null)}
        />
      )}
    </View>
  );
};
