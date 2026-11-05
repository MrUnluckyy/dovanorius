import { test } from "node:test";
import assert from "node:assert/strict";
import { extractChannelId, normalize, type HostingerProduct } from "./hostinger";

const CHANNEL = "scha_01M3VBRNSBZ18RZFBR8CNPPZG3";

test("finds the sales-channel id in page markup", () => {
  const html = `<script>{"storeId":"store_01JHT2S67EHS315QZCR96KKD1S","channel":"${CHANNEL}"}</script>`;
  assert.equal(extractChannelId(html), CHANNEL);
});

test("prefers the most repeated channel id", () => {
  const other = "scha_01ABCDEFGHJKMNPQRSTVWXYZ01";
  const html = `${other} ${CHANNEL} ${CHANNEL}`;
  assert.equal(extractChannelId(html), CHANNEL);
});

test("returns null when there is no store", () => {
  assert.equal(extractChannelId('<meta name="generator" content="Hostinger AI Builder">'), null);
});

// Shape as returned for dumo.lt (Nov 2026).
const product: HostingerProduct = {
  id: "prod_01JHT3",
  title: "DŪMO rūkykla M",
  description: "<p>Rūkykla karštam ir šaltam rūkymui</p>",
  thumbnail: "https://cdn.zyrosite.com/cdn-ecommerce/store_x/assets/a.jpg",
  seo_settings: { slug: "dmo-rkymo-rkykla" },
  is_available: true,
  purchasable: true,
  variants: [
    {
      id: "var_1",
      prices: [
        {
          amount: 22900,
          sale_amount: 19900,
          currency_code: "eur",
          currency: { code: "eur", decimal_digits: 2 },
        },
      ],
    },
  ],
};

test("reads minor-unit prices, preferring the sale price", () => {
  const { item, currency } = normalize(product, "dumo.lt");
  assert.equal(item?.price, 199);
  assert.equal(currency, "EUR");
});

test("builds a same-host product URL from the slug", () => {
  const { item } = normalize(product, "dumo.lt");
  assert.equal(item?.productUrl, "https://dumo.lt/dmo-rkymo-rkykla");
  assert.equal(item?.description, "Rūkykla karštam ir šaltam rūkymui");
  assert.equal(item?.imageUrl, product.thumbnail);
  assert.equal(item?.inStock, true);
});

test("cheapest variant wins and tracked zero stock is sold out", () => {
  const { item } = normalize(
    {
      ...product,
      variants: [
        { prices: [{ amount: 32900 }], manage_inventory: true, inventory_quantity: 0 },
        { prices: [{ amount: 25900 }], manage_inventory: true, inventory_quantity: 0 },
      ],
    },
    "dumo.lt"
  );
  assert.equal(item?.price, 259);
  assert.equal(item?.inStock, false);
});

test("a slug cannot escape the shop's host", () => {
  const { item } = normalize({ ...product, seo_settings: { slug: "//evil.com/x" } }, "dumo.lt");
  assert.ok(item === null || item.productUrl.startsWith("https://dumo.lt/"));
});

test("drops products without id, title or slug", () => {
  assert.equal(normalize({ ...product, id: undefined }, "dumo.lt").item, null);
  assert.equal(normalize({ ...product, title: " " }, "dumo.lt").item, null);
  assert.equal(normalize({ ...product, seo_settings: null, slug: null }, "dumo.lt").item, null);
});
