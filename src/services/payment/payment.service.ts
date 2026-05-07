import type { PaymentProvider } from './payment.interface';
import { SumUpProvider } from './providers/sumup.provider';

type PaymentMethodType = 'SUM_UP' | 'PAYPAL' | 'BANK_TRANSFER' | 'CASH';

class PaymentService {
  private providers: Map<PaymentMethodType, PaymentProvider>;

  constructor() {
    this.providers = new Map();
    
    // Enregistrer le provider SumUp
    this.providers.set('SUM_UP', new SumUpProvider());
    
    // Les autres providers seront ajoutés ici plus tard
    // this.providers.set('PAYPAL', new PayPalProvider());
    // this.providers.set('STRIPE', new StripeProvider());
  }

  getProvider(paymentMethod: PaymentMethodType): PaymentProvider {
    const provider = this.providers.get(paymentMethod);
    
    if (!provider) {
      throw new Error(`Payment provider not found for method: ${paymentMethod}`);
    }
    
    return provider;
  }

  isProviderAvailable(paymentMethod: PaymentMethodType): boolean {
    return this.providers.has(paymentMethod);
  }

  getAvailableProviders(): PaymentMethodType[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton pattern
export const paymentService = new PaymentService();
