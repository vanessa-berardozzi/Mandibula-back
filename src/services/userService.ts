import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Service pour la gestion des utilisateurs
 * Centralise toute la logique métier liée aux users
 */
export class UserService {
  // ==================== READ (Lecture) ====================
  
  /**
   * Récupérer un utilisateur par son ID
   */
  static async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Récupérer un utilisateur par son email
   */
  static async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Récupérer tous les utilisateurs (admin uniquement)
   */
  static async getAllUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // ==================== UPDATE (Mise à jour) ====================
  
  /**
   * Mettre à jour les informations d'un utilisateur
   */
  static async updateUser(id: string, data: { name?: string; image?: string }): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  // ==================== DELETE (Suppression) ====================
  
  /**
   * Supprimer un utilisateur (cascade automatique sur sessions/accounts)
   */
  static async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }
}
