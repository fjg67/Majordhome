import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Modal, Image,
  Alert, Dimensions, StatusBar, Platform, Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Swipeable } from 'react-native-gesture-handler';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import { notificationService } from '@services/notifications';
import type { Expense, ExpenseCategory, SplitMode, HouseholdMember } from '@appTypes/index';

const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:    '#1A0E00',
  bgMid:     '#261400',
  bgSurface: '#2E1A00',
  bgElev:    '#3A2200',
  amber:     '#F5A623',
  amberSoft: 'rgba(245,166,35,0.15)',
  amberGlow: 'rgba(245,166,35,0.30)',
  amberBrd:  'rgba(245,166,35,0.22)',
  border:    'rgba(255,255,255,0.07)',
  text:      '#FFFFFF',
  textSec:   'rgba(255,255,255,0.58)',
  textMut:   'rgba(255,255,255,0.32)',
  green:     '#34D399',
  red:       '#FF6B6B',
  blue:      '#4ECDC4',
  purple:    '#A78BFA',
  orange:    '#FFA07A',
};

const CAT_CFG: Record<ExpenseCategory, { emoji: string; label: string; color: string }> = {
  food:      { emoji: '🍽️', label: 'Alimentation', color: '#FF8C42' },
  transport: { emoji: '🚗', label: 'Transport',    color: '#4ECDC4' },
  housing:   { emoji: '🏠', label: 'Logement',     color: '#A78BFA' },
  health:    { emoji: '💊', label: 'Santé',         color: '#34D399' },
  leisure:   { emoji: '🎮', label: 'Loisirs',       color: '#FFA07A' },
  shopping:  { emoji: '🛍️', label: 'Shopping',      color: '#FF6B9D' },
  bills:     { emoji: '📄', label: 'Factures',      color: '#87CEEB' },
  other:     { emoji: '📦', label: 'Autre',          color: C.amber  },
};

const SPLIT_LABELS: Record<SplitMode, string> = {
  equal:      '÷ Égal',
  custom:     '✏️ Personnalisé',
  payer_only: '👤 Payeur seul',
};

const MONTH_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const fmtMoney = (n: number) => n.toFixed(2).replace('.', ',') + ' €';

const fmtDateLabel = (d: string): string => {
  const dt = new Date(d + 'T00:00:00');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  if (d === todayStr) return "Aujourd'hui";
  if (d === yesterdayStr) return 'Hier';
  return dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

// ═══════════════════════════════════════════════════════════
// DONUT CHART (SKIA)
// ═══════════════════════════════════════════════════════════
interface CatStat { category: ExpenseCategory; total: number; pct: number; }

const DonutChart: React.FC<{ stats: CatStat[]; totalAmount: number }> = ({ stats, totalAmount }) => {
  const SIZE = SW - 80;
  const cx = SIZE / 2;
  const cy = 100;
  const RING_R    = 72;
  const STROKE_W  = 28;
  const GAP_DEG   = 3;

  const segPaths = useMemo(() => {
    const oval = { x: cx - RING_R, y: cy - RING_R, width: RING_R * 2, height: RING_R * 2 };
    let angle = -90;
    return stats
      .filter(s => s.pct > 1)
      .map(s => {
        const sweep = (s.pct / 100) * 360 - GAP_DEG;
        const p = Skia.Path.Make();
        p.addArc(oval, angle, Math.max(sweep, 0));
        const seg = { path: p, color: CAT_CFG[s.category]?.color ?? C.amber };
        angle += (s.pct / 100) * 360;
        return seg;
      });
  }, [stats, cx, cy]);

  const bgPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc({ x: cx - RING_R, y: cy - RING_R, width: RING_R * 2, height: RING_R * 2 }, 0, 360);
    return p;
  }, [cx, cy]);

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: cy * 2 }}>
        <Canvas style={{ width: SIZE, height: cy * 2 }}>
          <Path path={bgPath} style="stroke" strokeWidth={STROKE_W} color="rgba(255,255,255,0.06)" />
          {segPaths.map((seg, i) => (
            <Path key={i} path={seg.path} style="stroke" strokeWidth={STROKE_W} color={seg.color} />
          ))}
        </Canvas>
        {/* Center overlay */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut, letterSpacing: 1.5, marginBottom: 2 }}>
            TOTAL
          </Text>
          <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: C.amber }}>
            {fmtMoney(totalAmount)}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════
const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center', paddingTop: 60, paddingBottom: 40 }}>
    {/* Decorative rings */}
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
      <View style={{
        position: 'absolute', width: 140, height: 140, borderRadius: 70,
        borderWidth: 1, borderColor: 'rgba(245,166,35,0.12)', borderStyle: 'dashed',
      }} />
      <View style={{
        position: 'absolute', width: 100, height: 100, borderRadius: 50,
        borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)',
      }} />
      <View style={{
        width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(245,166,35,0.10)', borderWidth: 1, borderColor: C.amberBrd,
      }}>
        <Text style={{ fontSize: 32 }}>💸</Text>
      </View>
    </View>

    <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 8 }}>
      Aucune dépense
    </Text>
    <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSec, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 32 }}>
      Commence à suivre vos dépenses{'\n'}partagées du foyer
    </Text>
    <Pressable onPress={onAdd} style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.amberSoft, borderRadius: 14,
      borderWidth: 1, borderColor: C.amberBrd,
      paddingHorizontal: 22, paddingVertical: 13,
    }}>
      <Text style={{ fontSize: 16, color: C.amber }}>+</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>Ajouter une dépense</Text>
    </Pressable>
  </Animated.View>
);

// ═══════════════════════════════════════════════════════════
// EXPENSE CARD (with swipe-to-delete)
// ═══════════════════════════════════════════════════════════
interface ExpenseCardProps {
  expense: Expense;
  myMemberId?: string;
  userId?: string;
  members: HouseholdMember[];
  onDelete: (id: string, title: string) => void;
}

const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, myMemberId, userId, members, onDelete }) => {
  const cat    = CAT_CFG[expense.category] ?? CAT_CFG.other;
  const payer  = members.find(m => m.id === expense.paid_by || m.user_id === expense.paid_by);
  const mc     = payer?.color ?? C.amber;
  const isOwn  = expense.paid_by === myMemberId || expense.paid_by === userId;
  const share  = expense.split_mode !== 'payer_only' && members.length > 0
    ? expense.amount / members.length : expense.amount;

  const renderRightActions = () => (
    <Pressable
      onPress={() => onDelete(expense.id, expense.title)}
      style={{
        width: 72, marginBottom: 8, borderRadius: 18,
        backgroundColor: C.red,
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 6,
      }}
    >
      <Text style={{ fontSize: 20 }}>🗑️</Text>
      <Text style={{ fontSize: 10, color: '#fff', fontFamily: 'DMSans-Regular', marginTop: 2 }}>Suppr.</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} friction={2} rightThreshold={40} overshootRight={false}>
      <View style={{
        flexDirection: 'row', marginBottom: 8,
        backgroundColor: C.bgSurface, borderRadius: 18,
        borderWidth: 1, borderColor: 'rgba(245,166,35,0.13)',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22, shadowRadius: 8, elevation: 4,
      }}>
        {/* Left accent bar */}
        <View style={{
          width: 3.5, backgroundColor: cat.color,
          margin: 10, borderRadius: 2,
          shadowColor: cat.color, shadowRadius: 6, shadowOpacity: 0.8,
        }} />

        {/* Top highlight */}
        <LinearGradient
          colors={['rgba(245,166,35,0.12)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
        />

        {/* Content */}
        <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center', paddingVertical: 12, paddingRight: 14 }}>
          {/* Category icon */}
          <View style={{
            width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: cat.color + '18', borderWidth: 1, borderColor: cat.color + '28',
          }}>
            <Text style={{ fontSize: 21 }}>{cat.emoji}</Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={1}>
              {expense.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mc }} />
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: mc }}>
                {payer?.display_name ?? '?'}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                · {SPLIT_LABELS[expense.split_mode]}
              </Text>
            </View>
            {expense.note ? (
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut, fontStyle: 'italic', marginTop: 2 }} numberOfLines={1}>
                "{expense.note}"
              </Text>
            ) : null}
          </View>

          {/* Amount */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 17, fontFamily: 'Nunito-Bold', color: isOwn ? C.green : C.red }}>
              {isOwn ? '+' : '-'}{fmtMoney(expense.amount)}
            </Text>
            {expense.split_mode === 'equal' && !isOwn && (
              <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 2 }}>
                Part: {fmtMoney(share)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Swipeable>
  );
};

// ═══════════════════════════════════════════════════════════
// ADD EXPENSE MODAL
// ═══════════════════════════════════════════════════════════
interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  members: ReturnType<typeof useAuthStore>['members'];
  defaultPaidBy: string;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  visible, onClose, onSaved, householdId, members, defaultPaidBy,
}) => {
  const [title, setTitle]       = useState('');
  const [amount, setAmount]     = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [paidBy, setPaidBy]     = useState(defaultPaidBy);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [note, setNote]         = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => { if (visible) setPaidBy(defaultPaidBy); }, [visible, defaultPaidBy]);

  const pickReceipt = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 1 });
    const asset = result.assets?.[0];
    if (asset?.uri) setReceiptUri(asset.uri);
  };

  const reset = () => {
    setTitle(''); setAmount(''); setCategory('other');
    setSplitMode('equal'); setNote(''); setReceiptUri(null);
  };

  const handleClose = () => { reset(); onClose(); Keyboard.dismiss(); };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('', 'Entre un titre.'); return; }
    const amt = parseFloat(amount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) { Alert.alert('', 'Montant invalide.'); return; }

    await supabase.from('expenses').insert({
      household_id: householdId,
      paid_by:      paidBy || defaultPaidBy,
      title:        title.trim(),
      amount:       amt,
      category,
      split_mode:   splitMode,
      split_members: [],
      note:         note.trim() || null,
      expense_date: new Date().toISOString().split('T')[0],
    });

    reset(); onClose(); onSaved(); Keyboard.dismiss();
  };

  const CATS = Object.keys(CAT_CFG) as ExpenseCategory[];
  const amtNum = parseFloat(amount.replace(',', '.')) || 0;
  const share = members.length > 0 && splitMode === 'equal'
    ? amtNum / members.length
    : amtNum;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: C.bgMid, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          maxHeight: '90%', borderTopWidth: 1, borderTopColor: C.amberBrd,
        }}>
          {/* Top highlight */}
          <LinearGradient
            colors={['rgba(245,166,35,0.25)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          />
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 20 }} />

            <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 8 }}>
              Nouvelle dépense
            </Text>

            {/* ── BIG AMOUNT ── */}
            <View style={{
              alignItems: 'center', marginVertical: 20,
              backgroundColor: C.bgSurface, borderRadius: 20,
              borderWidth: 1, borderColor: C.amberBrd, padding: 20,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <TextInput
                  ref={amountRef}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0,00"
                  placeholderTextColor="rgba(245,166,35,0.35)"
                  keyboardType="decimal-pad"
                  style={{ fontSize: 52, fontFamily: 'Nunito-Bold', color: C.amber, minWidth: 80, textAlign: 'center' }}
                />
                <Text style={{ fontSize: 28, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.55)', marginBottom: 6 }}>€</Text>
              </View>
              {splitMode === 'equal' && amtNum > 0 && (
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 6 }}>
                  {fmtMoney(share)} par personne
                </Text>
              )}
            </View>

            {/* ── TITLE ── */}
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>TITRE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Courses, Restaurant, Ciné..."
              placeholderTextColor={C.textMut}
              style={{
                backgroundColor: C.bgSurface, borderRadius: 14, padding: 14,
                color: C.text, fontFamily: 'DMSans-Regular', fontSize: 15,
                borderWidth: 1, borderColor: C.border, marginBottom: 20,
              }}
            />

            {/* ── CATEGORY GRID ── */}
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>CATÉGORIE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {CATS.map(k => {
                const sel = category === k;
                const col = CAT_CFG[k].color;
                return (
                  <Pressable key={k} onPress={() => setCategory(k)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
                    backgroundColor: sel ? col + '22' : C.bgSurface,
                    borderWidth: 1.5, borderColor: sel ? col : C.border,
                  }}>
                    <Text style={{ fontSize: 14 }}>{CAT_CFG[k].emoji}</Text>
                    <Text style={{
                      fontSize: 11,
                      fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular',
                      color: sel ? col : C.textMut,
                    }}>{CAT_CFG[k].label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── PAID BY ── */}
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>PAYÉ PAR</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {members.map(m => {
                const sel = paidBy === m.id;
                const mc = m.color ?? C.amber;
                return (
                  <Pressable key={m.id} onPress={() => setPaidBy(m.id)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 7,
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                    backgroundColor: sel ? mc + '22' : C.bgSurface,
                    borderWidth: 1.5, borderColor: sel ? mc : C.border,
                  }}>
                    <Text style={{ fontSize: 16 }}>{m.avatar_emoji}</Text>
                    <Text style={{
                      fontSize: 12,
                      fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular',
                      color: sel ? mc : C.textSec,
                    }}>{m.display_name}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── SPLIT MODE ── */}
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>RÉPARTITION</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(Object.keys(SPLIT_LABELS) as SplitMode[]).map(k => {
                const sel = splitMode === k;
                return (
                  <Pressable key={k} onPress={() => setSplitMode(k)} style={{
                    flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
                    backgroundColor: sel ? C.amberSoft : C.bgSurface,
                    borderWidth: 1.5, borderColor: sel ? C.amberBrd : C.border,
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular',
                      color: sel ? C.amber : C.textMut,
                      textAlign: 'center',
                    }}>{SPLIT_LABELS[k]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── NOTE ── */}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (optionnel)"
              placeholderTextColor={C.textMut}
              multiline
              style={{
                backgroundColor: C.bgSurface, borderRadius: 14, padding: 14,
                color: C.text, fontFamily: 'DMSans-Regular', fontSize: 14,
                borderWidth: 1, borderColor: C.border, marginBottom: 16, minHeight: 56,
              }}
            />

            {/* ── TICKET PHOTO ── */}
            <Pressable
              onPress={pickReceipt}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: C.bgSurface, borderRadius: 14,
                borderWidth: 1, borderColor: receiptUri ? C.amberBrd : C.border,
                padding: 14, marginBottom: 24,
              }}
            >
              {receiptUri ? (
                <>
                  <Image source={{ uri: receiptUri }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.amber }}>Ticket ajouté ✓</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 1 }}>Appuie pour changer</Text>
                  </View>
                  <Pressable onPress={() => setReceiptUri(null)} hitSlop={8}>
                    <Text style={{ fontSize: 18, color: C.red }}>✕</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 20 }}>📷</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                    Ajouter un ticket (optionnel)
                  </Text>
                </>
              )}
            </Pressable>

            {/* ── SUBMIT ── */}
            <Pressable onPress={handleSubmit} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 8 }}>
              <LinearGradient colors={['#F5A623', '#E8920A']} style={{ paddingVertical: 17, alignItems: 'center', borderRadius: 16 }}>
                <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Ajouter la dépense</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleClose} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'DMSans-Medium', color: C.textMut }}>Annuler</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN BUDGET SCREEN
// ═══════════════════════════════════════════════════════════
export const BudgetScreen: React.FC = () => {
  const navigation = useNavigation();
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [showModal,  setShowModal]  = useState(false);
  const [tab,        setTab]        = useState<'list' | 'balance' | 'stats'>('list');
  const [period,     setPeriod]     = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // ── FAB pulse ──
  const fabPulse = useSharedValue(0);
  useEffect(() => {
    fabPulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [fabPulse]);
  const fabStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.35 + fabPulse.value * 0.4,
    shadowRadius:  10 + fabPulse.value * 10,
    transform:     [{ scale: 1 + fabPulse.value * 0.025 }],
  }));

  // ── Period change spring animation ──
  const periodScale = useSharedValue(1);
  const periodOpacity = useSharedValue(1);
  const periodStyle = useAnimatedStyle(() => ({
    transform: [{ scale: periodScale.value }],
    opacity: periodOpacity.value,
  }));
  useEffect(() => {
    periodOpacity.value = 0.5;
    periodScale.value = 0.96;
    periodOpacity.value = withSpring(1, { damping: 14, stiffness: 180 });
    periodScale.value = withSpring(1, { damping: 14, stiffness: 180 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.month, period.year]);

  const myMember = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);

  // ── Data loading ──
  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('expenses')
      .select('*')
      .eq('household_id', household.id)
      .order('expense_date', { ascending: false })
      .order('created_at',   { ascending: false });
    setExpenses((data ?? []) as Expense[]);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!household?.id) return;
    return subscribeToTable('expenses', household.id, () => load());
  }, [household?.id, load]);

  // ── Period navigation ──
  const shiftMonth = (dir: -1 | 1) => {
    setPeriod(p => {
      let m = p.month + dir;
      let y = p.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  };

  // ── Filtered expenses for selected period ──
  const filtered = useMemo(() => expenses.filter(e => {
    const d = new Date(e.expense_date + 'T00:00:00');
    return d.getMonth() === period.month && d.getFullYear() === period.year;
  }), [expenses, period]);

  // ── Total for selected period ──
  const totalPeriod = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  // ── My expenses this period ──
  const myTotal = useMemo(() => filtered
    .filter(e => e.paid_by === myMember?.id || e.paid_by === user?.id)
    .reduce((s, e) => s + e.amount, 0),
  [filtered, myMember?.id, user?.id]);

  // ── Balance per member (net) ──
  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach(m => { map[m.id] = 0; });

    expenses.forEach(exp => {
      if (exp.split_mode === 'payer_only') return;
      const involved = exp.split_members?.length > 0 ? exp.split_members : members.map(m => m.id);
      const share = exp.amount / (involved.length || 1);
      if (map[exp.paid_by] !== undefined) map[exp.paid_by] += exp.amount;
      involved.forEach(mid => { if (map[mid] !== undefined) map[mid] -= share; });
    });
    return map;
  }, [expenses, members]);

  const myBalance = myMember ? (balances[myMember.id] ?? 0) : 0;

  // ── Budget balance notification (once per session) ──
  const balanceNotifiedRef = useRef(false);
  const prevBalanceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!household?.id || expenses.length === 0) return;

    // Notify once if user owes money
    if (!balanceNotifiedRef.current && myBalance < -0.5) {
      balanceNotifiedRef.current = true;
      const creditor = members.find(m => m.id !== myMember?.id && (balances[m.id] ?? 0) > 0);
      notificationService.notifyBudgetBalanceIfNeeded(
        myBalance,
        household.id,
        creditor?.display_name,
      );
    }

    // Notify when all balances reach zero (settled)
    const allSettled = members.length > 1 && members.every(m => Math.abs(balances[m.id] ?? 0) < 0.5);
    if (prevBalanceRef.current !== null && !allSettled !== (Math.abs(prevBalanceRef.current) < 0.5) && allSettled) {
      notificationService.notifyBudgetSettled(household.id, myMember?.display_name ?? '');
    }
    prevBalanceRef.current = myBalance;
  }, [myBalance, balances, expenses.length, household?.id, members, myMember]);

  // ── Grouped by date ──
  const grouped = useMemo(() => {
    const g: Record<string, Expense[]> = {};
    filtered.forEach(e => {
      if (!g[e.expense_date]) g[e.expense_date] = [];
      g[e.expense_date].push(e);
    });
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // ── Category stats ──
  const catStats = useMemo((): CatStat[] => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return (Object.entries(map) as [ExpenseCategory, number][])
      .map(([category, total]) => ({ category, total, pct: totalPeriod > 0 ? (total / totalPeriod) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, totalPeriod]);

  // ── Delete expense ──
  const deleteExpense = useCallback((id: string, ttl: string) => {
    Alert.alert('Supprimer', `Supprimer "${ttl}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('expenses').delete().eq('id', id);
        load();
      }},
    ]);
  }, [load]);

  const TABS = [
    { key: 'list'    as const, label: '💳 Dépenses' },
    { key: 'balance' as const, label: '⚖️ Soldes'   },
    { key: 'stats'   as const, label: '📊 Stats'     },
  ];

  const isCurrentPeriod = (() => {
    const now = new Date();
    return period.month === now.getMonth() && period.year === now.getFullYear();
  })();

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      {/* Background gradient */}
      <LinearGradient
        colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Ambient glow top-right */}
      <View style={{
        position: 'absolute', top: -80, right: -60, width: 220, height: 220,
        borderRadius: 110, backgroundColor: 'rgba(245,166,35,0.04)',
      }} />

      {/* ══ HEADER ══ */}
      <Animated.View entering={FadeInDown.duration(500)}>
        <LinearGradient
          colors={['rgba(245,166,35,0.09)', 'rgba(245,166,35,0.02)', 'transparent']}
          style={{ paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 24) + 14, paddingHorizontal: 20, paddingBottom: 0 }}
        >
          {/* Row: back + title + period selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={12}
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  backgroundColor: C.amberSoft,
                  borderWidth: 1, borderColor: C.amberBrd,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 16, color: C.amber, marginLeft: -2 }}>‹</Text>
              </Pressable>
              <Text style={{ fontSize: 28, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>
                💰 Budget
              </Text>
            </View>

            {/* Period pill */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: C.amberSoft, borderRadius: 14,
              borderWidth: 1, borderColor: C.amberBrd,
              paddingVertical: 7, paddingHorizontal: 12,
            }}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={{ paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 13, color: C.amber }}>◀</Text>
              </Pressable>
              <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.amber, minWidth: 90, textAlign: 'center' }}>
                {MONTH_FR[period.month]} {period.year}
              </Text>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={{ paddingHorizontal: 4 }}
                disabled={isCurrentPeriod}>
                <Text style={{ fontSize: 13, color: isCurrentPeriod ? C.textMut : C.amber }}>▶</Text>
              </Pressable>
            </View>
          </View>

          {/* ── SUMMARY CARD ── */}
          <Animated.View style={periodStyle}>
          <View style={{
            backgroundColor: C.bgSurface, borderRadius: 22,
            borderWidth: 1, borderColor: C.amberBrd,
            marginBottom: 16, overflow: 'hidden',
            shadowColor: C.amber, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
          }}>
            {/* Top highlight line */}
            <LinearGradient
              colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1.5 }}
            />

            <View style={{ flexDirection: 'row', paddingVertical: 18, paddingHorizontal: 8 }}>

              {/* My expenses */}
              <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  Mes dép.
                </Text>
                <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: myMember?.color ?? C.amber }}>
                  {fmtMoney(myTotal)}
                </Text>
              </View>

              {/* Separator */}
              <View style={{ width: 1, backgroundColor: C.border, marginVertical: 4 }} />

              {/* TOTAL (center, larger) */}
              <View style={{ flex: 1.4, alignItems: 'center', paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  Total ce mois
                </Text>
                <Text style={{ fontSize: 28, fontFamily: 'Nunito-Bold', color: C.amber }}>
                  {fmtMoney(totalPeriod)}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 3 }}>
                  {filtered.length} dépense{filtered.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Separator */}
              <View style={{ width: 1, backgroundColor: C.border, marginVertical: 4 }} />

              {/* Balance */}
              <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  {myBalance >= 0 ? 'On me doit' : 'Je dois'}
                </Text>
                <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: myBalance >= 0 ? C.green : C.red }}>
                  {fmtMoney(Math.abs(myBalance))}
                </Text>
              </View>
            </View>

            {/* Members row */}
            {members.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 16 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 16 }}>
                  {members.map(m => {
                    const bal = balances[m.id] ?? 0;
                    const mc = m.color ?? C.amber;
                    return (
                      <View key={m.id} style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{
                          width: 32, height: 32, borderRadius: 10,
                          backgroundColor: mc + '22',
                          borderWidth: 1.5, borderColor: mc,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 14 }}>{m.avatar_emoji}</Text>
                        </View>
                        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: mc }}>{m.display_name.split(' ')[0]}</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: bal >= 0 ? C.green : C.red }}>
                          {bal >= 0 ? '+' : ''}{Math.round(bal)}€
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* ══ TAB BAR ══ */}
      <Animated.View entering={FadeInDown.duration(400).delay(120)}
        style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, gap: 8 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={{
              flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center',
              backgroundColor: active ? C.amber : C.bgElev,
              borderWidth: 1, borderColor: active ? C.amber : 'rgba(245,166,35,0.15)',
              shadowColor: active ? C.amber : 'transparent',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: active ? 0.45 : 0,
              shadowRadius: 12, elevation: active ? 8 : 0,
            }}>
              <Text style={{
                fontSize: 12,
                fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular',
                color: active ? '#1A0E00' : 'rgba(255,255,255,0.48)',
              }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* ══ CONTENT ══ */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ═══ DÉPENSES TAB ═══ */}
        {tab === 'list' && (
          <>
            {grouped.length === 0
              ? <EmptyState onAdd={() => setShowModal(true)} />
              : grouped.map(([date, items], gi) => {
                  const dayTotal = items.reduce((s, e) => s + e.amount, 0);
                  const isToday = date === new Date().toISOString().split('T')[0];
                  return (
                    <Animated.View key={date} entering={FadeInUp.duration(400).delay(gi * 55)}>
                      {/* Section header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: gi === 0 ? 4 : 20, marginBottom: 10, gap: 10 }}>
                        <View style={{
                          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                          backgroundColor: isToday ? C.amber : 'rgba(245,166,35,0.12)',
                          borderWidth: 1, borderColor: 'rgba(245,166,35,0.28)',
                        }}>
                          <Text style={{
                            fontSize: 12, fontFamily: 'Nunito-Bold',
                            color: isToday ? '#1A0E00' : C.amber,
                          }}>{fmtDateLabel(date)}</Text>
                        </View>
                        <LinearGradient
                          colors={['rgba(245,166,35,0.22)', 'transparent']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={{ flex: 1, height: 1 }}
                        />
                        <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                          {fmtMoney(dayTotal)}
                        </Text>
                      </View>

                      {/* Expense cards */}
                      {items.map(exp => (
                        <ExpenseCard
                          key={exp.id}
                          expense={exp}
                          myMemberId={myMember?.id}
                          userId={user?.id}
                          members={members}
                          onDelete={deleteExpense}
                        />
                      ))}
                    </Animated.View>
                  );
                })
            }
          </>
        )}

        {/* ═══ SOLDES TAB ═══ */}
        {tab === 'balance' && (
          <Animated.View entering={FadeIn.duration(400)}>
            <View style={{ marginTop: 4, marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: C.text }}>⚖️ Qui doit quoi ?</Text>
              <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 4 }}>
                Soldes nets sur toutes les dépenses
              </Text>
            </View>

            {/* All-balanced state */}
            {members.every(m => Math.abs(balances[m.id] ?? 0) < 0.01) && (
              <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>⚖️</Text>
                <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 6 }}>
                  Tout est équilibré !
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSec }}>
                  Aucun solde en attente 🎉
                </Text>
              </Animated.View>
            )}

            {/* Per-member balance cards */}
            {members.map((m, i) => {
              const bal = balances[m.id] ?? 0;
              const mc  = m.color ?? C.amber;
              const isPos = bal >= 0;
              const borderCol = isPos ? 'rgba(52,211,153,0.25)' : 'rgba(255,107,107,0.25)';

              return (
                <Animated.View key={m.id} entering={FadeInUp.duration(400).delay(i * 80)}>
                  <View style={{
                    backgroundColor: C.bgSurface, borderRadius: 18,
                    borderWidth: 1, borderColor: borderCol,
                    marginBottom: 10, overflow: 'hidden',
                  }}>
                    <LinearGradient
                      colors={['transparent', isPos ? 'rgba(52,211,153,0.15)' : 'rgba(255,107,107,0.15)', 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ height: 1.5 }}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                      {/* Avatar */}
                      <View style={{
                        width: 50, height: 50, borderRadius: 14,
                        backgroundColor: mc + '22',
                        borderWidth: 2, borderColor: mc,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 22 }}>{m.avatar_emoji}</Text>
                      </View>

                      {/* Name */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.text }}>{m.display_name}</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec, marginTop: 2 }}>
                          {isPos ? '✅ Créditeur' : '🔴 Débiteur'}
                        </Text>
                      </View>

                      {/* Balance badge */}
                      <View style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
                        backgroundColor: isPos ? 'rgba(52,211,153,0.12)' : 'rgba(255,107,107,0.12)',
                        borderWidth: 1, borderColor: isPos ? 'rgba(52,211,153,0.28)' : 'rgba(255,107,107,0.28)',
                      }}>
                        <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: isPos ? C.green : C.red }}>
                          {isPos ? '+' : ''}{fmtMoney(bal)}
                        </Text>
                      </View>
                    </View>

                    {/* Mini stats row */}
                    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border }}>
                      <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginBottom: 2 }}>Avancé</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.green }}>
                          {fmtMoney(expenses
                            .filter(e => e.paid_by === m.id || e.paid_by === m.user_id)
                            .reduce((s, e) => s + e.amount, 0)
                          )}
                        </Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: C.border }} />
                      <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginBottom: 2 }}>Dépenses</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.red }}>
                          {fmtMoney(expenses
                            .filter(e => e.split_mode !== 'payer_only')
                            .reduce((s, e) => s + (e.split_members?.length > 0
                              ? (e.split_members.includes(m.id) ? e.amount / e.split_members.length : 0)
                              : e.amount / (members.length || 1)
                            ), 0)
                          )}
                        </Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: C.border }} />
                      <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginBottom: 2 }}>Solde net</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: isPos ? C.green : C.red }}>
                          {isPos ? '+' : ''}{fmtMoney(bal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              );
            })}

            <View style={{
              marginTop: 8, padding: 14, borderRadius: 14,
              backgroundColor: 'rgba(245,166,35,0.06)',
              borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)',
            }}>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center', lineHeight: 18 }}>
                💡 Solde positif = a avancé plus que sa part{'\n'}
                Solde négatif = doit de l'argent aux autres
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ═══ STATS TAB ═══ */}
        {tab === 'stats' && (
          <Animated.View entering={FadeIn.duration(400)}>
            <View style={{ marginTop: 4, marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: C.text }}>📊 Répartition</Text>
              <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 4 }}>
                {MONTH_FR[period.month]} {period.year}
              </Text>
            </View>

            {catStats.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
                <Text style={{ fontSize: 14, fontFamily: 'DMSans-Regular', color: C.textSec }}>
                  Aucune donnée ce mois
                </Text>
              </View>
            ) : (
              <>
                {/* Donut chart */}
                <View style={{
                  backgroundColor: C.bgSurface, borderRadius: 22,
                  borderWidth: 1, borderColor: C.amberBrd,
                  marginBottom: 20, paddingVertical: 20, overflow: 'hidden',
                }}>
                  <LinearGradient
                    colors={['transparent', 'rgba(245,166,35,0.20)', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ height: 1, position: 'absolute', top: 0, left: 0, right: 0 }}
                  />
                  <DonutChart stats={catStats} totalAmount={totalPeriod} />
                </View>

                {/* Category legend */}
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.amber, marginBottom: 12 }}>
                  Par catégorie
                </Text>
                {catStats.map((stat, i) => {
                  const cfg = CAT_CFG[stat.category] ?? CAT_CFG.other;
                  return (
                    <Animated.View key={stat.category} entering={FadeInUp.duration(350).delay(i * 60)}>
                      <View style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: C.bgSurface, borderRadius: 14,
                        borderWidth: 1, borderColor: C.border,
                        padding: 12, marginBottom: 8,
                      }}>
                        {/* Icon */}
                        <View style={{
                          width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: cfg.color + '18',
                        }}>
                          <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
                        </View>

                        {/* Bar + name */}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 5 }}>
                            {cfg.label}
                          </Text>
                          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)' }}>
                            <View style={{
                              height: 4, borderRadius: 2, backgroundColor: cfg.color,
                              width: `${Math.min(stat.pct, 100)}%`,
                            }} />
                          </View>
                        </View>

                        {/* Amount + % */}
                        <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: cfg.color }}>
                            {fmtMoney(stat.total)}
                          </Text>
                          <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                            {stat.pct.toFixed(0)}%
                          </Text>
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}

                {/* Insight card */}
                {catStats.length > 0 && (
                  <View style={{
                    marginTop: 8, padding: 16, borderRadius: 16,
                    backgroundColor: 'rgba(245,166,35,0.06)',
                    borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)',
                  }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.amber, marginBottom: 6 }}>
                      💡 Insight du mois
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSec, lineHeight: 20 }}>
                      La catégorie <Text style={{ color: CAT_CFG[catStats[0].category]?.color ?? C.amber, fontFamily: 'Nunito-Bold' }}>
                        {CAT_CFG[catStats[0].category]?.label}
                      </Text> représente {catStats[0].pct.toFixed(0)}% du budget avec{' '}
                      {fmtMoney(catStats[0].total)}.
                      {catStats.length > 1 && ` Suivi de ${CAT_CFG[catStats[1].category]?.label} (${catStats[1].pct.toFixed(0)}%).`}
                    </Text>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* ══ FAB ══ */}
      <Animated.View entering={FadeInUp.duration(500).delay(500)} style={[fabStyle, {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        right: 20,
        shadowColor: C.amber,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
      }]}>
        <Pressable
          onPress={() => setShowModal(true)}
          style={{ width: 58, height: 58, borderRadius: 18, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#F5A623', '#E8920A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 28, color: '#1A0E00', marginTop: -2 }}>+</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ══ ADD MODAL ══ */}
      <AddExpenseModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={load}
        householdId={household?.id ?? ''}
        members={members}
        defaultPaidBy={myMember?.id ?? ''}
      />
    </View>
  );
};
