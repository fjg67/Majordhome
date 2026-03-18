import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  View, Text, ScrollView, SectionList, FlatList, Pressable,
  TextInput, Alert, StatusBar, Dimensions, Linking, Share,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence,
  Easing, interpolate,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  Canvas, Circle, Path, Skia, RoundedRect, BlurMask,
} from '@shopify/react-native-skia';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MoreStackParamList } from '@app/navigation/types';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import { notificationService } from '@services/notifications';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import type { HouseholdDocumentV2, DocCategory, FileType } from '@appTypes/index';

dayjs.locale('fr');
const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 44) / 2;
const SUPABASE_STORAGE_URL = 'https://yxqsgqbrzesmnpughynd.supabase.co/storage/v1';
const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024; // 500MB

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
  teal:      '#4ECDC4',
  purple:    '#A78BFA',
  coral:     '#FF6B6B',
  gold:      '#FFD700',
  warning:   '#FF8C00',
  danger:    '#FF4444',
};

// ═══════════════════════════════════════════════════════════
// CATEGORY & FILE TYPE CONFIG
// ═══════════════════════════════════════════════════════════
const CAT_CFG: Record<DocCategory, { label: string; emoji: string; color: string }> = {
  facture:    { label: 'Factures',   emoji: '🧾', color: '#F5A623' },
  contrat:    { label: 'Contrats',   emoji: '📋', color: '#4ECDC4' },
  quittance:  { label: 'Quittances', emoji: '🏠', color: '#34D399' },
  ordonnance: { label: 'Santé',      emoji: '💊', color: '#FF6B6B' },
  assurance:  { label: 'Assurances', emoji: '🛡️', color: '#A78BFA' },
  impot:      { label: 'Impôts',     emoji: '📊', color: '#FFD700' },
  photo:      { label: 'Photos',     emoji: '📷', color: '#FFA07A' },
  autre:      { label: 'Autre',      emoji: '📦', color: 'rgba(255,255,255,0.45)' },
};
const CATS = Object.keys(CAT_CFG) as DocCategory[];

const FILE_CFG: Record<FileType, { label: string; color: string }> = {
  pdf:   { label: 'PDF',  color: '#FF6B6B' },
  image: { label: 'IMG',  color: '#4ECDC4' },
  doc:   { label: 'DOC',  color: '#A78BFA' },
  other: { label: 'FILE', color: '#F5A623' },
};

const EMPTY_TEXTS: Record<DocCategory | 'all', string> = {
  all:        'Aucun document stocké',
  facture:    'Aucune facture',
  contrat:    'Aucun contrat',
  quittance:  'Aucune quittance',
  ordonnance: 'Aucun document santé',
  assurance:  'Aucune assurance',
  impot:      'Aucun document fiscal',
  photo:      'Aucune photo',
  autre:      'Aucun autre document',
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const formatSize = (bytes: number): string => {
  if (bytes < 1024)       return `${bytes} o`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} Mo`;
  return `${(bytes / 1073741824).toFixed(2)} Go`;
};

const getFileType = (mimeType: string | null): FileType => {
  if (!mimeType) return 'other';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return 'doc';
  return 'other';
};

const isExpiringSoon = (d: HouseholdDocumentV2): boolean => {
  if (!d.expiry_date) return false;
  const days = dayjs(d.expiry_date).diff(dayjs(), 'day');
  return days >= 0 && days <= 30;
};
const isExpired = (d: HouseholdDocumentV2): boolean => {
  if (!d.expiry_date) return false;
  return dayjs(d.expiry_date).isBefore(dayjs(), 'day');
};
const daysUntilExpiry = (d: HouseholdDocumentV2): number => {
  if (!d.expiry_date) return 9999;
  return dayjs(d.expiry_date).diff(dayjs(), 'day');
};
const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `Il y a ${d}j`;
  return dayjs(iso).format('D MMM');
};

const getMemberName = (id: string, members: { user_id?: string; id?: string; display_name: string }[]): string => {
  const m = members.find(x => x.user_id === id || x.id === id);
  return m ? m.display_name.split(' ')[0] : 'Toi';
};
const getMemberColor = (id: string, members: { user_id?: string; id?: string; color?: string }[]): string => {
  const m = members.find(x => x.user_id === id || x.id === id);
  return m?.color ?? C.amber;
};

const getAuthUrl = async (fileUrl: string, bucket: string): Promise<{ uri: string; headers: Record<string, string> }> => {
  const { data: s } = await supabase.auth.getSession();
  const token = s?.session?.access_token;
  const match = fileUrl.match(new RegExp(`/storage/v1/object/(?:public|authenticated)/${bucket}/(.+?)(?:\\?|$)`));
  const path = match ? match[1] : null;
  if (token && path) {
    return {
      uri: `${SUPABASE_STORAGE_URL}/object/authenticated/${bucket}/${path}`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }
  return { uri: fileUrl, headers: {} };
};

// ═══════════════════════════════════════════════════════════
// SKIA EMPTY STATE
// ═══════════════════════════════════════════════════════════
const DocEmptyState: React.FC<{ category: DocCategory | 'all'; onAdd: () => void }> = ({ category, onAdd }) => {
  const pulse = useSharedValue(1);
  const orb1  = useSharedValue(0);
  const orb2  = useSharedValue(0);
  const orb3  = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(
      withTiming(1.2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      withTiming(1,   { duration: 1200 }),
    ), -1, false);
    orb1.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
    orb2.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.linear }), -1, false);
    orb3.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false);
  }, [pulse, orb1, orb2, orb3]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const orb1Style  = useAnimatedStyle(() => ({ transform: [{ rotate: `${orb1.value * 360}deg` }] }));

  const S = 220;
  const cx = S / 2, cy = S / 2 - 5;

  const folderBody = Skia.Path.Make();
  folderBody.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 56, cy - 44, 112, 80), 12, 12));

  const folderTab = Skia.Path.Make();
  folderTab.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 56, cy - 56, 44, 16), 6, 6));

  const doc1 = Skia.Path.Make();
  doc1.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 34, cy - 32, 44, 56), 5, 5));
  const doc2 = Skia.Path.Make();
  doc2.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 14, cy - 36, 44, 56), 5, 5));
  const doc3 = Skia.Path.Make();
  doc3.addRRect(Skia.RRectXY(Skia.XYWHRect(cx + 6, cy - 30, 44, 56), 5, 5));

  const shadowPath = Skia.Path.Make();
  shadowPath.addOval(Skia.XYWHRect(cx - 40, cy + 38, 80, 14));

  return (
    <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 20 }}>
      <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        {/* Orbit dots */}
        <Animated.View style={[{ position: 'absolute', width: S * 0.85, height: S * 0.85 }, orb1Style]}>
          <View style={{ position: 'absolute', top: 0, left: '50%', width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber, opacity: 0.45, marginLeft: -3 }} />
          <View style={{ position: 'absolute', bottom: 10, left: '22%', width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal, opacity: 0.35 }} />
          <View style={{ position: 'absolute', top: '25%', right: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, opacity: 0.3 }} />
        </Animated.View>

        {/* Sparkles */}
        <Animated.Text style={[{ position: 'absolute', top: 16, right: 36, fontSize: 12 }, pulseStyle]}>✦</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', top: 28, left: 28, fontSize: 10, color: C.teal }]}>✦</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', bottom: 38, right: 26, fontSize: 9, color: C.green }]}>✦</Animated.Text>

        <Canvas style={{ width: S, height: S }}>
          {/* Ambient glow */}
          <Circle cx={cx} cy={cy} r={90} color="rgba(245,166,35,0.04)" />

          {/* Shadow */}
          <Path path={shadowPath} color="rgba(0,0,0,0.25)">
            <BlurMask blur={8} style="normal" />
          </Path>

          {/* Ghost documents (fan) */}
          <Path path={doc1} color="rgba(255,255,255,0.04)" />
          <Path path={doc1} color="rgba(255,255,255,0.08)" style="stroke" strokeWidth={1} />
          <Path path={doc2} color="rgba(255,255,255,0.04)" />
          <Path path={doc2} color="rgba(255,255,255,0.10)" style="stroke" strokeWidth={1} />
          <Path path={doc3} color="rgba(245,166,35,0.06)" />
          <Path path={doc3} color="rgba(245,166,35,0.18)" style="stroke" strokeWidth={1} />

          {/* Folder body */}
          <Path path={folderBody} color="rgba(58,34,0,0.55)" />
          <Path path={folderBody} color="rgba(245,166,35,0.30)" style="stroke" strokeWidth={1.8} />

          {/* Folder tab */}
          <Path path={folderTab} color="rgba(245,166,35,0.22)" />
          <Path path={folderTab} color="rgba(245,166,35,0.40)" style="stroke" strokeWidth={1.5} />
        </Canvas>

        {/* Plus button overlay */}
        <Animated.View style={[{ position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(245,166,35,0.40)' }, pulseStyle]}>
          <Text style={{ fontSize: 22, color: 'rgba(245,166,35,0.40)', lineHeight: 26 }}>+</Text>
        </Animated.View>
      </View>

      <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, textAlign: 'center', marginBottom: 8 }}>
        {EMPTY_TEXTS[category]}
      </Text>
      <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 36 }}>
        Stockez vos factures, contrats{'\n'}et quittances en sécurité
      </Text>
      <Pressable onPress={onAdd} style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd,
        borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13,
      }}>
        <Text style={{ fontSize: 16, color: C.amber }}>↑</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>Ajouter un document</Text>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// DOCUMENT CARD (grid)
// ═══════════════════════════════════════════════════════════
interface DocCardProps {
  doc: HouseholdDocumentV2;
  onPress: (doc: HouseholdDocumentV2) => void;
  onLongPress: (doc: HouseholdDocumentV2) => void;
  memberName: string;
  memberColor: string;
  index: number;
}

const DocumentCard: React.FC<DocCardProps> = ({ doc, onPress, onLongPress, memberName, memberColor, index }) => {
  const cat     = CAT_CFG[doc.category] ?? CAT_CFG.autre;
  const ft      = FILE_CFG[doc.file_type];
  const catColor = cat.color.startsWith('rgba') ? C.amber : cat.color;
  const expiring = isExpiringSoon(doc);
  const expired  = isExpired(doc);
  const daysLeft = daysUntilExpiry(doc);
  const scale    = useSharedValue(1);
  const as       = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const borderPulse = useSharedValue(0.20);
  useEffect(() => {
    if (expiring && daysLeft < 7) {
      borderPulse.value = withRepeat(withSequence(
        withTiming(0.55, { duration: 900 }), withTiming(0.20, { duration: 900 }),
      ), -1, false);
    }
  }, [expiring, daysLeft, borderPulse]);
  const borderStyle = useAnimatedStyle(() => ({ borderColor: `rgba(255,140,0,${borderPulse.value})` }));

  return (
    <Animated.View entering={FadeInUp.duration(350).delay(index * 55).springify()} style={[as, { width: CARD_W, marginBottom: 10 }]}>
      <Pressable
        onPress={() => onPress(doc)}
        onLongPress={() => onLongPress(doc)}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        style={[{
          backgroundColor: C.bgSurface, borderRadius: 20, overflow: 'hidden',
          borderWidth: 1.5, height: 180,
          shadowColor: expiring ? C.warning : catColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: expiring ? 0.30 : 0.15,
          shadowRadius: 12, elevation: 5,
        }, expiring && daysLeft < 7 ? borderStyle : { borderColor: `${catColor}28` }]}
      >
        {/* File type bar top */}
        <LinearGradient
          colors={[ft.color, ft.color + '44']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 3 }}
        />

        {/* Top highlight */}
        <LinearGradient
          colors={['transparent', `${catColor}35`, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 1 }}
        />

        {/* Preview zone (60%) */}
        <View style={{
          height: 108, backgroundColor: doc.file_type === 'pdf' ? 'rgba(255,107,107,0.06)' : `${catColor}0D`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {/* File type icon */}
          {doc.file_type === 'pdf' ? (
            <View style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: 'rgba(255,107,107,0.15)', borderWidth: 1.5, borderColor: '#FF6B6B55', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>📄</Text>
              </View>
              <View style={{ backgroundColor: '#FF6B6B22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: '#FF6B6B', letterSpacing: 1 }}>PDF</Text>
              </View>
            </View>
          ) : doc.file_type === 'image' ? (
            <View style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: 'rgba(78,205,196,0.15)', borderWidth: 1.5, borderColor: '#4ECDC455', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🖼️</Text>
              </View>
            </View>
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: `${catColor}20`, borderWidth: 1.5, borderColor: `${catColor}40`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>{cat.emoji}</Text>
            </View>
          )}

          {/* Important badge */}
          {doc.is_important && (
            <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 6, padding: 3 }}>
              <Text style={{ fontSize: 12 }}>⭐</Text>
            </View>
          )}

          {/* Expiry badge */}
          {(expired || expiring) && (
            <View style={{
              position: 'absolute', top: 8, right: 8,
              backgroundColor: expired ? 'rgba(255,68,68,0.20)' : 'rgba(255,140,0,0.20)',
              borderRadius: 7, paddingHorizontal: 5, paddingVertical: 2,
            }}>
              <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: expired ? C.danger : C.warning }}>
                {expired ? 'Expiré' : `⚠️ ${daysLeft}j`}
              </Text>
            </View>
          )}
        </View>

        {/* Footer (40%) */}
        <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <View style={{ backgroundColor: `${catColor}18`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: catColor }}>{cat.emoji} {cat.label}</Text>
            </View>
            <View style={{ backgroundColor: `${ft.color}18`, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 'auto' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Nunito-Bold', color: ft.color }}>{ft.label}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 4 }} numberOfLines={1}>{doc.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>{formatSize(doc.file_size)}</Text>
            <Text style={{ fontSize: 9, color: C.textMut, marginHorizontal: 4 }}>·</Text>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: memberColor, marginRight: 3 }} />
            <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut, flex: 1 }} numberOfLines={1}>{memberName}</Text>
            <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>{timeAgo(doc.created_at)}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// DOCUMENT LIST ITEM
// ═══════════════════════════════════════════════════════════
const DocumentListItem: React.FC<DocCardProps> = ({ doc, onPress, onLongPress, memberName, memberColor, index }) => {
  const cat     = CAT_CFG[doc.category] ?? CAT_CFG.autre;
  const ft      = FILE_CFG[doc.file_type];
  const catColor = cat.color.startsWith('rgba') ? C.amber : cat.color;
  const expiring = isExpiringSoon(doc);
  const expired  = isExpired(doc);
  const daysLeft = daysUntilExpiry(doc);

  return (
    <Animated.View entering={FadeInUp.duration(320).delay(index * 45)}>
      <Pressable
        onPress={() => onPress(doc)}
        onLongPress={() => onLongPress(doc)}
        style={{
          flexDirection: 'row', backgroundColor: C.bgSurface,
          borderRadius: 16, borderWidth: 1, borderColor: `${catColor}22`,
          marginHorizontal: 16, marginBottom: 8, overflow: 'hidden',
          shadowColor: catColor, shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
        }}
      >
        {/* Left accent */}
        <View style={{ width: 4, backgroundColor: catColor }} />

        {/* File icon */}
        <View style={{ width: 54, backgroundColor: `${ft.color}10`, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>
            {doc.file_type === 'pdf' ? '📄' : doc.file_type === 'image' ? '🖼️' : cat.emoji}
          </Text>
          <Text style={{ fontSize: 7, fontFamily: 'Nunito-Bold', color: ft.color, marginTop: 2 }}>{ft.label}</Text>
        </View>

        <View style={{ flex: 1, padding: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={1}>{doc.title}</Text>
            {doc.is_important && <Text style={{ fontSize: 12, marginLeft: 4 }}>⭐</Text>}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 5 }}>
            <View style={{ backgroundColor: `${catColor}18`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: catColor }}>{cat.emoji} {cat.label}</Text>
            </View>
            <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>{formatSize(doc.file_size)}</Text>
            {(expired || expiring) && (
              <View style={{ backgroundColor: expired ? 'rgba(255,68,68,0.15)' : 'rgba(255,140,0,0.15)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: expired ? C.danger : C.warning }}>
                  {expired ? 'Expiré' : `⚠️ ${daysLeft}j`}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: memberColor, marginRight: 4 }} />
            <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>{memberName}</Text>
            <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginLeft: 'auto' }}>
              {doc.document_date ? dayjs(doc.document_date).format('D MMM YYYY') : timeAgo(doc.created_at)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// IMPORTANT SECTION (horizontal scroll)
// ═══════════════════════════════════════════════════════════
const ImportantSection: React.FC<{ docs: HouseholdDocumentV2[]; onPress: (d: HouseholdDocumentV2) => void }> = ({ docs, onPress }) => {
  if (docs.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10, marginTop: 4 }}>
        <Text style={{ fontSize: 12 }}>⭐</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.gold, letterSpacing: 2, textTransform: 'uppercase' }}>Importants</Text>
        <LinearGradient colors={['rgba(255,215,0,0.35)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      </View>
      <FlatList
        horizontal
        data={docs}
        keyExtractor={d => d.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingRight: 8 }}
        renderItem={({ item }) => {
          const cat = CAT_CFG[item.category] ?? CAT_CFG.autre;
          const catColor = cat.color.startsWith('rgba') ? C.amber : cat.color;
          return (
            <Pressable onPress={() => onPress(item)} style={{
              width: 140, height: 100, backgroundColor: C.bgSurface, borderRadius: 16,
              borderWidth: 1.5, borderColor: `${catColor}35`, overflow: 'hidden',
              shadowColor: catColor, shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
            }}>
              <LinearGradient colors={[C.gold, C.gold + '55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3 }} />
              <View style={{ flex: 1, padding: 10, justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={2}>{item.title}</Text>
                <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>{formatSize(item.file_size)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
      <View style={{ height: 14 }} />
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// EXPIRING SOON SECTION
// ═══════════════════════════════════════════════════════════
const ExpiringSoonSection: React.FC<{ docs: HouseholdDocumentV2[]; onPress: (d: HouseholdDocumentV2) => void }> = ({ docs, onPress }) => {
  if (docs.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(60)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ fontSize: 12 }}>⚠️</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.warning, letterSpacing: 2, textTransform: 'uppercase' }}>Expirent bientôt</Text>
        <View style={{ backgroundColor: C.warning + '20', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: C.warning }}>{docs.length}</Text>
        </View>
        <LinearGradient colors={['rgba(255,140,0,0.35)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      </View>
      <FlatList
        horizontal
        data={docs}
        keyExtractor={d => d.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingRight: 8 }}
        renderItem={({ item }) => {
          const daysLeft = daysUntilExpiry(item);
          const urgent = daysLeft < 7;
          const cat = CAT_CFG[item.category] ?? CAT_CFG.autre;
          return (
            <Pressable onPress={() => onPress(item)} style={{
              width: 150, backgroundColor: C.bgSurface, borderRadius: 14,
              borderWidth: 1.5, borderColor: urgent ? C.danger + '55' : C.warning + '40',
              padding: 11, overflow: 'hidden',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                <View style={{ backgroundColor: urgent ? C.danger + '20' : C.warning + '20', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: urgent ? C.danger : C.warning }}>{daysLeft}j</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 2 }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                Expire le {dayjs(item.expiry_date!).format('D MMM YYYY')}
              </Text>
            </Pressable>
          );
        }}
      />
      <View style={{ height: 14 }} />
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// ADD DOCUMENT MODAL
// ═══════════════════════════════════════════════════════════
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string; category: DocCategory; description: string;
    tags: string[]; isImportant: boolean; documentDate: string | null; expiryDate: string | null;
    fileUri: string; fileName: string; mimeType: string;
  }) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
}

const AddDocumentModal: React.FC<AddModalProps> = ({ visible, onClose, onSave, isUploading, uploadProgress }) => {
  const [title,        setTitle]        = useState('');
  const [category,     setCategory]     = useState<DocCategory>('autre');
  const [description,  setDescription]  = useState('');
  const [tagInput,     setTagInput]      = useState('');
  const [tags,         setTags]          = useState<string[]>([]);
  const [isImportant,  setIsImportant]   = useState(false);
  const [expiryDate,   setExpiryDate]    = useState('');
  const [fileUri,      setFileUri]       = useState('');
  const [fileName,     setFileName]      = useState('');
  const [mimeType,     setMimeType]      = useState('');
  const [hasFile,      setHasFile]       = useState(false);

  const reset = () => {
    setTitle(''); setCategory('autre'); setDescription('');
    setTags([]); setTagInput(''); setIsImportant(false);
    setExpiryDate(''); setFileUri(''); setFileName('');
    setMimeType(''); setHasFile(false);
  };

  const pickFromGallery = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, includeBase64: false });
    if (res.assets?.[0]) {
      const asset = res.assets[0];
      setFileUri(asset.uri ?? '');
      setFileName(asset.fileName ?? 'image.jpg');
      setMimeType(asset.type ?? 'image/jpeg');
      if (!title) setTitle(asset.fileName?.replace(/\.[^.]+$/, '') ?? '');
      setHasFile(true);
    }
  };

  const pickFromCamera = async () => {
    const res = await launchCamera({ mediaType: 'photo', quality: 0.85 });
    if (res.assets?.[0]) {
      const asset = res.assets[0];
      setFileUri(asset.uri ?? '');
      setFileName(asset.fileName ?? 'photo.jpg');
      setMimeType(asset.type ?? 'image/jpeg');
      if (!title) setTitle('Photo ' + dayjs().format('D MMM YYYY'));
      setHasFile(true);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('', 'Ajoute un titre.'); return; }
    if (!hasFile)       { Alert.alert('', 'Sélectionne un fichier.'); return; }
    await onSave({
      title: title.trim(), category, description, tags, isImportant,
      documentDate: null,
      expiryDate: expiryDate || null,
      fileUri, fileName, mimeType,
    });
    reset(); onClose();
  };

  if (!visible) return null;

  return (
    <Pressable onPress={() => { if (!isUploading) { onClose(); reset(); } }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', zIndex: 100 }}>
      <Pressable onPress={e => e.stopPropagation()} style={{
        backgroundColor: C.bgMid, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: '90%', borderTopWidth: 1, borderTopColor: C.amberBrd,
      }}>
        <LinearGradient colors={['rgba(245,166,35,0.22)', 'transparent']} style={{ height: 2, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} />

        {/* Upload progress bar */}
        {isUploading && (
          <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <Animated.View style={{ height: 3, backgroundColor: C.amber, width: `${uploadProgress}%` }} />
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 18 }} />
          <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 18 }}>Nouveau document</Text>

          {/* File picker buttons */}
          {!hasFile ? (
            <View style={{ gap: 10, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1 }}>SÉLECTIONNER UN FICHIER</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={pickFromCamera} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, borderRadius: 14, backgroundColor: C.bgSurface, borderWidth: 1, borderColor: C.border }}>
                  <Text style={{ fontSize: 16 }}>📸</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec }}>Caméra</Text>
                </Pressable>
                <Pressable onPress={pickFromGallery} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, borderRadius: 14, backgroundColor: C.bgSurface, borderWidth: 1, borderColor: C.border }}>
                  <Text style={{ fontSize: 16 }}>🖼️</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec }}>Galerie</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ backgroundColor: C.bgSurface, borderRadius: 14, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.green + '40' }}>
              <Text style={{ fontSize: 22 }}>{mimeType.startsWith('image') ? '🖼️' : '📄'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={1}>{fileName}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>Prêt à uploader</Text>
              </View>
              <Pressable onPress={() => { setHasFile(false); setFileUri(''); }}>
                <Text style={{ fontSize: 14, color: C.textMut }}>✕</Text>
              </Pressable>
            </View>
          )}

          {/* Title */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>TITRE</Text>
          <TextInput value={title} onChangeText={setTitle}
            placeholder="Ex: Facture EDF Mars 2026" placeholderTextColor={C.textMut}
            style={{ backgroundColor: C.bgSurface, borderRadius: 14, padding: 14, color: C.text, fontFamily: 'Nunito-Bold', fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 18 }} />

          {/* Category grid */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>CATÉGORIE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {CATS.map(k => {
              const sel = category === k;
              const cfg = CAT_CFG[k];
              const col = cfg.color.startsWith('rgba') ? C.amber : cfg.color;
              return (
                <Pressable key={k} onPress={() => setCategory(k)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12,
                  backgroundColor: sel ? col + '22' : C.bgElev,
                  borderWidth: 1.5, borderColor: sel ? col : 'rgba(245,166,35,0.12)',
                }}>
                  <Text style={{ fontSize: 13 }}>{cfg.emoji}</Text>
                  <Text style={{ fontSize: 11, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular', color: sel ? col : C.textSec }}>
                    {cfg.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Expiry date */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>DATE D'EXPIRATION (optionnel)</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
            {[['Dans 1 an', dayjs().add(1, 'year').format('YYYY-MM-DD')],
              ['Dans 2 ans', dayjs().add(2, 'year').format('YYYY-MM-DD')]].map(([lbl, val]) => (
              <Pressable key={lbl} onPress={() => setExpiryDate(expiryDate === val ? '' : val)} style={{
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                backgroundColor: expiryDate === val ? C.amberSoft : C.bgElev,
                borderWidth: 1.5, borderColor: expiryDate === val ? C.amber : C.border,
              }}>
                <Text style={{ fontSize: 11, fontFamily: expiryDate === val ? 'Nunito-Bold' : 'DMSans-Regular', color: expiryDate === val ? C.amber : C.textSec }}>{lbl}</Text>
              </Pressable>
            ))}
            <TextInput value={expiryDate.startsWith('20') ? expiryDate : ''} onChangeText={setExpiryDate}
              placeholder="AAAA-MM-JJ" placeholderTextColor={C.textMut}
              style={{ flex: 1, backgroundColor: C.bgSurface, borderRadius: 12, paddingHorizontal: 10, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 12, borderWidth: 1, borderColor: C.border }} />
          </View>

          {/* Description */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>DESCRIPTION (optionnel)</Text>
          <TextInput value={description} onChangeText={setDescription}
            placeholder="Montant, fournisseur, remarques..." placeholderTextColor={C.textMut} multiline
            style={{ backgroundColor: C.bgSurface, borderRadius: 14, padding: 14, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 14, borderWidth: 1, borderColor: C.border, minHeight: 70, marginBottom: 18 }} />

          {/* Important toggle */}
          <Pressable onPress={() => setIsImportant(v => !v)} style={{
            flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
            backgroundColor: isImportant ? 'rgba(255,215,0,0.10)' : C.bgSurface,
            borderWidth: 1, borderColor: isImportant ? C.gold + '55' : C.border, marginBottom: 24,
          }}>
            <Text style={{ fontSize: 18 }}>{isImportant ? '⭐' : '☆'}</Text>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: isImportant ? C.gold : C.textSec }}>Marquer comme important</Text>
          </Pressable>

          {/* Submit */}
          <Pressable onPress={handleSave} disabled={isUploading} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 8, opacity: isUploading ? 0.7 : 1 }}>
            <LinearGradient colors={['#F5A623', '#E8920A']} style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}>
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>
                {isUploading ? `Upload… ${Math.round(uploadProgress)}%` : 'Enregistrer le document'}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => { if (!isUploading) { onClose(); reset(); } }} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut }}>Annuler</Text>
          </Pressable>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};

// ═══════════════════════════════════════════════════════════
// SPEED DIAL FAB
// ═══════════════════════════════════════════════════════════
const SpeedDialFAB: React.FC<{
  onCamera: () => void;
  onGallery: () => void;
}> = ({ onCamera, onGallery }) => {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);
  const items    = useSharedValue(0);
  const fabPulse = useSharedValue(0);

  useEffect(() => {
    fabPulse.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [fabPulse]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 1 : 0, { damping: 12 });
    items.value    = withSpring(next ? 1 : 0, { damping: 14 });
  };

  const rotStyle  = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 45])}deg` }] }));
  const fabGlow   = useAnimatedStyle(() => ({
    shadowOpacity: 0.4 + fabPulse.value * 0.3,
    shadowRadius:  12   + fabPulse.value * 8,
  }));

  const DIAL_ITEMS = [
    { label: 'Prendre une photo', icon: '📸', onPress: onCamera },
    { label: 'Depuis la galerie', icon: '🖼️', onPress: onGallery },
  ];

  return (
    <>
      {open && (
        <Pressable onPress={toggle} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 98 }} />
      )}

      <View style={{ position: 'absolute', bottom: 90, right: 16, zIndex: 99, alignItems: 'flex-end' }}>
        {DIAL_ITEMS.map((item, i) => {
          const itemAnim = useAnimatedStyle(() => ({
            transform: [
              { translateY: interpolate(items.value, [0, 1], [0, -(i + 1) * 62]) },
              { scale: items.value },
            ],
            opacity: items.value,
          }));
          return (
            <Animated.View key={item.label} style={[{ position: 'absolute', right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, itemAnim]}>
              <View style={{ backgroundColor: 'rgba(26,14,0,0.92)', borderWidth: 1, borderColor: C.amberBrd, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.text }}>{item.label}</Text>
              </View>
              <Pressable onPress={() => { toggle(); item.onPress(); }} style={{
                width: 46, height: 46, borderRadius: 14,
                backgroundColor: C.amberSoft, borderWidth: 1.5, borderColor: C.amber,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 5,
              }}>
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <Animated.View style={[fabGlow, { shadowColor: C.amber, shadowOffset: { width: 0, height: 6 }, elevation: 12, borderRadius: 18 }]}>
          <Pressable onPress={toggle} style={{ width: 58, height: 58, borderRadius: 18, overflow: 'hidden' }}>
            <LinearGradient colors={['#F5A623', '#E8920A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.Text style={[{ fontSize: 26, color: '#1A0E00', lineHeight: 30 }, rotStyle]}>↑</Animated.Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const DocumentsScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [docs,        setDocs]        = useState<HouseholdDocumentV2[]>([]);
  const [catFilter,   setCatFilter]   = useState<DocCategory | 'all'>('all');
  const [searchText,  setSearchText]  = useState('');
  const [viewMode,    setViewMode]    = useState<'grid' | 'list'>('grid');
  const [showModal,   setShowModal]   = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [totalSize,   setTotalSize]   = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const searchRef = useRef<TextInput>(null);
  const searchFocused = useSharedValue(0);
  const storageBarW   = useSharedValue(0);

  const myMember = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);

  // ── Load ──
  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('documents').select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });
    const d = (data ?? []) as HouseholdDocumentV2[];
    setDocs(d);
    const sz = d.reduce((s, x) => s + (x.file_size ?? 0), 0);
    setTotalSize(sz);
    setExpiringSoonCount(d.filter(isExpiringSoon).length);
    storageBarW.value = withTiming((sz / STORAGE_QUOTA_BYTES) * 100, { duration: 900 });
  }, [household?.id, storageBarW]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!household?.id) return;
    const sub = supabase.channel(`docs-${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `household_id=eq.${household.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [household?.id, load]);

  // ── Derived ──
  const filteredDocs = useMemo(() => {
    let list = docs;
    if (catFilter !== 'all') list = list.filter(d => d.category === catFilter);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [docs, catFilter, searchText]);

  const importantDocs  = useMemo(() => filteredDocs.filter(d => d.is_important), [filteredDocs]);
  const expiringDocs   = useMemo(() => filteredDocs.filter(d => isExpiringSoon(d) || isExpired(d)), [filteredDocs]);
  const regularDocs    = useMemo(() => filteredDocs.filter(d => !d.is_important), [filteredDocs]);

  const catCounts = useMemo(() => {
    const map: Record<string, number> = { all: docs.length };
    CATS.forEach(k => { map[k] = docs.filter(d => d.category === k).length; });
    return map;
  }, [docs]);

  // Group by month for list view
  const sections = useMemo(() => {
    const map = new Map<string, HouseholdDocumentV2[]>();
    regularDocs.forEach(d => {
      const key = dayjs(d.created_at).format('MMMM YYYY');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries()).map(([title, data]) => ({
      title: `${title} · ${data.length} doc${data.length > 1 ? 's' : ''}`,
      data,
    }));
  }, [regularDocs]);

  // ── Upload ──
  const handleUpload = useCallback(async (data: {
    title: string; category: DocCategory; description: string;
    tags: string[]; isImportant: boolean; documentDate: string | null;
    expiryDate: string | null; fileUri: string; fileName: string; mimeType: string;
  }) => {
    if (!household?.id || !myMember) return;
    if (totalSize >= STORAGE_QUOTA_BYTES) {
      Alert.alert('Quota dépassé', 'Vous avez atteint la limite de 500 Mo. Supprimez des documents pour libérer de l\'espace.');
      return;
    }
    setIsUploading(true); setUploadPct(10);
    try {
      const fileData = await fetch(data.fileUri).then(r => r.blob());
      setUploadPct(30);

      const ext  = data.fileName.split('.').pop() ?? 'jpg';
      const path = `${household.id}/${Date.now()}.${ext}`;
      const ft   = getFileType(data.mimeType);

      const { error: uploadErr } = await supabase.storage.from('household-documents').upload(path, fileData, { contentType: data.mimeType });
      if (uploadErr) { Alert.alert('Erreur upload', uploadErr.message); return; }
      setUploadPct(70);

      const { data: { publicUrl } } = supabase.storage.from('household-documents').getPublicUrl(path);

      await supabase.from('documents').insert({
        household_id: household.id,
        uploaded_by:  myMember.id ?? myMember.user_id,
        title:        data.title,
        file_url:     publicUrl,
        file_type:    ft,
        file_size:    fileData.size,
        file_name:    data.fileName,
        mime_type:    data.mimeType,
        category:     data.category,
        description:  data.description || null,
        tags:         data.tags,
        is_important: data.isImportant,
        is_shared:    true,
        document_date: data.documentDate,
        expiry_date:   data.expiryDate,
      });
      setUploadPct(100);
      load();

      notificationService.displayNotification({
        type: 'DOC_UPLOADED' as any,
        householdId: household.id,
        triggeredByName: myMember.display_name,
        data: { title: data.title, category: data.category, size: formatSize(fileData.size) },
      }).catch(() => {});
    } catch (e: unknown) {
      Alert.alert('Erreur', String(e));
    } finally {
      setIsUploading(false); setUploadPct(0);
    }
  }, [household?.id, myMember, totalSize, load]);

  const handleDelete = useCallback((doc: HouseholdDocumentV2) => {
    Alert.alert('Supprimer', `Supprimer "${doc.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('documents').delete().eq('id', doc.id);
        load();
      }},
    ]);
  }, [load]);

  const toggleImportant = useCallback(async (doc: HouseholdDocumentV2) => {
    await supabase.from('documents').update({ is_important: !doc.is_important }).eq('id', doc.id);
    load();
  }, [load]);

  const openDoc = useCallback(async (doc: HouseholdDocumentV2) => {
    try {
      const { uri } = await getAuthUrl(doc.file_url, 'household-documents');
      await Linking.openURL(uri);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le document.');
    }
  }, []);

  const handleLongPress = useCallback((doc: HouseholdDocumentV2) => {
    Alert.alert(doc.title, '', [
      { text: '👁️ Ouvrir',                    onPress: () => openDoc(doc) },
      { text: doc.is_important ? '☆ Retirer important' : '⭐ Marquer important', onPress: () => toggleImportant(doc) },
      { text: '🔗 Partager',                  onPress: () => Share.share({ url: doc.file_url, title: doc.title }) },
      { text: '🗑️ Supprimer', style: 'destructive', onPress: () => handleDelete(doc) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [openDoc, toggleImportant, handleDelete]);

  // ── Storage bar animation style ──
  const storageBarAnim = useAnimatedStyle(() => ({
    width: `${Math.min(storageBarW.value, 100)}%`,
  }));

  const usedPct  = (totalSize / STORAGE_QUOTA_BYTES) * 100;
  const barColors: [string, string] = usedPct > 85 ? ['#FF8C00', '#FF4444'] : usedPct > 60 ? ['#F5A623', '#FF8C00'] : ['#34D399', '#F5A623'];
  const sizeColor = usedPct > 85 ? C.danger : usedPct > 60 ? C.warning : C.green;

  const searchAnimStyle = useAnimatedStyle(() => ({
    borderColor: searchFocused.value === 1 ? 'rgba(245,166,35,0.45)' : 'rgba(255,255,255,0.10)',
  }));

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(245,166,35,0.04)' }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* ══ HEADER ══ */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={['rgba(245,166,35,0.09)', 'rgba(245,166,35,0.02)', 'transparent']}
            style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 0 }}>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 28 }}>📁</Text>
                <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>Documents</Text>
              </View>
              {/* View toggle */}
              <View style={{ flexDirection: 'row', gap: 2, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.amberBrd }}>
                {(['grid', 'list'] as const).map(mode => (
                  <Pressable key={mode} onPress={() => setViewMode(mode)} style={{
                    width: 34, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: viewMode === mode ? C.amber : 'transparent',
                  }}>
                    <Text style={{ fontSize: 14, color: viewMode === mode ? '#1A0E00' : C.textMut }}>
                      {mode === 'grid' ? '⊞' : '≡'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Counter + expiry warning */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSec }}>
                {docs.length} document{docs.length !== 1 ? 's' : ''} stocké{docs.length !== 1 ? 's' : ''}
              </Text>
              {expiringSoonCount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,140,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.30)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10 }}>⚠️</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.warning }}>{expiringSoonCount} expirent bientôt</Text>
                </View>
              )}
            </View>

            {/* Storage card */}
            <View style={{ backgroundColor: C.bgSurface, borderRadius: 20, borderWidth: 1, borderColor: C.amberBrd, padding: 16, marginBottom: 14, overflow: 'hidden' }}>
              <LinearGradient colors={['transparent', 'rgba(245,166,35,0.28)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec }}>Stockage du foyer</Text>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: sizeColor }}>
                  {formatSize(totalSize)} / 500 Mo
                </Text>
              </View>
              {/* Storage bar */}
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 10 }}>
                <Animated.View style={[storageBarAnim, { height: 6, borderRadius: 3 }]}>
                  <LinearGradient colors={barColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 3 }} />
                </Animated.View>
              </View>
              {/* Breakdown by category */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATS.filter(k => catCounts[k] > 0).slice(0, 4).map(k => {
                  const cfg = CAT_CFG[k];
                  const col = cfg.color.startsWith('rgba') ? C.amber : cfg.color;
                  return (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
                      <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                        {cfg.label} ({catCounts[k]})
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ══ SEARCH BAR ══ */}
        <Animated.View entering={FadeIn.duration(400).delay(80)} style={{ paddingHorizontal: 16, marginBottom: 14 }}>
          <Animated.View style={[{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 18, borderWidth: 1,
            paddingHorizontal: 14, paddingVertical: 11, gap: 10,
          }, searchAnimStyle]}>
            <Text style={{ fontSize: 16, color: 'rgba(245,166,35,0.55)' }}>🔍</Text>
            <TextInput
              ref={searchRef}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => { searchFocused.value = withSpring(1); }}
              onBlur={() => { searchFocused.value = withSpring(0); }}
              placeholder="Rechercher un document…"
              placeholderTextColor="rgba(255,255,255,0.22)"
              style={{ flex: 1, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 15, padding: 0 }}
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText('')} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, color: C.text }}>✕</Text>
              </Pressable>
            )}
          </Animated.View>
        </Animated.View>

        {/* ══ CATEGORY TABS ══ */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
            {(['all', ...CATS] as (DocCategory | 'all')[]).map(cat => {
              const active = catFilter === cat;
              const cfg    = cat === 'all' ? null : CAT_CFG[cat];
              const color  = cfg ? (cfg.color.startsWith('rgba') ? C.amber : cfg.color) : C.amber;
              const label  = cat === 'all' ? 'Tout' : cfg!.label;
              const emoji  = cat === 'all' ? '🗂️' : cfg!.emoji;
              const count  = catCounts[cat] ?? 0;
              return (
                <Pressable key={cat} onPress={() => setCatFilter(cat)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: active ? color : C.bgElev,
                  borderWidth: 1, borderColor: active ? color : 'rgba(245,166,35,0.15)',
                  shadowColor: active ? color : 'transparent',
                  shadowOffset: { width: 0, height: 3 }, shadowOpacity: active ? 0.45 : 0,
                  shadowRadius: 10, elevation: active ? 6 : 0,
                }}>
                  <Text style={{ fontSize: 13 }}>{emoji}</Text>
                  <Text style={{ fontSize: 12, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular', color: active ? '#1A0E00' : 'rgba(255,255,255,0.48)' }}>{label}</Text>
                  {count > 0 && (
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: active ? 'rgba(26,14,0,0.35)' : color + 'CC', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ══ IMPORTANT SECTION ══ */}
        <ImportantSection docs={importantDocs} onPress={openDoc} />

        {/* ══ EXPIRING SOON SECTION ══ */}
        <ExpiringSoonSection docs={expiringDocs} onPress={openDoc} />

        {/* ══ MAIN CONTENT ══ */}
        {filteredDocs.length === 0 ? (
          <DocEmptyState category={catFilter} onAdd={() => setShowModal(true)} />
        ) : viewMode === 'grid' ? (
          <View style={{ paddingHorizontal: 12 }}>
            {/* Grid 2 columns */}
            {Array.from({ length: Math.ceil(regularDocs.length / 2) }).map((_, row) => (
              <View key={row} style={{ flexDirection: 'row', gap: 10 }}>
                {regularDocs.slice(row * 2, row * 2 + 2).map((doc, col) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onPress={openDoc}
                    onLongPress={handleLongPress}
                    memberName={getMemberName(doc.uploaded_by, members)}
                    memberColor={getMemberColor(doc.uploaded_by, members)}
                    index={row * 2 + col}
                  />
                ))}
                {regularDocs.slice(row * 2, row * 2 + 2).length === 1 && <View style={{ width: CARD_W }} />}
              </View>
            ))}
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderSectionHeader={({ section }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
                <View style={{ backgroundColor: 'rgba(245,166,35,0.12)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.20)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber }}>
                    {section.title}
                  </Text>
                </View>
                <LinearGradient colors={['rgba(245,166,35,0.25)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
              </View>
            )}
            renderItem={({ item, index }) => (
              <DocumentListItem
                doc={item}
                onPress={openDoc}
                onLongPress={handleLongPress}
                memberName={getMemberName(item.uploaded_by, members)}
                memberColor={getMemberColor(item.uploaded_by, members)}
                index={index}
              />
            )}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}
      </ScrollView>

      {/* ══ FAB SPEED DIAL ══ */}
      <SpeedDialFAB
        onCamera={async () => {
          const res = await launchCamera({ mediaType: 'photo', quality: 0.85 });
          if (res.assets?.[0]) setShowModal(true);
        }}
        onGallery={async () => {
          const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.85 });
          if (res.assets?.[0]) setShowModal(true);
        }}
      />

      {/* ══ MODAL ══ */}
      <AddDocumentModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleUpload}
        isUploading={isUploading}
        uploadProgress={uploadPct}
      />
    </View>
  );
};
