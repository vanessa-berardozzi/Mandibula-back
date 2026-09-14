import { Resend } from 'resend';

/**
 * Service d'envoi d'emails avec Resend
 * Docs: https://resend.com/docs/introduction
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Habillage HTML repris de la DA homepage (bandeau jungle assombri, watermark topographique,
 * kicker mono vert façon `.eyebrow`, titre condensé façon `.kinetic-title`), pour un rendu cohérent avec mandibula-front.
 */
function renderEmailLayout(params: { title: string; bodyHtml: string; ctaUrl?: string; ctaLabel?: string }): string {
  const { title, bodyHtml, ctaUrl, ctaLabel } = params;
  const siteUrl = process.env.FRONTEND_URL || 'https://mandibula.com';
  // Les images doivent être servies sur une URL publique : en local, FRONTEND_URL pointe vers
  // localhost (injoignable par Gmail/Resend), donc on retombe sur EMAIL_ASSETS_URL ou le domaine de staging.
  const assetsUrl = process.env.EMAIL_ASSETS_URL || (siteUrl.includes('localhost') ? 'https://dev.mandibula.lu' : siteUrl);
  const logoUrl = `${assetsUrl}/mandibula-logo.png`;
  const jungleUrl = `${assetsUrl}/mandibula-jungle.png`;
  const topoUrl = `${assetsUrl}/topographic-neon.png`;
  const cta = ctaUrl
    ? `<tr><td align="center" style="padding:32px 0 8px;">
         <a href="${ctaUrl}" style="display:inline-block;background:#70f18b;color:#071309;font-weight:700;font-size:16px;text-decoration:none;padding:16px 36px;border-radius:8px;">${ctaLabel ?? 'Confirmer'}</a>
       </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#070a08;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#070a08;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#0d120e;border:1px solid rgba(112,241,139,0.35);border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" bgcolor="#030906" style="background:linear-gradient(180deg, rgba(3,9,6,0.86), rgba(3,9,6,0.96)), url('${jungleUrl}') center 40% / cover no-repeat;background-color:#030906;padding:44px 40px 32px;border-bottom:1px solid rgba(112,241,139,0.35);">
                <a href="${siteUrl}" style="text-decoration:none;">
                  <img src="${logoUrl}" alt="Mandibula" width="200" style="display:block;max-width:200px;width:100%;height:auto;margin:0 auto;" />
                </a>
              </td>
            </tr>
            <tr>
              <td bgcolor="#0d120e" style="background:url('${topoUrl}') 108% -10% / 55% auto no-repeat, #0d120e;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:36px 40px 0;">
                      <span style="display:block;color:#70f18b;font-family:ui-monospace,'Courier New',monospace;font-size:11px;font-weight:900;letter-spacing:0.24em;text-transform:uppercase;margin:0 0 14px;">Confirmation de compte</span>
                      <h1 style="color:#f2f5f2;font-family:'Arial Black','Helvetica Neue',Arial,sans-serif;font-size:30px;line-height:1;letter-spacing:-0.03em;margin:0 0 20px;">${title}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 40px;color:#c7d0cb;font-size:15px;line-height:1.7;">
                      ${bodyHtml}
                    </td>
                  </tr>
                  <tr><td>${cta}</td></tr>
                  <tr>
                    <td align="center" style="padding:40px 40px 32px;">
                      <a href="${siteUrl}" style="color:#70f18b;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-decoration:none;">Visiter mandibula.com →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px;border-top:1px solid #1c2620;background-color:#0d120e;">
                <p style="color:#6b756f;font-size:12px;margin:0;">Vous recevez cet email suite à la création d'un compte sur Mandibula. Si vous n'êtes pas à l'origine de cette action, ignorez ce message.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Template unique de confirmation de création de compte, utilisé pour tous
 * les modes de connexion (credentials, Google, Discord...).
 * Le lien de vérification n'est inclus que lorsque la méthode le requiert.
 */
export function buildAccountConfirmationEmail(params: { verificationUrl?: string }): { subject: string; text: string; html: string } {
  const subject = 'Votre compte Mandibula a été créé';
  const text = params.verificationUrl
    ? `Bonjour,\n\nVotre compte Mandibula a été créé avec succès. Confirmez votre adresse email en cliquant sur ce lien : ${params.verificationUrl}\n\nSi vous n'êtes pas à l'origine de cette création, ignorez cet email.`
    : `Bonjour,\n\nVotre compte Mandibula a été créé avec succès.\n\nSi vous n'êtes pas à l'origine de cette création, contactez notre support immédiatement.`;
  const html = renderEmailLayout({
    title: `Bienvenue sur <span style="color:#70f18b;">Mandibula</span>`,
    bodyHtml: params.verificationUrl
      ? `<p style="margin:0 0 12px;">Votre compte a été créé avec succès.</p><p style="margin:0;">Confirmez votre adresse email pour l'activer.</p>`
      : `<p style="margin:0;">Votre compte a été créé avec succès.</p>`,
    ctaUrl: params.verificationUrl,
    ctaLabel: 'Confirmer mon adresse email',
  });
  return { subject, text, html };
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
export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<void> {
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
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'; // À remplacer par ton domaine vérifié
    const { data, error } = await client.emails.send({
      from: `Mandibula <${fromAddress}>`,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
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
