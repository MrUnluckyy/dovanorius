/**
 * Fold a search term into the same shape as the `*_norm` columns Postgres
 * generates: lowercase, stripped of diacritics.
 *
 * People type names without Lithuanian letters — "Zyg" to find "Žygimantas" —
 * and an `ilike` against the raw column answers that with nothing. Folding both
 * sides of the comparison makes "Zyg", "Žyg" and "ZYG" the same query.
 *
 * NFD splits "ž" into a plain "z" plus a combining caron; the second replace
 * drops every such mark, which covers the whole Lithuanian set (ąčęėįšųūž) and
 * accented Latin generally. LIKE wildcards are dropped rather than escaped —
 * escaping them correctly through PostgREST is fiddly and a name search has no
 * use for them.
 */
export function foldForSearch(term: string): string {
  return term
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[%_\\*]/g, " ")
    .trim();
}
