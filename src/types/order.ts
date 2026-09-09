// Types related to orders in the Mandibula application.
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "TO_PREPARE"
  | "PREPARING"
  | "HELD_WEATHER"
  | "READY"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";




