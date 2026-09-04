/**
 * ⚠️ IMPORTANT — À LIRE AVANT D'UTILISER CE FICHIER
 *
 * Les taux STANDARD ci-dessous sont ceux généralement rapportés pour 2026
 * par les sources fiscales publiques au moment de la rédaction (sept. 2026).
 * Les taux RÉDUITS pour la catégorie LIVE_ANIMALS sont volontairement
 * laissés à confirmer pays par pays : le classement TVA des animaux vivants
 * (notamment invertébrés) varie et n'est pas toujours documenté clairement.
 * Ne poussez PAS ce seed en production sans faire valider chaque taux par
 * votre comptable/fiscaliste luxembourgeois, en particulier pour
 * LIVE_ANIMALS. Le seed est structuré pour que la mise à jour soit facile
 * (voir champ `source` sur chaque ligne).
 *
 * Exécution : npx prisma db seed  (après avoir configuré "prisma.seed"
 * dans votre package.json, cf. doc Prisma)
 */

import { PrismaClient, ProductVatCategory, VatRateType } from '@prisma/client';

const prisma = new PrismaClient();

interface CountrySeed {
  code: string;
  name: string;
  standardRate: number;
  /** null = pas de taux réduit connu/applicable pour cette catégorie -> utiliser standardRate */
  liveAnimalsRate: number | null;
  liveAnimalsRateType: VatRateType;
}

// Taux STANDARD des 27 États membres (source: comparatifs fiscaux publics,
// à jour approximative 2026 — À RE-VÉRIFIER avant mise en prod).
const COUNTRIES: CountrySeed[] = [
  {
    code: 'LU',
    name: 'Luxembourg',
    standardRate: 17,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'FR',
    name: 'France',
    standardRate: 20,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'BE',
    name: 'Belgique',
    standardRate: 21,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'DE',
    name: 'Allemagne',
    standardRate: 19,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'NL',
    name: 'Pays-Bas',
    standardRate: 21,
    liveAnimalsRate: 9,
    liveAnimalsRateType: 'REDUCED',
  },
  {
    code: 'IT',
    name: 'Italie',
    standardRate: 22,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'ES',
    name: 'Espagne',
    standardRate: 21,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'PT',
    name: 'Portugal',
    standardRate: 23,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'AT',
    name: 'Autriche',
    standardRate: 20,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'IE',
    name: 'Irlande',
    standardRate: 23,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'DK',
    name: 'Danemark',
    standardRate: 25,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'SE',
    name: 'Suède',
    standardRate: 25,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'FI',
    name: 'Finlande',
    standardRate: 25.5,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'PL',
    name: 'Pologne',
    standardRate: 23,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'CZ',
    name: 'Tchéquie',
    standardRate: 21,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'SK',
    name: 'Slovaquie',
    standardRate: 23,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'HU',
    name: 'Hongrie',
    standardRate: 27,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'RO',
    name: 'Roumanie',
    standardRate: 21,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'BG',
    name: 'Bulgarie',
    standardRate: 20,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'GR',
    name: 'Grèce',
    standardRate: 24,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'HR',
    name: 'Croatie',
    standardRate: 25,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'SI',
    name: 'Slovénie',
    standardRate: 22,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'EE',
    name: 'Estonie',
    standardRate: 24,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'LV',
    name: 'Lettonie',
    standardRate: 21,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'LT',
    name: 'Lituanie',
    standardRate: 21,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'MT',
    name: 'Malte',
    standardRate: 18,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
  {
    code: 'CY',
    name: 'Chypre',
    standardRate: 19,
    liveAnimalsRate: null,
    liveAnimalsRateType: 'STANDARD',
  },
];

const SOURCE_NOTE =
  'Seed initial sept. 2026 — taux standard indicatifs, à valider avec un fiscaliste avant prod';

async function main() {
  for (const c of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name, isEuMember: true },
      update: { name: c.name },
    });

    // Taux standard, applicable au matériel d'élevage et par défaut
    // aux animaux vivants tant que le taux réduit n'est pas confirmé.
    await prisma.vatRate.upsert({
      where: {
        countryCode_productCategory_validFrom: {
          countryCode: c.code,
          productCategory: ProductVatCategory.STANDARD_GOODS,
          validFrom: new Date('2026-01-01'),
        },
      },
      create: {
        countryCode: c.code,
        productCategory: ProductVatCategory.STANDARD_GOODS,
        rateType: VatRateType.STANDARD,
        rate: c.standardRate,
        validFrom: new Date('2026-01-01'),
        source: SOURCE_NOTE,
      },
      update: { rate: c.standardRate, source: SOURCE_NOTE },
    });

    const liveAnimalsRate = c.liveAnimalsRate ?? c.standardRate;
    const liveAnimalsType = c.liveAnimalsRate ? c.liveAnimalsRateType : VatRateType.STANDARD;

    await prisma.vatRate.upsert({
      where: {
        countryCode_productCategory_validFrom: {
          countryCode: c.code,
          productCategory: ProductVatCategory.LIVE_ANIMALS,
          validFrom: new Date('2026-01-01'),
        },
      },
      create: {
        countryCode: c.code,
        productCategory: ProductVatCategory.LIVE_ANIMALS,
        rateType: liveAnimalsType,
        rate: liveAnimalsRate,
        validFrom: new Date('2026-01-01'),
        source: c.liveAnimalsRate
          ? SOURCE_NOTE
          : `${SOURCE_NOTE} — À CONFIRMER, taux standard appliqué par défaut`,
      },
      update: { rate: liveAnimalsRate, rateType: liveAnimalsType },
    });
  }

  console.log(`Seed terminé : ${COUNTRIES.length} pays configurés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
