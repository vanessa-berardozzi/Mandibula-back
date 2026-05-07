import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Validation du body pour créer une commande
const createOrderSchema = z.object({
  items: z.array(
    z.object({
      variantId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1, 'Le panier ne peut pas être vide'),
  paymentMethod: z.enum(['SUM_UP', 'PAYPAL', 'BANK_TRANSFER', 'CASH']),
  shippingAddress: z.string().optional(),
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
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

      const { items, paymentMethod, shippingAddress, billingAddress, notes } = validation.data;

      // Récupérer les variantes pour vérifier les prix et la disponibilité
      const variantIds = items.map((item) => item.variantId);
      const variants = await prisma.productVariant.findMany({
        where: {
          id: { in: variantIds },
        },
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      // Vérifier que toutes les variantes existent
      if (variants.length !== variantIds.length) {
        const foundIds = variants.map((v) => v.id);
        const missingIds = variantIds.filter((id) => !foundIds.includes(id));
        return res.status(400).json({
          error: 'Certains produits sont introuvables',
          missingIds,
        });
      }

      // Créer un map pour accès rapide aux variantes
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      // Calculer le subtotal et préparer les items de commande
      let subtotal = 0;
      const orderItems = items.map((item) => {
        const variant = variantMap.get(item.variantId)!;
        const price = parseFloat(variant.price.toString());
        subtotal += price * item.quantity;

        return {
          variantId: item.variantId,
          quantity: item.quantity,
          price: variant.price,
          variantName: variant.name,
        };
      });

      // TODO: Calculer les frais de port et taxes selon la logique métier
      const shippingCost = 0;
      const tax = null;
      const total = subtotal + shippingCost;

      // Créer la commande avec les items
      const order = await prisma.order.create({
        data: {
          userId,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod,
          subtotal,
          shippingCost,
          tax,
          total,
          shippingAddress,
          billingAddress,
          notes,
          orderItems: {
            create: orderItems,
          },
        },
        include: {
          orderItems: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
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
}
