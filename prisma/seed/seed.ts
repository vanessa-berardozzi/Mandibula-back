import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import type { AccessoireAttributes, AnimalAttributes, DifficultyLabel, DifficultyLevel } from '../../src/types/product-attributes';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquante dans .env');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

// ── Types internes ─────────────────────────────────────────────────────────────

type CategoryMapping = {
  rootName: string;
  rootSlug: string;
  subName: string;
  subSlug: string;
  isAnimal: boolean;
};

interface CsvVariant {
  name: string;
  price: number;
  stock: number;
  sumupVariantId: string;
}

interface CsvProduct {
  name: string;
  sumupId: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  category: string;
  images: string[];
  variants: CsvVariant[];
  showInStore: boolean;
}

// ── Mapping catégories SumUp → hiérarchie Mandibula ───────────────────────────

const CATEGORY_MAP: Record<string, CategoryMapping> = {
  'ardentiella':     { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Ardentiella',     subSlug: 'ardentiella',      isAnimal: true  },
  'autres isopodes': { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Autres isopodes', subSlug: 'autres-isopodes',  isAnimal: true  },
  'araignées':       { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Araignées',       subSlug: 'araignees',        isAnimal: true  },
  'myriapodes':      { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Myriapodes',      subSlug: 'myriapodes',       isAnimal: true  },
  'cubaris':         { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Cubaris',         subSlug: 'cubaris',          isAnimal: true  },
  'blattes':         { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Blattes',         subSlug: 'blattes',          isAnimal: true  },
  'collemboles':     { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Collemboles',     subSlug: 'collemboles',      isAnimal: true  },
  'coléoptères':     { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Coléoptères',     subSlug: 'coleopteres',      isAnimal: true  },
  'laureola':        { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Laureola',        subSlug: 'laureola',         isAnimal: true  },
  'mantes':          { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Mantes',          subSlug: 'mantes',           isAnimal: true  },
  'porcellio':       { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Porcellio',       subSlug: 'porcellio',        isAnimal: true  },
  'troglodillo':     { rootName: 'Animaux vivants', rootSlug: 'animaux-vivants', subName: 'Troglodillo',     subSlug: 'troglodillo',      isAnimal: true  },
  'nourriture':      { rootName: 'Non-vivant',      rootSlug: 'non-vivant',      subName: 'Nourriture',      subSlug: 'nourriture',       isAnimal: false },
  'accessoires':     { rootName: 'Non-vivant',      rootSlug: 'non-vivant',      subName: 'Accessoires',     subSlug: 'accessoires',      isAnimal: false },
  'pack':            { rootName: 'Non-vivant',      rootSlug: 'non-vivant',      subName: 'Packs & Kits',    subSlug: 'packs-kits',       isAnimal: false },
};

const DEFAULT_CATEGORY: CategoryMapping = {
  rootName: 'Non-vivant', rootSlug: 'non-vivant',
  subName: 'Divers',      subSlug: 'divers',
  isAnimal: false,
};

// ── Helpers HTML / texte ───────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extractOrigine(text: string): string {
  const m = text.match(/[Oo]rigine\s*:?\s*([^.\n]+)/);
  return m ? m[1].replace(/^[:\s]+/, '').trim() : 'Non précisée';
}

function extractTemperature(text: string): string {
  const m = text.match(/[Tt]emp[eé]rature[^:]*:\s*\[?([0-9][0-9\s\u2013\-°C]*)\]?/u);
  if (!m) return 'Non précisée';
  return m[1].replace(/[\[\]]/g, '').replace(/\.$/, '').trim();
}

function extractHumidite(text: string): string {
  const m = text.match(/[Hh]umidit[eé][^:]*:\s*\[?([0-9][0-9\s\u2013\-%]*)\]?/u);
  if (!m) return 'Non précisée';
  return m[1].replace(/[\[\]]/g, '').replace(/\.$/, '').trim();
}

function resolveNiveauScore(label: string): DifficultyLevel {
  const l = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (l.includes('simple') || l.includes('facile') || l.includes('debutant')) return 1;
  if (l.includes('intermediaire') || l.includes('intermediate'))               return 2;
  if (l.includes('avance') || l.includes('modere'))                            return 3;
  if (l.includes('difficile'))                                                  return 4;
  if (l.includes('expert') || l.includes('tres'))                              return 5;
  return 2;
}

function extractNiveau(text: string): { label: DifficultyLabel; score: DifficultyLevel } {
  const m = text.match(/[Nn]iveau[^:\n]*:\s*\[?([^\].\n]{3,30})\]?/);
  if (!m) return { label: 'Facile', score: 1 };
  const label = m[1].trim().replace(/[.\]\s]*$/, '') as DifficultyLabel;
  return { label, score: resolveNiveauScore(label) };
}

function extractAlimentation(text: string): string {
  const m = text.match(/[Aa]limentation[s]?\s*[^:]*:\s*([^.\n<]{5,})/);
  return m ? m[1].trim() : 'Détritivore';
}

function extractSubstrat(text: string): string {
  const m = text.match(/[Ss]ubstrat[^:.\n]*:\s*([^.\n<]{5,})/);
  if (m) return m[1].trim();
  if (/d[eé]tritivore/i.test(text)) return 'Feuilles mortes, bois en décomposition';
  return 'Non précisé';
}

function extractConseils(text: string): string[] {
  // Cherche des phrases conseils dans le texte : paragraphes après "Conseils" ou les lignes clés
  const m = text.match(/[Cc]onseils?[^:]*:\s*([^.]{10,}\.(?:[^.]{10,}\.){0,3})/);
  if (m) {
    return m[1].split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 8).slice(0, 4);
  }
  return [];
}

function isWc(text: string): boolean {
  return /esp[eè]ce\s*WC|wild.caught|\bWC\b/i.test(text);
}

// ── Helpers Variants ───────────────────────────────────────────────────────────

function inferLotSize(variantName: string): number {
  const n = variantName.toLowerCase().trim();
  if (n === 'unité' || n === 'unite' || n === 'piece' || n === 'pièce') return 1;
  const mLot = n.match(/lot\s+de\s+(\d+)/);
  if (mLot) return parseInt(mLot[1], 10);
  const mX = n.match(/x\s*(\d+)$/);
  if (mX) return parseInt(mX[1], 10);
  const mNum = n.match(/^(\d+)\s+(?:individus?|specimens?|exemplaires?)/i);
  if (mNum) return parseInt(mNum[1], 10);
  return 1;
}

function getImages(row: Record<string, string>): string[] {
  return ['Image 1','Image 2','Image 3','Image 4','Image 5','Image 6','Image 7']
    .map(k => (row[k] || '').trim())
    .filter(Boolean);
}

function parsePrice(s: string): number {
  const n = parseFloat((s || '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function parseStock(s: string): number {
  const n = parseInt(s || '0', 10);
  return isNaN(n) ? 0 : n;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»""'']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Groupement des lignes CSV ──────────────────────────────────────────────────

function groupCsvRows(records: Record<string, string>[]): CsvProduct[] {
  const products: CsvProduct[] = [];
  let current: CsvProduct | null = null;

  for (const row of records) {
    const itemName     = (row['Item name'] || '').trim();
    const variantName  = (row['Variations'] || '').trim();
    const price        = parsePrice(row['Price']);
    const stock        = parseStock(row['Quantity']);
    const sumupId      = (row['Item id (Do not change)'] || '').trim();
    const sumupVarId   = (row['Variant id (Do not change)'] || '').trim();

    if (itemName) {
      if (current) products.push(current);
      const onlineStore = (row['Display item in Online Store? (Yes/No)'] || '').trim().toLowerCase();
      current = {
        name:           itemName,
        sumupId,
        description:    row['Description (Online Store and Invoices only)'] || '',
        seoTitle:       row['SEO title (Online Store only)'] || '',
        seoDescription: row['SEO description (Online Store only)'] || '',
        category:       (row['Category'] || '').trim(),
        images:         getImages(row),
        variants:       [],
        showInStore:    onlineStore !== 'no',
      };
      // Produit à variante unique : la variante est sur la même ligne
      if (sumupVarId) {
        current.variants.push({
          name:          variantName || 'Unité',
          price,
          stock,
          sumupVariantId: sumupVarId,
        });
      }
    } else if (current && variantName) {
      current.variants.push({ name: variantName, price, stock, sumupVariantId: sumupVarId });
    }
  }
  if (current) products.push(current);
  return products;
}

// ── Builders d'attributs ───────────────────────────────────────────────────────

function buildAnimalAttributes(html: string): AnimalAttributes {
  const text = stripHtml(html);
  const niveau = extractNiveau(text);
  return {
    type:         'animal',
    origine:      extractOrigine(text),
    temperature:  extractTemperature(text),
    humidite:     extractHumidite(text),
    substrat:     extractSubstrat(text),
    alimentation: extractAlimentation(text),
    conseils:     extractConseils(text),
    niveau:       niveau.label,
    niveauScore:  niveau.score,
    wc:           isWc(text),
  };
}

function buildAccessoireAttributes(html: string, productName: string): AccessoireAttributes {
  const text = stripHtml(html);
  const lines = text.split(/[•·→▸●✅✔️⚡💡🛠️📦]/u)
    .map(s => s.trim()).filter(s => s.length > 5).slice(0, 8);

  const dimMatch = text.match(/(\d+\s*[xX×]\s*\d+(?:\s*[xX×]\s*\d+)?(?:\s*cm)?)/);
  const volMatch = text.match(/(\d+(?:[.,]\d+)?\s*(?:[Ll]|litres?))/);

  return {
    type:             'accessoire',
    caracteristiques: lines.length > 0 ? lines : [productName],
    dimensions:       dimMatch ? dimMatch[1].trim() : undefined,
    volume:           volMatch ? volMatch[1].trim() : undefined,
  };
}

// ── Résolution du mapping catégorie ───────────────────────────────────────────

function resolveCategoryMapping(sumupCategory: string): CategoryMapping {
  const key = sumupCategory.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    const nk = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nk === key) return v;
  }
  // Correspondance partielle
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    const nk = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (key.includes(nk) || nk.includes(key)) return v;
  }
  console.warn(`  ⚠️  Catégorie inconnue "${sumupCategory}" → Non-vivant/Divers`);
  return DEFAULT_CATEGORY;
}

// ── Seed principal ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Démarrage du seeding depuis le CSV SumUp...\n');

  const csvPath = path.join(__dirname, '../../docPerso/2026-05-19_14-56-43_items-export_MCVQLQMM.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Fichier CSV introuvable : ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  }) as Record<string, string>[];

  console.log(`📄 ${records.length} lignes lues`);

  const products = groupCsvRows(records);
  console.log(`🪲 ${products.length} produits identifiés\n`);

  // Cache slug → id pour éviter les requêtes répétées
  const catCache = new Map<string, string>();

  async function getOrCreateCategory(mapping: CategoryMapping): Promise<string> {
    if (catCache.has(mapping.subSlug)) return catCache.get(mapping.subSlug)!;

    // Catégorie racine
    let rootId = catCache.get(mapping.rootSlug);
    if (!rootId) {
      const root = await prisma.category.upsert({
        where:  { slug: mapping.rootSlug },
        update: { name: mapping.rootName },
        create: { name: mapping.rootName, slug: mapping.rootSlug, isActive: true },
      });
      rootId = root.id;
      catCache.set(mapping.rootSlug, rootId);
    }

    // Sous-catégorie
    const sub = await prisma.category.upsert({
      where:  { slug: mapping.subSlug },
      update: { name: mapping.subName },
      create: { name: mapping.subName, slug: mapping.subSlug, parentId: rootId, isActive: true },
    });
    catCache.set(mapping.subSlug, sub.id);
    return sub.id;
  }

  let inserted = 0;
  let skipped  = 0;

  for (const product of products) {
    if (!product.name) { skipped++; continue; }

    if (product.variants.length === 0) {
      console.warn(`⚠️  "${product.name}" : aucune variante, ignoré`);
      skipped++;
      continue;
    }

    const mapping    = resolveCategoryMapping(product.category);
    const categoryId = await getOrCreateCategory(mapping);

    const descHtml   = product.description || product.seoDescription;
    const attributes = mapping.isAnimal
      ? buildAnimalAttributes(descHtml)
      : buildAccessoireAttributes(descHtml, product.name);

    // Prix d'affichage = prix minimum des variantes (hors 0)
    const prices      = product.variants.map(v => v.price).filter(p => p > 0);
    const displayPrice = prices.length > 0 ? Math.min(...prices) : 0.01;

    // ID stable = SumUp Item ID (UUID), ou slugify du nom en fallback
    const productId = product.sumupId
      ? product.sumupId.toLowerCase()
      : slugify(product.name);

    try {
      const created = await prisma.product.upsert({
        where:  { id: productId },
        update: {
          name: product.name,
          description: product.seoDescription || product.seoTitle || product.name,
          price: displayPrice,
          images: product.images,
          attributes: attributes as unknown as Prisma.InputJsonValue,
          categoryId,
        },
        create: {
          id: productId,
          name: product.name,
          description: product.seoDescription || product.seoTitle || product.name,
          price: displayPrice,
          images: product.images,
          attributes: attributes as unknown as Prisma.InputJsonValue,
          categoryId,
        },
      });

      const variantIsActive = product.showInStore;
      for (const variant of product.variants) {
        const varPrice = variant.price > 0 ? variant.price : displayPrice;
        await prisma.productVariant.upsert({
          where: {
            productId_name: { productId: created.id, name: variant.name },
          },
          update: {
            price:    varPrice,
            stock:    variant.stock,
            lotSize:  inferLotSize(variant.name),
            isActive: variantIsActive,
          },
          create: {
            productId: created.id,
            name:      variant.name,
            lotSize:   inferLotSize(variant.name),
            price:     varPrice,
            stock:     variant.stock,
            isActive:  variantIsActive,
          },
        });
      }

      // Synchroniser StockInfo : seuil d'alerte + statut calculé depuis les variantes
      const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
      const minThreshold = 5;
      const stockStatus =
        totalStock === 0                 ? 'OUT_OF_STOCK' :
        totalStock <= minThreshold       ? 'LOW_STOCK'    :
                                           'IN_STOCK';

      await prisma.stockInfo.upsert({
        where:  { productId: created.id },
        update: { status: stockStatus, minThreshold },
        create: { productId: created.id, minThreshold, status: stockStatus },
      });

      if (product.showInStore) {
        console.log(`  ✅ ${product.name.trim()} (${product.variants.length} variante(s))`);
      } else {
        console.log(`  🚫 ${product.name.trim()} — désactivé (non visible en ligne sur SumUp)`);
      }
      inserted++;
    } catch (err) {
      console.error(`  ❌ Erreur sur "${product.name}":`, err);
      skipped++;
    }
  }

  // ── Désactiver les produits SumUp supprimés du catalogue ──────────────────
  const activeSumupIds = products
    .filter(p => p.sumupId)
    .map(p => p.sumupId.toLowerCase());

  const deactivated = await prisma.productVariant.updateMany({
    where: {
      product: { id: { notIn: activeSumupIds } },
      isActive: true,
    },
    data: { isActive: false },
  });

  if (deactivated.count > 0) {
    console.log(`\n🗑️  ${deactivated.count} variante(s) désactivée(s) (produits retirés de SumUp ou non visibles en ligne)`);
  }

  console.log(`\n🎉 Seeding terminé : ${inserted} produits insérés/mis à jour, ${skipped} ignorés`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur fatale lors du seeding:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
