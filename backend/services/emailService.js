const nodemailer = require('nodemailer');
const { POLICY_TEXT } = require('../utils/cancellationPolicy');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Gmail credentials not configured (GMAIL_USER, GMAIL_APP_PASSWORD)');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

function formatDate(date) {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const E = {
  bg: '#FAFAF9',
  text: '#1C1917',
  muted: '#57534E',
  accent: '#B78B7D',
  panel: '#E5D4CE',
  infoBg: '#F0E6E2',
  white: '#ffffff',
  shadow: 'rgba(28,25,23,0.06)',
  border: 'rgba(28,25,23,0.08)',
  accentBorder: 'rgba(183,139,125,0.22)',
};

/** Full-width email CTA — large tap target for mobile clients (Gmail/Apple Mail). */
function emailButton({ href, label, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  const bg = isPrimary ? E.accent : E.white;
  const color = isPrimary ? E.white : E.accent;
  const border = isPrimary ? E.accent : E.accent;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 12px;">
      <tr>
        <td align="center" bgcolor="${bg}" style="background:${bg};border:2px solid ${border};border-radius:14px;">
          <a href="${href}" ${isPrimary ? 'target="_blank"' : ''}
             style="display:block;width:100%;box-sizing:border-box;padding:18px 20px;font-size:15px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};text-decoration:none;text-align:center;line-height:1.35;border-radius:14px;-webkit-text-size-adjust:100%;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function buildConfirmationHTML({
  clientName,
  treatment,
  startTime,
  endTime,
  bookingId,
  cancelUrl,
  cancellationDeadline,
}) {
  const calendarFile = require('./calendarFile');
  const googleUrl = calendarFile.generateGoogleCalendarUrl({
    title: `${treatment.name} – Nereida Martín Studio`,
    startTime,
    endTime,
    description: `${treatment.name}: ${treatment.tag}`,
    location: 'Nereida Martín Studio',
  });

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
  const icsUrl = `${backendUrl}/api/bookings/${bookingId}/calendar`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Nereida Martín Studio</h1>
      <p style="color:${E.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Tu cita ha sido confirmada</p>
    </div>

    <div style="background:${E.white};border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px ${E.shadow};">
      <p style="color:${E.text};font-size:16px;margin:0 0 20px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 24px;">Tu reserva ha sido confirmada. Aquí tienes los detalles:</p>

      <div style="background:${E.panel};border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="color:${E.accent};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Tratamiento</p>
        <p style="color:${E.text};font-size:16px;font-weight:600;margin:0;">${treatment.name}</p>
        <p style="color:${E.muted};font-size:13px;margin:4px 0 0;">${treatment.tag}</p>
      </div>

      <div style="background:${E.panel};border-radius:12px;padding:20px;">
        <p style="color:${E.accent};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Fecha y hora</p>
        <p style="color:${E.text};font-size:16px;font-weight:600;margin:0;text-transform:capitalize;">${formatDate(startTime)}</p>
        <p style="color:${E.muted};font-size:13px;margin:4px 0 0;">${formatTime(startTime)} – ${formatTime(endTime)}</p>
      </div>
    </div>

    <div style="margin:0 0 8px;">
      ${emailButton({ href: googleUrl, label: 'Agregar a Google Calendar', variant: 'primary' })}
    </div>

    <div style="text-align:center;margin:0 0 20px;padding:8px 0;">
      <a href="${icsUrl}" style="display:inline-block;padding:12px 16px;color:${E.accent};font-size:14px;line-height:1.4;text-decoration:underline;-webkit-text-size-adjust:100%;">Descargar recordatorio (.ics)</a>
    </div>

    ${cancelUrl ? `
    <div style="margin:0 0 20px;">
      ${emailButton({ href: cancelUrl, label: 'Cancelar cita', variant: 'secondary' })}
    </div>` : ''}

    <div style="background:${E.infoBg};border-radius:12px;padding:16px;border:1px solid ${E.accentBorder};">
      <p style="color:${E.text};font-size:13px;font-weight:600;line-height:1.5;margin:0 0 8px;">
        Política de cancelación
      </p>
      <p style="color:${E.text};font-size:13px;line-height:1.6;margin:0 0 8px;">
        ${POLICY_TEXT}
      </p>
      ${cancellationDeadline ? `<p style="color:${E.muted};font-size:12px;margin:0;">No podrás cancelar online después de: <strong>${cancellationDeadline}</strong>.</p>` : ''}
    </div>

    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Nereida Martín Studio · Nereida Martín</p>
    </div>
  </div>
</body>
</html>`;
}

function buildCancellationHTML({ clientName, treatment, startTime, endTime }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Nereida Martín Studio</h1>
      <p style="color:${E.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Cita cancelada</p>
    </div>
    <div style="background:${E.white};border-radius:16px;padding:28px;box-shadow:0 2px 12px ${E.shadow};">
      <p style="color:${E.text};font-size:16px;margin:0 0 16px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 20px;">
        Tu cita de <strong>${treatment.name}</strong> del ${formatDate(startTime)} a las ${formatTime(startTime)} ha sido cancelada correctamente.
      </p>
      <p style="color:${E.muted};font-size:13px;margin:0;">Si deseas reservar de nuevo, visita nuestra web cuando quieras.</p>
    </div>
    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Nereida Martín Studio · Nereida Martín</p>
    </div>
  </div>
</body>
</html>`;
}

function buildGoogleChangeHTML({ clientName, treatment, startTime, endTime, changeType }) {
  const titles = {
    cancelled: 'Tu cita ha sido cancelada',
    rescheduled: 'Tu cita ha sido reprogramada',
    updated: 'Tu cita ha sido actualizada',
  };
  const messages = {
    cancelled: 'El estudio ha cancelado tu cita. Si tienes dudas, contáctanos.',
    rescheduled: 'El estudio ha cambiado la fecha u hora de tu cita. Revisa los nuevos datos:',
    updated: 'El estudio ha actualizado los detalles de tu cita:',
  };

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Nereida Martín Studio</h1>
      <p style="color:${E.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${titles[changeType] || titles.updated}</p>
    </div>
    <div style="background:${E.white};border-radius:16px;padding:28px;box-shadow:0 2px 12px ${E.shadow};">
      <p style="color:${E.text};font-size:16px;margin:0 0 16px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 20px;">${messages[changeType] || messages.updated}</p>
      ${changeType !== 'cancelled' ? `
      <div style="background:${E.panel};border-radius:12px;padding:20px;">
        <p style="color:${E.accent};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Nueva fecha y hora</p>
        <p style="color:${E.text};font-size:16px;font-weight:600;margin:0;text-transform:capitalize;">${formatDate(startTime)}</p>
        <p style="color:${E.muted};font-size:13px;margin:4px 0 0;">${formatTime(startTime)} – ${formatTime(endTime)}</p>
        <p style="color:${E.muted};font-size:13px;margin:8px 0 0;">${treatment.name}</p>
      </div>` : ''}
    </div>
    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Nereida Martín Studio · Nereida Martín</p>
    </div>
  </div>
</body>
</html>`;
}

function buildReminderHTML({ clientName, treatment, startTime, endTime }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Nereida Martín Studio</h1>
      <p style="color:${E.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Recordatorio de cita</p>
    </div>

    <div style="background:${E.white};border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px ${E.shadow};">
      <p style="color:${E.text};font-size:16px;margin:0 0 20px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 24px;">
        Te recordamos que tu cita es <strong>hoy en unas horas</strong>. ¡Te esperamos!
      </p>

      <div style="background:${E.panel};border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="color:${E.accent};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Tratamiento</p>
        <p style="color:${E.text};font-size:16px;font-weight:600;margin:0;">${treatment.name}</p>
        <p style="color:${E.muted};font-size:13px;margin:4px 0 0;">${treatment.tag}</p>
      </div>

      <div style="background:${E.panel};border-radius:12px;padding:20px;">
        <p style="color:${E.accent};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Fecha y hora</p>
        <p style="color:${E.text};font-size:16px;font-weight:600;margin:0;text-transform:capitalize;">${formatDate(startTime)}</p>
        <p style="color:${E.muted};font-size:13px;margin:4px 0 0;">${formatTime(startTime)} – ${formatTime(endTime)}</p>
      </div>
    </div>

    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Nereida Martín Studio · Nereida Martín</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendConfirmation({
  to,
  clientName,
  treatment,
  startTime,
  endTime,
  bookingId,
  cancelUrl,
  cancellationDeadline,
}) {
  const transport = getTransporter();

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `✨ Cita confirmada – ${treatment.name} | Nereida Martín Studio`,
    html: buildConfirmationHTML({
      clientName,
      treatment,
      startTime,
      endTime,
      bookingId,
      cancelUrl,
      cancellationDeadline,
    }),
  });
}

async function sendCancellationConfirmation({ to, clientName, treatment, startTime, endTime }) {
  const transport = getTransporter();

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Cita cancelada – ${treatment.name} | Nereida Martín Studio`,
    html: buildCancellationHTML({ clientName, treatment, startTime, endTime }),
  });
}

async function sendGoogleChangeNotice({
  to,
  clientName,
  treatment,
  startTime,
  endTime,
  changeType,
}) {
  const transport = getTransporter();
  const subjects = {
    cancelled: 'Tu cita ha sido cancelada',
    rescheduled: 'Tu cita ha sido reprogramada',
    updated: 'Actualización de tu cita',
  };

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${subjects[changeType] || subjects.updated} | Nereida Martín Studio`,
    html: buildGoogleChangeHTML({ clientName, treatment, startTime, endTime, changeType }),
  });
}

async function sendReminder({ to, clientName, treatment, startTime, endTime }) {
  const transport = getTransporter();

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `⏰ Recordatorio: Tu cita es hoy – ${treatment.name} | Nereida Martín Studio`,
    html: buildReminderHTML({ clientName, treatment, startTime, endTime }),
  });
}

function getOwnerEmail() {
  return process.env.OWNER_EMAIL || process.env.GMAIL_USER;
}

function ownerAlertHTML({ title, body, actions }) {
  const actionButtons = (actions || [])
    .map(
      (a) =>
        `<a href="${a.url}" style="display:inline-block;margin:8px 6px;background:${a.danger ? '#c45c5c' : E.accent};color:${E.white};text-decoration:none;padding:12px 24px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${a.label}</a>`
    )
    .join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <h1 style="color:${E.text};font-size:20px;">${title}</h1>
    <div style="background:${E.white};border-radius:16px;padding:24px;box-shadow:0 2px 12px ${E.shadow};">
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;color:${E.text};margin:0;">${body}</pre>
      ${actionButtons ? `<div style="text-align:center;margin-top:20px;">${actionButtons}</div>` : ''}
    </div>
  </div></body></html>`;
}

async function sendOwnerAlert({ subject, title, body, actions }) {
  const to = getOwnerEmail();
  if (!to) return;
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: ownerAlertHTML({ title, body, actions }),
  });
}

async function sendOwnerFirstVisitAlert(payload) {
  await sendOwnerAlert({
    subject: `⭐ Primera visita – ${payload.clientName} | Nereida Martín Studio`,
    title: 'Nueva primera visita al estudio',
    body: payload.body,
  });
}

async function sendOwnerTreatmentFirstAlert(payload) {
  await sendOwnerAlert({
    subject: `🆕 Nuevo tratamiento – ${payload.clientName} | Nereida Martín Studio`,
    title: 'Primera vez en un tratamiento',
    body: payload.body,
  });
}

async function sendOwnerFlaggedAlert(payload) {
  await sendOwnerAlert({
    subject: `⚠️ Cuestionario marcado – ${payload.clientName} | Nereida Martín Studio`,
    title: 'Revisar cuestionario de aptitud',
    body: payload.body,
  });
}

async function sendOwnerHennaAssessment({ body, approveUrl, rejectUrl, photoPath, treatmentName }) {
  const to = getOwnerEmail();
  if (!to) return;
  const transport = getTransporter();
  const label = treatmentName || 'tratamiento';
  const attachments = photoPath
    ? [{ filename: 'valoracion-foto.jpg', path: require('path').join(__dirname, '..', 'uploads', photoPath) }]
    : [];

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `📷 Valoración pendiente – ${label} | Nereida Martín Studio`,
    html: ownerAlertHTML({
      title: `Nueva valoración por foto – ${label}`,
      body,
      actions: [
        { label: 'Aprobar', url: approveUrl },
        { label: 'Rechazar y cancelar', url: rejectUrl, danger: true },
      ],
    }),
    attachments,
  });
}

async function sendClientHennaPending({ to, clientName, treatment, startTime, endTime }) {
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `⏳ Cita pendiente de valoración – ${treatment.name} | Nereida Martín Studio`,
    html: `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:${E.bg};padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
        <p>Hola <strong>${clientName}</strong>,</p>
        <p>Hemos recibido tu solicitud de <strong>${treatment.name}</strong> para el ${formatDate(startTime)} a las ${formatTime(startTime)}.</p>
        <p>Tu cita está <strong>pendiente de valoración</strong>. Revisaremos la foto de tus cejas y te confirmaremos por email si eres apta para el tratamiento.</p>
        <p style="color:${E.muted};font-size:13px;">Si no eres apta, cancelaremos la cita y te lo comunicaremos.</p>
      </div></body></html>`,
  });
}

async function sendClientHennaApproved({ to, clientName, treatment, startTime, endTime }) {
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `✅ Valoración aprobada – ${treatment.name} | Nereida Martín Studio`,
    html: `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:${E.bg};padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
        <p>Hola <strong>${clientName}</strong>,</p>
        <p>¡Buenas noticias! Tras revisar tu foto, confirmamos que eres apta para <strong>${treatment.name}</strong>.</p>
        <p>Tu cita del ${formatDate(startTime)} a las ${formatTime(startTime)} queda <strong>confirmada</strong>. Recibirás también el email de confirmación con los detalles.</p>
      </div></body></html>`,
  });
}

async function sendClientHennaRejected({ to, clientName, treatment, startTime }) {
  const transport = getTransporter();
  const dateLine = startTime
    ? ` del ${formatDate(startTime)} a las ${formatTime(startTime)}`
    : '';
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Valoración – no apta | Nereida Martín Studio`,
    html: `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:${E.bg};padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
        <p>Hola <strong>${clientName}</strong>,</p>
        <p>Tras valorar la foto de tus cejas, lamentamos informarte que <strong>no eres apta</strong> para el tratamiento de ${treatment.name} en este momento.</p>
        <p>Tu cita${dateLine} ha sido <strong>cancelada</strong>.</p>
        <p style="color:${E.muted};font-size:13px;">Si tienes dudas o quieres asesoramiento, escríbenos por WhatsApp. Estaremos encantadas de ayudarte.</p>
      </div></body></html>`,
  });
}

module.exports = {
  sendConfirmation,
  sendCancellationConfirmation,
  sendGoogleChangeNotice,
  sendReminder,
  sendOwnerFirstVisitAlert,
  sendOwnerTreatmentFirstAlert,
  sendOwnerFlaggedAlert,
  sendOwnerHennaAssessment,
  sendClientHennaPending,
  sendClientHennaApproved,
  sendClientHennaRejected,
};
