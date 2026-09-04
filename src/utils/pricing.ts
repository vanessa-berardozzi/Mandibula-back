import { PromotionType } from '@prisma/client';

/**
 * Applique la promotion d'un produit à un prix de base et renvoie le prix final.
 * Ne descend jamais sous 0.
 */
export function calculateDiscountedPrice(
  basePrice: number,
  promotionType: PromotionType | null | undefined,
  promotionValue: number | null | undefined
): number {
  if (!promotionType || promotionType === 'NONE' || !promotionValue || promotionValue <= 0) {
    return Math.round(basePrice * 100) / 100;
  }

  let discounted = basePrice;
  if (promotionType === 'PERCENTAGE') {
    discounted = basePrice * (1 - promotionValue / 100);
  } else if (promotionType === 'FIXED_AMOUNT') {
    discounted = basePrice - promotionValue;
  }

  return Math.max(0, Math.round(discounted * 100) / 100);
}
