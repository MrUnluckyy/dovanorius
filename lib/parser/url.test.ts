// pnpm test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanUrl, isPublicHost, titleFromUrl } from "./url";

test("tracking parameters go, product parameters stay", () => {
  assert.equal(
    cleanUrl("https://pigu.lt/lt/x/laikrodis-casio?id=76638303&gclid=abc&utm_source=fb&srsltid=zz"),
    "https://pigu.lt/lt/x/laikrodis-casio?id=76638303"
  );
  assert.equal(cleanUrl("https://shop.lt/p/x?fbclid=1"), "https://shop.lt/p/x");
  assert.equal(cleanUrl("https://shop.lt/p/x?variant=5395"), "https://shop.lt/p/x?variant=5395");
});

test("only public shop hosts may be fetched", () => {
  for (const h of ["senukai.lt", "www.zalando.lt", "shop.philips.lt", "xn--80ak6aa92e.com"]) assert.ok(isPublicHost(h), h);
  for (const h of ["localhost", "127.0.0.1", "169.254.169.254", "10.0.0.5", "[::1]", "intranet", "db.internal", "printer.local"]) assert.ok(!isPublicHost(h), h);
});

test("a readable title from the link when the page can't be read", () => {
  assert.equal(titleFromUrl("https://www.senukai.lt/p/elektrine-mesmale-zyle-zy358mg-2000-w/d9f1"), "Elektrine mesmale zyle zy358mg 2000 w");
  assert.equal(titleFromUrl("https://www.knygos.lt/lt/knygos/laime-yra-lape/"), "Laime yra lape");
  assert.equal(
    titleFromUrl("https://www.parduotuvevaikams.lt/stumdukai/191742-zaislinis-stumdukas-ant-pagaliuko-woopie-antis-5906280654696.html"),
    "Zaislinis stumdukas ant pagaliuko woopie antis"
  );
  assert.equal(titleFromUrl("https://www.douglas.lt/lt/p/5012122085"), null);
});
