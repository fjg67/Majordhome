import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StatusBar, ScrollView, Share, Linking, Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MoreStackParamList } from '@app/navigation/types';
import { supabase } from '@services/supabase';
import type { HouseholdDocumentV2 } from '@appTypes/index';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

const SUPABASE_STORAGE_URL = 'https://yxqsgqbrzesmnpughynd.supabase.co/storage/v1';

const C = {
  bgDeep: '#0D0700', bgMid: '#1A0E00', bgSurface: '#2E1A00',
  amber: '#F5A623', amberSoft: 'rgba(245,166,35,0.15)', amberBrd: 'rgba(245,166,35,0.22)',
  border: 'rgba(255,255,255,0.07)', text: '#FFFFFF', textSec: 'rgba(255,255,255,0.58)',
  textMut: 'rgba(255,255,255,0.32)', green: '#34D399', warning: '#FF8C00', danger: '#FF4444',
};

const CAT_CFG: Record<string, { label: string; emoji: string; color: string }> = {
  facture:    { label: 'Factures',   emoji: '🧾', color: '#F5A623' },
  contrat:    { label: 'Contrats',   emoji: '📋', color: '#4ECDC4' },
  quittance:  { label: 'Quittances', emoji: '🏠', color: '#34D399' },
  ordonnance: { label: 'Santé',      emoji: '💊', color: '#FF6B6B' },
  assurance:  { label: 'Assurances', emoji: '🛡️', color: '#A78BFA' },
  impot:      { label: 'Impôts',     emoji: '📊', color: '#FFD700' },
  photo:      { label: 'Photos',     emoji: '📷', color: '#FFA07A' },
  autre:      { label: 'Autre',      emoji: '📦', color: 'rgba(255,255,255,0.45)' },
};

const formatSize = (bytes: number): string => {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
};

type Nav = StackNavigationProp<MoreStackParamList, 'DocumentViewer'>;
type RouteT = RouteProp<MoreStackParamList & { DocumentViewer: { docId: string } }, 'DocumentViewer'>;

export const DocumentViewerScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const docId      = (route.params as { docId?: string })?.docId;

  const [doc,  setDoc]  = useState<HouseholdDocumentV2 | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  useEffect(() => {
    if (!docId) return;
    (async () => {
      const { data } = await supabase.from('documents').select('*').eq('id', docId).single();
      if (data) setDoc(data as HouseholdDocumentV2);
    })();
  }, [docId]);

  const getAuthUrl = async (): Promise<string> => {
    if (!doc) return '';
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token;
    const match = doc.file_url.match(/\/storage\/v1\/object\/(?:public|authenticated)\/household-documents\/(.+?)(?:\?|$)/);
    const path = match ? match[1] : null;
    if (token && path) {
      return `${SUPABASE_STORAGE_URL}/object/authenticated/household-documents/${path}`;
    }
    return doc.file_url;
  };

  const handleOpen = async () => {
    try {
      const url = await getAuthUrl();
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le document.');
    }
  };

  const handleShare = async () => {
    if (!doc) return;
    await Share.share({ url: doc.file_url, title: doc.title }).catch(() => {});
  };

  if (!doc) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📁</Text>
        <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.text }}>Chargement…</Text>
      </View>
    );
  }

  const cat = CAT_CFG[doc.category] ?? CAT_CFG.autre;
  const catColor = cat.color.startsWith('rgba') ? C.amber : cat.color;
  const expiring = doc.expiry_date && dayjs(doc.expiry_date).diff(dayjs(), 'day') <= 30 && dayjs(doc.expiry_date).isAfter(dayjs());
  const expired  = doc.expiry_date && dayjs(doc.expiry_date).isBefore(dayjs(), 'day');
  const daysLeft = doc.expiry_date ? dayjs(doc.expiry_date).diff(dayjs(), 'day') : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* ── HEADER ── */}
      <Animated.View entering={FadeInDown.duration(400)} style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{
          width: 36, height: 36, borderRadius: 11,
          backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 18, color: C.amber, marginLeft: -1 }}>‹</Text>
        </Pressable>

        <Text style={{ flex: 1, fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text, marginHorizontal: 12 }} numberOfLines={1}>
          {doc.title}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={handleShare} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14 }}>⬆</Text>
          </Pressable>
          <Pressable onPress={handleOpen} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14 }}>↗</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── MAIN PREVIEW AREA ── */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View entering={FadeIn.duration(500).delay(100)} style={{ alignItems: 'center', gap: 16 }}>
          {/* File icon large */}
          <View style={{
            width: 120, height: 120, borderRadius: 28,
            backgroundColor: `${catColor}18`, borderWidth: 2, borderColor: `${catColor}40`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 52 }}>
              {doc.file_type === 'pdf' ? '📄' : doc.file_type === 'image' ? '🖼️' : cat.emoji}
            </Text>
          </View>

          <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: C.text, textAlign: 'center', paddingHorizontal: 32 }}>
            {doc.title}
          </Text>

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: `${catColor}18`, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
            borderWidth: 1, borderColor: `${catColor}35`,
          }}>
            <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: catColor }}>{cat.label}</Text>
          </View>

          {/* Open button */}
          <Pressable onPress={handleOpen} style={{ marginTop: 8, borderRadius: 16, overflow: 'hidden' }}>
            <LinearGradient colors={['#F5A623', '#E8920A']} style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>👁️</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Ouvrir le document</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* ── META FOOTER ── */}
      <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{
        backgroundColor: C.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderTopWidth: 1, borderTopColor: C.amberBrd, padding: 20, paddingBottom: 36,
      }}>
        <Pressable onPress={() => setShowMeta(v => !v)} style={{ alignItems: 'center', marginBottom: showMeta ? 14 : 0 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </Pressable>

        {/* Always visible: size + uploader */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: showMeta ? 14 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut }}>{formatSize(doc.file_size)}</Text>
            <Text style={{ color: C.textMut }}>·</Text>
            <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut }}>{doc.file_name}</Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
            {dayjs(doc.created_at).format('D MMM YYYY')}
          </Text>
        </View>

        {/* Expanded meta */}
        {showMeta && (
          <Animated.View entering={FadeIn.duration(200)}>
            {doc.document_date && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut }}>Date du document</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.text }}>{dayjs(doc.document_date).format('D MMM YYYY')}</Text>
              </View>
            )}
            {doc.expiry_date && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut }}>Expiration</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: expired ? C.danger : expiring ? C.warning : C.text }}>
                    {dayjs(doc.expiry_date).format('D MMM YYYY')}
                  </Text>
                  {(expired || expiring) && (
                    <View style={{ backgroundColor: expired ? C.danger + '20' : C.warning + '20', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: expired ? C.danger : C.warning }}>
                        {expired ? 'Expiré' : `${daysLeft}j`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            {doc.description && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.textMut, letterSpacing: 1, marginBottom: 4 }}>DESCRIPTION</Text>
                <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSec }}>{doc.description}</Text>
              </View>
            )}
            {doc.tags.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {doc.tags.map(t => (
                  <View key={t} style={{ backgroundColor: C.amberSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.amberBrd }}>
                    <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.amber }}>#{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};
