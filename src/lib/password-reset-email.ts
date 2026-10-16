export function passwordResetEmailContent(input: {
  name: string;
  resetUrl: string;
  logoUrl: string;
}) {
  const firstName = input.name.trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";

  const text = `${greeting}

Pediste cambiar tu contraseña en Enforma.

Abrí este enlace para elegir una contraseña nueva (vale una hora):
${input.resetUrl}

La contraseña tiene que tener al menos 8 caracteres e incluir letras y números.

Si no pediste esto, ignorá este email.

— Enforma`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cambiar contraseña · Enforma</title>
</head>
<body style="margin:0;padding:0;background:#F6F1E8;font-family:Georgia,'Times New Roman',serif;color:#2F241C;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F1E8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#FFFCFA;border:1px solid #E8DFD2;border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 12px;">
                <tr>
                  <td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;border-radius:999px;background:#A35A2E;color:#FFF8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:700;line-height:56px;">
                    <img src="${input.logoUrl}" width="56" height="56" alt="Enforma" style="display:block;border:0;border-radius:999px;outline:none;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:28px;line-height:1.2;font-style:italic;letter-spacing:-0.02em;color:#2F241C;">Enforma</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;text-align:center;">
              <h1 style="margin:0;font-size:26px;line-height:1.25;font-style:italic;font-weight:normal;color:#2F241C;">Cambiar contraseña</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#5C5248;">
              <p style="margin:0 0 12px;">${greeting}</p>
              <p style="margin:0 0 12px;">Pediste cambiar tu contraseña en Enforma. Tocá el botón para elegir una nueva.</p>
              <p style="margin:0 0 20px;">La contraseña tiene que tener al menos 8 caracteres e incluir letras y números. El enlace vale una hora.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:4px 28px 24px;">
              <a href="${input.resetUrl}" style="display:inline-block;background:#A35A2E;color:#FFF8F0;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;padding:14px 22px;border-radius:999px;">
                Cambiar contraseña
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;color:#8A7F74;">
              <p style="margin:0 0 8px;">Si el botón no funciona, copiá y pegá este enlace:</p>
              <p style="margin:0;word-break:break-all;"><a href="${input.resetUrl}" style="color:#A35A2E;">${input.resetUrl}</a></p>
              <p style="margin:16px 0 0;">Si no pediste esto, ignorá el email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: "Cambiar contraseña · Enforma",
    html,
    text,
  };
}
