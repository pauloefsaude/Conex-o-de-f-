import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Dimensions, Pressable } from 'react-native';
import { useApp } from '../context';
import { api } from '../api';
import { colors, fonts, radius } from '../theme';
import { Screen, H2, P, Chip, Button, Loading, ErrorText, Card, Avatar } from '../ui';

const W = Dimensions.get('window').width;

export default function ProfileView({ id, fromDiscover, matchId }) {
  const { nav } = useApp();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  useEffect(() => { api(`/api/users/${id}`).then(setP).catch((e) => setErr(e.message)); }, [id]);

  const swipe = async (action) => {
    try {
      const r = await api('/api/swipes', { method: 'POST', body: { toUserId: id, action } });
      if (r.matched) return nav.replace('Chat', { matchId: r.matchId });
      setDone(action === 'like' ? 'Curtida enviada. Se for recíproco, a conversa é liberada.' : 'Perfil passado.');
    } catch (e) { setErr(e.message); }
  };

  if (err && !p) return <Screen title="Perfil" onBack={nav.pop}><ErrorText>{err}</ErrorText></Screen>;
  if (!p) return <Screen title="Perfil" onBack={nav.pop}><Loading /></Screen>;

  return (
    <Screen title={p.name} onBack={nav.pop} padded={false}
      right={<Pressable onPress={() => nav.push('Report', { userId: p.id, name: p.name, matchId })} hitSlop={10}><Text style={{ fontSize: 22, color: colors.navy }}>⋯</Text></Pressable>}>
      {p.photos.length ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {p.photos.map((u) => <Image key={u} source={{ uri: u }} style={{ width: W, height: W * 1.2, backgroundColor: colors.line }} />)}
        </ScrollView>
      ) : <View style={{ height: 220, backgroundColor: colors.navy2, alignItems: 'center', justifyContent: 'center' }}><Avatar name={p.name} size={120} /></View>}

      <View style={{ padding: 20 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.navy, fontWeight: '600' }}>{p.name}, {p.age}</Text>
        <P muted>{[p.city && `${p.city} – ${p.region}`, p.distance].filter(Boolean).join(' · ')}</P>
        {p.badges.includes('email_verificado') && <P muted style={{ marginTop: 4 }}>✓ E-mail verificado (não é verificação de identidade)</P>}

        {p.reasons?.length ? (
          <Card style={{ marginTop: 16, backgroundColor: colors.goldSoft, borderColor: colors.goldSoft }}>
            <Text style={{ fontWeight: '700', color: colors.navy, marginBottom: 6 }}>Afinidade declarada: {p.compatibility}%</Text>
            {p.reasons.map((r) => <P key={r}>• {r}</P>)}
          </Card>
        ) : null}

        {p.bio ? <><H2>Sobre</H2><P>{p.bio}</P></> : null}

        <H2>Relacionamento</H2>
        {p.relationshipGoal && <P>Procura: {p.relationshipGoal}</P>}
        {p.wantsChildren && <P>Filhos: {p.wantsChildren}</P>}
        {p.future ? <P style={{ marginTop: 6 }}>{p.future}</P> : null}

        {(p.denomination || p.churchFrequency || p.prayerImportance || p.favoriteVerse) ? <H2>Fé</H2> : null}
        {p.denomination && <P>Tradição: {p.denomination}</P>}
        {p.churchFrequency && <P>Participação: {p.churchFrequency}</P>}
        {p.prayerImportance && <P>Oração na rotina: {'●'.repeat(p.prayerImportance)}{'○'.repeat(5 - p.prayerImportance)}</P>}
        {p.favoriteVerse && <P>Versículo favorito: {p.favoriteVerse}</P>}

        {p.values.length ? <><H2>Valores</H2><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{p.values.map((v) => <Chip key={v} label={v} small />)}</View></> : null}
        {p.interests.length ? <><H2>Interesses</H2><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{p.interests.map((v) => <Chip key={v} label={v} small selected={p.sharedInterests?.includes(v)} />)}</View></> : null}

        {p.answers.map((a) => (
          <Card key={a.q} style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 13, color: colors.mute, marginBottom: 6 }}>{a.q}</Text>
            <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.navy, lineHeight: 25 }}>{a.a}</Text>
          </Card>
        ))}

        <ErrorText>{err}</ErrorText>
        {fromDiscover && !done && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button kind="ghost" title="Passar" style={{ flex: 1 }} onPress={() => swipe('pass')} />
            <Button kind="gold" title="Curtir" style={{ flex: 1 }} onPress={() => swipe('like')} />
          </View>
        )}
        {done ? <P muted style={{ marginTop: 16 }}>{done}</P> : null}
      </View>
    </Screen>
  );
}
