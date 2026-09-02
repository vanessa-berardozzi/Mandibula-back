import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { CartService } from '../services/cartService';
import { paymentService } from '../services/payment/payment.service';
import type { CreateCheckoutInput } from '../validations/checkout.validation';

// ── Types internes ────────────────────────────────────────────────────────────

type OrderWithItems = {
  id: string;
  userId: string;
  total: import('@prisma/client').Prisma.Decimal;
  orderItems: Array<{
    variantId: string;
    quantity: number;
    variant: { productId: string };
  }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Confirme un paiement dans une transaction atomique :
 * - passe la commande en CONFIRMED/PAID
 * - décrémente stock + reservedStock sur chaque variante
 * - crée un StockMovement par variante
 * - met à jour le statut StockInfo (LOW_STOCK / OUT_OF_STOCK) si existant
 *
 * Inclut une garde idempotente : ne fait rien si la commande n'est plus PENDING.
 */
async function confirmPayment(order: OrderWithItems, context: string): Promise<boolean> {
  let processed = false;

  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (current?.paymentStatus !== 'PENDING') return;

    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
    });

    // Grouper par productId pour décrémenter une seule fois
    const quantitiesByProduct = new Map<string, { quantity: number; variantId: string }>();
    
    for (const item of order.orderItems) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { productId: true, lotSize: true },
      });
      if (!variant) continue;

      const unitsToRemove = item.quantity * variant.lotSize;
      quantitiesByProduct.set(item.variant.productId, { quantity: unitsToRemove, variantId: item.variantId });
    }

    // Décrémenter Product.totalStock + créer movements
    for (const [productId, { quantity, variantId }] of quantitiesByProduct) {
      await tx.product.update({
        where: { id: productId },
        data: { totalStock: { decrement: quantity } },
      });

      await tx.stockMovement.create({
        data: {
          variantId: variantId,
          productId: productId,
          type: 'SALE',
          quantity: quantity,
          reason: `Order #${order.id.slice(0, 8)} - ${context}`,
          orderId: order.id,
        },
      });

      // Recalc status
      const stockInfo = await tx.stockInfo.findUnique({
        where: { productId },
      });
      if (stockInfo) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        const newStatus = !product ? 'IN_STOCK' :
          product.totalStock === 0 ? 'OUT_OF_STOCK' :
          product.totalStock <= stockInfo.minThreshold ? 'LOW_STOCK' :
          'IN_STOCK';
        
        await tx.stockInfo.update({
          where: { id: stockInfo.id },
          data: { status: newStatus },
        });
      }
    }

    processed = true;
  });

  return processed;
}

/**
 * Annule un paiement (FAILED / CANCELLED)
 * - passe la commande au statut fourni (pas de modification de stock)
 */
async function cancelPayment(
  order: OrderWithItems,
  paymentStatus: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (current?.paymentStatus !== 'PENDING') return;

    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: paymentStatus as any, status: 'CANCELLED' },
    });
  });
}

// ── Controller ────────────────────────────────────────────────────────────────

export class CheckoutController {
  /**
   * Crée un checkout de paiement et retourne l'URL de redirection
   */
  static async createCheckout(req: Request, res: Response) {
    try {
      const { orderId, paymentMethod } = req.body as CreateCheckoutInput;
      const userId = req.user!.id;

      // 1. Vérifier que la commande existe et appartient à l'utilisateur
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { orderItems: true },
      });

      if (!order) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      if (order.userId !== userId) {
        return res.status(403).json({ error: 'Accès non autorisé à cette commande' });
      }

      if (order.paymentStatus === 'PAID') {
        return res.status(400).json({ error: 'Cette commande a déjà été payée' });
      }

      // 2. Vérifier que le provider de paiement est disponible
      if (!paymentService.isProviderAvailable(paymentMethod)) {
        return res.status(400).json({ 
          error: `Méthode de paiement non disponible: ${paymentMethod}`,
          availableMethods: paymentService.getAvailableProviders(),
        });
      }

      // 3. Pour les retries de paiement, créer toujours un nouveau checkout
      // (l'ancien peut avoir expiré chez SumUp après ~30min)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Checkout] Création nouveau checkout (ancien peut être expiré)');
      }

      // 4. Créer un nouveau checkout
      const provider = paymentService.getProvider(paymentMethod);
      
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const returnUrl = `${baseUrl}/commande/confirmation?orderId=${orderId}`;

      // Utiliser une référence unique avec timestamp pour éviter les conflits 409
      // (en cas de tentatives multiples ou d'échec précédent non sauvegardé)
      const checkoutReference = `${orderId}-${Date.now()}`;

      const checkoutResult = await provider.createCheckout({
        orderId: checkoutReference,
        amount: Number(order.total),
        currency: 'EUR',
        returnUrl,
        description: `Commande Mandibula #${orderId.slice(0, 8)}`,
      });

      // 5. Sauvegarder l'ID du checkout dans la commande
      await prisma.order.update({
        where: { id: orderId },
        data: {
          sumupCheckoutId: checkoutResult.checkoutId,
          paymentMethod,
        },
      });

      // 6. Retourner l'URL de redirection
      res.status(200).json({
        success: true,
        checkoutUrl: checkoutResult.checkoutUrl,
        checkoutId: checkoutResult.checkoutId,
      });
    } catch (error) {
      console.error('Error creating checkout:', error);
      
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Erreur lors de la création du checkout' });
      }
    }
  }

  /**
   * Gère les webhooks SumUp
   */
  static async handleSumUpWebhook(req: Request, res: Response) {
    try {
      const provider = paymentService.getProvider('SUM_UP');
      const webhookResult = await provider.handleWebhook(req.body);

      // Extraire l'orderId de la référence (format: orderId-timestamp)
      // Un UUID a 5 segments (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      // Avec timestamp : 6 segments (uuid-timestamp)
      const checkoutReference = webhookResult.orderId;
      const segments = checkoutReference.split('-');
      const orderId = segments.length > 5 
        ? segments.slice(0, 5).join('-') // Garde les 5 premiers segments (UUID)
        : checkoutReference;

      if (process.env.NODE_ENV === 'development') {
        console.log('[Webhook] Checkout reference:', checkoutReference, '→ Order ID:', orderId);
      }

      // Récupérer la commande avec ses items et variants
      const order = await prisma.order.findFirst({
        where: { id: orderId },
        include: { orderItems: { include: { variant: true } } },
      });

      if (!order) {
        console.error(`Order not found for webhook: ${orderId}`);
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      // Éviter de traiter deux fois un paiement déjà confirmé
      if (order.paymentStatus === 'PAID') {
        return res.status(200).json({ success: true, alreadyProcessed: true });
      }

      if (webhookResult.paymentStatus === 'PAID') {
        await confirmPayment(order, 'Payment confirmed');
        await CartService.clearCart(order.userId).catch((err) =>
          console.error('[Webhook] Erreur vidage panier:', err)
        );
        console.log('[Webhook] Paiement confirmé, stock mis à jour, panier vidé:', orderId);
      } else {
        await cancelPayment(order, webhookResult.paymentStatus);
        console.log('[Webhook] Paiement échoué, réservation libérée:', orderId, webhookResult.paymentStatus);
      }

      // SumUp attend une réponse 200 pour confirmer la réception du webhook
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error handling SumUp webhook:', error);
      res.status(500).json({ error: 'Erreur lors du traitement du webhook' });
    }
  }

  /**
   * Vérifie le statut d'une commande (pour polling côté client).
   * Si la commande est toujours PENDING et qu'un checkout SumUp existe,
   * on interroge directement SumUp pour mettre à jour le statut (fallback webhook).
   */
  static async checkOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const userId = req.user!.id;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: { include: { variant: true } },
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      if (order.userId !== userId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Fallback : si toujours PENDING, interroger SumUp directement
      if (order.paymentStatus === 'PENDING' && order.sumupCheckoutId) {
        try {
          const provider = paymentService.getProvider('SUM_UP');
          const sumupStatus = await provider.checkPaymentStatus!(order.sumupCheckoutId);

          if (sumupStatus === 'PAID') {
            const processed = await confirmPayment(order, 'Payment confirmed (fallback)');
            if (processed) {
              await CartService.clearCart(order.userId).catch((err) =>
                console.error('[CheckOrderStatus] Erreur vidage panier:', err)
              );
              console.log('[CheckOrderStatus] Statut mis à jour via SumUp API (fallback):', orderId);
            }
            return res.status(200).json({
              orderId: order.id,
              status: 'CONFIRMED',
              paymentStatus: 'PAID',
              total: order.total,
            });
          }

          if (sumupStatus === 'FAILED') {
            await cancelPayment(order, 'FAILED');
            return res.status(200).json({
              orderId: order.id,
              status: 'CANCELLED',
              paymentStatus: 'FAILED',
              total: order.total,
            });
          }
        } catch (sumupError) {
          console.warn('[CheckOrderStatus] Erreur vérification SumUp:', sumupError);
          // On retourne le statut DB actuel si SumUp est inaccessible
        }
      }

      res.status(200).json({
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
      });
    } catch (error) {
      console.error('Error checking order status:', error);
      res.status(500).json({ error: 'Erreur lors de la vérification du statut' });
    }
  }
}
