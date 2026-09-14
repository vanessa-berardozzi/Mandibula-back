/**
 * Habillage HTML commun à tous les emails, repris de la DA homepage (bandeau jungle assombri,
 * kicker mono vert façon `.eyebrow`, titre condensé façon `.kinetic-title`), pour un rendu
 * cohérent avec mandibula-front.
 */
export interface EmailLayoutParams {
  kicker: string;
  title: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

export function renderEmailLayout(params: EmailLayoutParams): string {
  const { kicker, title, bodyHtml, ctaUrl, ctaLabel } = params;
  const siteUrl = process.env.FRONTEND_URL || 'https://mandibula.lu';
  // Les images doivent être servies sur une URL publique : en local, FRONTEND_URL pointe vers
  // localhost (injoignable par Gmail/Resend), donc on retombe sur EMAIL_ASSETS_URL ou le domaine de staging.
  const assetsUrl = process.env.EMAIL_ASSETS_URL || (siteUrl.includes('localhost') ? 'https://dev.mandibula.lu' : siteUrl);
  const logoUrl = `${assetsUrl}/mandibula-logo.png`;
  const jungleUrl = `${assetsUrl}/mandibula-jungle.png`;
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
              <td align="center" bgcolor="#0a120c" background="${jungleUrl}" style="background-image:url('${jungleUrl}');background-position:center 40%;background-size:cover;background-repeat:no-repeat;background-color:#0a120c;padding:44px 40px 32px;border-bottom:1px solid rgba(112,241,139,0.35);">
                <a href="${siteUrl}" style="text-decoration:none;">
                  <img src="${logoUrl}" alt="Mandibula" width="200" style="display:block;max-width:200px;width:100%;height:auto;margin:0 auto;" />
                </a>
              </td>
            </tr>
            <tr>
              <td bgcolor="#0d120e" style="background-color:#0d120e;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:36px 40px 0;">
                      <span style="display:block;color:#70f18b;font-family:ui-monospace,'Courier New',monospace;font-size:11px;font-weight:900;letter-spacing:0.24em;text-transform:uppercase;margin:0 0 14px;">${kicker}</span>
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
                      <a href="${siteUrl}" style="color:#70f18b;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-decoration:none;">Visiter mandibula.lu →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px;border-top:1px solid #1c2620;background-color:#0d120e;">
                <p style="color:#6b756f;font-size:12px;margin:0;">Vous recevez cet email suite à une action sur votre compte Mandibula. Si vous n'êtes pas à l'origine de cette action, ignorez ce message.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
