import { ImageResponse } from "next/og";
import { loadFonts, loadLogo, loadProductImage } from "./assets";
import { slideCount, type Deck } from "./deck";
import { ClosingSlide, CoverSlide, ProductSlide, SLIDE_H, SLIDE_W } from "./slides";

export type RenderOptions = { showPrice: boolean };

/** Render one slide of the deck as a PNG response. */
export async function renderSlide(
  deck: Deck,
  index: number,
  opts: RenderOptions
): Promise<ImageResponse> {
  const [fonts, logo] = await Promise.all([loadFonts(), loadLogo()]);
  const last = slideCount(deck) - 1;

  let element: React.ReactElement;
  if (index === 0) {
    const images = await Promise.all(
      deck.products.slice(0, 3).map((p) => loadProductImage(p.imageUrl))
    );
    element = (
      <CoverSlide title={deck.title} count={deck.products.length} images={images} logo={logo} />
    );
  } else if (index === last) {
    element = <ClosingSlide logo={logo} />;
  } else {
    const product = deck.products[index - 1];
    element = (
      <ProductSlide
        product={product}
        image={await loadProductImage(product.imageUrl)}
        index={index - 1}
        total={deck.products.length}
        showPrice={opts.showPrice}
        logo={logo}
      />
    );
  }

  return new ImageResponse(element, { width: SLIDE_W, height: SLIDE_H, fonts });
}
