-- search_products / search_fallback run as their owner.
--
-- As the anon role, a search with a price filter ("lego", 10-50 EUR) took
-- over 10 s and hit the 3 s anon statement timeout, so the page sat on
-- skeletons. The same call as the owner took ~100 ms.
--
-- Cause: inspo_products has a row-level-security policy (public read,
-- `using (true)`). Under RLS the planner can't use the trigram condition's
-- statistics the same way (the match operators aren't leakproof), estimates
-- the word match at ~1 row and walks inspo_products_price_id_idx instead,
-- testing the regex on ~144k rows. It was already ~1 s with LIKE before
-- 20261112120000; the word-start regex made it time out.
--
-- Running as the owner skips RLS, which hides nothing here (the policy is
-- `true`), and gives the planner the trigram estimate back. Safe as a
-- definer: search_path is pinned, stems are [a-z0-9] and quoted with %L,
-- every other value is a bound parameter. log_search is already a definer.

alter function public.search_products(text, text, text, text, numeric, numeric, text, text, boolean, text, integer, integer, text)
  security definer;

alter function public.search_fallback(text, text, text, text, numeric, numeric, text, text, boolean)
  security definer;
