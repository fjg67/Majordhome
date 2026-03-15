import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert, Modal,
  Dimensions, StatusBar, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeOut,
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
  withRepeat, withSequence, withDelay, Easing, Layout,
} from 'react-native-reanimated';
import { Canvas, Path, Circle, Group, vec, Line as SkiaLine, RoundedRect } from '@shopify/react-native-skia';
import LinearGradient from 'react-native-linear-gradient';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import type { ShoppingItem as ShoppingItemType, HouseholdMember, FoodItem as FoodItemType } from '@appTypes/index';

const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium
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

  checked:       '#34D399',
  checkedBg:     'rgba(52,211,153,0.08)',
  checkedBorder: 'rgba(52,211,153,0.20)',

  catDairy:   '#87CEEB',
  catMeat:    '#FF6B6B',
  catVeg:     '#34D399',
  catFruit:   '#FFA07A',
  catFrozen:  '#4ECDC4',
  catDry:     '#F5A623',
  catHygiene: '#A78BFA',
  catDrinks:  '#87CEEB',
  catOther:   'rgba(255,255,255,0.5)',
  catBakery:  '#D4A574',
  catSnacks:  '#FFD93D',
  catBaby:    '#FFB6C1',
  catPets:    '#8B6914',
  catCleaning:'#00CED1',
  catCanned:  '#CD853F',
  catPasta:   '#DEB887',
  catSauces:  '#FF6347',
  catSpices:  '#DAA520',
  catSweets:  '#FF69B4',
  catChips:   '#E8A317',
  catApero:   '#FF7F50',
};

// ═══════════════════════════════════════════════════════════
// CATEGORIES CONFIG
// ═══════════════════════════════════════════════════════════
interface CatCfg { emoji: string; label: string; color: string }
const CAT_CFG: Record<string, CatCfg> = {
  dairy:      { emoji: '🥛', label: 'Laitages',    color: C.catDairy },
  meat:       { emoji: '🥩', label: 'Viande',      color: C.catMeat },
  vegetables: { emoji: '🥦', label: 'Légumes',     color: C.catVeg },
  fruits:     { emoji: '🍎', label: 'Fruits',      color: C.catFruit },
  frozen:     { emoji: '❄️', label: 'Surgelés',    color: C.catFrozen },
  dry:        { emoji: '🌾', label: 'Épicerie',    color: C.catDry },
  bakery:     { emoji: '🥐', label: 'Boulangerie', color: C.catBakery },
  pasta:      { emoji: '🍝', label: 'Pâtes & Riz', color: C.catPasta },
  canned:     { emoji: '🥫', label: 'Conserves',   color: C.catCanned },
  sauces:     { emoji: '🫕', label: 'Sauces',      color: C.catSauces },
  spices:     { emoji: '🧂', label: 'Épices',      color: C.catSpices },
  snacks:     { emoji: '🍪', label: 'Snacks',       color: C.catSnacks },
  sweets:     { emoji: '🍬', label: 'Confiseries',  color: C.catSweets },
  chips:      { emoji: '🍟', label: 'Chips',        color: C.catChips },
  apero:      { emoji: '🧀', label: 'Apéro',       color: C.catApero },
  drinks:     { emoji: '🥤', label: 'Boissons',     color: C.catDrinks },
  hygiene:    { emoji: '🧴', label: 'Hygiène',     color: C.catHygiene },
  cleaning:   { emoji: '🧹', label: 'Ménage',      color: C.catCleaning },
  baby:       { emoji: '🍼', label: 'Bébé',        color: C.catBaby },
  pets:       { emoji: '🐾', label: 'Animaux',     color: C.catPets },
  other:      { emoji: '📦', label: 'Autre',       color: C.catOther },
};
const CAT_ORDER = [
  'dairy', 'meat', 'vegetables', 'fruits', 'frozen', 'dry', 'bakery', 'pasta',
  'canned', 'sauces', 'spices', 'snacks', 'sweets', 'chips', 'apero',
  'drinks', 'hygiene', 'cleaning', 'baby', 'pets', 'other',
];
const MODAL_CATS = CAT_ORDER;

const UNITS = ['pièce(s)', 'g', 'kg', 'ml', 'L', 'barquette(s)'];

const getCat = (key: string): CatCfg => CAT_CFG[key] ?? CAT_CFG.other;

// ═══════════════════════════════════════════════════════════
// DLC helpers (for food suggestions)
// ═══════════════════════════════════════════════════════════
const getDaysUntil = (d: string): number => {
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
};

// ═══════════════════════════════════════════════════════════
// COMPONENT — Section Header
// ═══════════════════════════════════════════════════════════
const SectionHeader: React.FC<{ catKey: string; remaining: number; index: number }> = React.memo(
  ({ catKey, remaining, index }) => {
    const cat = getCat(catKey);
    return (
      <Animated.View
        entering={FadeInDown.delay(240 + index * 50).duration(400)}
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 4, marginTop: 18, marginBottom: 8,
        }}
      >
        <View style={{
          width: 28, height: 28, borderRadius: 9,
          backgroundColor: cat.color + '22', borderWidth: 1, borderColor: cat.color + '40',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
        </View>
        <Text style={{
          fontFamily: 'Nunito-Bold', fontSize: 13, color: 'rgba(255,255,255,0.7)',
          textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 8,
        }}>{cat.label}</Text>
        <LinearGradient
          colors={[cat.color + '4D', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1, height: 1, marginLeft: 10 }}
        />
        <Text style={{
          fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 8,
        }}>{remaining} restant{remaining !== 1 ? 's' : ''}</Text>
      </Animated.View>
    );
  },
);

// ═══════════════════════════════════════════════════════════
// COMPONENT — Shopping Item Card
// ═══════════════════════════════════════════════════════════
const ShoppingCard: React.FC<{
  item: ShoppingItemType;
  members: HouseholdMember[];
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string, name: string) => void;
  index: number;
}> = React.memo(({ item, members, onToggle, onDelete, index }) => {
  const adder = members.find(m => m.user_id === item.added_by);
  const checker = item.checked_by ? members.find(m => m.user_id === item.checked_by) : null;
  const cat = getCat(item.category);

  const checkScale = useSharedValue(1);
  const cardOpacity = useSharedValue(item.checked ? 0.65 : 1);

  const handleToggle = useCallback(() => {
    const next = !item.checked;
    checkScale.value = withSequence(
      withSpring(1.25, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 }),
    );
    cardOpacity.value = withTiming(next ? 0.65 : 1, { duration: 300 });
    onToggle(item.id, next);
  }, [item.id, item.checked, onToggle, checkScale, cardOpacity]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const cardAnim = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(280 + index * 40).duration(350).springify()}
      layout={Layout.springify()}
      style={[{
        backgroundColor: C.bgSurface,
        borderRadius: 16, borderWidth: 1,
        borderColor: item.checked ? C.checkedBorder : C.amberBorder,
        marginBottom: 7, overflow: 'hidden',
      }]}
    >
      <Animated.View style={cardAnim}>
        {/* Highlight line top */}
        {!item.checked && (
          <LinearGradient
            colors={['transparent', 'rgba(245,166,35,0.25)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 1 }}
          />
        )}
        <Pressable
          onPress={handleToggle}
          onLongPress={() => onDelete(item.id, item.name)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}
        >
          {/* Checkbox */}
          <Animated.View style={[checkStyle, {
            width: 28, height: 28, borderRadius: 9, borderWidth: 2,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: item.checked ? C.checked : 'transparent',
            borderColor: item.checked ? C.checked : 'rgba(245,166,35,0.35)',
            ...(item.checked ? {
              shadowColor: C.checked, shadowRadius: 8, shadowOpacity: 0.6, elevation: 4,
            } : {}),
          }]}>
            {item.checked && (
              <Canvas style={{ width: 16, height: 16 }}>
                <Path
                  path="M3 8 L6.5 11.5 L13 4.5"
                  style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round"
                  color="#FFFFFF"
                />
              </Canvas>
            )}
          </Animated.View>

          {/* Content */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'Nunito-SemiBold', fontSize: 16,
                color: item.checked ? 'rgba(255,255,255,0.35)' : C.textPrimary,
                textDecorationLine: item.checked ? 'line-through' : 'none',
              }}
            >{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
              {item.quantity ? (
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Text style={{
                    fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)',
                  }}>{item.quantity}</Text>
                </View>
              ) : null}
              {adder && !item.checked ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{
                    width: 5, height: 5, borderRadius: 3,
                    backgroundColor: adder.color || C.amber,
                  }} />
                  <Text style={{
                    fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.38)',
                  }}>{adder.display_name}</Text>
                </View>
              ) : null}
              {item.checked && checker ? (
                <Text style={{
                  fontFamily: 'DMSans-Regular', fontSize: 11,
                  color: 'rgba(52,211,153,0.7)', marginTop: 2,
                }}>Pris par {checker.display_name}</Text>
              ) : null}
            </View>
          </View>

          {/* Right: delete button */}
          {!item.checked ? (
            <Pressable
              onPress={() => onDelete(item.id, item.name)}
              hitSlop={8}
              style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: 'rgba(255,68,68,0.10)',
                borderWidth: 1, borderColor: 'rgba(255,68,68,0.22)',
                alignItems: 'center', justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 14 }}>🗑️</Text>
            </Pressable>
          ) : (
            <Canvas style={{ width: 16, height: 16 }}>
              <Path
                path="M3 8 L6.5 11.5 L13 4.5"
                style="stroke" strokeWidth={2} strokeCap="round" color={C.checked}
              />
            </Canvas>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════
// COMPONENT — DLC Suggestion Card
// ═══════════════════════════════════════════════════════════
const DlcSuggestionCard: React.FC<{
  food: FoodItemType;
  onAdd: (name: string, category: string) => void;
}> = React.memo(({ food, onAdd }) => {
  const days = getDaysUntil(food.expiry_date);
  const urgColor = days <= 0 ? '#FF4444' : days <= 2 ? '#FF8C00' : C.amber;
  const urgText = days <= 0 ? 'Expiré' : days === 1 ? 'Expire demain' : `Expire dans ${days}j`;
  const cat = getCat(food.category);

  return (
    <Pressable
      onPress={() => onAdd(food.name, food.category)}
      style={{
        width: 130, borderRadius: 14, borderWidth: 1,
        borderColor: 'rgba(245,166,35,0.25)',
        backgroundColor: 'rgba(245,166,35,0.08)',
        padding: 12, marginRight: 8,
      }}
    >
      <Text style={{ fontSize: 24 }}>{cat.emoji}</Text>
      <Text numberOfLines={1} style={{
        fontFamily: 'Nunito-SemiBold', fontSize: 13, color: C.textPrimary, marginTop: 6,
      }}>{food.name}</Text>
      <View style={{
        marginTop: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
        backgroundColor: urgColor + '22', borderWidth: 1, borderColor: urgColor + '44',
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: urgColor }}>{urgText}</Text>
      </View>
      <View style={{
        position: 'absolute', bottom: 10, right: 10,
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: C.bgDeep, fontSize: 14, fontWeight: '700', marginTop: -1 }}>+</Text>
      </View>
    </Pressable>
  );
});

// ═══════════════════════════════════════════════════════════
// COMPONENT — Empty State (Skia)
// ═══════════════════════════════════════════════════════════
const EmptyState: React.FC<{ onAdd: () => void; hasSuggestions: boolean }> = ({ onAdd, hasSuggestions }) => {
  const sparkle = useSharedValue(1);
  useEffect(() => {
    sparkle.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    );
    return () => { sparkle.value = 1; };
  }, [sparkle]);

  return (
    <Animated.View entering={FadeIn.delay(200).duration(500)} style={{ alignItems: 'center', paddingTop: 40 }}>
      <Canvas style={{ width: 240, height: 200 }}>
        {/* Background circles */}
        <Circle cx={120} cy={100} r={90} color="rgba(245,166,35,0.05)" />
        <Circle cx={140} cy={85} r={60} color="rgba(52,211,153,0.03)" />
        {/* Cart body */}
        <RoundedRect x={70} y={60} width={100} height={70} r={10}
          style="stroke" strokeWidth={2} color="rgba(245,166,35,0.35)" />
        {/* Cart grid lines */}
        {[0, 1, 2].map(i => (
          <SkiaLine key={`h${i}`}
            p1={vec(75, 78 + i * 18)} p2={vec(165, 78 + i * 18)}
            style="stroke" strokeWidth={1} color="rgba(245,166,35,0.12)" />
        ))}
        {[0, 1].map(i => (
          <SkiaLine key={`v${i}`}
            p1={vec(103 + i * 33, 65)} p2={vec(103 + i * 33, 125)}
            style="stroke" strokeWidth={1} color="rgba(245,166,35,0.12)" />
        ))}
        {/* Handle */}
        <Path
          path="M65 60 Q55 40 70 35 Q80 32 85 40"
          style="stroke" strokeWidth={2} color="rgba(245,166,35,0.35)" strokeCap="round"
        />
        {/* Wheels */}
        <Circle cx={95} cy={140} r={6} style="stroke" strokeWidth={2} color="rgba(245,166,35,0.35)" />
        <Circle cx={145} cy={140} r={6} style="stroke" strokeWidth={2} color="rgba(245,166,35,0.35)" />
        {/* Sparkle */}
        <Group transform={[{ translateX: 175 }, { translateY: 45 }]}>
          <Path path="M0 -6 L0 6 M-6 0 L6 0" style="stroke" strokeWidth={1.5} color={C.amber} strokeCap="round" />
          <Path path="M-4 -4 L4 4 M4 -4 L-4 4" style="stroke" strokeWidth={1} color={C.amber} strokeCap="round" />
        </Group>
        {/* Orbital dots */}
        <Circle cx={50} cy={90} r={2.5} color="rgba(245,166,35,0.3)" />
        <Circle cx={190} cy={75} r={2} color="rgba(245,166,35,0.25)" />
        <Circle cx={100} cy={160} r={2} color="rgba(245,166,35,0.2)" />
      </Canvas>

      <Text style={{
        fontFamily: 'Nunito-Bold', fontSize: 20, color: C.textPrimary, marginTop: 8,
      }}>Liste de courses vide</Text>
      <Text style={{
        fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.38)',
        textAlign: 'center', marginTop: 6, lineHeight: 19,
      }}>{'Ajoute tes articles ou consulte\nles suggestions DLC'}</Text>

      <Pressable onPress={onAdd} style={{
        marginTop: 20, borderRadius: 14, height: 48,
        backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberGlow,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 24, gap: 8,
      }}>
        <Text style={{ color: C.amber, fontSize: 16, fontWeight: '700' }}>+</Text>
        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: C.amber }}>Ajouter un article</Text>
      </Pressable>

      {hasSuggestions && (
        <Text style={{
          fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(245,166,35,0.6)',
          marginTop: 10,
        }}>Voir les suggestions DLC  ›</Text>
      )}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const ShoppingListScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user = useAuthStore(s => s.user);
  const member = useAuthStore(s => s.member);
  const members: HouseholdMember[] = useAuthStore(s => s.members) ?? [];

  const [items, setItems] = useState<ShoppingItemType[]>([]);
  const [filter, setFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [dlcSuggestions, setDlcSuggestions] = useState<FoodItemType[]>([]);
  const [dlcExpanded, setDlcExpanded] = useState(true);
  const [cartExpanded, setCartExpanded] = useState(true);
  const quickInputRef = useRef<TextInput>(null);

  // Modal form state
  const [mName, setMName] = useState('');
  const [mCat, setMCat] = useState('other');
  const [mQty, setMQty] = useState('');
  const [mUnit, setMUnit] = useState('pièce(s)');

  // ─── Data Loading ──────────────────────────────────────
  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('shopping_items').select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });
    setItems((data ?? []) as ShoppingItemType[]);
  }, [household?.id]);

  const loadDlcSuggestions = useCallback(async () => {
    if (!household?.id) return;
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const { data } = await supabase.from('food_items').select('*')
      .eq('household_id', household.id).is('consumed_at', null)
      .lte('expiry_date', inThreeDays.toISOString().split('T')[0])
      .order('expiry_date', { ascending: true }).limit(10);
    setDlcSuggestions((data ?? []) as FoodItemType[]);
  }, [household?.id]);

  useEffect(() => { load(); loadDlcSuggestions(); }, [load, loadDlcSuggestions]);

  // Realtime
  useEffect(() => {
    if (!household?.id) return;
    const unsub = subscribeToTable('shopping_items', household.id, () => { load(); });
    return unsub;
  }, [household?.id, load]);

  // ─── Computed ──────────────────────────────────────────
  const uncheckedItems = useMemo(() => items.filter(i => !i.checked), [items]);
  const checkedItems = useMemo(() => items.filter(i => i.checked), [items]);
  const checkedCount = checkedItems.length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  // Grouped unchecked items by category (filtered)
  const sections = useMemo(() => {
    const src = filter === 'all' ? uncheckedItems : uncheckedItems.filter(i => (i.category || 'other') === filter);
    const g: Record<string, ShoppingItemType[]> = {};
    src.forEach(i => { const c = i.category || 'other'; if (!g[c]) g[c] = []; g[c].push(i); });
    return CAT_ORDER.filter(c => g[c]?.length).map(c => ({ key: c, data: g[c] }));
  }, [uncheckedItems, filter]);

  // Active categories for filter chips
  const activeCats = useMemo(() => {
    const set = new Set<string>();
    uncheckedItems.forEach(i => set.add(i.category || 'other'));
    return CAT_ORDER.filter(c => set.has(c));
  }, [uncheckedItems]);

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    uncheckedItems.forEach(i => { const c = i.category || 'other'; m[c] = (m[c] || 0) + 1; });
    return m;
  }, [uncheckedItems]);

  // ─── Actions ───────────────────────────────────────────
  const toggle = useCallback(async (id: string, checked: boolean) => {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? {
      ...i, checked,
      checked_by: checked ? user?.id ?? null : null,
      checked_at: checked ? new Date().toISOString() : null,
    } : i));
    await supabase.from('shopping_items').update({
      checked,
      checked_by: checked ? user?.id ?? null : null,
      checked_at: checked ? new Date().toISOString() : null,
    }).eq('id', id);
  }, [user?.id]);

  const addItem = useCallback(async (name: string, category: string, quantity?: string) => {
    if (!name.trim() || !household?.id || !user?.id) return;
    await supabase.from('shopping_items').insert({
      household_id: household.id,
      added_by: user.id,
      name: name.trim(),
      category,
      quantity: quantity || null,
    });
    load();
  }, [household?.id, user?.id, load]);

  const quickAdd = useCallback(() => {
    if (!quickText.trim()) return;
    addItem(quickText.trim(), 'other');
    setQuickText('');
    Keyboard.dismiss();
  }, [quickText, addItem]);

  const modalAdd = useCallback(() => {
    if (!mName.trim()) {
      Alert.alert('Champ requis', 'Remplis le nom de l\'article.');
      return;
    }
    const qty = mQty.trim() ? `${mQty.trim()} ${mUnit}` : undefined;
    addItem(mName.trim(), mCat, qty);
    setModalVisible(false);
    setMName(''); setMCat('other'); setMQty(''); setMUnit('pièce(s)');
  }, [mName, mCat, mQty, mUnit, addItem]);

  const addFromDlc = useCallback((name: string, category: string) => {
    addItem(name, category);
    setDlcSuggestions(prev => prev.filter(f => f.name !== name));
  }, [addItem]);

  const deleteItem = useCallback((id: string, name: string) => {
    setDeleteConfirm({ id, name });
  }, []);

  const confirmDeleteItem = useCallback(async () => {
    if (!deleteConfirm) return;
    await supabase.from('shopping_items').delete().eq('id', deleteConfirm.id);
    setItems(prev => prev.filter(i => i.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  }, [deleteConfirm]);

  const clearChecked = useCallback(() => {
    setClearConfirm(true);
  }, []);

  const confirmClearChecked = useCallback(async () => {
    const ids = checkedItems.map(i => i.id);
    await supabase.from('shopping_items').delete().in('id', ids);
    setClearConfirm(false);
    load();
  }, [checkedItems, load]);

  // ─── FAB Animation ─────────────────────────────────────
  const fabScale = useSharedValue(0.3);
  const fabShadow = useSharedValue(0.55);
  useEffect(() => {
    fabScale.value = withDelay(600, withSpring(1, { damping: 12, stiffness: 100 }));
    fabShadow.value = withDelay(700, withRepeat(withSequence(
      withTiming(0.75, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.55, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
    ), -1, true));
    return () => { fabScale.value = 1; fabShadow.value = 0.55; };
  }, [fabScale, fabShadow]);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
    shadowOpacity: fabShadow.value,
  }));

  // ─── Progress bar animation ────────────────────────────
  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming(progress * 100, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [progress, progressWidth]);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as unknown as number,
  }));

  // ─── Chevron animation (cart section) ──────────────────
  const cartChevron = useSharedValue(0);
  useEffect(() => {
    cartChevron.value = withTiming(cartExpanded ? 1 : 0, { duration: 250 });
  }, [cartExpanded, cartChevron]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${cartChevron.value * 180}deg` }],
  }));

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      {/* ══════ HEADER ══════ */}
      <Animated.View entering={FadeInDown.duration(400)} style={{
        paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingHorizontal: 20, paddingBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Cart Skia icon */}
          <Canvas style={{ width: 28, height: 28 }}>
            <RoundedRect x={5} y={8} width={18} height={14} r={3}
              style="stroke" strokeWidth={2} color={C.amber} />
            <Circle cx={10} cy={25} r={2.5} color={C.amber} />
            <Circle cx={20} cy={25} r={2.5} color={C.amber} />
            <Path path="M3 8 Q1 3 5 2" style="stroke" strokeWidth={2} color={C.amber} strokeCap="round" />
            <Path path="M23 4 L25 2 M24 3 L26 5" style="stroke" strokeWidth={1.2} color={C.amber} strokeCap="round" />
          </Canvas>
          <Text style={{
            fontFamily: 'Nunito-Bold', fontSize: 30, color: C.textPrimary,
            letterSpacing: -0.5, marginLeft: 10, flex: 1,
          }}>Courses</Text>

          {/* Actions right */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {checkedCount > 0 && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                <Pressable onPress={clearChecked} style={{
                  width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.20)',
                }}>
                  <Canvas style={{ width: 20, height: 20 }}>
                    <Path path="M4 16 L8 4 L12 16 M6 10 L10 10" style="stroke" strokeWidth={1.8} color="rgba(255,107,107,0.7)" strokeCap="round" />
                    <Path path="M14 6 Q16 4 18 6 Q20 8 16 12 Q12 8 14 6" style="stroke" strokeWidth={1.2} color="rgba(255,107,107,0.5)" />
                  </Canvas>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Counter + Progress */}
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textSecondary }}>
              {checkedCount} / {totalCount} article{totalCount !== 1 ? 's' : ''}
            </Text>
            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textSecondary }}>
              {totalCount > 0 ? Math.round(progress * 100) : 0}%
            </Text>
          </View>
          <View style={{
            height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)',
            marginTop: 6, overflow: 'hidden',
          }}>
            <Animated.View style={[progressStyle, { height: '100%', borderRadius: 2, overflow: 'hidden' }]}>
              <LinearGradient
                colors={['#F5A623', '#34D399']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </View>
        </View>
      </Animated.View>

      {/* ══════ MAIN SCROLL ══════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 170 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── DLC Suggestions ── */}
        {dlcSuggestions.length > 0 && (
          <Animated.View entering={FadeIn.delay(80).duration(350)} style={{ marginTop: 4, marginBottom: 12 }}>
            <Pressable onPress={() => setDlcExpanded(p => !p)}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
            >
              <Canvas style={{ width: 16, height: 16 }}>
                <Path path="M8 2 L8 6 M8 8 L8 14 M5 5 L8 2 L11 5"
                  style="stroke" strokeWidth={1.5} color={C.amber} strokeCap="round" />
                <Circle cx={8} cy={14} r={2} color={C.amber} />
              </Canvas>
              <Text style={{
                fontFamily: 'Nunito-SemiBold', fontSize: 13, color: C.amber, marginLeft: 6, flex: 1,
              }}>Suggestions DLC</Text>
              <Text style={{
                fontFamily: 'DMSans-Regular', fontSize: 18, color: C.textMuted,
                transform: [{ rotate: dlcExpanded ? '90deg' : '0deg' }],
              }}>›</Text>
            </Pressable>
            {dlcExpanded && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {dlcSuggestions.map(food => (
                  <DlcSuggestionCard key={food.id} food={food} onAdd={addFromDlc} />
                ))}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* ── Filter Tabs ── */}
        {totalCount > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(350)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
              contentContainerStyle={{ gap: 6, paddingRight: 16 }}
            >
              {/* "Tout" chip */}
              <Pressable onPress={() => setFilter('all')} style={{
                borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                backgroundColor: filter === 'all' ? C.amber : C.bgElevated,
                borderWidth: filter === 'all' ? 0 : 1,
                borderColor: 'rgba(245,166,35,0.15)',
                ...(filter === 'all' ? {
                  shadowColor: C.amber, shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
                } : {}),
              }}>
                <Text style={{
                  fontFamily: filter === 'all' ? 'Nunito-Bold' : 'DMSans-Medium',
                  fontSize: 12, color: filter === 'all' ? C.bgDeep : 'rgba(255,255,255,0.48)',
                }}>Tout</Text>
              </Pressable>
              {activeCats.map(catKey => {
                const cat = getCat(catKey);
                const active = filter === catKey;
                const count = catCounts[catKey] || 0;
                return (
                  <Pressable key={catKey} onPress={() => setFilter(active ? 'all' : catKey)}
                    style={{
                      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: active ? C.amber : C.bgElevated,
                      borderWidth: active ? 0 : 1,
                      borderColor: 'rgba(245,166,35,0.15)',
                      ...(active ? {
                        shadowColor: C.amber, shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
                      } : {}),
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{cat.emoji}</Text>
                    <Text style={{
                      fontFamily: active ? 'Nunito-Bold' : 'DMSans-Medium',
                      fontSize: 12, color: active ? C.bgDeep : 'rgba(255,255,255,0.48)',
                    }}>{cat.label}</Text>
                    {count > 0 && (
                      <View style={{
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: active ? C.bgDeep : C.amber,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{
                          fontFamily: 'Nunito-Bold', fontSize: 9,
                          color: active ? C.amber : C.bgDeep,
                        }}>{count}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Item Sections or Empty State ── */}
        {totalCount === 0 ? (
          <EmptyState onAdd={() => setModalVisible(true)} hasSuggestions={dlcSuggestions.length > 0} />
        ) : (
          <>
            {sections.map((sec, si) => (
              <View key={sec.key}>
                <SectionHeader catKey={sec.key} remaining={sec.data.length} index={si} />
                {sec.data.map((item, ii) => (
                  <ShoppingCard
                    key={item.id} item={item} members={members}
                    onToggle={toggle} onDelete={deleteItem}
                    index={si * 5 + ii}
                  />
                ))}
              </View>
            ))}

            {/* ── Dans le chariot (checked) ── */}
            {checkedCount > 0 && (
              <Animated.View entering={FadeIn.duration(300)} style={{ marginTop: 20 }}>
                <Pressable
                  onPress={() => setCartExpanded(p => !p)}
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
                >
                  <Canvas style={{ width: 16, height: 16 }}>
                    <Path
                      path="M2 6 L4 12 L14 12 L15 8 L5 8"
                      style="stroke" strokeWidth={1.5} color={C.checked} strokeCap="round" strokeJoin="round"
                    />
                    <Circle cx={6} cy={14.5} r={1.5} color={C.checked} />
                    <Circle cx={12} cy={14.5} r={1.5} color={C.checked} />
                  </Canvas>
                  <Text style={{
                    fontFamily: 'Nunito-SemiBold', fontSize: 13, color: C.checked,
                    marginLeft: 6, flex: 1,
                  }}>Dans le chariot</Text>
                  <View style={{
                    width: 18, height: 18, borderRadius: 9,
                    backgroundColor: C.checked, alignItems: 'center', justifyContent: 'center',
                    marginRight: 8,
                  }}>
                    <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 10, color: C.bgDeep }}>
                      {checkedCount}
                    </Text>
                  </View>
                  <Animated.View style={chevronStyle}>
                    <Text style={{ fontSize: 16, color: C.textMuted }}>▾</Text>
                  </Animated.View>
                </Pressable>

                {cartExpanded && checkedItems.map((item, ii) => (
                  <ShoppingCard
                    key={item.id} item={item} members={members}
                    onToggle={toggle} onDelete={deleteItem} index={ii}
                  />
                ))}

                {cartExpanded && (
                  <Pressable onPress={clearChecked} style={{
                    marginTop: 8, borderRadius: 12, paddingVertical: 10,
                    backgroundColor: 'rgba(255,68,68,0.08)',
                    borderWidth: 1, borderColor: 'rgba(255,68,68,0.20)',
                    alignItems: 'center',
                  }}>
                    <Text style={{
                      fontFamily: 'DMSans-Medium', fontSize: 13, color: 'rgba(255,107,107,0.7)',
                    }}>Tout vider</Text>
                  </Pressable>
                )}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* ══════ QUICK ADD BAR ══════ */}
      <Animated.View
        entering={FadeInUp.delay(500).duration(400)}
        style={{
          position: 'absolute', bottom: 90, left: 16, right: 90,
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: C.bgElevated, borderRadius: 18,
          borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
          paddingHorizontal: 16, paddingVertical: 4,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
        }}
      >
        <Text style={{ color: C.amber, fontSize: 16, fontWeight: '700', marginRight: 8 }}>+</Text>
        <TextInput
          ref={quickInputRef}
          value={quickText}
          onChangeText={setQuickText}
          onSubmitEditing={quickAdd}
          returnKeyType="done"
          placeholder="Ajouter rapidement..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          style={{
            flex: 1, fontFamily: 'DMSans-Regular', fontSize: 14,
            color: C.textPrimary, paddingVertical: 10,
          }}
        />
        {quickText.length > 0 && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <Pressable onPress={quickAdd} style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: C.bgDeep, fontSize: 16, fontWeight: '700' }}>→</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>

      {/* ══════ FAB ══════ */}
      <Animated.View style={[fabStyle, {
        position: 'absolute', bottom: 86, right: 16,
        shadowColor: C.amber, shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16, elevation: 12,
      }]}>
        <Pressable
          onPress={() => setModalVisible(true)}
          style={{ width: 58, height: 58, borderRadius: 18, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#F5A623', '#E8920A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 58, height: 58, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Canvas style={{ width: 24, height: 24 }}>
              <RoundedRect x={4} y={7} width={16} height={12} r={2.5}
                style="stroke" strokeWidth={2} color={C.bgDeep} />
              <Circle cx={8} cy={21} r={2} color={C.bgDeep} />
              <Circle cx={17} cy={21} r={2} color={C.bgDeep} />
              <Path path="M2 7 Q0 3 3 2" style="stroke" strokeWidth={2} color={C.bgDeep} strokeCap="round" />
              <Path path="M14 4 L14 0 M12 2 L16 2" style="stroke" strokeWidth={1.8} color={C.bgDeep} strokeCap="round" />
            </Canvas>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ══════ ADD MODAL ══════ */}
      {modalVisible && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
        }}>
          <Pressable style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View
              entering={FadeInUp.duration(350).springify()}
              style={{
                backgroundColor: C.bgMid, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30,
                maxHeight: Dimensions.get('window').height * 0.85,
              }}
            >
              {/* Drag handle */}
              <View style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignSelf: 'center', marginBottom: 16,
              }} />

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={{
                  fontFamily: 'Nunito-Bold', fontSize: 22, color: C.textPrimary, marginBottom: 20,
                }}>Nouvel article</Text>

                {/* Name */}
                <Text style={labelStyle}>Nom de l'article *</Text>
                <TextInput
                  value={mName} onChangeText={setMName}
                  placeholder="Ex: Lait, Pain, Pommes..."
                  placeholderTextColor={C.textMuted}
                  autoFocus style={inputStyle}
                />

                {/* Category grid */}
                <Text style={[labelStyle, { marginTop: 16 }]}>Catégorie</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {MODAL_CATS.map(catKey => {
                    const cat = getCat(catKey);
                    const sel = mCat === catKey;
                    return (
                      <Pressable key={catKey} onPress={() => setMCat(catKey)}
                        style={{
                          width: (SW - 72) / 3, paddingVertical: 10, borderRadius: 12,
                          alignItems: 'center',
                          backgroundColor: sel ? cat.color + '22' : C.bgSurface,
                          borderWidth: 1.5,
                          borderColor: sel ? cat.color : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                        <Text style={{
                          fontFamily: 'DMSans-Medium', fontSize: 11,
                          color: sel ? cat.color : C.textSecondary, marginTop: 4,
                        }}>{cat.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Quantity + Unit */}
                <Text style={[labelStyle, { marginTop: 16 }]}>Quantité (optionnel)</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={mQty} onChangeText={setMQty}
                    keyboardType="numeric" placeholder="Qté"
                    placeholderTextColor={C.textMuted}
                    style={[inputStyle, { width: 80, flex: 0 }]}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                  >
                    {UNITS.map(u => (
                      <Pressable key={u} onPress={() => setMUnit(u)} style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                        backgroundColor: mUnit === u ? C.amberSoft : C.bgSurface,
                        borderWidth: 1, borderColor: mUnit === u ? C.amberBorder : 'rgba(255,255,255,0.08)',
                      }}>
                        <Text style={{
                          fontFamily: 'DMSans-Medium', fontSize: 12,
                          color: mUnit === u ? C.amber : C.textSecondary,
                        }}>{u}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Submit */}
                {(() => {
                  const canSubmit = mName.trim().length > 0 && mCat !== 'other';
                  return (
                    <Pressable
                      onPress={canSubmit ? modalAdd : undefined}
                      disabled={!canSubmit}
                      style={{ marginTop: 24, borderRadius: 16, overflow: 'hidden', opacity: canSubmit ? 1 : 0.4 }}>
                      <LinearGradient
                        colors={canSubmit ? ['#F5A623', '#E8920A'] : ['#555', '#444']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={{
                          height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                          shadowColor: canSubmit ? C.amber : 'transparent', shadowOpacity: 0.4, shadowRadius: 12, elevation: canSubmit ? 8 : 0,
                        }}
                      >
                        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 16, color: canSubmit ? C.bgDeep : 'rgba(255,255,255,0.35)' }}>
                          Ajouter à la liste
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  );
                })()}
                <View style={{ height: 40 }} />
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ─── DELETE ITEM MODAL ─── */}
      <Modal visible={!!deleteConfirm} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setDeleteConfirm(null)} />
          <Animated.View entering={FadeIn.duration(250)} style={{ width: SW * 0.82, borderRadius: 28, overflow: 'hidden' }}>
            <Canvas style={{ position: 'absolute', width: SW * 0.82, height: 280 }}>
              <RoundedRect x={0} y={0} width={SW * 0.82} height={280} r={28} color="#2A1600" />
              <Circle cx={SW * 0.41} cy={50} r={90} color="rgba(255,80,80,0.06)" />
              <Circle cx={SW * 0.41} cy={50} r={45} color="rgba(255,80,80,0.04)" />
            </Canvas>
            <View style={{ padding: 28, alignItems: 'center' }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: 'rgba(255,80,80,0.12)',
                borderWidth: 1.5, borderColor: 'rgba(255,80,80,0.25)',
                alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                shadowColor: '#FF5050', shadowRadius: 20, shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 0 }, elevation: 8,
              }}>
                <Text style={{ fontSize: 28 }}>🗑️</Text>
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.textPrimary, marginBottom: 8, textAlign: 'center' }}>
                Supprimer l'article
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 6, lineHeight: 20 }}>
                Êtes-vous sûr de vouloir supprimer
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: C.amber, textAlign: 'center', marginBottom: 24 }}>
                « {deleteConfirm?.name} »
              </Text>
              <LinearGradient colors={['transparent', 'rgba(255,80,80,0.25)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, width: '100%', marginBottom: 20 }} />
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <Pressable onPress={() => setDeleteConfirm(null)} style={{
                  flex: 1, height: 50, borderRadius: 16, backgroundColor: C.bgSurface,
                  borderWidth: 1, borderColor: C.amberBorder, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.textSecondary }}>Annuler</Text>
                </Pressable>
                <Pressable onPress={confirmDeleteItem} style={{ flex: 1, height: 50, borderRadius: 16, overflow: 'hidden' }}>
                  <LinearGradient colors={['#FF5050', '#CC2020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
                      shadowColor: '#FF5050', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: '#FFFFFF' }}>Supprimer</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ─── CLEAR CART MODAL ─── */}
      <Modal visible={clearConfirm} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setClearConfirm(false)} />
          <Animated.View entering={FadeIn.duration(250)} style={{ width: SW * 0.85, borderRadius: 28, overflow: 'hidden' }}>
            <Canvas style={{ position: 'absolute', width: SW * 0.85, height: 320 }}>
              <RoundedRect x={0} y={0} width={SW * 0.85} height={320} r={28} color="#2A1600" />
              <Circle cx={SW * 0.425} cy={55} r={100} color="rgba(245,166,35,0.05)" />
              <Circle cx={SW * 0.425} cy={55} r={50} color="rgba(245,166,35,0.04)" />
            </Canvas>
            <View style={{ padding: 28, alignItems: 'center' }}>
              {/* Cart icon */}
              <View style={{
                width: 68, height: 68, borderRadius: 34,
                backgroundColor: 'rgba(245,166,35,0.10)',
                borderWidth: 1.5, borderColor: 'rgba(245,166,35,0.25)',
                alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                shadowColor: C.amber, shadowRadius: 20, shadowOpacity: 0.25,
                shadowOffset: { width: 0, height: 0 }, elevation: 8,
              }}>
                <Text style={{ fontSize: 30 }}>🛒</Text>
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.textPrimary, marginBottom: 8, textAlign: 'center' }}>
                Vider le chariot
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20, marginBottom: 6 }}>
                Supprimer tous les articles cochés ?
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(245,166,35,0.08)', borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)',
                paddingHorizontal: 14, paddingVertical: 8, marginBottom: 24,
              }}>
                <Text style={{ fontSize: 14 }}>📦</Text>
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: C.amber }}>
                  {checkedCount} article{checkedCount > 1 ? 's' : ''}
                </Text>
              </View>
              <LinearGradient colors={['transparent', 'rgba(245,166,35,0.20)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, width: '100%', marginBottom: 20 }} />
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <Pressable onPress={() => setClearConfirm(false)} style={{
                  flex: 1, height: 50, borderRadius: 16, backgroundColor: C.bgSurface,
                  borderWidth: 1, borderColor: C.amberBorder, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.textSecondary }}>Annuler</Text>
                </Pressable>
                <Pressable onPress={confirmClearChecked} style={{ flex: 1, height: 50, borderRadius: 16, overflow: 'hidden' }}>
                  <LinearGradient colors={['#F5A623', '#E8920A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
                      shadowColor: C.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.bgDeep }}>Tout vider</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════
const labelStyle = {
  fontFamily: 'DMSans-Medium' as const, fontSize: 13,
  color: C.textSecondary, marginBottom: 8,
};

const inputStyle = {
  height: 50, backgroundColor: C.bgSurface, borderRadius: 14,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  paddingHorizontal: 16, fontFamily: 'DMSans-Regular' as const,
  fontSize: 15, color: C.textPrimary, marginBottom: 4,
};
