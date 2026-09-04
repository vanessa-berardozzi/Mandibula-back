import { prisma } from '../../lib/prisma';
import { VatNumberValidationError } from './vat.errors';

const VIES_ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';
const VIES_TIMEOUT_MS = 8_000;
const CACHE_VALID_TTL_MS = 24 * 60 * 60 * 1000; // 24h pour un numéro valide
const CACHE_INVALID_TTL_MS = 30 * 60 * 1000; // 30 min pour un numéro invalide (peut se régulariser vite)

export interface VatNumberValidationResult {
  vatNumber: string;
  countryCode: string;
  isValid: boolean;
  companyName?: string | null;
  fromCache: boolean;
}

interface ViesApiResponse {
  countryCode: string;
  vatNumber: string;
  requestDate: string;
  valid: boolean;
  name?: string;
  address?: string;
  requestIdentifier?: string;
}

/**
 * Sépare un numéro de TVA "FR12345678901" en code pays + numéro.
 * Tolère les espaces et le préfixe optionnel.
 */
export function parseVatNumber(rawVatNumber: string): { countryCode: string; number: string } {
  const cleaned = rawVatNumber.replace(/\s+/g, '').toUpperCase();
  const match = cleaned.match(/^([A-Z]{2})([A-Z0-9]+)$/);
  if (!match) {
    throw new VatNumberValidationError(`Format de numéro de TVA invalide: "${rawVatNumber}"`);
  }
  const [, countryCode, number] = match;
  return { countryCode, number };
}

async function callViesApi(countryCode: string, number: string): Promise<ViesApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIES_TIMEOUT_MS);

  try {
    const response = await fetch(VIES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode, vatNumber: number }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new VatNumberValidationError(
        `L'API VIES a répondu avec le statut ${response.status}. Le service est peut-être temporairement indisponible.`
      );
    }

    return (await response.json()) as ViesApiResponse;
  } catch (err) {
    if (err instanceof VatNumberValidationError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new VatNumberValidationError(
        'Délai dépassé lors de la vérification VIES (service européen lent ou indisponible).'
      );
    }
    throw new VatNumberValidationError(`Échec de l'appel à VIES: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Valide un numéro de TVA intracommunautaire via VIES, avec cache en base.
 *
 * Le cache sert deux buts :
 *  1. Éviter de solliciter l'API européenne (parfois lente/instable) à
 *     chaque commande d'un même client récurrent.
 *  2. Conserver une preuve horodatée de la vérification, exigée en cas de
 *     contrôle pour justifier l'application de l'autoliquidation B2B.
 *
 * En cas d'indisponibilité de VIES, on NE valide PAS silencieusement le
 * numéro : on relance l'erreur pour que l'appelant décide (ex: bloquer la
 * commande, ou basculer temporairement en B2C par sécurité).
 */
export async function validateVatNumber(rawVatNumber: string): Promise<VatNumberValidationResult> {
  const { countryCode, number } = parseVatNumber(rawVatNumber);
  const normalized = `${countryCode}${number}`;

  const cached = await prisma.vatNumberCheck.findUnique({ where: { vatNumber: normalized } });
  if (cached && cached.expiresAt > new Date()) {
    return {
      vatNumber: normalized,
      countryCode,
      isValid: cached.isValid,
      companyName: cached.companyName,
      fromCache: true,
    };
  }

  const result = await callViesApi(countryCode, number);

  const ttl = result.valid ? CACHE_VALID_TTL_MS : CACHE_INVALID_TTL_MS;
  await prisma.vatNumberCheck.upsert({
    where: { vatNumber: normalized },
    create: {
      vatNumber: normalized,
      countryCode,
      isValid: result.valid,
      companyName: result.name ?? null,
      consultationId: result.requestIdentifier ?? null,
      expiresAt: new Date(Date.now() + ttl),
    },
    update: {
      isValid: result.valid,
      companyName: result.name ?? null,
      consultationId: result.requestIdentifier ?? null,
      checkedAt: new Date(),
      expiresAt: new Date(Date.now() + ttl),
    },
  });

  return {
    vatNumber: normalized,
    countryCode,
    isValid: result.valid,
    companyName: result.name ?? null,
    fromCache: false,
  };
}
