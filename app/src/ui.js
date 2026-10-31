import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from './theme';

// Logotipo original: dois anéis entrelaçados (dois corações/vidas) com um traço dourado
// vertical no ponto de encontro — fé discreta, sem excesso de símbolos.
export function Logo({ size = 72, light = false }) {
  const ring = size * 0.62, stroke = Math.max(2, size * 0.07);
  const c1 = light ? colors.white : colors.navy;
  return (
    <View style={{ width: size, height: size * 0.7, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Logotipo Conexão de Fé">
      <View style={{ position: 'absolute', left: size * 0.06, width: ring, height: ring, borderRadius: ring, borderWidth: stroke, borderColor: c1 }} />
      <View style={{ position: 'absolute', right: size * 0.06, width: ring, height: ring, borderRadius: ring, borderWidth: stroke, borderColor: colors.gold }} />
      <View style={{ position: 'absolute', width: stroke * 0.9, height: ring * 0.46, backgroundColor: colors.gold, borderRadius: stroke }} />
      <View style={{ position: 'absolute', top: size * 0.7 / 2 - ring * 0.1, width: ring * 0.26, height: stroke * 0.9, backgroundColor: colors.gold, borderRadius: stroke }} />
    </View>
  );
}

export function Screen({ children, title, onBack, right, scroll = true, dark = false, padded = true }) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: dark ? colors.navy : colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top, backgroundColor: dark ? colors.navy : colors.paper }}>
        {(title || onBack) && (
          <View style={s.header}>
            {onBack ? <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Voltar"><Text style={[s.back, dark && { color: colors.white }]}>‹</Text></Pressable> : <View style={{ width: 24 }} />}
            <Text style={[s.headerTitle, dark && { color: colors.white }]} numberOfLines={1}>{title}</Text>
            <View style={{ minWidth: 24, alignItems: 'flex-end' }}>{right}</View>
          </View>
        )}
      </View>
      <Body style={{ flex: 1 }} contentContainerStyle={scroll ? { padding: padded ? 20 : 0, paddingBottom: 40 + insets.bottom } : undefined} keyboardShouldPersistTaps="handled">
        {scroll ? children : <View style={{ flex: 1, padding: padded ? 20 : 0 }}>{children}</View>}
      </Body>
    </KeyboardAvoidingView>
  );
}

export function H1({ children, light, style }) { return <Text style={[s.h1, light && { color: colors.white }, style]}>{children}</Text>; }
export function H2({ children, style }) { return <Text style={[s.h2, style]}>{children}</Text>; }
export function P({ children, muted, light, style }) {
  return <Text style={[s.p, muted && { color: colors.mute }, light && { color: '#D6DCEB' }, style]}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'primary', loading, disabled, style }) {
  const st = { primary: [s.btn, s.btnPrimary], gold: [s.btn, s.btnGold], ghost: [s.btn, s.btnGhost], danger: [s.btn, s.btnDanger], light: [s.btn, s.btnLight] }[kind];
  const tc = { primary: colors.white, gold: colors.navy, ghost: colors.navy, danger: colors.white, light: colors.navy }[kind];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ pressed }) => [...st, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}>
      {loading ? <ActivityIndicator color={tc} /> : <Text style={[s.btnText, { color: tc }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#9AA0AA" style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, error && { borderColor: colors.red }]} {...props} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, small }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: !!selected }}
      style={[s.chip, small && { paddingVertical: 5, paddingHorizontal: 10 }, selected && s.chipOn]}>
      <Text style={[s.chipText, small && { fontSize: 13 }, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({ options, value, onChange, multiple, max }) {
  const sel = multiple ? value || [] : [value];
  return (
    <View style={s.chips}>
      {options.map((o) => (
        <Chip key={o} label={o} selected={sel.includes(o)} onPress={() => {
          if (!multiple) return onChange(value === o ? null : o);
          if (sel.includes(o)) onChange(sel.filter((x) => x !== o));
          else if (!max || sel.length < max) onChange([...sel, o]);
        }} />
      ))}
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={s.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <View style={[s.switch, value && { backgroundColor: colors.navy }]}>
        <View style={[s.knob, value && { transform: [{ translateX: 18 }] }]} />
      </View>
    </Pressable>
  );
}

export function Card({ children, style }) { return <View style={[s.card, style]}>{children}</View>; }

export function ErrorText({ children }) { return children ? <Text style={s.error}>{children}</Text> : null; }

export function Notice({ children, kind = 'info' }) {
  const bg = { info: colors.goldSoft, warn: colors.redSoft }[kind];
  return <View style={[s.notice, { backgroundColor: bg }]}><Text style={{ color: colors.ink, lineHeight: 20 }}>{children}</Text></View>;
}

export function Avatar({ uri, name, size = 56 }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.line }} />;
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.navy2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.gold, fontFamily: fonts.serif, fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function Row({ label, value, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: '#EFEBE2' }]}>
      <Text style={[s.rowLabel, danger && { color: colors.red }]}>{label}</Text>
      <Text style={s.rowValue}>{value ?? '›'}</Text>
    </Pressable>
  );
}

export const Loading = () => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}><ActivityIndicator color={colors.navy} /></View>;

export const s = StyleSheet.create({
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  back: { fontSize: 34, lineHeight: 36, color: colors.navy, width: 24 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 18, color: colors.navy, fontWeight: '600' },
  h1: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.navy, fontWeight: '600', marginBottom: 8 },
  h2: { fontFamily: fonts.serif, fontSize: 19, color: colors.navy, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  p: { fontSize: 15, lineHeight: 22, color: colors.ink },
  btn: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, marginVertical: 6 },
  btnPrimary: { backgroundColor: colors.navy },
  btnGold: { backgroundColor: colors.gold },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.navy },
  btnDanger: { backgroundColor: colors.red },
  btnLight: { backgroundColor: colors.white },
  btnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.ink },
  hint: { fontSize: 12.5, color: colors.mute, marginTop: 5, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.ink, fontSize: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  toggleLabel: { fontSize: 15.5, color: colors.ink },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#CFC8B8', padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  error: { color: colors.red, marginVertical: 8, lineHeight: 20 },
  notice: { borderRadius: radius.md, padding: 14, marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { fontSize: 16, color: colors.ink },
  rowValue: { fontSize: 15, color: colors.mute },
});
