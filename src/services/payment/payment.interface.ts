export interface CheckoutData {
  orderId: string;
  amount: number;
  currency?: string;
  returnUrl: string;
  description?: string;
}

export interface CheckoutResult {
  checkoutId: string;
  checkoutUrl: string;
  provider: string;
}

export interface WebhookPayload {
  [key: string]: any;
}

export interface WebhookResult {
  orderId: string;
  paymentStatus: 'PAID' | 'FAILED' | 'PENDING';
  transactionId?: string;
}

export interface PaymentProvider {
  /**
   * Crée un checkout de paiement et retourne l'URL de redirection
   */
  createCheckout(data: CheckoutData): Promise<CheckoutResult>;

  /**
   * Gère les webhooks du provider de paiement
   */
  handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;

  /**
   * Vérifie le statut d'un paiement (optionnel, pour polling)
   */
  checkPaymentStatus?(checkoutId: string): Promise<'PAID' | 'FAILED' | 'PENDING'>;
}
