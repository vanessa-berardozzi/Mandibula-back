import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { CartService } from '../services/cartService';
import { paymentService } from '../services/payment/payment.service';
import type { CreateCheckoutInput } from '../validations/checkout.validation';

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

      // 3. Vérifier si un checkout existe déjà pour cette commande
      if (order.sumupCheckoutId && paymentMethod === 'SUM_UP') {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Checkout] Checkout existant trouvé:', order.sumupCheckoutId);
        }
        
        try {
          const provider = paymentService.getProvider(paymentMethod);
          const status = await provider.checkPaymentStatus!(order.sumupCheckoutId);
          
          if (status === 'PENDING') {
            // Le checkout existe et est toujours actif, on le réutilise
            
            // Récupérer les détails du checkout pour obtenir l'URL
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const returnUrl = `${baseUrl}/commande/confirmation?orderId=${orderId}`;
            
            // SumUp ne retourne pas l'URL dans GET, donc on la reconstruit
            // Format: https://pay.sumup.com/payments/{checkoutId}
            const checkoutUrl = `https://pay.sumup.com/payments/${order.sumupCheckoutId}`;
            
            return res.status(200).json({
              success: true,
              checkoutUrl,
              checkoutId: order.sumupCheckoutId,
              reused: true,
            });
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[Checkout] Checkout existant dans état final:', status);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Checkout] Erreur vérification checkout existant:', error);
          }
          // On continue pour créer un nouveau checkout
        }
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

      // Récupérer la commande avec ses items
      const order = await prisma.order.findFirst({
        where: { id: orderId },
        include: { orderItems: true },
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
        // Transaction atomique : mettre à jour commande + stock
        await prisma.$transaction(async (tx) => {
          // 1. Confirmer la commande
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
          });

          // 2. Décrémenter le stock physique et libérer la réservation
          for (const item of order.orderItems) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: { decrement: item.quantity },
                reservedStock: { decrement: item.quantity },
              },
            });
          }
        });

        // 3. Vider le panier (hors transaction — non critique)
        await CartService.clearCart(order.userId).catch((err) =>
          console.error('[Webhook] Erreur vidage panier:', err)
        );

        console.log('[Webhook] Paiement confirmé, stock mis à jour, panier vidé:', orderId);
      } else {
        // Paiement échoué ou annulé → libérer la réservation
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: webhookResult.paymentStatus,
              status: 'CANCELLED',
            },
          });

          for (const item of order.orderItems) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { reservedStock: { decrement: item.quantity } },
            });
          }
        });

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
   * Vérifie le statut d'une commande (pour polling côté client)
   */
  static async checkOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const userId = req.user!.id;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      if (order.userId !== userId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
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
