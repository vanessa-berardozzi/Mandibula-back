import type { Cart, CartItem, Product, ProductVariant } from '@prisma/client';

/**
 * Types pour le panier
 */

export interface CartItemWithVariant extends CartItem {
  variant: ProductVariant & { product: Product };
}

export interface CartWithItems extends Cart {
  items: CartItemWithVariant[];
}

export interface CartResponse {
  id: string;
  userId?: string | null;
  guestToken?: string | null;
  items: CartItemResponse[];
  createdAt: Date;
  updatedAt: Date;
  subtotal: number;
  itemCount: number;
}

export interface CartItemResponse {
  id: string;
  variantId: string;
  variant: {
    id: string;
    name: string;
    price: number;
    lotSize: number;
    stock: number;
    reservedStock: number;
    availableStock: number;
    product: {
      id: string;
      name: string;
      image?: string;
    };
  };
  quantity: number;
  price: number;
  total: number;
}

export interface AddToCartRequest {
  variantId: string;
  quantity?: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface CartValidationResponse {
  valid: boolean;
  items: CartItemValidated[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  promoCode?: string;
  errors?: string[];
}

export interface PromoCode {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal?: number;
}

export interface PromoValidationResponse {
  valid: boolean;
  code?: string;
  description?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  error?: string;
}

export interface CartItemValidated {
  variantId: string;
  quantity: number;
  price: number;
  total: number;
  available: boolean;
}
