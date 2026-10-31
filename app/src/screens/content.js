import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context';
import { api } from '../api';
import { colors, fonts } from '../theme';
import { Screen, H1, P, Card, Button, Loading, ErrorText } from '../ui';

const KIND = { versiculo: 'Versículo', reflexao: 'Reflexão', comunicacao: 'Comunicação', responsabilidade: 'Responsabilidade afetiva',
  oracao: 'Oração', esperanca: 'Esperança', seguranca: 'Segurança' };

// ---------- Espaço de inspiração (tela 14) ----------
export function Inspiration() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/inspiration').then(setData).catch((e) => setErr(e.message)); }, []);
  return (
    <Screen title="Inspiração">
      <ErrorText>{err}</ErrorText>
      {!data ? <Loading /> : (
        <>
          {data.items.map((it) => (
            <Card key={it.id}>
              <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>{KIND[it.kind] || it.kind}</Text>
              <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.navy, marginTop: 6, fontWeight: '600' }}>{it.title}</Text>
              {it.ref ? <Text style={{ color: colors.navySoft, marginTop: 2, fontStyle: 'italic' }}>{it.ref}</Text> : null}
              <P style={{ marginTop: 8 }}>{it.body}</P>
            </Card>
          ))}
          <P muted style={{ fontSize: 12, textAlign: 'center' }}>{data.note}</P>
        </>
      )}
    </Screen>
  );
}

// ---------- Eventos (tela 15) ----------
export function Events() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/api/events').then((r) => setList(r.events)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const toggle = async (e) => {
    try { await api(`/api/events/${e.id}/rsvp`, { method: e.imGoing ? 'DELETE' : 'POST', body: {} }); load(); } catch (x) { setErr(x.message); }
  };
  return (
    <Screen title="Eventos">
      <P muted style={{ marginBottom: 12 }}>Participar é opcional. Ninguém vê a lista de quem vai — só o número de confirmações.</P>
      <ErrorText>{err}</ErrorText>
      {!list ? <Loading /> : !list.length ? <P muted>Nenhum evento programado no momento.</P> : list.map((e) => {
        const d = new Date(e.startsAt.replace(' ', 'T') + 'Z');
        return (
          <Card key={e.id}>
            <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>{e.kind}</Text>
            <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.navy, marginTop: 4, fontWeight: '600' }}>{e.title}</Text>
            <P muted style={{ marginTop: 4 }}>
              {d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </P>
            <P muted>{e.onlineUrl ? 'Online' : [e.city, e.location].filter(Boolean).join(' · ')}</P>
            <P style={{ marginTop: 8 }}>{e.description}</P>
            <P muted style={{ marginTop: 6 }}>{e.going} {e.going === 1 ? 'confirmação' : 'confirmações'}</P>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button kind={e.imGoing ? 'ghost' : 'primary'} title={e.imGoing ? 'Cancelar presença' : 'Tenho interesse'} onPress={() => toggle(e)} style={{ flex: 1 }} />
              {e.onlineUrl ? <Button kind="gold" title="Abrir link" onPress={() => Linking.openURL(e.onlineUrl)} style={{ flex: 1 }} /> : null}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

// ---------- Notificações (tela 16) ----------
export function Notifications() {
  const { nav, setUnread } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => {
    api('/api/notifications').then((r) => { setList(r.notifications); api('/api/notifications/read', { method: 'POST', body: {} }); setUnread(0); }).catch(() => setList([]));
  }, []);
  const label = (n) => n.kind === 'match' ? `Você e ${n.data.name} se curtiram` : n.kind === 'message' ? `Nova mensagem de ${n.data.name}` : 'Atualização';
  return (
    <Screen title="Notificações" onBack={nav.pop}>
      {!list ? <Loading /> : !list.length ? <P muted>Nada por aqui ainda.</P> : list.map((n) => (
        <Pressable key={n.id} onPress={() => n.data.matchId && nav.push('Chat', { matchId: n.data.matchId })}
          style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center' }}>
          {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginRight: 10 }} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15.5, color: colors.ink }}>{label(n)}</Text>
            <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>{new Date(n.createdAt.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

// ---------- Central de ajuda (tela 20) ----------
export function Help() {
  const { nav } = useApp();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { api('/api/help').then(setData).catch(() => {}); }, []);
  return (
    <Screen title="Central de ajuda" onBack={nav.pop}>
      {!data ? <Loading /> : (
        <>
          {data.faq.map((f, i) => (
            <Pressable key={i} onPress={() => setOpen(open === i ? null : i)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.navy }}>{open === i ? '−' : '+'}  {f.q}</Text>
              {open === i && <P style={{ marginTop: 8 }}>{f.a}</P>}
            </Pressable>
          ))}
          <Card style={{ marginTop: 18 }}>
            <Text style={{ fontWeight: '700', color: colors.navy }}>Precisa falar com a equipe?</Text>
            <P style={{ marginTop: 4 }}>{data.contact}</P>
            <P muted style={{ marginTop: 6 }}>Em situação de risco, procure a polícia (190). Violência contra a mulher: Ligue 180.</P>
          </Card>
        </>
      )}
    </Screen>
  );
}
