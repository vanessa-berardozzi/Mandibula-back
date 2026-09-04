import type { ProductVatCategory } from '@prisma/client';

export class VatRateNotFoundError extends Error {
  constructor(countryCode: string, productCategory: ProductVatCategory) {
    super(
      `Aucun taux de TVA configuré pour le pays "${countryCode}" et la catégorie "${productCategory}". ` +
        `Vérifiez la table vat_rates ou que ce pays est bien supporté.`
    );
    this.name = 'VatRateNotFoundError';
  }
}

export class UnsupportedCountryError extends Error {
  constructor(countryCode: string) {
    super(`Le pays "${countryCode}" n'est pas reconnu ou n'est pas configuré.`);
    this.name = 'UnsupportedCountryError';
  }
}

export class VatNumberValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VatNumberValidationError';
  }
}

export class InvalidCartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCartError';
  }
}
