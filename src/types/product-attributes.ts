// Types partagés pour les attributs produits Mandibula
// Ce fichier est la source de vérité — copie identique dans mandibula-front/types/

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export type DifficultyLabel =
  | 'Facile'
  | 'Simple'
  | 'Intermédiaire'
  | 'Avancé'
  | 'Difficile'
  | 'Expert';

/** Attributs pour tous les animaux vivants (isopodes, myriapodes, araignées…) */
export interface AnimalAttributes {
  type: 'animal';
  origine: string;          // "Vietnam", "Espagne", "Caraïbes"
  temperature: string;      // "22–26 °C"
  humidite: string;         // "70–90 %"
  substrat: string;         // "Feuilles mortes, bois en décomposition"
  alimentation: string;     // "Détritivore (feuilles mortes, bois)"
  conseils: string[];       // Tips d'élevage affichés sur la fiche produit
  niveau: DifficultyLabel;
  niveauScore: DifficultyLevel;
  wc?: boolean;             // true = espèce prélevée en nature (Wild-Caught)
}

/** Attributs pour les produits non-vivants (accessoires, nourriture, substrats, kits…) */
export interface AccessoireAttributes {
  type: 'accessoire';
  caracteristiques: string[];  // Points forts / descriptif du produit
  contenu?: string[];           // Pour les kits/packs : liste du contenu
  dimensions?: string;          // "30x20x15 cm"
  poids?: string;               // "500 g"
  volume?: string;              // "5 L"
}

export type ProductAttributes = AnimalAttributes | AccessoireAttributes;

// ── Helpers côté client ─────────────────────────────────────────────────────

export function isAnimalAttributes(a: ProductAttributes): a is AnimalAttributes {
  return a.type === 'animal';
}

export function isAccessoireAttributes(a: ProductAttributes): a is AccessoireAttributes {
  return a.type === 'accessoire';
}

/** Mappe niveauScore → label lisible en français */
export const DIFFICULTY_LABELS: Record<DifficultyLevel, DifficultyLabel> = {
  1: 'Facile',
  2: 'Intermédiaire',
  3: 'Avancé',
  4: 'Difficile',
  5: 'Expert',
};
