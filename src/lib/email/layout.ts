// email/templates/layout.ts
import mjml2html from 'mjml';

export interface EmailLayoutParams {
  kicker: string;
  title: string;
  bodyHtml: string;
  extraContentHtml?: string; // ← nouveau : bloc custom (ex: tableau panier)
  ctaUrl?: string;
  ctaLabel?: string;
}

export async function renderEmailLayout(params: EmailLayoutParams): Promise<string> {
  const { kicker, title, bodyHtml, extraContentHtml, ctaUrl, ctaLabel } = params;
  const siteUrl = process.env.FRONTEND_URL || 'https://mandibula.lu';
  const assetsUrl =
    process.env.EMAIL_ASSETS_URL ||
    (siteUrl.includes('localhost') ? 'https://dev.mandibula.lu' : siteUrl);
  const logoUrl = `${assetsUrl}/mandibula-logo.png`;
  const jungleUrl = `${assetsUrl}/mandibula-jungle.png`;
  const cta = ctaUrl
    ? `<mj-button href="${ctaUrl}" background-color="#70f18b" color="#071309" font-size="16px" font-weight="700" border-radius="8px" inner-padding="16px 36px" padding="32px 0 8px">${ctaLabel ?? 'Confirmer'}</mj-button>`
    : '';
  const extraSection = extraContentHtml
    ? `<mj-text align="left" padding="24px 0 0">${extraContentHtml}</mj-text>`
    : '';

  const result = await mjml2html(
    `<mjml>
      <mj-head>
        <mj-title>Mandibula</mj-title>
        <mj-preview>Votre compte Mandibula a été créé</mj-preview>
        <mj-raw>
          <meta name="color-scheme" content="light only">
          <meta name="supported-color-schemes" content="light only">
          <style>
            [data-ogsc] body,
            [data-ogsc] table,
            [data-ogsc] td,
            [data-ogsc] .mandibula-card,
            [data-ogsc] .mandibula-card table,
            [data-ogsc] .mandibula-card td,
            [data-ogsb] body,
            [data-ogsb] table,
            [data-ogsb] td,
            [data-ogsb] .mandibula-card,
            [data-ogsb] .mandibula-card table,
            [data-ogsb] .mandibula-card td {
              background-color: #071109 !important;
            }
          </style>
        </mj-raw>
        <mj-attributes>
          <mj-all font-family="Arial, Helvetica, sans-serif" />
          <mj-text color="#ebf1ec" font-size="15px" line-height="1.7" padding="0" />
          <mj-section background-color="#070a08" />
        </mj-attributes>
        <mj-style inline="inline">
          .mandibula-card > table { border: 1px solid rgba(112,241,139,0.18); border-radius: 16px; overflow: hidden; }
          .mandibula-title div { color: #f2f5f2; font-family: Arial Black, Helvetica Neue, Arial, sans-serif; font-size: 30px; font-weight: 900; line-height: 1; }
          .mandibula-kicker div { color: #70f18b; font-family: Courier New, monospace; font-size: 11px; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase; }
          .mandibula-body p { margin: 0; }
          .mandibula-body p + p { margin-top: 12px; }
          [data-ogsc] .mandibula-title div,
          [data-ogsc] .mandibula-kicker div,
          [data-ogsc] .mandibula-body p,
          [data-ogsb] .mandibula-title div,
          [data-ogsb] .mandibula-kicker div,
          [data-ogsb] .mandibula-body p { color: #ebf1ec !important; }
          [data-ogsc] .mandibula-card,
          [data-ogsb] .mandibula-card { background-color: #071109 !important; }
        </mj-style>
      </mj-head>
      <mj-body background-color="#070a08" width="560px">
        <mj-wrapper css-class="mandibula-card" background-color="#071109" padding="0">
          <mj-section background-url="${jungleUrl}" background-size="cover" background-position="center" padding="0" border="0">
            <mj-column padding="40px 40px 28px">
              <mj-image href="${siteUrl}" src="${logoUrl}" alt="Mandibula" width="200px" padding="0" />
            </mj-column>
          </mj-section>

          <mj-section background-color="#071109" padding="32px 40px 0">
            <mj-column>
              <mj-text align="center" css-class="mandibula-kicker" padding="0 0 14px">${kicker}</mj-text>
              <mj-text align="center" css-class="mandibula-title" padding="0 0 20px">${title}</mj-text>
              <mj-text align="center" css-class="mandibula-body" padding="0">${bodyHtml}</mj-text>
              ${extraSection}
              ${cta}
              <mj-text align="center" padding="40px 0 32px"><a href="${siteUrl}" style="color:#70f18b;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-decoration:none;">Visiter mandibula.lu</a></mj-text>
            </mj-column>
          </mj-section>

          <mj-section background-color="#070a08" border-top="1px solid #1c2620" padding="24px 40px 32px">
            <mj-column>
              <mj-text color="#6b756f" font-size="12px" line-height="1.5">Vous recevez cet email suite à une action sur votre compte Mandibula. Si vous n'êtes pas à l'origine de cette action, ignorez ce message.</mj-text>
            </mj-column>
          </mj-section>
        </mj-wrapper>
      </mj-body>
    </mjml>`,
    { validationLevel: 'soft' }
  );

  if (result.errors.length > 0) {
    console.warn('MJML email warnings:', result.errors);
  }

  return result.html;
}
