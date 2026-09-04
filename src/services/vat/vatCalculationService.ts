import type {
  VatCalculationRequest,
  VatCalculationResult,
  VatLineResult
} from '../../types/vat';
import { InvalidCartError } from './vat.errors';
import { getVatRate, isKnownCountry } from './vatRates.repository';
import { validateVatNumber } from './viesService';

/** Pays d'établissement du vendeur — à externaliser en config/env si besoin. */
const SELLER_COUNTRY = 'LU';

function assertValidRequest(req: VatCalculationRequest): void {
  if (!req.items || req.items.length === 0) {
    throw new InvalidCartError('Le panier est vide.');
  }
  for (const item of req.items) {
    if (item.quantity <= 0) {
      throw new InvalidCartError(`Quantité invalide pour le produit ${item.productId}.`);
    }
    if (item.unitPriceExclVatCents < 0) {
      throw new InvalidCartError(`Prix invalide pour le produit ${item.productId}.`);
    }
  }
  if (req.buyerType === 'B2B' && !req.vatNumber) {
    throw new InvalidCartError(
      'Un numéro de TVA intracommunautaire est requis pour une commande B2B.'
    );
  }
}

function computeExemptLines(
  req: VatCalculationRequest,
  vatRateType: VatLineResult['vatRateType']
): VatLineResult[] {
  return req.items.map((item) => {
    const lineTotalExclVatCents = item.unitPriceExclVatCents * item.quantity;
    return {
      productId: item.productId,
      productCategory: item.productCategory,
      quantity: item.quantity,
      unitPriceExclVatCents: item.unitPriceExclVatCents,
      lineTotalExclVatCents,
      vatRate: 0,
      vatRateType,
      vatAmountCents: 0,
      lineTotalInclVatCents: lineTotalExclVatCents,
    };
  });
}

async function computeTaxedLines(
  req: VatCalculationRequest,
  countryForRate: string
): Promise<VatLineResult[]> {
  const lines: VatLineResult[] = [];

  for (const item of req.items) {
    const { rate, rateType } = await getVatRate(countryForRate, item.productCategory);

    const lineTotalExclVatCents = item.unitPriceExclVatCents * item.quantity;
    // Arrondi au centime le plus proche — jamais de calcul flottant "libre"
    // sur des montants monétaires.
    const vatAmountCents = Math.round((lineTotalExclVatCents * rate) / 100);

    lines.push({
      productId: item.productId,
      productCategory: item.productCategory,
      quantity: item.quantity,
      unitPriceExclVatCents: item.unitPriceExclVatCents,
      lineTotalExclVatCents,
      vatRate: rate,
      vatRateType: rateType,
      vatAmountCents,
      lineTotalInclVatCents: lineTotalExclVatCents + vatAmountCents,
    });
  }

  return lines;
}

function sumTotals(lines: VatLineResult[]): VatCalculationResult['totals'] {
  return lines.reduce(
    (acc, line) => ({
      totalExclVatCents: acc.totalExclVatCents + line.lineTotalExclVatCents,
      totalVatCents: acc.totalVatCents + line.vatAmountCents,
      totalInclVatCents: acc.totalInclVatCents + line.lineTotalInclVatCents,
    }),
    { totalExclVatCents: 0, totalVatCents: 0, totalInclVatCents: 0 }
  );
}

/**
 * Calcule la TVA applicable à un panier, selon le pays de livraison et le
 * type d'acheteur.
 *
 * Logique appliquée :
 *  - Livraison au Luxembourg (pays du vendeur) → TVA luxembourgeoise standard.
 *  - Livraison hors UE → exonération export (TVA = 0), la fiscalité locale
 *    à l'arrivée est à la charge du client / gérée séparément (douane).
 *  - Livraison dans l'UE, acheteur B2B avec numéro de TVA valide et
 *    différent du pays vendeur → autoliquidation (reverse charge, TVA = 0
 *    facturée par vous, le client déclare la TVA chez lui).
 *  - Livraison dans l'UE, acheteur B2B avec numéro invalide/non fourni,
 *    ou B2C → TVA du pays de destination (régime OSS), comme requis
 *    au-delà du seuil de 10 000 € de CA annuel intra-UE B2C.
 *
 * Hypothèse: le seuil OSS de 10 000 € est considéré comme dépassé (à
 * adapter avec un service de suivi du seuil si vous voulez repasser
 * automatiquement en TVA du pays vendeur en dessous du seuil).
 */
export async function calculateVat(req: VatCalculationRequest): Promise<VatCalculationResult> {
  assertValidRequest(req);

  const shipToCountry = req.shipToCountry.toUpperCase();

  // --- Cas 1 : livraison hors UE -> export exonéré -------------------
  const isEu = await isKnownCountry(shipToCountry);
  if (!isEu) {
    const lines = computeExemptLines(req, 'EXPORT_EXEMPT');
    return {
      regime: 'EXPORT_NON_EU',
      shipToCountry,
      buyerType: req.buyerType,
      lines,
      totals: sumTotals(lines),
    };
  }

  // --- Cas 2 : livraison au pays du vendeur (vente domestique) -------
  if (shipToCountry === SELLER_COUNTRY) {
    const lines = await computeTaxedLines(req, SELLER_COUNTRY);
    return {
      regime: 'DOMESTIC',
      shipToCountry,
      buyerType: req.buyerType,
      lines,
      totals: sumTotals(lines),
    };
  }

  // --- Cas 3 : B2B intra-UE -------------------------------------------
  if (req.buyerType === 'B2B' && req.vatNumber) {
    const validation = await validateVatNumber(req.vatNumber);

    if (validation.isValid) {
      const lines = computeExemptLines(req, 'REVERSE_CHARGE');
      return {
        regime: 'EU_B2B_REVERSE_CHARGE',
        shipToCountry,
        buyerType: req.buyerType,
        vatNumberValidated: {
          vatNumber: validation.vatNumber,
          isValid: true,
          companyName: validation.companyName,
        },
        lines,
        totals: sumTotals(lines),
      };
    }

    // Numéro fourni mais invalide -> on retombe sur le traitement B2C
    // (TVA du pays de destination), on ne peut pas appliquer
    // l'autoliquidation sans numéro valide.
    const lines = await computeTaxedLines(req, shipToCountry);
    return {
      regime: 'EU_B2B_NO_VALID_VAT_NUMBER',
      shipToCountry,
      buyerType: req.buyerType,
      vatNumberValidated: {
        vatNumber: validation.vatNumber,
        isValid: false,
        companyName: validation.companyName,
      },
      lines,
      totals: sumTotals(lines),
    };
  }

  // --- Cas 4 : B2C intra-UE -> TVA du pays de destination (OSS) ------
  const lines = await computeTaxedLines(req, shipToCountry);
  return {
    regime: 'EU_B2C_DESTINATION',
    shipToCountry,
    buyerType: req.buyerType,
    lines,
    totals: sumTotals(lines),
  };
}
