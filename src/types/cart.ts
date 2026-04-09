import type { Cart, CartItem, Product } from '@prisma/client';

/**
 * Types pour le panier
 */

export interface CartItemWithProduct extends CartItem {
  product: Product;
}

export interface CartWithItems extends Cart {
  items: CartItemWithProduct[];
}

export interface CartResponse {
  id: string;
  userId: string;
  items: CartItemResponse[];
  createdAt: Date;
  updatedAt: Date;
  subtotal: number;
  itemCount: number;
}

export interface CartItemResponse {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    price: number;
    image?: string;
  };
  quantity: number;
  price: number;
  total: number; // quantity * price
}

export interface AddToCartRequest {
  productId: string;
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
  total: number;
  errors?: string[];
}

export interface CartItemValidated {
  productId: string;
  quantity: number;
  price: number;
  total: number;
  available: boolean;
}
