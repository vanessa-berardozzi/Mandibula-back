import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { calculateVat } from '../services/vat/vatCalculationService';
import { calculateDiscountedPrice } from '../utils/pricing';

// Validation du body pour créer une commande
const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'Le panier ne peut pas être vide'),
  paymentMethod: z.enum(['SUM_UP', 'PAYPAL', 'BANK_TRANSFER', 'CASH']),
  shippingAddress: z.string().optional(),
  shippingCountryCode: z.string().length(2), // ← NOUVEAU, obligatoire
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().min(0).optional(),
  promoCode: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  // Pour plus tard, si vous gérez le B2B :
  // vatNumber: z.string().optional(),
});

type CreateOrderInput = z.infer<typeof createOrderSchema>;

export class OrderController {
  /**
   * Créer une commande à partir du panier
   * POST /api/orders
   */
  static async createOrder(req: Request, res: Response) {
    try {
      // Récupérer l'utilisateur authentifié (garanti par authMiddleware)
      const userId = req.user!.id;

      // Valider le body
      const validation = createOrderSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Données invalides',
          details: validation.error.issues,
        });
      }

      const {
        items,
        paymentMethod,
        shippingAddress,
        shippingCountryCode,
        billingAddress,
        notes,
        discount: discountFromBody,
        promoCode,
      } = validation.data;

      // Récupérer les variantes — AJOUT de vatCategory dans le select produit
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: items.map((item) => item.variantId) } },
        include: {
          product: {
            select: {
              name: true,
              totalStock: true,
              promotionType: true,
              promotionValue: true,
              vatCategory: true, // ← NOUVEAU
            },
          },
        },
      });

      // Vérifier que toutes les variantes existent
      const variantIds = items.map((item) => item.variantId);
      if (variants.length !== variantIds.length) {
        const foundIds = variants.map((v) => v.id);
        const missingIds = variantIds.filter((id) => !foundIds.includes(id));
        return res.status(400).json({
          error: 'Certains produits sont introuvables',
          missingIds,
        });
      }

      // Créer un map pour accès rapide aux variantes + produits
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      // Vérifier le stock total du produit pour chaque article (stock en individus, quantité en lots)
      const stockErrors: {
        variantName: string;
        productName: string;
        available: number;
        requested: number;
      }[] = [];
      for (const item of items) {
        const variant = variantMap.get(item.variantId)!;
        const availableLots = Math.floor(variant.product.totalStock / variant.lotSize);
        if (availableLots < item.quantity) {
          stockErrors.push({
            variantName: variant.name,
            productName: variant.product.name,
            available: availableLots,
            requested: item.quantity,
          });
        }
      }
      if (stockErrors.length > 0) {
        return res.status(400).json({
          error: 'Stock insuffisant',
          details: stockErrors,
        });
      }

      // Calculer le subtotal et préparer les items de commande
      let subtotal = 0;
      const orderItems = items.map((item) => {
        const variant = variantMap.get(item.variantId)!;
        const basePrice = parseFloat(variant.price.toString());
        const promotionValue = variant.product.promotionValue
          ? Number(variant.product.promotionValue)
          : null;
        const price = calculateDiscountedPrice(
          basePrice,
          variant.product.promotionType,
          promotionValue
        );
        subtotal += price * item.quantity;

        return {
          variantId: item.variantId,
          quantity: item.quantity,
          price,
          variantName: variant.name,
        };
      });

      const SHIPPING_COST = 5.99;
      const discount = discountFromBody ?? 0;

      // --- Calcul TVA réel, côté serveur ----------------------------------
      const vatItems = items.map((item) => {
        const variant = variantMap.get(item.variantId)!;
        const basePrice = parseFloat(variant.price.toString());
        const promotionValue = variant.product.promotionValue
          ? Number(variant.product.promotionValue)
          : null;
        const discountedPrice = calculateDiscountedPrice(
          basePrice,
          variant.product.promotionType,
          promotionValue
        );

        return {
          productId: variant.id,
          productCategory: variant.product.vatCategory,
          unitPriceExclVatCents: Math.round(discountedPrice * 100), // euros -> centimes
          quantity: item.quantity,
        };
      });

      const vatResult = await calculateVat({
        items: vatItems,
        shipToCountry: shippingCountryCode,
        buyerType: 'B2C', // à faire évoluer si vous ajoutez un flux B2B plus tard
      });

      const vatAmount = vatResult.totals.totalVatCents / 100; // retour en euros pour rester cohérent avec le reste du schéma
      const total = subtotal - discount + SHIPPING_COST + vatAmount;

      // Créer la commande (pas de réservation, juste crée la cmd en PENDING)
      const order = await prisma.$transaction(async (tx) => {
        return tx.order.create({
          data: {
            userId,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentMethod,
            subtotal,
            shippingCost: SHIPPING_COST,
            tax: vatAmount,
            total,
            shippingAddress,
            billingAddress,
            vatDetailsJson: vatResult as any,
            vatRegime: vatResult.regime,

            notes: notes ?? (promoCode ? `Promo: ${promoCode}` : undefined),
            orderItems: { create: orderItems },
          },
        });
      });

      res.status(201).json({
        orderId: order.id,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la commande' });
    }
  }

  /**
   * Récupérer une commande par ID
   * GET /api/orders/:orderId
   */
  static async getOrder(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      images: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      // Vérifier que la commande appartient à l'utilisateur
      if (order.userId !== userId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // 💡 vatDetailsJson est déjà un objet JS ici, prêt à être envoyé !
      res.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
    }
  }

  /**
   * Récupérer toutes les commandes de l'utilisateur
   * GET /api/orders
   */
  static async getUserOrders(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const orders = await prisma.order.findMany({
        where: { userId },
        include: {
          orderItems: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      images: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
    }
  }

  /**
   * Supprimer une commande (seulement si elle est en attente de paiement)
   * DELETE /api/orders/:orderId
   */
  static async deleteOrder(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      // Vérifier que la commande appartient à l'utilisateur
      if (order.userId !== userId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Vérifier que la commande peut être annulée (seulement si paiement en attente ou annulée)
      if (order.paymentStatus !== 'PENDING' && order.status !== 'CANCELLED') {
        return res.status(400).json({
          error:
            'Cette commande ne peut pas être annulée. Seules les commandes en attente de paiement peuvent être supprimées.',
        });
      }

      // Supprimer la commande (pas de réservation à libérer)
      await prisma.$transaction(async (tx) => {
        await tx.order.delete({
          where: { id: orderId },
        });
      });

      res.json({ message: 'Commande supprimée avec succès' });
    } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la commande' });
    }
  }
}
