import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, PanResponder, Pressable, Dimensions, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context';
import { api } from '../api';
import { colors, fonts, radius } from '../theme';
import { Button, P, H1, Loading, Logo, Avatar, ErrorText } from '../ui';

const W = Dimensions.get('window').width;
const THRESHOLD = W * 0.28;

export default function Discover({ goTab }) {
  const { nav, unread, me } = useApp();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState(null);
  const [err, setErr] = useState('');
  const [match, setMatch] = useState(null);
  const [why, setWhy] = useState(false);
  const pos = useRef(new Animated.ValueXY()).current;

  const load = useCallback(async () => {
    setErr('');
    try { const r = await api('/api/discover'); setQueue(r.profiles); } catch (e) { setErr(e.message); setQueue([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = queue?.[0];

  const decide = useCallback(async (action) => {
    if (!current) return;
    const target = current;
    Animated.timing(pos, { toValue: { x: action === 'like' ? W * 1.4 : -W * 1.4, y: 30 }, duration: 220, useNativeDriver: false }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      setQueue((q) => q.slice(1));
    });
    try {
      const r = await api('/api/swipes', { method: 'POST', body: { toUserId: target.id, action } });
      if (r.matched) setMatch({ ...r, person: target });
    } catch (e) {
      setErr(e.message);
      if (e.code === 'daily_like_limit') setQueue((q) => [target, ...(q || [])]);
    }
  }, [current, pos]);

  const undo = async () => {
    setErr('');
    try { const r = await api('/api/swipes/undo', { method: 'POST', body: {} }); setQueue((q) => [r.restored, ...(q || [])]); }
    catch (e) { if (e.code === 'premium_required') nav.push('Premium'); else setErr(e.message); }
  };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > THRESHOLD) decideRef.current('like');
      else if (g.dx < -THRESHOLD) decideRef.current('pass');
      else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
    },
  })).current;
  const decideRef = useRef(decide); decideRef.current = decide;

  const rotate = pos.x.interpolate({ inputRange: [-W, 0, W], outputRange: ['-10deg', '0deg', '10deg'] });
  const likeOp = pos.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOp = pos.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <View style={st.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Logo size={38} />
          <Text style={st.brand}>Conexão de Fé</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={() => nav.push('Preferences')} hitSlop={10} accessibilityLabel="Filtros"><Text style={st.topIcon}>☰</Text></Pressable>
          <Pressable onPress={() => nav.push('Notifications')} hitSlop={10} accessibilityLabel="Notificações">
            <Text style={st.topIcon}>◔</Text>{unread > 0 && <View style={st.dot} />}
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 14 }}>
        {queue === null ? <Loading /> : !current ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
            <H1 style={{ textAlign: 'center' }}>Por hoje é isso</H1>
            <P muted style={{ textAlign: 'center' }}>Você viu todas as pessoas dentro das suas preferências. Ampliar a distância ou a faixa etária pode trazer novas sugestões.</P>
            <ErrorText>{err}</ErrorText>
            <Button title="Ajustar preferências" onPress={() => nav.push('Preferences')} />
            <Button kind="ghost" title="Atualizar" onPress={load} />
          </View>
        ) : (
          <>
            {queue[1] && <Card p={queue[1]} style={{ transform: [{ scale: 0.96 }], opacity: 0.7 }} />}
            <Animated.View {...pan.panHandlers} style={[StyleSheet.absoluteFill, { marginHorizontal: 14, transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }]}>
              <Card p={current} onOpen={() => nav.push('ProfileView', { id: current.id, fromDiscover: true })} onWhy={() => setWhy(true)} />
              <Animated.View style={[st.stamp, st.stampLike, { opacity: likeOp }]}><Text style={[st.stampText, { color: colors.gold }]}>CURTIR</Text></Animated.View>
              <Animated.View style={[st.stamp, st.stampPass, { opacity: passOp }]}><Text style={[st.stampText, { color: colors.white }]}>PASSAR</Text></Animated.View>
            </Animated.View>
          </>
        )}
      </View>

      {current && (
        <View>
          {err ? <Text style={{ color: colors.red, textAlign: 'center', paddingHorizontal: 20 }}>{err}</Text> : null}
          <View style={st.actions}>
            <Round label="↺" small onPress={undo} a11y="Desfazer (Premium)" />
            <Round label="✕" onPress={() => decide('pass')} a11y="Passar" />
            <Round label="♥" gold onPress={() => decide('like')} a11y="Curtir" />
            <Round label="i" small onPress={() => nav.push('ProfileView', { id: current.id, fromDiscover: true })} a11y="Ver perfil completo" />
          </View>
        </View>
      )}

      <Modal visible={why} transparent animationType="fade" onRequestClose={() => setWhy(false)}>
        <Pressable style={st.backdrop} onPress={() => setWhy(false)}>
          <View style={st.sheet}>
            <Text style={st.sheetTitle}>Por que esta sugestão?</Text>
            {(current?.reasons || []).map((r) => <P key={r} style={{ marginBottom: 6 }}>• {r}</P>)}
            {!current?.reasons?.length && <P>Vocês estão dentro das preferências um do outro.</P>}
            <P muted style={{ marginTop: 10, fontSize: 13 }}>O indicador usa apenas o que vocês declararam no perfil. Ele não prevê o futuro de um relacionamento.</P>
            <Button title="Entendi" onPress={() => setWhy(false)} />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!match} transparent animationType="fade" onRequestClose={() => setMatch(null)}>
        <View style={[st.backdrop, { backgroundColor: 'rgba(14,27,61,0.96)' }]}>
          <View style={{ alignItems: 'center', padding: 28 }}>
            <Logo size={90} light />
            <Text style={{ fontFamily: fonts.serif, fontSize: 32, color: colors.white, marginTop: 18, textAlign: 'center' }}>Vocês se curtiram</Text>
            <P light style={{ textAlign: 'center', marginTop: 8 }}>Você e {match?.person?.name} demonstraram interesse um no outro. Que tal começar com uma pergunta gentil?</P>
            <View style={{ flexDirection: 'row', marginVertical: 24 }}>
              <Avatar uri={me?.profile?.photos?.[0]?.url} name={me?.profile?.displayName} size={84} />
              <View style={{ marginLeft: -14 }}><Avatar uri={match?.person?.photos?.[0]} name={match?.person?.name} size={84} /></View>
            </View>
            <Button kind="gold" title="Enviar mensagem" style={{ alignSelf: 'stretch' }} onPress={() => { const id = match.matchId; setMatch(null); nav.push('Chat', { matchId: id }); }} />
            <Button kind="ghost" title="Continuar conhecendo pessoas" style={{ alignSelf: 'stretch', borderColor: '#8C97B5' }} onPress={() => setMatch(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Card({ p, style, onOpen, onWhy }) {
  return (
    <View style={[StyleSheet.absoluteFill, st.card, style]}>
      {p.photos?.[0]
        ? <Image source={{ uri: p.photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navy2, alignItems: 'center', justifyContent: 'center' }]}><Avatar name={p.name} size={140} /></View>}
      <View style={st.shade} />
      {p.compatibility != null && (
        <Pressable onPress={onWhy} style={st.badge} accessibilityLabel="Por que esta sugestão">
          <Text style={st.badgeText}>Afinidade {p.compatibility}% ⓘ</Text>
        </Pressable>
      )}
      <Pressable onPress={onOpen} style={st.info}>
        <Text style={st.name}>{p.name}, {p.age}</Text>
        <Text style={st.meta}>{[p.city, p.distance].filter(Boolean).join(' · ')}</Text>
        {p.relationshipGoal ? <Text style={st.goal}>Busca: {p.relationshipGoal}</Text> : null}
        {p.denomination ? <Text style={st.meta}>{p.denomination}</Text> : null}
        {p.sharedInterests?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {p.sharedInterests.slice(0, 4).map((i) => <Text key={i} style={st.tag}>{i}</Text>)}
          </View>
        ) : null}
        {p.badges?.includes('email_verificado') && <Text style={[st.meta, { marginTop: 6 }]}>✓ E-mail verificado</Text>}
      </Pressable>
    </View>
  );
}

function Round({ label, onPress, gold, small, a11y }) {
  const size = small ? 50 : 66;
  return (
    <Pressable onPress={onPress} accessibilityLabel={a11y} style={({ pressed }) => [{
      width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: gold ? colors.gold : colors.white, borderWidth: gold ? 0 : 1, borderColor: colors.line,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Text style={{ fontSize: small ? 20 : 28, color: gold ? colors.navy : colors.navy, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  brand: { fontFamily: fonts.serif, fontSize: 19, color: colors.navy, fontWeight: '600' },
  topIcon: { fontSize: 22, color: colors.navy },
  dot: { position: 'absolute', right: -2, top: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold },
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: colors.navy2, marginBottom: 8 },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: 'rgba(14,27,61,0.55)' },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 },
  name: { fontFamily: fonts.serif, fontSize: 30, color: colors.white, fontWeight: '600' },
  meta: { color: '#E3E7F1', fontSize: 14.5, marginTop: 2 },
  goal: { color: colors.gold, fontSize: 15, fontWeight: '700', marginTop: 6 },
  tag: { color: colors.navy, backgroundColor: colors.goldSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 12.5, overflow: 'hidden' },
  badge: { position: 'absolute', top: 16, left: 16, backgroundColor: 'rgba(14,27,61,0.75)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: colors.gold, fontWeight: '700', fontSize: 13 },
  stamp: { position: 'absolute', top: 40, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 3, borderRadius: 10 },
  stampLike: { left: 24, borderColor: colors.gold, transform: [{ rotate: '-12deg' }] },
  stampPass: { right: 24, borderColor: colors.white, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, paddingVertical: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.paper, borderRadius: radius.lg, padding: 22 },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 21, color: colors.navy, marginBottom: 10, fontWeight: '600' },
});
