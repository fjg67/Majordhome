import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StatusBar, Platform,
  ActivityIndicator, Dimensions, TextInput, RefreshControl,
  PermissionsAndroid, Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

const WEATHER_CITY_KEY = '@homesync_weather_city';

dayjs.locale('fr');
const { width: SW } = Dimensions.get('window');

const C = {
  bgDeep: '#1A0E00', bgMid: '#261400', bgSurface: '#2E1A00', bgElevated: '#3A2200',
  amber: '#F5A623', amberSoft: 'rgba(245,166,35,0.15)', amberGlow: 'rgba(245,166,35,0.30)',
  border: 'rgba(255,255,255,0.07)',
  textPrimary: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.58)', textMuted: 'rgba(255,255,255,0.32)',
  blue: '#4ECDC4', purple: '#A78BFA', yellow: '#FBBF24', red: '#FF6B6B',
};

const WMO_CODES: Record<number, { emoji: string; label: string }> = {
  0:  { emoji: '☀️',  label: 'Ciel dégagé' },
  1:  { emoji: '🌤️', label: 'Peu nuageux' },
  2:  { emoji: '⛅',  label: 'Partiellement nuageux' },
  3:  { emoji: '☁️',  label: 'Couvert' },
  45: { emoji: '🌫️', label: 'Brouillard' },
  48: { emoji: '🌫️', label: 'Brouillard givrant' },
  51: { emoji: '🌦️', label: 'Bruine légère' },
  53: { emoji: '🌦️', label: 'Bruine modérée' },
  55: { emoji: '🌧️', label: 'Bruine dense' },
  61: { emoji: '🌧️', label: 'Pluie légère' },
  63: { emoji: '🌧️', label: 'Pluie modérée' },
  65: { emoji: '🌧️', label: 'Forte pluie' },
  66: { emoji: '🌨️', label: 'Pluie verglaçante' },
  67: { emoji: '🌨️', label: 'Forte pluie verglaçante' },
  71: { emoji: '🌨️', label: 'Neige légère' },
  73: { emoji: '❄️',  label: 'Neige modérée' },
  75: { emoji: '❄️',  label: 'Forte neige' },
  77: { emoji: '❄️',  label: 'Grains de neige' },
  80: { emoji: '🌦️', label: 'Averses légères' },
  81: { emoji: '🌧️', label: 'Averses modérées' },
  82: { emoji: '⛈️',  label: 'Averses violentes' },
  85: { emoji: '🌨️', label: 'Averses de neige' },
  86: { emoji: '🌨️', label: 'Fortes averses de neige' },
  95: { emoji: '⛈️',  label: 'Orage' },
  96: { emoji: '⛈️',  label: 'Orage avec grêle' },
  99: { emoji: '⛈️',  label: 'Orage violent' },
};

const getWeatherInfo = (code: number) => WMO_CODES[code] ?? { emoji: '🌡️', label: 'Inconnu' };
const getWindDir = (deg: number): string => {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(deg / 45) % 8];
};
const getUVLevel = (uv: number): { label: string; color: string } => {
  if (uv <= 2) return { label: 'Faible', color: C.blue };
  if (uv <= 5) return { label: 'Modéré', color: C.yellow };
  if (uv <= 7) return { label: 'Élevé', color: C.amber };
  return { label: 'Très élevé', color: C.red };
};

interface City {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

interface WeatherData {
  current: {
    temperature: number; apparent: number; humidity: number;
    weathercode: number; windspeed: number; winddirection: number;
    pressure: number;
  };
  daily: {
    date: string; tempMax: number; tempMin: number; weathercode: number;
    uvMax: number; precipSum: number; sunrise: string; sunset: string;
  }[];
  hourly: { time: string; temp: number; code: number; precip: number }[];
}

export const WeatherScreen: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch real weather from Open-Meteo ───
  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure',
        hourly: 'temperature_2m,weather_code,precipitation_probability',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,sunrise,sunset',
        timezone: 'Europe/Paris',
        forecast_days: '7',
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      const json = await res.json();
      setWeather({
        current: {
          temperature: json.current?.temperature_2m ?? 0,
          apparent: json.current?.apparent_temperature ?? 0,
          humidity: json.current?.relative_humidity_2m ?? 0,
          weathercode: json.current?.weather_code ?? 0,
          windspeed: json.current?.wind_speed_10m ?? 0,
          winddirection: json.current?.wind_direction_10m ?? 0,
          pressure: json.current?.surface_pressure ?? 0,
        },
        daily: (json.daily?.time ?? []).map((d: string, i: number) => ({
          date: d,
          tempMax: json.daily.temperature_2m_max[i],
          tempMin: json.daily.temperature_2m_min[i],
          weathercode: json.daily.weather_code[i],
          uvMax: json.daily.uv_index_max[i],
          precipSum: json.daily.precipitation_sum[i],
          sunrise: json.daily.sunrise[i],
          sunset: json.daily.sunset[i],
        })),
        hourly: (json.hourly?.time ?? []).slice(0, 24).map((t: string, i: number) => ({
          time: t,
          temp: json.hourly.temperature_2m[i],
          code: json.hourly.weather_code[i],
          precip: json.hourly.precipitation_probability[i],
        })),
      });
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer la météo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ─── Geocoding search (Open-Meteo, France uniquement) ───
  const searchCities = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        name: query,
        count: '10',
        language: 'fr',
        format: 'json',
        country_id: 'FR',
      });
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      const json = await res.json();
      const results: City[] = (json.results ?? []).map((r: {
        name: string; latitude: number; longitude: number; admin1?: string;
      }) => ({
        name: r.name,
        lat: r.latitude,
        lon: r.longitude,
        region: r.admin1,
      }));
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCities(text), 400);
  }, [searchCities]);

  const selectCity = useCallback((c: City) => {
    setCity(c);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    // Persister la ville choisie
    AsyncStorage.setItem(WEATHER_CITY_KEY, JSON.stringify(c)).catch(() => {});
  }, []);

  // ─── Géolocalisation ───
  const locateMe = useCallback(async () => {
    setLocating(true);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Localisation',
            message: 'HomeSync a besoin de ta position pour afficher la météo locale.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Annuler',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission refusée', 'Active la localisation dans les réglages.');
          setLocating(false);
          return;
        }
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          // Reverse geocode with Open-Meteo
          try {
            const res = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&count=1&language=fr&format=json`
            );
            const json = await res.json();
            // Use nominatim for reverse geocoding since Open-Meteo doesn't support it
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=fr`,
              { headers: { 'User-Agent': 'HomeSync/1.0' } }
            );
            const nom = await nomRes.json();
            const cityName = nom.address?.city || nom.address?.town || nom.address?.village || 'Ma position';
            const detectedCity: City = { name: cityName, lat: latitude, lon: longitude };
            setCity(detectedCity);
            AsyncStorage.setItem(WEATHER_CITY_KEY, JSON.stringify(detectedCity)).catch(() => {});
          } catch {
            const fallbackCity: City = { name: 'Ma position', lat: latitude, lon: longitude };
            setCity(fallbackCity);
            AsyncStorage.setItem(WEATHER_CITY_KEY, JSON.stringify(fallbackCity)).catch(() => {});
          }
          setLocating(false);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          Alert.alert('Localisation impossible', 'Vérifie que le GPS est activé.');
          setLocating(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } catch {
      setLocating(false);
    }
  }, []);

  // Charger la météo quand la ville change
  useEffect(() => {
    if (city) fetchWeather(city.lat, city.lon);
  }, [city, fetchWeather]);

  // Au lancement : charger la ville sauvegardée, sinon géolocaliser
  useEffect(() => {
    AsyncStorage.getItem(WEATHER_CITY_KEY).then(stored => {
      if (stored) {
        try {
          const saved: City = JSON.parse(stored);
          setCity(saved);
        } catch {
          locateMe();
        }
      } else {
        locateMe();
      }
    }).catch(() => locateMe());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = weather?.daily?.[0];
  const info = weather ? getWeatherInfo(weather.current.weathercode) : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { if (city) { setRefreshing(true); fetchWeather(city.lat, city.lon); } }}
            tintColor={C.amber} colors={[C.amber]}
          />
        }
      >
        {/* ─── HEADER ─── */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={['rgba(78,205,196,0.12)', 'rgba(245,166,35,0.04)', 'transparent']}
            style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 12 }}>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Ville */}
              <Pressable onPress={() => setShowSearch(!showSearch)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 24, fontFamily: 'Nunito-Bold', color: C.textPrimary }} numberOfLines={1}>
                  🌤️ {city ? city.name : '—'}
                </Text>
                <Text style={{ fontSize: 14, color: C.textMuted }}>{showSearch ? '▲' : '▼'}</Text>
              </Pressable>

              {/* Bouton localisation */}
              <Pressable onPress={locateMe} disabled={locating}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: C.amberSoft, borderRadius: 12, paddingHorizontal: 12,
                  paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(245,166,35,0.35)',
                }}>
                {locating
                  ? <ActivityIndicator size="small" color={C.amber} />
                  : <Text style={{ fontSize: 14 }}>📍</Text>
                }
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Medium', color: C.amber }}>
                  {locating ? '...' : 'Me localiser'}
                </Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSecondary, marginTop: 4 }}>
              {dayjs().format('dddd D MMMM YYYY')}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ─── RECHERCHE ─── */}
        {showSearch && (
          <Animated.View entering={FadeIn.duration(250)}
            style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={{
              backgroundColor: C.bgSurface, borderRadius: 14, borderWidth: 1,
              borderColor: 'rgba(245,166,35,0.35)', flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 14, marginBottom: 8,
            }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Rechercher une ville en France..."
                placeholderTextColor={C.textMuted}
                autoFocus
                style={{
                  flex: 1, paddingVertical: 12, fontSize: 14,
                  fontFamily: 'DMSans-Regular', color: C.textPrimary,
                }}
              />
              {searchLoading && <ActivityIndicator size="small" color={C.amber} />}
            </View>

            {/* Résultats */}
            {searchResults.length > 0 && (
              <View style={{
                backgroundColor: C.bgSurface, borderRadius: 14,
                borderWidth: 1, borderColor: C.border, overflow: 'hidden',
              }}>
                {searchResults.map((r, i) => (
                  <Pressable key={`${r.name}-${i}`}
                    onPress={() => selectCity(r)}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: 12, paddingHorizontal: 14,
                      backgroundColor: pressed ? C.bgElevated : 'transparent',
                      borderBottomWidth: i < searchResults.length - 1 ? 1 : 0,
                      borderBottomColor: C.border,
                    })}>
                    <View>
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.textPrimary }}>
                        {r.name}
                      </Text>
                      {r.region && (
                        <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMuted, marginTop: 1 }}>
                          {r.region}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 18, color: C.textMuted }}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
              <Text style={{ textAlign: 'center', color: C.textMuted, fontFamily: 'DMSans-Regular',
                fontSize: 13, paddingVertical: 12 }}>
                Aucune ville trouvée
              </Text>
            )}
          </Animated.View>
        )}

        {/* ─── LOADING ─── */}
        {(loading && !weather) || locating ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <ActivityIndicator color={C.amber} size="large" />
            <Text style={{ color: C.textMuted, fontFamily: 'DMSans-Regular', fontSize: 13, marginTop: 12 }}>
              {locating ? 'Localisation en cours...' : 'Chargement de la météo...'}
            </Text>
          </View>
        ) : !city ? (
          <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🌍</Text>
            <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: C.textPrimary,
              textAlign: 'center', marginBottom: 8 }}>
              Où es-tu ?
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'DMSans-Regular', color: C.textSecondary,
              textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              Clique sur "📍 Me localiser" ou cherche ta ville avec la barre de recherche ▼
            </Text>
            <Pressable onPress={() => setShowSearch(true)}
              style={{
                backgroundColor: C.amberSoft, borderRadius: 14, paddingVertical: 12,
                paddingHorizontal: 24, borderWidth: 1, borderColor: C.amber,
              }}>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>
                🔍 Chercher une ville
              </Text>
            </Pressable>
          </View>
        ) : weather && info ? (
          <>
            {/* ─── MÉTÉO ACTUELLE ─── */}
            <Animated.View entering={FadeInUp.duration(500).delay(100)}
              style={{ marginHorizontal: 16, marginBottom: 14 }}>
              <LinearGradient colors={['rgba(78,205,196,0.08)', 'rgba(245,166,35,0.06)']}
                style={{ borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 56, fontFamily: 'Nunito-Bold', color: C.textPrimary }}>
                      {Math.round(weather.current.temperature)}°
                    </Text>
                    <Text style={{ fontSize: 14, fontFamily: 'DMSans-Regular', color: C.textSecondary }}>
                      Ressenti {Math.round(weather.current.apparent)}°
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 60 }}>{info.emoji}</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'DMSans-Medium', color: C.textSecondary,
                      textAlign: 'center', maxWidth: 120, marginTop: 4 }}>
                      {info.label}
                    </Text>
                  </View>
                </View>
                {today && (
                  <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
                    <View style={{ flex: 1, backgroundColor: C.bgSurface + '88', borderRadius: 12,
                      padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DMSans-Regular' }}>Min / Max</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.textPrimary, marginTop: 2 }}>
                        {Math.round(today.tempMin)}° / {Math.round(today.tempMax)}°
                      </Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: C.bgSurface + '88', borderRadius: 12,
                      padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DMSans-Regular' }}>Humidité</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.blue, marginTop: 2 }}>
                        💧 {weather.current.humidity}%
                      </Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: C.bgSurface + '88', borderRadius: 12,
                      padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DMSans-Regular' }}>Vent</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.textPrimary, marginTop: 2 }}>
                        💨 {Math.round(weather.current.windspeed)}
                      </Text>
                      <Text style={{ fontSize: 9, color: C.textMuted }}>
                        km/h {getWindDir(weather.current.winddirection)}
                      </Text>
                    </View>
                  </View>
                )}
              </LinearGradient>
            </Animated.View>

            {/* ─── LEVER / COUCHER / UV ─── */}
            {today && (
              <Animated.View entering={FadeInUp.duration(500).delay(200)}
                style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 14 }}>
                {[
                  { emoji: '🌅', label: 'Lever', value: dayjs(today.sunrise).format('HH:mm'), color: C.yellow },
                  { emoji: '🌇', label: 'Coucher', value: dayjs(today.sunset).format('HH:mm'), color: C.amber },
                ].map(item => (
                  <View key={item.label} style={{ flex: 1, backgroundColor: C.bgSurface, borderRadius: 16,
                    padding: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                    <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DMSans-Regular', marginTop: 4 }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: item.color }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
                <View style={{ flex: 1, backgroundColor: C.bgSurface, borderRadius: 16,
                  padding: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22 }}>☀️</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DMSans-Regular', marginTop: 4 }}>UV</Text>
                  <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: getUVLevel(today.uvMax).color }}>
                    {today.uvMax.toFixed(0)}
                  </Text>
                  <Text style={{ fontSize: 9, color: getUVLevel(today.uvMax).color, fontFamily: 'DMSans-Regular' }}>
                    {getUVLevel(today.uvMax).label}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* ─── HEURE PAR HEURE ─── */}
            <Animated.View entering={FadeInUp.duration(500).delay(300)}>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.textPrimary,
                paddingHorizontal: 20, marginBottom: 8 }}>
                Heure par heure
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
                {weather.hourly.map((h, i) => {
                  const hi = getWeatherInfo(h.code);
                  const isNow = dayjs(h.time).hour() === dayjs().hour();
                  return (
                    <View key={i} style={{
                      width: 64, paddingVertical: 12, borderRadius: 16, alignItems: 'center',
                      backgroundColor: isNow ? C.amberSoft : C.bgSurface,
                      borderWidth: 1, borderColor: isNow ? C.amber : C.border,
                    }}>
                      <Text style={{ fontSize: 10,
                        fontFamily: isNow ? 'Nunito-Bold' : 'DMSans-Regular',
                        color: isNow ? C.amber : C.textMuted }}>
                        {isNow ? 'Maint.' : dayjs(h.time).format('HH:mm')}
                      </Text>
                      <Text style={{ fontSize: 22, marginVertical: 4 }}>{hi.emoji}</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.textPrimary }}>
                        {Math.round(h.temp)}°
                      </Text>
                      {h.precip > 0 && (
                        <Text style={{ fontSize: 9, color: C.blue, fontFamily: 'DMSans-Medium', marginTop: 2 }}>
                          💧 {h.precip}%
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* ─── PRÉVISIONS 7 JOURS ─── */}
            <Animated.View entering={FadeInUp.duration(500).delay(400)}
              style={{ marginTop: 18, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.textPrimary, marginBottom: 10 }}>
                Prévisions 7 jours
              </Text>
              {weather.daily.map((d, i) => {
                const di = getWeatherInfo(d.weathercode);
                const isToday = i === 0;
                return (
                  <Animated.View key={d.date} entering={FadeInUp.duration(300).delay(400 + i * 40)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                      paddingHorizontal: 14, marginBottom: 6, borderRadius: 14,
                      backgroundColor: isToday ? C.amberSoft : C.bgSurface,
                      borderWidth: 1, borderColor: isToday ? C.amber + '33' : C.border,
                    }}>
                    <Text style={{ width: 70, fontSize: 13,
                      fontFamily: isToday ? 'Nunito-Bold' : 'DMSans-Regular',
                      color: isToday ? C.amber : C.textSecondary }}>
                      {isToday ? 'Auj.' : dayjs(d.date).format('ddd D')}
                    </Text>
                    <Text style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{di.emoji}</Text>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
                      justifyContent: 'flex-end', gap: 4 }}>
                      {d.precipSum > 0 && (
                        <Text style={{ fontSize: 10, color: C.blue, fontFamily: 'DMSans-Medium', marginRight: 8 }}>
                          💧 {d.precipSum.toFixed(1)}mm
                        </Text>
                      )}
                      <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.blue,
                        width: 32, textAlign: 'right' }}>
                        {Math.round(d.tempMin)}°
                      </Text>
                      <View style={{ width: 60, height: 4, borderRadius: 2,
                        backgroundColor: C.bgElevated, marginHorizontal: 4 }}>
                        <View style={{
                          position: 'absolute',
                          left: `${Math.max(0, ((d.tempMin + 10) / 50) * 100)}%` as any,
                          right: `${Math.max(0, 100 - ((d.tempMax + 10) / 50) * 100)}%` as any,
                          height: 4, borderRadius: 2, backgroundColor: C.amber,
                        }} />
                      </View>
                      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.amber,
                        width: 32, textAlign: 'left' }}>
                        {Math.round(d.tempMax)}°
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};
