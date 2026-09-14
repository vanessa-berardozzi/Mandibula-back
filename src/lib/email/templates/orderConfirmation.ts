// email/templates/orderConfirmation.ts
import { renderEmailLayout } from '../layout';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number; // en euros
  imageUrl?: string;
}

export interface BuildOrderConfirmationParams {
  orderNumber: string;
  items: OrderItem[];
}

function formatPrice(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

function buildItemsTable(items: OrderItem[]): string {
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
                  <div style="color:#6b756f;font-size:12px;font-weight:400;margin-top:2px;">Quantité : ${item.quantity}</div>
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

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

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

export async function buildOrderConfirmationEmail(
  params: BuildOrderConfirmationParams
): Promise<{ subject: string; text: string; html: string }> {
  const { orderNumber, items } = params;
  const subject = `Confirmation de votre commande #${orderNumber}`;

  const text = `Bonjour,\n\nVotre commande #${orderNumber} a été confirmée.\n\n${items
    .map((i) => `- ${i.name} x${i.quantity} : ${formatPrice(i.price * i.quantity)}`)
    .join('\n')}\n\nMerci pour votre confiance.`;

  const html = await renderEmailLayout({
    kicker: 'Commande confirmée',
    title: `Merci pour votre <span style="color:#70f18b;">commande</span>`,
    bodyHtml: `<p style="margin:0;">Votre commande <strong style="color:#f2f5f2;">#${orderNumber}</strong> a bien été enregistrée.</p>`,
    extraContentHtml: buildItemsTable(items),
    ctaUrl: undefined,
    ctaLabel: undefined,
  });

  return { subject, text, html };
}
