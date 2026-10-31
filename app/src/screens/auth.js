import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useApp } from '../context';
import { api, session, API_URL } from '../api';
import { colors, fonts } from '../theme';
import { Screen, Logo, H1, P, Button, Field, ErrorText, Toggle, Notice } from '../ui';

export function Splash() {
  const { nav, enter } = useApp();
  useEffect(() => {
    (async () => {
      const t = await session.load();
      await new Promise((r) => setTimeout(r, 900));
      if (!t) return nav.reset('Intro');
      try { await enter(); } catch { await session.clear(); nav.reset('Intro'); }
    })();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={120} light />
      <Text style={{ fontFamily: fonts.serif, color: colors.white, fontSize: 30, marginTop: 24 }}>Conexão de Fé</Text>
      <Text style={{ color: colors.gold, marginTop: 8, letterSpacing: 0.5 }}>Dois corações, uma fé, um propósito.</Text>
    </View>
  );
}

const SLIDES = [
  { t: 'Conheça pessoas que compartilham sua fé', d: 'Católicos e evangélicos de várias tradições, com intenção de amizade, namoro sério ou casamento.' },
  { t: 'Compatibilidade que você entende', d: 'Mostramos por que alguém foi sugerido: objetivos, valores e interesses em comum. Sem promessas mágicas.' },
  { t: 'Segurança em primeiro lugar', d: 'Conversa só depois de curtida mútua. Bloqueio imediato, denúncia simples e alertas contra golpes.' },
];

export function Intro() {
  const { nav } = useApp();
  const [i, setI] = useState(0);
  return (
    <Screen dark scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Logo size={84} light />
        <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.white, marginTop: 28 }}>{SLIDES[i].t}</Text>
        <P light style={{ marginTop: 12, fontSize: 16, lineHeight: 24 }}>{SLIDES[i].d}</P>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
          {SLIDES.map((_, k) => (
            <Pressable key={k} onPress={() => setI(k)} hitSlop={8} accessibilityLabel={`Página ${k + 1}`}>
              <View style={{ width: k === i ? 26 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? colors.gold : colors.navySoft }} />
            </Pressable>
          ))}
        </View>
      </View>
      {i < SLIDES.length - 1
        ? <Button kind="light" title="Continuar" onPress={() => setI(i + 1)} />
        : <Button kind="gold" title="Criar minha conta" onPress={() => nav.push('Register')} />}
      <Button kind="ghost" title="Já tenho conta" onPress={() => nav.push('Login')} style={{ borderColor: '#8C97B5' }} />
      <Text style={{ color: '#8C97B5', textAlign: 'center', fontSize: 12, marginTop: 8 }}>Exclusivo para maiores de 18 anos.</Text>
    </Screen>
  );
}

// Máscara simples DD/MM/AAAA → AAAA-MM-DD
const maskDate = (t) => t.replace(/\D/g, '').slice(0, 8).replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
const toIso = (d) => { const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

export function Register() {
  const { nav, enter } = useApp();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birth, setBirth] = useState('');
  const [terms, setTerms] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const next = () => {
    setErr('');
    const iso = toIso(birth);
    if (!iso) return setErr('Informe a data no formato DD/MM/AAAA.');
    const b = new Date(iso + 'T00:00:00'); const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
    if (age < 18) return setErr('O Conexão de Fé é exclusivo para maiores de 18 anos.');
    setStep(2);
  };

  const submit = async () => {
    setErr(''); setLoading(true);
    try {
      const r = await api('/api/auth/register', { method: 'POST', body: {
        email, password, birthdate: toIso(birth), acceptTerms: terms, acceptPrivacy: terms, acceptSensitiveData: sensitive } });
      await enter(r.token);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  if (step === 1) return (
    <Screen title="Verificação de idade" onBack={nav.pop}>
      <H1>Qual é a sua data de nascimento?</H1>
      <P muted>Usamos apenas para confirmar que você tem 18 anos ou mais e mostrar sua idade no perfil — nunca a data completa.</P>
      <View style={{ height: 20 }} />
      <Field label="Data de nascimento" placeholder="DD/MM/AAAA" keyboardType="number-pad" value={birth} onChangeText={(t) => setBirth(maskDate(t))} maxLength={10} />
      <ErrorText>{err}</ErrorText>
      <Button title="Continuar" onPress={next} />
    </Screen>
  );

  return (
    <Screen title="Criar conta" onBack={() => setStep(1)}>
      <H1>Seus dados de acesso</H1>
      <Field label="E-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field label="Senha" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} hint="Mínimo de 8 caracteres, com letras e números." />
      <Toggle value={terms} onChange={setTerms} label="Li e aceito os Termos de Uso e a Política de Privacidade" />
      <Toggle value={sensitive} onChange={setSensitive}
        label="Autorizo o tratamento das minhas informações religiosas"
        hint="Denominação, frequência e oração são dados sensíveis pela LGPD. Você decide o que fica visível e pode excluir tudo quando quiser." />
      <Pressable onPress={() => Linking.openURL(`${API_URL}/termos`)}><Text style={{ color: colors.navySoft, marginTop: 10, textDecorationLine: 'underline' }}>Ler os documentos</Text></Pressable>
      <ErrorText>{err}</ErrorText>
      <Button title="Criar conta" onPress={submit} loading={loading} disabled={!terms || !sensitive || !email || !password} />
    </Screen>
  );
}

export function Login({ expired }) {
  const { nav, enter } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(expired ? 'Sua sessão expirou. Entre novamente.' : '');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setErr(''); setLoading(true);
    try { const r = await api('/api/auth/login', { method: 'POST', body: { email, password } }); await enter(r.token); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  return (
    <Screen title="Entrar" onBack={nav.pop}>
      <H1>Que bom ver você de novo</H1>
      <View style={{ height: 12 }} />
      <Field label="E-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field label="Senha" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} />
      <ErrorText>{err}</ErrorText>
      <Button title="Entrar" onPress={submit} loading={loading} disabled={!email || !password} />
      <Button kind="ghost" title="Esqueci minha senha" onPress={() => nav.push('Forgot')} />
    </Screen>
  );
}

export function Forgot() {
  const { nav } = useApp();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setErr(''); setLoading(true);
    try { const r = await api('/api/auth/forgot-password', { method: 'POST', body: { email } }); setMsg(r.message); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  return (
    <Screen title="Recuperar senha" onBack={nav.pop}>
      <P>Informe seu e-mail. Se houver uma conta, enviaremos um link para criar uma nova senha.</P>
      <View style={{ height: 16 }} />
      <Field label="E-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <ErrorText>{err}</ErrorText>
      {msg ? <Notice>{msg}</Notice> : <Button title="Enviar link" onPress={submit} loading={loading} disabled={!email} />}
    </Screen>
  );
}
