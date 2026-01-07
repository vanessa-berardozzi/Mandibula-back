import { Resend } from 'resend';

/**
 * Service d'envoi d'emails avec Resend
 * Docs: https://resend.com/docs/introduction
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
}

// Instance Resend (lazy loading)
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  if (!resend) {
    throw new Error('Resend client not initialized - missing RESEND_API_KEY');
  }
  return resend;
}

/**
 * Envoie un email via Resend
 * En dev sans clé API, on log juste dans la console
 */
export async function sendEmail({ to, subject, text }: SendEmailOptions): Promise<void> {
  // Si pas de clé API (dev local), on log juste
  if (!process.env.RESEND_API_KEY) {
    console.log('📧 Email (mode dev - pas envoyé):');
    console.log(`   À: ${to}`);
    console.log(`   Sujet: ${subject}`);
    console.log(`   Message: ${text}`);
    console.log('---');
    return;
  }

  try {
    // Envoyer l'email via Resend
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', // À remplacer par ton domaine vérifié
      to,
      subject,
      text,
    });

    if (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }

    console.log('✅ Email envoyé avec succès:', data?.id);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi d\'email:', error);
    throw error;
  }
}
