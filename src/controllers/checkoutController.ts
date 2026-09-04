import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { CartService } from '../services/cartService';
import { paymentService } from '../services/payment/payment.service';
import { StockService } from '../services/stockService';
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
 * Confirme un paiement = Utilise StockService pour gérer les réservations
 * Idempotent: ne fait rien si déjà PAID
 */
async function confirmPayment(orderId: string, context: string): Promise<boolean> {
  return await StockService.confirmOrder(orderId);
}

/**
 * Annule un paiement = Libère les réservations via StockService
 */
async function cancelPayment(orderId: string, reason: string): Promise<void> {
  await StockService.cancelOrder(orderId, reason);
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

      // Récupérer la commande
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, userId: true, paymentStatus: true },
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
        await confirmPayment(orderId, 'Payment confirmed');
        await CartService.clearCart(order.userId).catch((err) =>
          console.error('[Webhook] Erreur vidage panier:', err)
        );
        console.log('[Webhook] Paiement confirmé, stock mis à jour, panier vidé:', orderId);
      } else {
        await cancelPayment(orderId, `Payment ${webhookResult.paymentStatus}`);
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
            const processed = await confirmPayment(orderId, 'Payment confirmed (fallback)');
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
            await cancelPayment(orderId, 'FAILED');
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
