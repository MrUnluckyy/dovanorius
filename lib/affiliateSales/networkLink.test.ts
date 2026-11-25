// pnpm test:unit — utils/affiliate/networkLink.ts (lives here because the
// unit-test glob covers lib/ only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { advertiserOf, networkOf, tagNetworkLink } from "../../utils/affiliate/networkLink";

const SUB = "11111111-2222-3333-4444-555555555555";
const AWIN = "https://www.awin1.com/pclick.php?p=46067939023&a=2685684&m=117711";
const TD = "https://pdt.tradedoubler.com/click?a(3492514)p(380227)product(258113-30049651)ttid(3)url(https%3A%2F%2Fpigu.lt%2Flt%2Fstalas%3Fid%3D30049651)";
const CJ = "https://www.tkqlhce.com/click-101900308-15116518?url=https%3A%2F%2Fwww.notino.lt%2Fmonotheme%2Fp-16222514%2F&cjsku=MTMLIMU";

test("our sub id rides on each network's link the way it expects", () => {
  assert.equal(tagNetworkLink(AWIN, SUB), `${AWIN}&clickref=${SUB}`);
  // TradeDoubler: url(...) must stay last; epi goes right before it.
  assert.equal(
    tagNetworkLink(TD, SUB),
    TD.replace("url(", `epi(${SUB})url(`)
  );
  assert.ok(tagNetworkLink(TD, SUB)!.endsWith(")") && /epi\([^)]+\)url\(/.test(tagNetworkLink(TD, SUB)!));
  assert.equal(new URL(tagNetworkLink(CJ, SUB)!).searchParams.get("sid"), SUB);
});

test("an existing epi is replaced, not doubled", () => {
  const withEpi = TD.replace("url(", "epi(old)url(");
  assert.equal((tagNetworkLink(withEpi, SUB)!.match(/epi\(/g) ?? []).length, 1);
});

test("only network tracking hosts are accepted (no open redirect)", () => {
  for (const bad of ["https://evil.example/x", "javascript:alert(1)", "https://awin1.com.evil.lt/pclick.php", "not a url"]) {
    assert.equal(networkOf(bad), null, bad);
    assert.equal(tagNetworkLink(bad, SUB), null, bad);
  }
});

test("the programme behind a link is found for the merchant lookup", () => {
  assert.deepEqual(advertiserOf(AWIN), { network: "awin", advertiserId: "117711", targetUrl: null });
  assert.equal(advertiserOf(TD)?.advertiserId, "380227");
  assert.equal(advertiserOf(TD)?.targetUrl, "https://pigu.lt/lt/stalas?id=30049651");
  assert.equal(advertiserOf(CJ)?.targetUrl, "https://www.notino.lt/monotheme/p-16222514/");
});
