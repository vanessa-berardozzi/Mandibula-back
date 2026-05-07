import type {
  CheckoutData,
  CheckoutResult,
  PaymentProvider,
  WebhookPayload,
  WebhookResult,
} from '../payment.interface';

interface SumUpCheckoutResponse {
  id: string;
  checkout_reference: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  hosted_checkout_url?: string;
  checkout_url?: string; // Alternative possible
  url?: string; // Alternative possible
}

export class SumUpProvider implements PaymentProvider {
  private readonly apiKey: string;
  private readonly merchantCode: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.SUMUP_API_KEY!;
    this.merchantCode = process.env.SUMUP_MERCHANT_CODE!;
    this.baseUrl = process.env.SUMUP_API_URL || 'https://api.sumup.com';

    if (!this.apiKey || !this.merchantCode) {
      throw new Error('SumUp API key and merchant code are required');
    }
  }

  async createCheckout(data: CheckoutData): Promise<CheckoutResult> {
    const requestBody = {
      checkout_reference: data.orderId,
      amount: data.amount,
      currency: data.currency || 'EUR',
      merchant_code: this.merchantCode,
      redirect_url: data.returnUrl,
      description: data.description || `Commande ${data.orderId}`,
      // IMPORTANT: Activer Hosted Checkout pour recevoir l'URL de paiement
      hosted_checkout: {
        enabled: true,
      },
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[SumUp] Creating checkout with:', {
        url: `${this.baseUrl}/v0.1/checkouts`,
        body: requestBody,
        hasApiKey: !!this.apiKey,
      });
    }

    const response = await fetch(`${this.baseUrl}/v0.1/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[SumUp] Response status:', response.status, response.statusText);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('[SumUp] Error response:', error);
      throw new Error(`SumUp checkout creation failed (${response.status}): ${error}`);
    }

    const checkout = await response.json() as SumUpCheckoutResponse;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[SumUp] Full checkout response:', JSON.stringify(checkout, null, 2));
    }

    if (!checkout.hosted_checkout_url) {
      throw new Error('SumUp n\'a pas retourné d\'URL de paiement. Vérifiez que Hosted Checkout est activé dans votre compte.');
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[SumUp] Checkout URL:', checkout.hosted_checkout_url);
    }

    return {
      checkoutId: checkout.id,
      checkoutUrl: checkout.hosted_checkout_url,
      provider: 'sumup',
    };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    // SumUp envoie le webhook avec cette structure
    const { id, checkout_reference, status, transaction_id } = payload;

    // Mapper le statut SumUp vers notre statut interne
    let paymentStatus: 'PAID' | 'FAILED' | 'PENDING';
    
    switch (status?.toLowerCase()) {
      case 'paid':
        paymentStatus = 'PAID';
        break;
      case 'failed':
      case 'cancelled':
        paymentStatus = 'FAILED';
        break;
      default:
        paymentStatus = 'PENDING';
    }

    return {
      orderId: checkout_reference,
      paymentStatus,
      transactionId: transaction_id || id,
    };
  }

  async checkPaymentStatus(checkoutId: string): Promise<'PAID' | 'FAILED' | 'PENDING'> {
    const response = await fetch(`${this.baseUrl}/v0.1/checkouts/${checkoutId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check SumUp payment status');
    }

    const checkout = await response.json() as SumUpCheckoutResponse;

    switch (checkout.status?.toLowerCase()) {
      case 'paid':
        return 'PAID';
      case 'failed':
      case 'cancelled':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }
}
