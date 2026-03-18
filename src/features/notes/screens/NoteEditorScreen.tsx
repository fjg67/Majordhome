import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, Alert, StatusBar,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeInDown, FadeIn, FadeOut,
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MoreStackParamList } from '@app/navigation/types';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import type { Note, NoteCategory, ChecklistItem } from '@appTypes/index';

const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:    '#1A0E00',
  bgMid:     '#261400',
  bgSurface: '#2E1A00',
  bgElev:    '#3A2200',
  amber:     '#F5A623',
  amberSoft: 'rgba(245,166,35,0.15)',
  amberBrd:  'rgba(245,166,35,0.22)',
  border:    'rgba(255,255,255,0.07)',
  text:      '#FFFFFF',
  textSec:   'rgba(255,255,255,0.58)',
  textMut:   'rgba(255,255,255,0.32)',
  green:     '#34D399',
  purple:    '#A78BFA',
};

const CAT_CFG: Record<NoteCategory, { emoji: string; label: string; color: string }> = {
  memo:    { emoji: '📝', label: 'Mémo',    color: '#F5A623' },
  recette: { emoji: '🍳', label: 'Recette', color: '#34D399' },
  contact: { emoji: '📋', label: 'Contact', color: '#4ECDC4' },
  code:    { emoji: '🔑', label: 'Code',    color: '#A78BFA' },
  liste:   { emoji: '✅', label: 'Liste',   color: '#FF6B6B' },
  idee:    { emoji: '💡', label: 'Idée',    color: '#FFD700' },
  autre:   { emoji: '📦', label: 'Autre',   color: 'rgba(255,255,255,0.45)' },
};
const CATS = Object.keys(CAT_CFG) as NoteCategory[];

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
};

// ═══════════════════════════════════════════════════════════
// CHECKLIST ITEM
// ═══════════════════════════════════════════════════════════
const CheckItem: React.FC<{
  item: ChecklistItem;
  onToggle: () => void;
  onChangeText: (text: string) => void;
  onDelete: () => void;
}> = ({ item, onToggle, onChangeText, onDelete }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
    <Pressable onPress={onToggle} style={{
      width: 22, height: 22, borderRadius: 6,
      backgroundColor: item.checked ? C.green + 'AA' : 'transparent',
      borderWidth: 1.5, borderColor: item.checked ? C.green : C.amberBrd,
      alignItems: 'center', justifyContent: 'center',
    }}>
      {item.checked && <Text style={{ fontSize: 12, color: '#fff' }}>✓</Text>}
    </Pressable>
    <TextInput
      value={item.text}
      onChangeText={onChangeText}
      style={{
        flex: 1, color: item.checked ? C.textMut : C.text,
        fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 22,
        textDecorationLine: item.checked ? 'line-through' : 'none',
        padding: 0,
      }}
      placeholder="Élément de la liste"
      placeholderTextColor={C.textMut}
    />
    <Pressable onPress={onDelete} hitSlop={8}>
      <Text style={{ fontSize: 14, color: C.textMut }}>✕</Text>
    </Pressable>
  </View>
);

// ═══════════════════════════════════════════════════════════
// MAIN EDITOR SCREEN
// ═══════════════════════════════════════════════════════════
type Nav = StackNavigationProp<MoreStackParamList, 'NoteEditor'>;
type RouteT = RouteProp<MoreStackParamList & { NoteEditor: { noteId?: string; category?: NoteCategory } }, 'NoteEditor'>;

export const NoteEditorScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const user       = useAuthStore(s => s.user);
  const members    = useAuthStore(s => s.members);
  const household  = useAuthStore(s => s.household);

  const noteId  = (route.params as any)?.noteId as string | undefined;
  const initCat = (route.params as any)?.category as NoteCategory | undefined;

  const [note,      setNote]      = useState<Note | null>(null);
  const [title,     setTitle]     = useState('');
  const [content,   setContent]   = useState('');
  const [category,  setCategory]  = useState<NoteCategory>(initCat ?? 'memo');
  const [isPinned,  setIsPinned]  = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [tags,      setTags]      = useState<string[]>([]);
  const [tagInput,  setTagInput]  = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showCatPicker, setShowCatPicker] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myMember  = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);
  const cat       = CAT_CFG[category] ?? CAT_CFG.autre;

  // ── Load note if editing ──
  useEffect(() => {
    if (!noteId) return;
    (async () => {
      const { data } = await supabase.from('notes').select('*').eq('id', noteId).single();
      if (!data) return;
      const n = data as Note;
      setNote(n);
      setTitle(n.title);
      setContent(n.content ?? '');
      setCategory(n.category);
      setIsPinned(n.is_pinned);
      setChecklist(n.checklist ?? []);
      setTags(n.tags ?? []);
    })();
  }, [noteId]);

  // ── Auto-save with debounce ──
  const scheduleAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      if (!title.trim()) { setSaveState('idle'); return; }
      if (noteId) {
        await supabase.from('notes').update({
          title: title.trim(),
          content: content || null,
          category,
          is_pinned: isPinned,
          checklist: category === 'liste' ? checklist : null,
          tags,
          last_edited_by: myMember?.id,
        }).eq('id', noteId);
      } else if (household?.id && myMember) {
        const { data } = await supabase.from('notes').insert({
          household_id: household.id,
          created_by: myMember.id,
          last_edited_by: myMember.id,
          title: title.trim(),
          content: content || null,
          category,
          is_pinned: isPinned,
          is_archived: false,
          checklist: category === 'liste' ? checklist : null,
          tags,
          attachments: [],
        }).select().single();
        if (data) {
          // Prevent re-creating on next save
          (route.params as any).noteId = (data as Note).id;
        }
      }
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    }, 1000);
  }, [noteId, title, content, category, isPinned, checklist, tags, household?.id, myMember, route.params]);

  useEffect(() => { if (title) scheduleAutoSave(); }, [title, content, category, isPinned, checklist, tags]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ── Delete ──
  const handleDelete = () => {
    Alert.alert('Supprimer', `Supprimer "${title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        if (noteId) await supabase.from('notes').delete().eq('id', noteId);
        navigation.goBack();
      }},
    ]);
  };

  // ── Checklist helpers ──
  const addCheckItem = () => {
    setChecklist(prev => [...prev, { id: Date.now().toString(), text: '', checked: false, order: prev.length }]);
  };
  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };
  const updateCheckText = (id: string, text: string) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, text } : i));
  };
  const removeCheckItem = (id: string) => {
    setChecklist(prev => prev.filter(i => i.id !== id));
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const saveIndicatorStyle = useAnimatedStyle(() => ({
    opacity: withTiming(saveState !== 'idle' ? 1 : 0, { duration: 300 }),
  }));

  const catColor = cat.color.startsWith('rgba') ? C.amber : cat.color;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── HEADER ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: C.border,
        }}>
          {/* Back */}
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{
            width: 36, height: 36, borderRadius: 11,
            backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 18, color: C.amber, marginLeft: -1 }}>‹</Text>
          </Pressable>

          {/* Category badge */}
          <Pressable onPress={() => setShowCatPicker(v => !v)} style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: catColor + '22',
            borderWidth: 1, borderColor: catColor + '55',
            borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: catColor }}>{cat.label}</Text>
            <Text style={{ fontSize: 10, color: C.textMut }}>▾</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Save indicator */}
            <Animated.View style={saveIndicatorStyle}>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: saveState === 'saved' ? C.green : C.textMut }}>
                {saveState === 'saving' ? 'Sauvegarde…' : '✓ Sauvegardé'}
              </Text>
            </Animated.View>

            {/* Actions menu */}
            <Pressable onPress={() => Alert.alert('', '', [
              { text: isPinned ? '📌 Désépingler' : '📌 Épingler', onPress: () => setIsPinned(v => !v) },
              ...(noteId ? [{ text: '🗑️ Supprimer', style: 'destructive' as const, onPress: handleDelete }] : []),
              { text: 'Annuler', style: 'cancel' as const },
            ])} style={{
              width: 32, height: 32, borderRadius: 9,
              backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 14, color: C.textSec }}>⋮</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Category picker dropdown */}
        {showCatPicker && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{
            position: 'absolute', top: 64, left: '50%', zIndex: 50,
            backgroundColor: C.bgMid, borderRadius: 16,
            borderWidth: 1, borderColor: C.amberBrd,
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.5, shadowRadius: 16, elevation: 20,
            padding: 8, minWidth: 180, transform: [{ translateX: -90 }],
          }}>
            {CATS.map(k => (
              <Pressable key={k} onPress={() => { setCategory(k); setShowCatPicker(false); }} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                padding: 10, borderRadius: 10,
                backgroundColor: category === k ? CAT_CFG[k].color + '22' : 'transparent',
              }}>
                <Text style={{ fontSize: 16 }}>{CAT_CFG[k].emoji}</Text>
                <Text style={{ fontSize: 13, fontFamily: category === k ? 'Nunito-Bold' : 'DMSans-Regular', color: category === k ? CAT_CFG[k].color : C.textSec }}>
                  {CAT_CFG[k].label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── TITLE ── */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titre de la note"
            placeholderTextColor="rgba(255,255,255,0.22)"
            multiline
            maxLength={100}
            style={{
              fontFamily: 'Nunito-Bold', fontSize: 28, color: C.text,
              letterSpacing: -0.5, paddingHorizontal: 20,
              paddingTop: 18, paddingBottom: 8,
            }}
          />

          {/* ── META ROW ── */}
          {note && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                Créée {timeAgo(note.created_at)}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(245,166,35,0.4)' }}>·</Text>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                Modifiée {timeAgo(note.updated_at)}
              </Text>
              {isPinned && (
                <>
                  <Text style={{ fontSize: 11, color: 'rgba(245,166,35,0.4)' }}>·</Text>
                  <Text style={{ fontSize: 10 }}>📌</Text>
                </>
              )}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 20, marginBottom: 16 }} />

          {/* ── CONTENT BY TYPE ── */}
          {category === 'liste' ? (
            <View style={{ paddingHorizontal: 20 }}>
              {checklist.map(item => (
                <CheckItem
                  key={item.id}
                  item={item}
                  onToggle={() => toggleCheck(item.id)}
                  onChangeText={text => updateCheckText(item.id, text)}
                  onDelete={() => removeCheckItem(item.id)}
                />
              ))}
              {checklist.length > 0 && (
                <View style={{ marginBottom: 12, paddingTop: 4 }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <View style={{
                      height: 4, borderRadius: 2, backgroundColor: C.green,
                      width: checklist.length > 0 ? `${(checklist.filter(i => i.checked).length / checklist.length) * 100}%` : '0%',
                    }} />
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 4 }}>
                    {checklist.filter(i => i.checked).length} / {checklist.length} cochés
                  </Text>
                </View>
              )}
              <Pressable onPress={addCheckItem} style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingVertical: 10, borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.04)',
                paddingHorizontal: 10,
              }}>
                <Text style={{ fontSize: 18, color: C.textMut }}>+</Text>
                <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut }}>Ajouter un élément</Text>
              </Pressable>
            </View>
          ) : category === 'code' ? (
            <View style={{
              marginHorizontal: 20, borderRadius: 14,
              backgroundColor: C.purple + '10', borderWidth: 1, borderColor: C.purple + '25',
              padding: 14, marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Text style={{ fontSize: 12 }}>🔒</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.purple, letterSpacing: 1 }}>CONTENU PROTÉGÉ</Text>
              </View>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Code, mot de passe, clé API…"
                placeholderTextColor={C.textMut}
                multiline
                style={{
                  color: C.text, fontFamily: 'DMSans-Regular', fontSize: 14,
                  lineHeight: 22, padding: 0,
                }}
              />
            </View>
          ) : (
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder={
                category === 'recette' ? 'Décris ta recette…\n\nIngrédients:\n- \n\nÉtapes:\n1. ' :
                category === 'contact' ? 'Nom, téléphone, email, adresse…' :
                category === 'idee' ? 'Développe ton idée ici…' :
                'Écris ta note ici…'
              }
              placeholderTextColor={C.textMut}
              multiline
              style={{
                color: C.text, fontFamily: 'DMSans-Regular', fontSize: 15,
                lineHeight: 24, paddingHorizontal: 20, marginBottom: 16,
                minHeight: 160,
              }}
            />
          )}

          {/* ── TAGS ── */}
          <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 20, marginVertical: 16 }} />
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>TAGS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {tags.map(t => (
                <Pressable key={t} onPress={() => setTags(prev => prev.filter(x => x !== t))} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: C.amberSoft, borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4,
                  borderWidth: 1, borderColor: C.amberBrd,
                }}>
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.amber }}>#{t}</Text>
                  <Text style={{ fontSize: 10, color: C.textMut }}>✕</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag}
                placeholder="ajouter-tag" placeholderTextColor={C.textMut} returnKeyType="done"
                style={{
                  flex: 1, backgroundColor: C.bgSurface, borderRadius: 12,
                  padding: 10, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 13,
                  borderWidth: 1, borderColor: C.border,
                }}
              />
              <Pressable onPress={addTag} style={{
                backgroundColor: C.amberSoft, borderRadius: 12,
                paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: C.amberBrd,
              }}>
                <Text style={{ color: C.amber, fontSize: 18 }}>+</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
