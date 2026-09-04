import type { ProductVatCategory, VatRateType } from '@prisma/client';

export type BuyerType = 'B2C' | 'B2B';

export interface CartItemInput {
  /** Identifiant produit, pour traçabilité dans la réponse */
  productId: string;
  productCategory: ProductVatCategory;
  /** Prix unitaire HORS TAXE, en centimes, pour éviter les erreurs de float */
  unitPriceExclVatCents: number;
  quantity: number;
}

export interface VatCalculationRequest {
  items: CartItemInput[];
  /** Pays de livraison, ISO 3166-1 alpha-2 (ex: "FR") */
  shipToCountry: string;
  buyerType: BuyerType;
  /** Numéro de TVA intracommunautaire, requis si buyerType === 'B2B' */
  vatNumber?: string;
}

export interface VatLineResult {
  productId: string;
  productCategory: ProductVatCategory;
  quantity: number;
  unitPriceExclVatCents: number;
  lineTotalExclVatCents: number;
  vatRate: number;
  vatRateType: VatRateType | 'REVERSE_CHARGE' | 'EXPORT_EXEMPT';
  vatAmountCents: number;
  lineTotalInclVatCents: number;
}

export type VatRegime =
  | 'DOMESTIC' // livraison au Luxembourg
  | 'EU_B2C_DESTINATION' // B2C UE, TVA du pays de destination (régime OSS)
  | 'EU_B2B_REVERSE_CHARGE' // B2B UE, numéro de TVA valide, autoliquidation
  | 'EU_B2B_NO_VALID_VAT_NUMBER' // B2B UE mais numéro invalide -> traité comme B2C
  | 'EXPORT_NON_EU'; // hors UE, exonéré

export interface VatCalculationResult {
  regime: VatRegime;
  shipToCountry: string;
  buyerType: BuyerType;
  vatNumberValidated?: {
    vatNumber: string;
    isValid: boolean;
    companyName?: string | null;
  };
  lines: VatLineResult[];
  totals: {
    totalExclVatCents: number;
    totalVatCents: number;
    totalInclVatCents: number;
  };
}
