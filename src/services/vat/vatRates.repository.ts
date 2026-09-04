import type { ProductVatCategory, VatRateType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { UnsupportedCountryError, VatRateNotFoundError } from './vat.errors';

export interface ResolvedVatRate {
  rate: number; // pourcentage, ex: 20 pour 20%
  rateType: VatRateType;
}

interface CacheEntry {
  value: ResolvedVatRate;
  expiresAt: number;
}

/**
 * Les taux de TVA changent rarement (quelques fois par an, par pays).
 * On évite donc une requête DB par item de panier via un cache mémoire
 * court (1h). En cas de mise à jour admin des taux, appeler
 * invalidateVatRateCache().
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function buildCacheKey(
  countryCode: string,
  productCategory: ProductVatCategory,
  atDate: Date
): string {
  // On inclut la date (jour) dans la clé pour rester correct si un taux
  // change en cours de journée (rare, mais on ne veut pas de faux positif
  // de cache à cheval sur un changement de taux).
  const day = atDate.toISOString().slice(0, 10);
  return `${countryCode}:${productCategory}:${day}`;
}

export async function isKnownCountry(countryCode: string): Promise<boolean> {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  return Boolean(country);
}

export async function getCountry(countryCode: string) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  if (!country) {
    throw new UnsupportedCountryError(countryCode);
  }
  return country;
}

/**
 * Retourne le taux de TVA en vigueur pour un pays et une catégorie de
 * produit donnés, à la date fournie (par défaut: maintenant).
 *
 * @throws VatRateNotFoundError si aucun taux n'est configuré pour ce couple.
 */
export async function getVatRate(
  countryCode: string,
  productCategory: ProductVatCategory,
  atDate: Date = new Date()
): Promise<ResolvedVatRate> {
  const key = buildCacheKey(countryCode, productCategory, atDate);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const record = await prisma.vatRate.findFirst({
    where: {
      countryCode,
      productCategory,
      validFrom: { lte: atDate },
      OR: [{ validTo: null }, { validTo: { gte: atDate } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  if (!record) {
    throw new VatRateNotFoundError(countryCode, productCategory);
  }

  const resolved: ResolvedVatRate = {
    rate: Number(record.rate),
    rateType: record.rateType,
  };

  cache.set(key, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  return resolved;
}

/** À appeler après toute mise à jour manuelle des taux (back-office admin). */
export function invalidateVatRateCache(): void {
  cache.clear();
}
