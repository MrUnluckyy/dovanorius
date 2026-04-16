"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { PartnerProduct } from "@/types/partner";
import { LuUpload, LuCheck, LuCircleAlert } from "react-icons/lu";
import toast from "react-hot-toast";

type ParsedRow = {
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  product_url: string | null;
  sku: string | null;
  is_active: boolean;
  min_age: number | null;
  max_age: number | null;
  gender: "male" | "female" | null;
  categories: string[];
};

// Shopify export CSV columns we care about:
// Handle, Title, Body (HTML), Vendor, Tags, Published, Variant SKU,
// Variant Price, Image Src, URL

function parseShopifyCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  const col = (name: string) => headers.indexOf(name);

  const titleIdx = col("title");
  const bodyIdx = col("body (html)");
  const skuIdx = col("variant sku");
  const priceIdx = col("variant price");
  const imageIdx = col("image src");
  const publishedIdx = col("published");
  const handleIdx = col("handle");

  const rows: ParsedRow[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const title = cells[titleIdx]?.trim();
    if (!title || seen.has(title)) continue; // Shopify repeats rows for variants
    seen.add(title);

    const rawPrice = cells[priceIdx]?.trim().replace(",", ".");
    const price = rawPrice ? parseFloat(rawPrice) : null;
    const published = cells[publishedIdx]?.trim().toLowerCase();
    const handle = cells[handleIdx]?.trim();

    rows.push({
      title,
      description: stripHtml(cells[bodyIdx]?.trim() ?? ""),
      price: isNaN(price!) ? null : price,
      currency: "EUR",
      image_url: cells[imageIdx]?.trim() || null,
      product_url: handle
        ? `https://yourdomain.com/products/${handle}`
        : null,
      sku: cells[skuIdx]?.trim() || null,
      is_active: published !== "false",
      min_age: null,
      max_age: null,
      gender: null,
      categories: [],
    });
  }

  return rows;
}

function parseGenericCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/[^a-z_]/g, "_")
  );

  const col = (name: string) => headers.indexOf(name);

  const titleIdx = col("title") !== -1 ? col("title") : col("name");
  const descIdx = col("description") !== -1 ? col("description") : col("body");
  const priceIdx = col("price");
  const currencyIdx = col("currency");
  const imageIdx = col("image_url") !== -1 ? col("image_url") : col("image");
  const urlIdx = col("product_url") !== -1 ? col("product_url") : col("url");
  const skuIdx = col("sku");
  const activeIdx = col("is_active") !== -1 ? col("is_active") : col("active");

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const title = cells[titleIdx]?.trim();
    if (!title) continue;

    const rawPrice = cells[priceIdx]?.trim().replace(",", ".");
    const price = rawPrice ? parseFloat(rawPrice) : null;
    const active = cells[activeIdx]?.trim().toLowerCase();

    rows.push({
      title,
      description: cells[descIdx]?.trim() || null,
      price: isNaN(price!) ? null : price,
      currency: cells[currencyIdx]?.trim() || "EUR",
      image_url: cells[imageIdx]?.trim() || null,
      product_url: cells[urlIdx]?.trim() || null,
      sku: cells[skuIdx]?.trim() || null,
      is_active: active !== "false" && active !== "0",
      min_age: null,
      max_age: null,
      gender: null,
      categories: [],
    });
  }
  return rows;
}

function isShopifyCSV(text: string): boolean {
  const firstLine = text.split(/\r?\n/)[0].toLowerCase();
  return firstLine.includes("body (html)") || firstLine.includes("variant price");
}

function parseXML(text: string): ParsedRow[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");

  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid XML");
  }

  function parseGender(val: string | null): "male" | "female" | null {
    if (!val) return null;
    const v = val.toLowerCase();
    if (v === "male" || v === "vyras" || v === "m") return "male";
    if (v === "female" || v === "moteris" || v === "f") return "female";
    return null;
  }

  function parseCategories(val: string | null): string[] {
    if (!val) return [];
    return val.split(/[,;]/).map((c) => c.trim()).filter(Boolean);
  }

  // Google Shopping / Merchant Center feed format
  const isGoogleFeed = !!doc.querySelector("entry");
  if (isGoogleFeed) {
    return Array.from(doc.querySelectorAll("entry")).map((entry) => {
      const getText = (tag: string) =>
        entry.querySelector(tag)?.textContent?.trim() || null;
      const rawPrice = getText("price") ?? getText("g\\:price");
      const price = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) : null;
      const minAge = getText("min_age");
      const maxAge = getText("max_age");
      return {
        title: getText("title") ?? "",
        description: getText("description") ?? null,
        price: isNaN(price!) ? null : price,
        currency: "EUR",
        image_url: getText("image_link") ?? getText("g\\:image_link"),
        product_url: getText("link") ?? getText("g\\:link"),
        sku: getText("id") ?? getText("g\\:id"),
        is_active: true,
        min_age: minAge ? parseInt(minAge) : null,
        max_age: maxAge ? parseInt(maxAge) : null,
        gender: parseGender(getText("gender")),
        categories: parseCategories(getText("categories")),
      };
    }).filter((r) => r.title);
  }

  // Generic XML — look for repeating product/item elements
  const itemTag =
    doc.querySelector("product") ? "product" :
    doc.querySelector("item") ? "item" :
    doc.querySelector("Product") ? "Product" : null;

  if (!itemTag) return [];

  return Array.from(doc.querySelectorAll(itemTag)).map((el) => {
    const getText = (tag: string) =>
      el.querySelector(tag)?.textContent?.trim() || null;
    const rawPrice = getText("price") ?? getText("Price");
    const price = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) : null;
    const minAge = getText("min_age");
    const maxAge = getText("max_age");
    return {
      title: getText("title") ?? getText("Title") ?? getText("name") ?? getText("Name") ?? "",
      description: getText("description") ?? getText("Description") ?? null,
      price: isNaN(price!) ? null : price,
      currency: getText("currency") ?? getText("Currency") ?? "EUR",
      image_url: getText("image_url") ?? getText("image") ?? getText("Image") ?? null,
      product_url: getText("product_url") ?? getText("url") ?? getText("URL") ?? null,
      sku: getText("sku") ?? getText("SKU") ?? getText("id") ?? null,
      is_active: true,
      min_age: minAge ? parseInt(minAge) : null,
      max_age: maxAge ? parseInt(maxAge) : null,
      gender: parseGender(getText("gender")),
      categories: parseCategories(getText("categories")),
    };
  }).filter((r) => r.title);
}

function stripHtml(html: string): string | null {
  if (!html) return null;
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped || null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function BulkUploadModal({
  partnerId,
  onClose,
  onImported,
}: {
  partnerId: string;
  onClose: () => void;
  onImported: (products: PartnerProduct[]) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleFile(file: File) {
    const isCSV = file.name.endsWith(".csv");
    const isXML = file.name.endsWith(".xml");
    if (!isCSV && !isXML) {
      setError("Palaikomi tik CSV ir XML formatai.");
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let rows: ParsedRow[];
        if (isXML) {
          rows = parseXML(text);
        } else {
          rows = isShopifyCSV(text) ? parseShopifyCSV(text) : parseGenericCSV(text);
        }
        if (rows.length === 0) {
          setError("Nerasta produktų. Patikrinkite failo formatą.");
          setParsed(null);
        } else {
          setParsed(rows);
        }
      } catch {
        setError("Nepavyko nuskaityti failo.");
        setParsed(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);

    const payload = parsed.map((r) => ({ ...r, partner_id: partnerId }));

    const { data, error } = await supabase
      .from("partner_products")
      .insert(payload)
      .select();

    setImporting(false);
    if (error) {
      toast.error("Importas nepavyko.");
      return;
    }
    toast.success(`Importuota ${data.length} produktų.`);
    onImported(data as PartnerProduct[]);
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="font-heading font-bold text-lg mb-1">Importuoti produktus</h3>
        <p className="text-sm text-base-content/60 mb-4">
          Palaikomas standartinis CSV,{" "}
          <span className="font-medium text-base-content">Shopify</span> eksportas ir XML (Google Shopping).
        </p>

        {/* Drop zone */}
        {!parsed && (
          <div
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 text-center transition-colors cursor-pointer ${
              dragging
                ? "border-primary bg-primary/10"
                : "border-base-300 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => document.getElementById("csv-file-input")?.click()}
          >
            <LuUpload size={28} className="text-base-content/40" />
            <p className="text-sm text-base-content/60">
              Nutempkite CSV arba XML failą čia arba <span className="text-primary underline">pasirinkite</span>
            </p>
            <p className="text-xs text-base-content/40">
              Shopify CSV · Google Shopping XML · Standartinis CSV/XML
            </p>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,.xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {error && (
          <div className="alert alert-error alert-sm mt-3 text-sm">
            <LuCircleAlert size={16} />
            {error}
          </div>
        )}

        {parsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-success font-medium">
              <LuCheck size={16} />
              <span>
                Nuskaitytas <span className="font-bold">{fileName}</span> —{" "}
                {parsed.length} produktų rasta
              </span>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto border border-base-300 rounded-xl max-h-52">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>Pavadinimas</th>
                    <th>SKU</th>
                    <th>Kaina</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td className="max-w-[200px] truncate">{r.title}</td>
                      <td>{r.sku ?? "—"}</td>
                      <td>{r.price != null ? `${r.price} ${r.currency}` : "—"}</td>
                    </tr>
                  ))}
                  {parsed.length > 8 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-center text-base-content/40 text-xs"
                      >
                        ... ir dar {parsed.length - 8} produktų
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="btn btn-ghost btn-xs text-base-content/50"
              onClick={() => { setParsed(null); setFileName(""); setError(null); }}
            >
              Pasirinkti kitą failą
            </button>
          </div>
        )}

        <div className="modal-action">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { dialogRef.current?.close(); onClose(); }}
          >
            Atšaukti
          </button>
          {parsed && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              Importuoti {parsed.length} produktų
            </button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
