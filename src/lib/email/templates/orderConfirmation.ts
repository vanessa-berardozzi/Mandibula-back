// email/templates/orderConfirmation.ts
import { renderEmailLayout } from '../layout';

export interface OrderItem {
  name: string;
  variantName?: string;
  quantity: number;
  price: number; // en euros, prix unitaire
  imageUrl?: string;
}

export interface BuildOrderConfirmationParams {
  orderNumber: string;
  createdAt: Date;
  total: number;
  shippingAddress?: string | null;
  items: OrderItem[];
}

function formatPrice(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildItemsTable(items: OrderItem[], total: number): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1c2620;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${
                  item.imageUrl
                    ? `<td width="56" style="padding-right:14px;">
                        <img src="${item.imageUrl}" alt="${item.name}" width="56" height="56" style="border-radius:8px;display:block;object-fit:cover;" />
                      </td>`
                    : ''
                }
                <td style="color:#f2f5f2;font-size:14px;font-weight:700;">
                  ${item.name}
                  <div style="color:#6b756f;font-size:12px;font-weight:400;margin-top:2px;">${item.variantName ? `${item.variantName} · ` : ''}Quantité : ${item.quantity}</div>
                </td>
                <td align="right" style="color:#70f18b;font-size:14px;font-weight:700;white-space:nowrap;">
                  ${formatPrice(item.price * item.quantity)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows}
      <tr>
        <td style="padding:16px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#f2f5f2;font-size:16px;font-weight:900;">Total</td>
              <td align="right" style="color:#70f18b;font-size:16px;font-weight:900;">${formatPrice(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildSummaryBlock(orderNumber: string, createdAt: Date, shippingAddress?: string | null): string {
  const addressHtml = shippingAddress
    ? `<tr>
        <td style="padding-top:12px;color:#6b756f;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Adresse de livraison</td>
      </tr>
      <tr>
        <td style="color:#f2f5f2;font-size:13px;line-height:1.5;">${shippingAddress.replace(/\r?\n/g, '<br/>')}</td>
      </tr>`
    : '';

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1c2620;border-radius:10px;padding:16px;margin-bottom:20px;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#6b756f;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Référence</td>
              <td align="right" style="color:#6b756f;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Date</td>
            </tr>
            <tr>
              <td style="color:#f2f5f2;font-size:14px;font-weight:700;">#${orderNumber}</td>
              <td align="right" style="color:#f2f5f2;font-size:14px;font-weight:700;">${formatDate(createdAt)}</td>
            </tr>
            ${addressHtml}
          </table>
        </td>
      </tr>
    </table>`;
}

export async function buildOrderConfirmationEmail(
  params: BuildOrderConfirmationParams
): Promise<{ subject: string; text: string; html: string }> {
  const { orderNumber, createdAt, total, shippingAddress, items } = params;
  const subject = `Confirmation de votre commande #${orderNumber}`;

  const text = `Bonjour,\n\nVotre commande #${orderNumber} du ${formatDate(createdAt)} a été confirmée.\n\n${items
    .map((i) => `- ${i.name}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity} : ${formatPrice(i.price * i.quantity)}`)
    .join('\n')}\n\nTotal : ${formatPrice(total)}${shippingAddress ? `\n\nAdresse de livraison :\n${shippingAddress}` : ''}\n\nMerci pour votre confiance.`;

  const html = await renderEmailLayout({
    kicker: 'Paiement confirmé',
    title: `Merci pour votre <span style="color:#70f18b;">commande</span>`,
    bodyHtml: `<p style="margin:0;">Votre paiement a bien été reçu, voici le récapitulatif de votre commande.</p>`,
    extraContentHtml: buildSummaryBlock(orderNumber, createdAt, shippingAddress) + buildItemsTable(items, total),
    ctaUrl: undefined,
    ctaLabel: undefined,
  });

  return { subject, text, html };
}
