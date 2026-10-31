import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context';
import { api } from '../api';
import { colors, radius } from '../theme';
import { Screen, H1, H2, P, Button, Field, ChipGroup, Chip, Toggle, ErrorText, Notice, Loading, Card } from '../ui';

// ---------- Criação / edição do perfil (tela 7) ----------
export function EditProfile({ onboarding }) {
  const { nav, me, options, refreshMe } = useApp();
  const p = me?.profile || {};
  const [f, setF] = useState({
    displayName: p.displayName || '', gender: p.gender || null, seeking: p.seeking || null, cityKey: p.cityKey || null,
    bio: p.bio || '', denomination: p.denomination || null, churchFrequency: p.churchFrequency || null,
    prayerImportance: p.prayerImportance || null, relationshipGoal: p.relationshipGoal || null, wantsChildren: p.wantsChildren || null,
    values: p.values || [], interests: p.interests || [], favoriteVerse: p.favoriteVerse || '', future: p.future || '',
    answers: p.answers || [], visibility: p.visibility || { denomination: false, church_frequency: false, prayer_importance: false, favorite_verse: true },
  });
  const [cityQuery, setCityQuery] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [tips, setTips] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  if (!options) return <Loading />;
  const cities = options.cities.filter((c) => !cityQuery || c.name.toLowerCase().includes(cityQuery.toLowerCase())).slice(0, cityQuery ? 12 : 8);
  const selectedCity = options.cities.find((c) => c.key === f.cityKey);

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      await api('/api/me/profile', { method: 'PUT', body: f });
      await refreshMe();
      if (onboarding) nav.replace('Preferences', { onboarding: true }); else nav.pop();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const askTips = async () => {
    try { setTips(await api('/api/ai/bio-suggestions', { method: 'POST', body: {} })); } catch (e) { setErr(e.message); }
  };

  const setAnswer = (q, a) => {
    const others = f.answers.filter((x) => x.q !== q);
    set('answers')(a ? [...others, { q, a }].slice(0, 3) : others);
  };

  return (
    <Screen title={onboarding ? 'Seu perfil' : 'Editar perfil'} onBack={onboarding ? undefined : nav.pop}>
      {onboarding && <><H1>Vamos montar seu perfil</H1><P muted>Só o essencial é obrigatório. O restante ajuda a encontrar pessoas com valores parecidos.</P></>}

      <H2>Sobre você</H2>
      <Field label="Nome de exibição" value={f.displayName} onChangeText={set('displayName')} maxLength={40} hint="Pode ser só o primeiro nome." />
      <Text style={lbl}>Eu sou</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Chip label="Homem" selected={f.gender === 'man'} onPress={() => set('gender')('man')} />
        <Chip label="Mulher" selected={f.gender === 'woman'} onPress={() => set('gender')('woman')} />
      </View>
      <Text style={lbl}>Quero conhecer</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Chip label="Homens" selected={f.seeking === 'man'} onPress={() => set('seeking')('man')} />
        <Chip label="Mulheres" selected={f.seeking === 'woman'} onPress={() => set('seeking')('woman')} />
      </View>

      <Text style={lbl}>Cidade</Text>
      {selectedCity ? <P style={{ marginBottom: 8 }}>📍 {selectedCity.name} – {selectedCity.uf}</P> : null}
      <Field placeholder="Buscar cidade" value={cityQuery} onChangeText={setCityQuery} hint="Mostramos só a cidade e uma faixa de distância. Nunca sua localização exata." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        {cities.map((c) => <Chip small key={c.key} label={`${c.name} – ${c.uf}`} selected={f.cityKey === c.key} onPress={() => set('cityKey')(c.key)} />)}
      </View>

      <Field label="Biografia" value={f.bio} onChangeText={set('bio')} multiline maxLength={500} hint={`${f.bio.length}/500 · Sem telefones ou links — isso fica para a conversa.`} />
      <Button kind="ghost" title="Sugestões para minha biografia" onPress={askTips} />
      {tips && (
        <Card>
          {tips.tips.map((t, i) => <P key={i} style={{ marginBottom: 6 }}>• {t}</P>)}
          {tips.example ? <P muted style={{ marginTop: 6, fontStyle: 'italic' }}>Exemplo: {tips.example}</P> : null}
          <P muted style={{ fontSize: 12, marginTop: 6 }}>{tips.source === 'ia' ? 'Sugestões geradas por IA com base no que você informou. Revise antes de usar.' : 'Dicas gerais (IA não configurada neste servidor).'}</P>
        </Card>
      )}

      <H2>Relacionamento</H2>
      <Text style={lbl}>O que você procura</Text>
      <ChipGroup options={options.relationshipGoals} value={f.relationshipGoal} onChange={set('relationshipGoal')} />
      <Text style={[lbl, { marginTop: 14 }]}>Filhos</Text>
      <ChipGroup options={options.wantsChildren} value={f.wantsChildren} onChange={set('wantsChildren')} />
      <Text style={[lbl, { marginTop: 14 }]}>Valores importantes (até 5)</Text>
      <ChipGroup multiple max={5} options={options.values} value={f.values} onChange={set('values')} />
      <Text style={[lbl, { marginTop: 14 }]}>Interesses e hobbies (até 10)</Text>
      <ChipGroup multiple max={10} options={options.interests} value={f.interests} onChange={set('interests')} />
      <View style={{ height: 14 }} />
      <Field label="Expectativas para o futuro" value={f.future} onChangeText={set('future')} multiline maxLength={300} />

      <H2>Fé</H2>
      <Notice>Estas informações são opcionais e ficam ocultas até você decidir mostrá-las.</Notice>
      <Text style={lbl}>Denominação ou tradição</Text>
      <ChipGroup options={options.denominations} value={f.denomination} onChange={set('denomination')} />
      <Toggle label="Mostrar no meu perfil" value={!!f.visibility.denomination} onChange={(v) => set('visibility')({ ...f.visibility, denomination: v })} />
      <Text style={[lbl, { marginTop: 14 }]}>Participação em atividades da igreja</Text>
      <ChipGroup options={options.churchFrequency} value={f.churchFrequency} onChange={set('churchFrequency')} />
      <Toggle label="Mostrar no meu perfil" value={!!f.visibility.church_frequency} onChange={(v) => set('visibility')({ ...f.visibility, church_frequency: v })} />
      <Text style={[lbl, { marginTop: 14 }]}>Importância da oração na rotina</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => <Chip key={n} label={String(n)} selected={f.prayerImportance === n} onPress={() => set('prayerImportance')(f.prayerImportance === n ? null : n)} />)}
      </View>
      <P muted style={{ fontSize: 12, marginTop: 4 }}>1 = pouca · 5 = central</P>
      <Toggle label="Mostrar no meu perfil" value={!!f.visibility.prayer_importance} onChange={(v) => set('visibility')({ ...f.visibility, prayer_importance: v })} />
      <View style={{ height: 14 }} />
      <Field label="Versículo favorito (opcional)" value={f.favoriteVerse} onChangeText={set('favoriteVerse')} maxLength={200} placeholder="Ex.: Salmos 23" />

      <H2>Perguntas para se conhecer (até 3)</H2>
      <P muted style={{ marginBottom: 10 }}>Responda as que fizerem sentido para você.</P>
      {options.questions.map((q) => {
        const cur = f.answers.find((a) => a.q === q)?.a || '';
        const disabled = !cur && f.answers.length >= 3;
        return <Field key={q} label={q} value={cur} editable={!disabled} placeholder={disabled ? 'Limite de 3 respostas' : 'Sua resposta'}
          onChangeText={(t) => setAnswer(q, t)} multiline maxLength={300} />;
      })}

      <ErrorText>{err}</ErrorText>
      <Button title={onboarding ? 'Continuar' : 'Salvar'} onPress={save} loading={saving}
        disabled={!f.displayName || !f.gender || !f.seeking || !f.cityKey} />
    </Screen>
  );
}
const lbl = { fontSize: 13, fontWeight: '600', color: colors.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 };

// ---------- Preferências de descoberta (tela 6) ----------
export function Preferences({ onboarding }) {
  const { nav, me, options } = useApp();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { api('/api/me/preferences').then(setP).catch((e) => setErr(e.message)); }, []);
  if (!p || !options) return <Loading />;
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v }));
  const step = (k, d, min, max) => set(k)(Math.max(min, Math.min(max, p[k] + d)));

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      await api('/api/me/preferences', { method: 'PUT', body: p });
      if (onboarding) nav.replace('Photos', { onboarding: true }); else nav.pop();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <Screen title="Preferências" onBack={onboarding ? undefined : nav.pop}>
      <H1>Quem você quer conhecer?</H1>
      <P muted>Você pode mudar isso quando quiser.</P>
      <H2>Faixa etária</H2>
      <Stepper label="De" value={p.ageMin} onMinus={() => step('ageMin', -1, 18, p.ageMax)} onPlus={() => step('ageMin', 1, 18, p.ageMax)} />
      <Stepper label="Até" value={p.ageMax} onMinus={() => step('ageMax', -1, p.ageMin, 99)} onPlus={() => step('ageMax', 1, p.ageMin, 99)} />
      <H2>Distância aproximada</H2>
      <ChipGroup options={['50 km', '100 km', '300 km', '1000 km', 'Brasil todo']}
        value={{ 50: '50 km', 100: '100 km', 300: '300 km', 1000: '1000 km', 5000: 'Brasil todo' }[p.maxDistanceKm] || null}
        onChange={(v) => v && set('maxDistanceKm')({ '50 km': 50, '100 km': 100, '300 km': 300, '1000 km': 1000, 'Brasil todo': 5000 }[v])} />
      <H2>Intenção de relacionamento</H2>
      <P muted style={{ marginBottom: 8 }}>Nenhuma marcada = todas.</P>
      <ChipGroup multiple options={options.relationshipGoals} value={p.goals} onChange={set('goals')} />
      <H2>Denominação</H2>
      <P muted style={{ marginBottom: 8 }}>Opcional. Ao filtrar, só aparecem pessoas que escolheram mostrar a denominação.</P>
      <ChipGroup multiple options={options.denominations.filter((d) => d !== 'Prefiro não dizer')} value={p.denominations} onChange={set('denominations')} />
      <ErrorText>{err}</ErrorText>
      <View style={{ height: 12 }} />
      <Button title={onboarding ? 'Continuar' : 'Salvar'} onPress={save} loading={saving} />
    </Screen>
  );
}

function Stepper({ label, value, onMinus, onPlus }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <P>{label}</P>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Chip label="−" onPress={onMinus} />
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.navy, minWidth: 30, textAlign: 'center' }}>{value}</Text>
        <Chip label="+" onPress={onPlus} />
      </View>
    </View>
  );
}

// ---------- Fotos (tela 8) ----------
export function Photos({ onboarding }) {
  const { nav, me, refreshMe } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const photos = me?.profile?.photos || [];

  const add = async () => {
    setErr('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr('Sem permissão para acessar suas fotos. Você pode liberar nas configurações do celular.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.7, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    setBusy(true);
    try { await api('/api/me/photos', { method: 'POST', body: { data: r.assets[0].base64 } }); await refreshMe(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = (id) => Alert.alert('Remover foto?', '', [{ text: 'Cancelar' }, { text: 'Remover', style: 'destructive', onPress: async () => {
    try { await api(`/api/me/photos/${id}`, { method: 'DELETE' }); await refreshMe(); } catch (e) { setErr(e.message); }
  } }]);

  return (
    <Screen title="Fotos" onBack={onboarding ? undefined : nav.pop}>
      <H1>Mostre quem você é</H1>
      <P muted>Fotos recentes, com o rosto visível e sem outras pessoas identificáveis. Elas passam por moderação.</P>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        {photos.map((ph) => (
          <Pressable key={ph.id} onLongPress={() => remove(ph.id)} onPress={() => remove(ph.id)} style={{ width: '31%' }}>
            <Image source={{ uri: ph.url }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.line }} />
            {ph.status === 'pending' && <Text style={{ fontSize: 11, color: colors.mute, marginTop: 3 }}>Em análise</Text>}
          </Pressable>
        ))}
        {photos.length < 6 && (
          <Pressable onPress={add} disabled={busy} style={{ width: '31%', aspectRatio: 3 / 4, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.navySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 30, color: colors.navySoft }}>{busy ? '…' : '+'}</Text>
          </Pressable>
        )}
      </View>
      <ErrorText>{err}</ErrorText>
      <View style={{ height: 20 }} />
      {onboarding
        ? <Button title={photos.length ? 'Começar a conhecer pessoas' : 'Pular por enquanto'} kind={photos.length ? 'primary' : 'ghost'} onPress={() => nav.reset('Main')} />
        : <Button title="Pronto" onPress={nav.pop} />}
    </Screen>
  );
}
