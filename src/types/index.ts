// User et Session types sont générés automatiquement par Better Auth
import type { User as BetterAuthUser, Session } from '../lib/auth';

// Étendre le User de Better Auth avec notre champ role personnalisé
export interface User extends BetterAuthUser {
  role: 'USER' | 'ADMIN';
}

// Réexporter Session
export type { Session };

// Auth request/response
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Better Auth response (retourne user + session)
export interface AuthResponse {
  user: User;
  session: Session;
}

// Express custom request (pour middleware)
export interface AuthRequest {
  user?: User;
  session?: Session;
}