# Payment Service

Architecture multi-provider pour gérer plusieurs moyens de paiement.

## Structure

- `payment.interface.ts` - Interface commune pour tous les providers
- `payment.service.ts` - Factory qui route vers le bon provider
- `providers/` - Implémentations spécifiques (SumUp, PayPal, etc.)

## Ajouter un nouveau provider

1. Créer `providers/nouveau-provider.provider.ts`
2. Implémenter l'interface `PaymentProvider`
3. Enregistrer dans `payment.service.ts`
4. Ajouter dans l'enum `PaymentMethod` du schema Prisma

## Configuration

Voir `.env.example` à la racine du projet.
