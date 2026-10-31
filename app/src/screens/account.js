import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context';
import { api } from '../api';
import { colors, fonts } from '../theme';
import { Screen, H1, H2, P, Button, Row, Toggle, Field, ErrorText, Notice, Card, Avatar, Loading } from '../ui';

// ---------- Hub do perfil ----------
export function Me() {
  const { nav, me, refreshMe, signOut } = useApp();
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  useEffect(() => { refreshMe().catch(() => {}); }, []);
  const p = me?.profile;
  const resend = async () => {
    try { await api('/api/auth/resend-verification', { method: 'POST', body: {} }); setInfo('Enviamos um novo link de confirmação para seu e-mail.'); } catch (e) { setErr(e.message); }
  };
  return (
    <Screen title="Perfil">
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <Avatar uri={p?.photos?.[0]?.url} name={p?.displayName} size={104} />
        <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.navy, marginTop: 10, fontWeight: '600' }}>{p?.displayName}</Text>
        <P muted>{p?.city ? `${p.city} – ${p.region}` : ''}</P>
        {me?.premium && <Text style={{ color: colors.gold, fontWeight: '800', marginTop: 4 }}>✦ Premium</Text>}
      </View>
      {!me?.emailVerified && (
        <Notice>Confirme seu e-mail para ganhar o selo "e-mail verificado". <Text onPress={resend} style={{ fontWeight: '700', textDecorationLine: 'underline' }}>Reenviar link</Text></Notice>
      )}
      {info ? <Notice>{info}</Notice> : null}
      <ErrorText>{err}</ErrorText>
      <Row label="Editar perfil" onPress={() => nav.push('EditProfile')} />
      <Row label="Fotos" value={`${p?.photos?.length || 0}/6`} onPress={() => nav.push('Photos')} />
      <Row label="Preferências de descoberta" onPress={() => nav.push('Preferences')} />
      <Row label="Ver meu perfil público" onPress={() => nav.push('ProfileView', { id: me.id, self: true })} />
      <Row label="Privacidade e notificações" onPress={() => nav.push('Privacy')} />
      <Row label="Pessoas bloqueadas" onPress={() => nav.push('Blocks')} />
      <Row label="Premium" value={me?.premium ? 'Ativo' : '›'} onPress={() => nav.push('Premium')} />
      <Row label="Central de ajuda" onPress={() => nav.push('Help')} />
      <Row label="Sair" onPress={signOut} />
      <Row label="Excluir conta" danger onPress={() => nav.push('DeleteAccount')} />
    </Screen>
  );
}

// ---------- Configurações de privacidade (tela 18) ----------
export function Privacy() {
  const { nav, me, refreshMe } = useApp();
  const [s, setS] = useState(me?.settings || {});
  const [vis, setVis] = useState(me?.profile?.visibility || {});
  const [err, setErr] = useState('');
  const saveSettings = async (patch) => {
    const next = { ...s, ...patch }; setS(next);
    try { await api('/api/me/settings', { method: 'PUT', body: next }); refreshMe(); } catch (e) { setErr(e.message); }
  };
  const saveVis = async (patch) => {
    const next = { ...vis, ...patch }; setVis(next);
    try { await api('/api/me/profile', { method: 'PUT', body: { visibility: next } }); refreshMe(); } catch (e) { setErr(e.message); }
  };
  return (
    <Screen title="Privacidade" onBack={nav.pop}>
      <H2>Descoberta</H2>
      <Toggle label="Aparecer para novas pessoas" hint="Desligado, você some da descoberta mas mantém suas conversas." value={s.showInDiscovery !== false} onChange={(v) => saveSettings({ showInDiscovery: v })} />
      <H2>O que aparece no meu perfil</H2>
      <Toggle label="Denominação" value={!!vis.denomination} onChange={(v) => saveVis({ denomination: v })} />
      <Toggle label="Frequência na igreja" value={!!vis.church_frequency} onChange={(v) => saveVis({ church_frequency: v })} />
      <Toggle label="Importância da oração" value={!!vis.prayer_importance} onChange={(v) => saveVis({ prayer_importance: v })} />
      <Toggle label="Versículo favorito" value={!!vis.favorite_verse} onChange={(v) => saveVis({ favorite_verse: v })} />
      <P muted style={{ marginTop: 8, fontSize: 13 }}>Nunca mostramos seu e-mail, sua data de nascimento ou sua localização exata.</P>
      <H2>Notificações</H2>
      <Toggle label="Novas combinações" value={s.notifyMatches !== false} onChange={(v) => saveSettings({ notifyMatches: v })} />
      <Toggle label="Novas mensagens" value={s.notifyMessages !== false} onChange={(v) => saveSettings({ notifyMessages: v })} />
      <P muted style={{ marginTop: 8, fontSize: 13 }}>Não enviamos lembretes para "voltar ao app" nem notificações de marketing.</P>
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}

export function Blocks() {
  const { nav } = useApp();
  const [list, setList] = useState(null);
  const load = () => api('/api/blocks').then((r) => setList(r.blocks)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  return (
    <Screen title="Bloqueados" onBack={nav.pop}>
      {!list ? <Loading /> : !list.length ? <P muted>Você não bloqueou ninguém.</P> : list.map((b) => (
        <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <P>{b.name || 'Conta'}</P>
          <Button kind="ghost" title="Desbloquear" onPress={async () => { await api(`/api/blocks/${b.id}`, { method: 'DELETE' }); load(); }} />
        </View>
      ))}
    </Screen>
  );
}

// ---------- Plano premium (tela 17) ----------
export function Premium() {
  const { nav, refreshMe } = useApp();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api('/api/premium').then(setD).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const devActivate = async () => {
    try { const r = await api('/api/premium/dev-activate', { method: 'POST', body: {} }); setMsg(r.note); await refreshMe(); load(); } catch (e) { setMsg(e.message); }
  };
  if (!d) return <Screen title="Premium" onBack={nav.pop}><Loading /></Screen>;
  return (
    <Screen title="Premium" onBack={nav.pop}>
      <H1>Conexão de Fé Premium</H1>
      {d.active && <Notice>Seu Premium está ativo até {new Date(d.premiumUntil.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}.</Notice>}
      <Card>{d.benefits.map((b) => <P key={b} style={{ marginBottom: 6 }}>✦ {b}</P>)}</Card>
      <P muted>{d.notIncluded}</P>
      <H2>Planos</H2>
      {d.plans.map((p) => (
        <Card key={p.id}><Text style={{ fontWeight: '700', color: colors.navy, fontSize: 16 }}>{p.label}</Text><P muted>{p.price ? p.price : 'Preço a definir'}</P></Card>
      ))}
      <Notice>{d.priceNote}</Notice>
      {d.devActivateAvailable && <Button kind="gold" title="Ativar Premium de teste (somente desenvolvimento)" onPress={devActivate} />}
      {msg ? <P muted style={{ marginTop: 8 }}>{msg}</P> : null}
    </Screen>
  );
}

// ---------- Exclusão de conta (tela 21) ----------
export function DeleteAccount() {
  const { nav, signOut } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setErr(''); setLoading(true);
    try { await api('/api/me', { method: 'DELETE', body: { password } }); await signOut(); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  return (
    <Screen title="Excluir conta" onBack={nav.pop}>
      <H1>Sentiremos sua falta</H1>
      <P>Ao excluir, apagamos definitivamente seu perfil, fotos, preferências, curtidas, combinações e mensagens enviadas.</P>
      <P muted style={{ marginTop: 8 }}>Denúncias que envolvem sua conta podem ser mantidas de forma mínima para proteger outras pessoas, como permite a LGPD.</P>
      <View style={{ height: 16 }} />
      <Field label="Sua senha" secureTextEntry value={password} onChangeText={setPassword} />
      <Field label='Digite "EXCLUIR" para confirmar' autoCapitalize="characters" value={confirm} onChangeText={setConfirm} />
      <ErrorText>{err}</ErrorText>
      <Button kind="danger" title="Excluir minha conta" onPress={submit} loading={loading} disabled={!password || confirm.trim().toUpperCase() !== 'EXCLUIR'} />
    </Screen>
  );
}
