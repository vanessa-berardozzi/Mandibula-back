// address.schema.ts
import { isValidPhoneNumber } from 'libphonenumber-js';
import { z } from 'zod';

/**
 * Regex de code postal par pays (norme officielle). Les pays absents de cette
 * table retombent sur une validation générique (alphanumérique, 3 à 10 caractères).
 */
const POSTAL_CODE_PATTERNS: Record<string, RegExp> = {
  FR: /^\d{5}$/,
  BE: /^\d{4}$/,
  CH: /^\d{4}$/,
  LU: /^\d{4}$/,
  MC: /^980\d{2}$/,
  DE: /^\d{5}$/,
  AT: /^\d{4}$/,
  ES: /^\d{5}$/,
  IT: /^\d{5}$/,
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  PT: /^\d{4}-\d{3}$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
  IE: /^[A-Za-z]\d[\dW]\s?[A-Za-z\d]{4}$/,
  DK: /^\d{4}$/,
  SE: /^\d{3}\s?\d{2}$/,
  NO: /^\d{4}$/,
  FI: /^\d{5}$/,
  PL: /^\d{2}-\d{3}$/,
  CZ: /^\d{3}\s?\d{2}$/,
  SK: /^\d{3}\s?\d{2}$/,
  HU: /^\d{4}$/,
  RO: /^\d{6}$/,
  BG: /^\d{4}$/,
  HR: /^\d{5}$/,
  SI: /^\d{4}$/,
  GR: /^\d{3}\s?\d{2}$/,
  CY: /^\d{4}$/,
  MT: /^[A-Za-z]{3}\s?\d{4}$/,
  EE: /^\d{5}$/,
  LV: /^\d{4}$/,
  LT: /^\d{5}$/,
  CA: /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/,
  US: /^\d{5}(-\d{4})?$/,
  AU: /^\d{4}$/,
  JP: /^\d{3}-?\d{4}$/,
};

const GENERIC_POSTAL_CODE_PATTERN = /^[A-Za-z0-9\- ]{3,10}$/;

export function isValidPostalCodeForCountry(postalCode: string, countryCode: string): boolean {
  const pattern = POSTAL_CODE_PATTERNS[countryCode.toUpperCase()];
  return (pattern ?? GENERIC_POSTAL_CODE_PATTERN).test(postalCode.trim());
}

export function isValidPhoneForCountry(phone: string, countryCode: string): boolean {
  return isValidPhoneNumber(phone, countryCode.toUpperCase() as never);
}

/**
 * Champs communs à une adresse "formulaire" (Adress en DB) et à un snapshot
 * figé (Order.billingAddress, Order.shippingAddress, Invoice.buyerAddress).
 * Ne contient PAS `type` : ce champ n'a de sens que pour une Adress vivante
 * (SHIPPING/BILLING/BOTH), pas pour un snapshot où le contexte est déjà
 * porté par le nom de la colonne (billingAddress vs shippingAddress).
 */
const addressCoreSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est obligatoire').max(100),
  lastName: z.string().trim().min(1, 'Le nom est obligatoire').max(100),
  companyName: z.string().trim().max(150).optional().or(z.literal('')),
  vatNumber: z.string().trim().max(30).optional().or(z.literal('')),
  street: z.string().trim().min(1, 'La rue est obligatoire').max(200),
  city: z.string().trim().min(1, 'La ville est obligatoire').max(100),
  // ISO 3166-1 alpha-2 (ex: FR, BE, US)
  country: z
    .string()
    .trim()
    .length(2, 'Le pays doit être un code ISO à 2 lettres (ex: FR)')
    .transform((value) => value.toUpperCase()),
  postalCode: z.string().trim().min(1, 'Le code postal est obligatoire').max(15),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

type AddressCore = z.infer<typeof addressCoreSchema>;

/**
 * Règles de validation métier partagées (code postal + téléphone selon le
 * pays). Appliquée identiquement partout où une adresse doit être vérifiée,
 * qu'il s'agisse du formulaire Adress ou d'un snapshot de commande.
 */
function applyAddressBusinessRules(data: AddressCore, ctx: z.RefinementCtx): void {
  if (!isValidPostalCodeForCountry(data.postalCode, data.country)) {
    ctx.addIssue({
      code: 'custom',
      path: ['postalCode'],
      message: `Format de code postal invalide pour le pays ${data.country}`,
    });
  }

  if (data.phone && !isValidPhoneForCountry(data.phone, data.country)) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: `Numéro de téléphone invalide pour le pays ${data.country}`,
    });
  }
}

// ── Adress (formulaire utilisateur) ─────────────────────────────────────

const addressBaseSchema = addressCoreSchema.extend({
  // Usage prévu de l'adresse : livraison, facturation, ou les deux
  type: z.enum(['SHIPPING', 'BILLING', 'BOTH']).optional().default('BOTH'),
});

export const addressSchema = addressBaseSchema.superRefine(applyAddressBusinessRules);

export const updateAddressSchema = addressBaseSchema.partial().superRefine((data, ctx) => {
  if (
    data.country &&
    data.postalCode &&
    !isValidPostalCodeForCountry(data.postalCode, data.country)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['postalCode'],
      message: `Format de code postal invalide pour le pays ${data.country}`,
    });
  }

  if (data.phone && data.country && !isValidPhoneForCountry(data.phone, data.country)) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: `Numéro de téléphone invalide pour le pays ${data.country}`,
    });
  }
});

export type AddressInput = z.infer<typeof addressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

// ── Snapshot figé (Order.billingAddress / shippingAddress, Invoice.buyerAddress) ──

/**
 * Même validation métier que addressSchema (code postal + téléphone par
 * pays), mais sans `type`. Utilisée pour valider le Json stocké dans une
 * commande ou une facture — à l'écriture avec .parse(), à la lecture avec
 * .safeParse() pour ne jamais faire planter une page sur une vieille donnée.
 */
export const addressSnapshotSchema = addressCoreSchema.superRefine(applyAddressBusinessRules);

export type AddressSnapshot = z.infer<typeof addressSnapshotSchema>;
