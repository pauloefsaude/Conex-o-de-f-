import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, Modal, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context';
import { api } from '../api';
import { colors, fonts, radius } from '../theme';
import { Screen, H1, P, Button, Avatar, Loading, ErrorText, Field, Toggle, Notice } from '../ui';

// ---------- Lista de combinações (tela 11) ----------
export function Matches() {
  const { nav, subscribe } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(null);
  const [likes, setLikes] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([api('/api/matches'), api('/api/likes/received')]);
      setList(m.matches); setLikes(l);
    } catch (e) { setErr(e.message); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe((ev) => { if (['message', 'notification', 'unmatched'].includes(ev.type)) load(); }), [subscribe, load]);

  if (list === null) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top + 8 }}>
      <Text style={st.title}>Conversas</Text>
      {likes?.count > 0 && (
        <Pressable onPress={() => likes.premiumRequired ? nav.push('Premium') : null} style={st.likes}>
          <Text style={{ color: colors.navy, fontWeight: '700' }}>{likes.count} {likes.count === 1 ? 'pessoa curtiu' : 'pessoas curtiram'} você</Text>
          <Text style={{ color: colors.navySoft, marginTop: 2 }}>
            {likes.premiumRequired ? 'Veja quem são com o Premium — ou continue descobrindo perfis.' : likes.profiles.map((p) => p.name).join(', ')}
          </Text>
        </Pressable>
      )}
      <ErrorText>{err}</ErrorText>
      <FlatList
        data={list}
        keyExtractor={(m) => String(m.matchId)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        onRefresh={load} refreshing={false}
        ListEmptyComponent={<View style={{ padding: 30 }}><P muted style={{ textAlign: 'center' }}>Quando duas pessoas se curtem, a conversa aparece aqui.</P></View>}
        renderItem={({ item: m }) => (
          <Pressable onPress={() => nav.push('Chat', { matchId: m.matchId })} style={({ pressed }) => [st.item, pressed && { opacity: 0.7 }]}>
            <Avatar uri={m.person.photo} name={m.person.name} size={58} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={st.name}>{m.person.name}{m.muted ? '  🔕' : ''}</Text>
              <Text style={[st.last, m.unread && { color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>
                {m.lastMessage ? `${m.lastMessage.mine ? 'Você: ' : ''}${m.lastMessage.body}` : 'Nova combinação — diga olá!'}
              </Text>
            </View>
            {m.unread > 0 && <View style={st.badge}><Text style={{ color: colors.navy, fontWeight: '800', fontSize: 12 }}>{m.unread}</Text></View>}
          </Pressable>
        )}
      />
    </View>
  );
}

// ---------- Chat (tela 12) + perguntas para conversar (tela 13) ----------
export function Chat({ matchId }) {
  const { nav, subscribe } = useApp();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState([]);
  const [person, setPerson] = useState(null);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [closed, setClosed] = useState('');
  const [starters, setStarters] = useState(null);
  const [menu, setMenu] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api(`/api/matches/${matchId}/messages`);
      setMsgs(r.messages); setPerson(r.person); setMuted(r.muted);
      api(`/api/matches/${matchId}/read`, { method: 'POST', body: {} }).catch(() => {});
    } catch (e) { if (e.status === 410 || e.status === 404) setClosed(e.message); else setErr(e.message); }
  }, [matchId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe((ev) => {
    if (ev.type === 'message' && ev.matchId === matchId) {
      setMsgs((m) => (m.some((x) => x.id === ev.message.id) ? m : [...m, ev.message]));
      api(`/api/matches/${matchId}/read`, { method: 'POST', body: {} }).catch(() => {});
    }
    if (ev.type === 'unmatched' && ev.matchId === matchId) setClosed('Esta conversa foi encerrada.');
  }), [subscribe, matchId]);

  const send = async (body = text) => {
    const t = body.trim(); if (!t) return;
    setErr(''); setText('');
    try { const r = await api(`/api/matches/${matchId}/messages`, { method: 'POST', body: { body: t } }); setMsgs((m) => [...m, r.message]); }
    catch (e) { setErr(e.message); setText(t); }
  };

  const openStarters = async () => {
    try { setStarters(await api(`/api/matches/${matchId}/starters`)); } catch (e) { setErr(e.message); }
  };

  const unmatch = () => Alert.alert('Desfazer combinação?', 'A conversa será encerrada para os dois.', [
    { text: 'Cancelar' },
    { text: 'Desfazer', style: 'destructive', onPress: async () => { await api(`/api/matches/${matchId}`, { method: 'DELETE' }).catch(() => {}); nav.pop(); } },
  ]);
  const toggleMute = async () => { const r = await api(`/api/matches/${matchId}/mute`, { method: 'PUT', body: { muted: !muted } }); setMuted(r.muted); setMenu(false); };

  if (closed) return <Screen title="Conversa" onBack={nav.pop}><Notice>{closed}</Notice></Screen>;
  if (!person) return <Screen title="Conversa" onBack={nav.pop}><Loading /></Screen>;

  return (
    <Screen title={person.name} onBack={nav.pop} scroll={false} padded={false}
      right={<Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel="Opções"><Text style={{ fontSize: 22, color: colors.navy }}>⋯</Text></Pressable>}>
      <Pressable onPress={() => nav.push('ProfileView', { id: person.id, matchId })} style={st.personBar}>
        <Avatar uri={person.photos[0]} name={person.name} size={34} />
        <Text style={{ marginLeft: 10, color: colors.navySoft }}>Ver perfil de {person.name}</Text>
      </Pressable>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <P muted style={{ textAlign: 'center' }}>Comece com respeito e curiosidade. Precisa de uma ideia?</P>
            <Button kind="gold" title="Sugestões de perguntas" onPress={openStarters} />
          </View>
        }
        renderItem={({ item: m }) => (
          <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            {m.warnings?.map((w) => <View key={w} style={st.warn}><Text style={{ color: colors.red, fontSize: 13, lineHeight: 18 }}>⚠ {w}</Text></View>)}
            <View style={[st.bubble, m.mine ? st.mine : st.theirs]}>
              <Text style={{ color: m.mine ? colors.white : colors.ink, fontSize: 15.5, lineHeight: 21 }}>{m.body}</Text>
            </View>
            {m.mine && m.readAt && m === msgs[msgs.length - 1] ? <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>Lida</Text> : null}
          </View>
        )}
      />
      {err ? <Text style={{ color: colors.red, paddingHorizontal: 16 }}>{err}</Text> : null}
      <View style={[st.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable onPress={openStarters} hitSlop={8} style={st.ideaBtn} accessibilityLabel="Sugestões de perguntas"><Text style={{ fontSize: 18, color: colors.gold }}>✦</Text></Pressable>
        <TextInput value={text} onChangeText={setText} placeholder="Escreva com carinho…" placeholderTextColor="#9AA0AA" style={st.input} multiline maxLength={1000} />
        <Pressable onPress={() => send()} disabled={!text.trim()} style={[st.sendBtn, !text.trim() && { opacity: 0.4 }]} accessibilityLabel="Enviar">
          <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>➤</Text>
        </Pressable>
      </View>

      <Modal visible={!!starters} transparent animationType="slide" onRequestClose={() => setStarters(null)}>
        <Pressable style={st.backdrop} onPress={() => setStarters(null)}>
          <Pressable style={st.sheet} onPress={() => {}}>
            <Text style={st.sheetTitle}>Ideias para conversar</Text>
            {starters?.sharedInterests?.length ? <P muted style={{ marginBottom: 8 }}>Em comum: {starters.sharedInterests.join(', ')}</P> : null}
            <ScrollView style={{ maxHeight: 380 }}>
              {starters?.suggestions.map((q) => (
                <Pressable key={q} onPress={() => { setText(q); setStarters(null); }} style={st.sugg}><Text style={{ color: colors.ink, lineHeight: 20 }}>{q}</Text></Pressable>
              ))}
              <Text style={[st.sheetTitle, { fontSize: 16, marginTop: 14 }]}>Para conversas mais profundas</Text>
              {starters?.deeperQuestions.map((q) => (
                <Pressable key={q} onPress={() => { setText(q); setStarters(null); }} style={st.sugg}><Text style={{ color: colors.ink, lineHeight: 20 }}>{q}</Text></Pressable>
              ))}
            </ScrollView>
            <P muted style={{ fontSize: 12, marginTop: 8 }}>Toque para colocar no campo de mensagem — você pode editar antes de enviar.</P>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={st.backdrop} onPress={() => setMenu(false)}>
          <View style={st.sheet}>
            <Button kind="ghost" title={muted ? 'Ativar notificações' : 'Silenciar conversa'} onPress={toggleMute} />
            <Button kind="ghost" title="Desfazer combinação" onPress={() => { setMenu(false); unmatch(); }} />
            <Button kind="danger" title="Denunciar ou bloquear" onPress={() => { setMenu(false); nav.push('Report', { userId: person.id, name: person.name, matchId, messages: msgs.filter((m) => !m.mine) }); }} />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ---------- Denúncia e bloqueio (tela 19) ----------
const REASONS = [
  ['perfil_falso', 'Perfil falso'], ['golpe_dinheiro', 'Pedido de dinheiro / golpe'], ['assedio', 'Assédio ou desrespeito'],
  ['conteudo_improprio', 'Conteúdo impróprio'], ['discriminacao', 'Discriminação'], ['menor_de_idade', 'Parece ser menor de 18 anos'],
  ['spam', 'Spam ou propaganda'], ['outro', 'Outro motivo'],
];

export function Report({ userId, name, matchId, messages = [] }) {
  const { nav } = useApp();
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [messageId, setMessageId] = useState(null);
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(''); setLoading(true);
    try {
      const r = await api('/api/reports', { method: 'POST', body: { userId, reason, details, messageId, block: alsoBlock } });
      setSent(r.message);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  const blockOnly = async () => {
    try { await api('/api/blocks', { method: 'POST', body: { userId } }); nav.reset('Main', { tab: 'matches' }); } catch (e) { setErr(e.message); }
  };

  if (sent) return (
    <Screen title="Denúncia enviada" onBack={() => nav.reset('Main', { tab: matchId ? 'matches' : 'discover' })}>
      <H1>Obrigado por nos avisar</H1>
      <P>{sent}</P>
      {alsoBlock && <P muted style={{ marginTop: 8 }}>{name} foi bloqueado(a) e não poderá ver seu perfil nem falar com você.</P>}
      <Button title="Voltar" onPress={() => nav.reset('Main', { tab: matchId ? 'matches' : 'discover' })} />
    </Screen>
  );

  return (
    <Screen title={`Denunciar ${name}`} onBack={nav.pop}>
      <P muted>A pessoa não saberá quem denunciou. Se você estiver em perigo, ligue 190.</P>
      <View style={{ marginTop: 14 }}>
        {REASONS.map(([k, l]) => (
          <Pressable key={k} onPress={() => setReason(k)} style={[st.reason, reason === k && { borderColor: colors.navy, backgroundColor: '#EEF0F6' }]}>
            <Text style={{ color: colors.ink, fontSize: 15.5 }}>{reason === k ? '◉' : '○'}  {l}</Text>
          </Pressable>
        ))}
      </View>
      {messages.length > 0 && (
        <>
          <Text style={{ fontWeight: '700', color: colors.navy, marginTop: 14, marginBottom: 6 }}>Qual mensagem? (opcional)</Text>
          {messages.slice(-5).map((m) => (
            <Pressable key={m.id} onPress={() => setMessageId(messageId === m.id ? null : m.id)} style={[st.reason, messageId === m.id && { borderColor: colors.red }]}>
              <Text numberOfLines={2} style={{ color: colors.ink }}>{m.body}</Text>
            </Pressable>
          ))}
        </>
      )}
      <View style={{ height: 10 }} />
      <Field label="Detalhes (opcional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
      <Toggle label={`Também bloquear ${name}`} value={alsoBlock} onChange={setAlsoBlock} />
      <ErrorText>{err}</ErrorText>
      <Button kind="danger" title="Enviar denúncia" onPress={submit} loading={loading} disabled={!reason} />
      <Button kind="ghost" title="Só bloquear, sem denunciar" onPress={blockOnly} />
    </Screen>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.navy, fontWeight: '600', paddingHorizontal: 18, marginBottom: 10 },
  likes: { marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.goldSoft },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontSize: 16.5, fontWeight: '700', color: colors.navy },
  last: { color: colors.mute, marginTop: 2 },
  badge: { backgroundColor: colors.gold, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  personBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { backgroundColor: colors.navy, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  warn: { backgroundColor: colors.redSoft, borderRadius: 10, padding: 8, marginBottom: 4, maxWidth: '85%' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper, gap: 8 },
  ideaBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15.5, color: colors.ink },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 21, color: colors.navy, marginBottom: 8, fontWeight: '600' },
  sugg: { backgroundColor: colors.white, borderRadius: radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.line },
  reason: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.md, padding: 14, marginBottom: 8 },
});
