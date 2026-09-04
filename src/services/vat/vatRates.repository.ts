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

const FALLBACK_EU_VAT_RATES: Record<string, number> = {
  AT: 20,
  BE: 21,
  BG: 20,
  CY: 19,
  CZ: 21,
  DE: 19,
  DK: 25,
  EE: 24,
  ES: 21,
  FI: 25.5,
  FR: 20,
  GR: 24,
  HR: 25,
  HU: 27,
  IE: 23,
  IT: 22,
  LT: 21,
  LU: 17,
  LV: 21,
  MT: 18,
  NL: 21,
  PL: 23,
  PT: 23,
  RO: 21,
  SE: 25,
  SI: 22,
  SK: 23,
};

const FALLBACK_LIVE_ANIMALS_VAT_RATES: Partial<Record<string, ResolvedVatRate>> = {
  NL: { rate: 9, rateType: 'REDUCED' },
};

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
  const normalizedCountryCode = countryCode.toUpperCase();
  const country = await prisma.country.findUnique({ where: { code: normalizedCountryCode } });
  if (!country && normalizedCountryCode in FALLBACK_EU_VAT_RATES) return true;
  return Boolean(country);
}

export async function getCountry(countryCode: string) {
  const normalizedCountryCode = countryCode.toUpperCase();
  const country = await prisma.country.findUnique({ where: { code: normalizedCountryCode } });
  if (!country) {
    if (normalizedCountryCode in FALLBACK_EU_VAT_RATES) {
      return { code: normalizedCountryCode, name: normalizedCountryCode, isEuMember: true };
    }
    throw new UnsupportedCountryError(normalizedCountryCode);
  }
  return country;
}

function getFallbackVatRate(
  countryCode: string,
  productCategory: ProductVatCategory
): ResolvedVatRate | null {
  const normalizedCountryCode = countryCode.toUpperCase();

  if (productCategory === 'LIVE_ANIMALS') {
    const liveAnimalsRate = FALLBACK_LIVE_ANIMALS_VAT_RATES[normalizedCountryCode];
    if (liveAnimalsRate) return liveAnimalsRate;
  }

  const standardRate = FALLBACK_EU_VAT_RATES[normalizedCountryCode];
  if (standardRate === undefined) return null;

  return { rate: standardRate, rateType: 'STANDARD' };
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
  const normalizedCountryCode = countryCode.toUpperCase();
  const key = buildCacheKey(normalizedCountryCode, productCategory, atDate);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const record = await prisma.vatRate.findFirst({
    where: {
      countryCode: normalizedCountryCode,
      productCategory,
      validFrom: { lte: atDate },
      OR: [{ validTo: null }, { validTo: { gte: atDate } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  if (!record) {
    const fallback = getFallbackVatRate(normalizedCountryCode, productCategory);
    if (fallback) {
      cache.set(key, { value: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
      return fallback;
    }
    throw new VatRateNotFoundError(normalizedCountryCode, productCategory);
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
