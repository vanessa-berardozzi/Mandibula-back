import { renderEmailLayout } from '../layout';

/**
 * Template unique de confirmation de création de compte, utilisé pour tous
 * les modes de connexion (credentials, Google, Discord...).
 * Le lien de vérification n'est inclus que lorsque la méthode le requiert.
 */
export async function buildAccountConfirmationEmail(params: { verificationUrl?: string }): Promise<{ subject: string; text: string; html: string }> {
  const subject = 'Votre compte Mandibula a été créé';
  const text = params.verificationUrl
    ? `Bonjour,\n\nVotre compte Mandibula a été créé avec succès. Confirmez votre adresse email en cliquant sur ce lien : ${params.verificationUrl}\n\nSi vous n'êtes pas à l'origine de cette création, ignorez cet email.`
    : `Bonjour,\n\nVotre compte Mandibula a été créé avec succès.\n\nSi vous n'êtes pas à l'origine de cette création, contactez notre support immédiatement.`;
  const html = await renderEmailLayout({
    kicker: 'Confirmation de compte',
    title: `Bienvenue sur <span style="color:#70f18b;">Mandibula</span>`,
    bodyHtml: params.verificationUrl
      ? `<p style="margin:0 0 12px;">Votre compte a été créé avec succès.</p><p style="margin:0;">Confirmez votre adresse email pour l'activer.</p>`
      : `<p style="margin:0;">Votre compte a été créé avec succès.</p>`,
    ctaUrl: params.verificationUrl,
    ctaLabel: 'Confirmer mon adresse email',
  });
  return { subject, text, html };
}
