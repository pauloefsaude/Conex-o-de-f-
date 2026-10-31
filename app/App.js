import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppContext as Ctx } from './src/context';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, session, connectRealtime, setUnauthorizedHandler } from './src/api';
import { colors } from './src/theme';
import { Loading } from './src/ui';
import * as Auth from './src/screens/auth';
import * as Onboarding from './src/screens/onboarding';
import Discover from './src/screens/Discover';
import ProfileView from './src/screens/ProfileView';
import { Matches, Chat, Report } from './src/screens/chat';
import { Inspiration, Events, Notifications, Help } from './src/screens/content';
import { Me, Privacy, Premium, DeleteAccount, Blocks } from './src/screens/account';

const SCREENS = {
  Splash: Auth.Splash, Intro: Auth.Intro, Register: Auth.Register, Login: Auth.Login, Forgot: Auth.Forgot,
  Preferences: Onboarding.Preferences, EditProfile: Onboarding.EditProfile, Photos: Onboarding.Photos,
  Main: MainTabs, ProfileView, Chat, Report, Notifications, Help, Privacy, Premium, DeleteAccount, Blocks,
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [stack, setStack] = useState([{ name: 'Splash', params: {} }]);
  const [me, setMe] = useState(null);
  const [options, setOptions] = useState(null);
  const [unread, setUnread] = useState(0);
  const listeners = useRef(new Set());

  const nav = useMemo(() => ({
    push: (name, params = {}) => setStack((s) => [...s, { name, params }]),
    replace: (name, params = {}) => setStack((s) => [...s.slice(0, -1), { name, params }]),
    reset: (name, params = {}) => setStack([{ name, params }]),
    pop: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  }), []);

  const refreshMe = useCallback(async () => {
    const m = await api('/api/me'); setMe(m); return m;
  }, []);

  const signOut = useCallback(async () => {
    await session.clear(); setMe(null); nav.reset('Intro');
  }, [nav]);

  // Decide para onde ir depois de entrar: completar perfil ou abrir o app.
  const enter = useCallback(async (token) => {
    if (token) await session.save(token);
    const m = await refreshMe();
    if (!m.profile?.complete) nav.reset('EditProfile', { onboarding: true });
    else nav.reset('Main');
  }, [nav, refreshMe]);

  useEffect(() => { setUnauthorizedHandler(() => { session.clear(); setMe(null); nav.reset('Login', { expired: true }); }); }, [nav]);
  useEffect(() => { api('/api/options').then(setOptions).catch(() => {}); }, []);

  useEffect(() => {
    if (!me) return;
    const off = connectRealtime((ev) => {
      if (ev.type === 'notification') setUnread((n) => n + 1);
      listeners.current.forEach((fn) => fn(ev));
    });
    return off;
  }, [me?.id]);

  const subscribe = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);

  const value = { nav, me, setMe, refreshMe, enter, signOut, options, subscribe, unread, setUnread };
  const top = stack[stack.length - 1];
  const Comp = SCREENS[top.name];

  return (
    <Ctx.Provider value={value}>
      <FadeIn key={stack.length + top.name}>
        {Comp ? <Comp {...top.params} /> : <Loading />}
      </FadeIn>
    </Ctx.Provider>
  );
}

function FadeIn({ children }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }).start(); }, [a]);
  return <Animated.View style={{ flex: 1, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}

const TABS = [
  { key: 'discover', label: 'Descobrir', icon: '◎', C: Discover },
  { key: 'matches', label: 'Conversas', icon: '◌', C: Matches },
  { key: 'inspiration', label: 'Inspiração', icon: '✦', C: Inspiration },
  { key: 'events', label: 'Eventos', icon: '▣', C: Events },
  { key: 'me', label: 'Perfil', icon: '◍', C: Me },
];

function MainTabs({ tab: initial = 'discover' }) {
  const [tab, setTab] = useState(initial);
  const insets = useSafeAreaInsets();
  const T = TABS.find((t) => t.key === tab).C;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flex: 1 }}><T goTab={setTab} /></View>
      <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
            <Text style={[st.icon, tab === t.key && { color: colors.gold }]}>{t.icon}</Text>
            <Text style={[st.label, tab === t.key && { color: colors.white }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.navy, paddingTop: 8, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  icon: { fontSize: 20, color: '#8C97B5' },
  label: { fontSize: 11, color: '#8C97B5', marginTop: 2, fontWeight: '600' },
});
