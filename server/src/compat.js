// Compatibilidade declarada e explicável. Não é previsão espiritual nem garantia de nada.
export function distanceKm(a, b) {
  if ([a.lat, a.lng, b.lat, b.lng].some((v) => v == null)) return null;
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceBand(km) {
  if (km == null) return null;
  if (km < 10) return 'Na mesma cidade';
  if (km < 50) return 'A menos de 50 km';
  if (km < 200) return 'A menos de 200 km';
  return 'A mais de 200 km';
}

const CHILD_GROUP = { 'Quero ter': 'yes', 'Já tenho e quero mais': 'yes', 'Já tenho': 'no-more', 'Não quero': 'no', 'Ainda não sei': 'open' };

export function compatibility(me, other, km) {
  let score = 0; const reasons = [];
  const shared = me.interests.filter((i) => other.interests.includes(i));
  if (shared.length) { score += Math.min(30, shared.length * 6); reasons.push(`${shared.length} interesse(s) em comum`); }

  if (me.relationship_goal && me.relationship_goal === other.relationship_goal) {
    score += 25; reasons.push(`Mesmo objetivo: ${me.relationship_goal.toLowerCase()}`);
  }
  const a = CHILD_GROUP[me.wants_children], b = CHILD_GROUP[other.wants_children];
  if (a && b && (a === b || a === 'open' || b === 'open')) { score += 15; reasons.push('Planos parecidos sobre filhos'); }

  const sharedValues = me.values.filter((v) => other.values.includes(v));
  if (sharedValues.length) { score += Math.min(15, sharedValues.length * 5); reasons.push(`Valores em comum: ${sharedValues.slice(0, 3).join(', ')}`); }

  // Só usa dados religiosos que a outra pessoa tornou públicos.
  if (other.visibility.denomination && me.denomination && me.denomination === other.denomination) {
    score += 10; reasons.push('Mesma tradição cristã');
  }
  if (other.visibility.prayer_importance && me.prayer_importance && other.prayer_importance &&
      Math.abs(me.prayer_importance - other.prayer_importance) <= 1) {
    score += 5; reasons.push('Importância parecida da oração na rotina');
  }
  if (km != null) score += Math.max(0, 10 - Math.floor(km / 50));

  return { score: Math.min(100, score), reasons, sharedInterests: shared };
}
