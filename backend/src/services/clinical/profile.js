// ─── Perfil clínico a partir do cadastro ───────────────────────────
// Helpers que montam o perfil usado pelo motor (idade, sexo, IMC) a
// partir dos campos do Patient. Antes viviam dentro do triageService;
// saíram para serem usados também pelos serviços de risco.

const ageFromDob = (dob) => {
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
};

const mapGender = (g) => {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (['m', 'male', 'masculino', 'h'].includes(s)) return 'male';
  if (['f', 'female', 'feminino'].includes(s))     return 'female';
  return s;
};

const computeBmi = (heightCm, weightKg) => {
  if (!heightCm || !weightKg) return null;
  const h = heightCm > 3 ? heightCm / 100 : heightCm; // aceita m ou cm
  if (!h) return null;
  return Number((weightKg / (h * h)).toFixed(1));
};

module.exports = { ageFromDob, mapGender, computeBmi };
