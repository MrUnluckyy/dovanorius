/** Lithuanian has three plural forms: 1 diena, 2 dienos, 10 dienų. */
export function ltPlural(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 9 && (mod100 < 11 || mod100 > 19)) return few;
  return many;
}
