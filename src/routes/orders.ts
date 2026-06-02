import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// Créer une nouvelle commande
router.post('/', OrderController.createOrder);

// Récupérer toutes les commandes de l'utilisateur
router.get('/', OrderController.getUserOrders);

// Récupérer une commande par ID
router.get('/:orderId', OrderController.getOrder);

// Supprimer une commande
router.delete('/:orderId', OrderController.deleteOrder);

export default router;
