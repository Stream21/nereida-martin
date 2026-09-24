const nodemailer = require('nodemailer');
const { POLICY_TEXT } = require('../utils/cancellationPolicy');
const { TIMEZONE } = require('../utils/studioTimezone');

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

/** Always format in studio TZ (Atlantic/Canary) — never server-local getters. */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const weekday = new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    weekday: 'long',
  }).format(d);
  const day = new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    day: 'numeric',
  }).format(d);
  const month = new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    month: 'long',
  }).format(d);
  const year = new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    year: 'numeric',
  }).format(d);
  return `${weekday}, ${day} de ${month} de ${year}`;
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
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

function buildCancellationHTML({ clientName, treatment, startTime, endTime, cancelledBy = 'client' }) {
  const intro =
    cancelledBy === 'studio'
      ? `El estudio ha cancelado tu cita de <strong>${treatment.name}</strong>.`
      : `Tu cita de <strong>${treatment.name}</strong> ha sido cancelada correctamente.`;

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
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 20px;">${intro}</p>
      <div style="background:${E.panel};border-radius:12px;padding:20px;margin:0 0 20px;">
        <p style="color:${E.accent};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Cita cancelada</p>
        <p style="color:${E.text};font-size:16px;font-weight:600;margin:0;text-transform:capitalize;">${formatDate(startTime)}</p>
        <p style="color:${E.muted};font-size:13px;margin:4px 0 0;">${formatTime(startTime)}${endTime ? ` – ${formatTime(endTime)}` : ''}</p>
        <p style="color:${E.muted};font-size:13px;margin:8px 0 0;">${treatment.name}</p>
      </div>
      <p style="color:${E.muted};font-size:13px;margin:0;">Si deseas reservar de nuevo, visita nuestra web cuando quieras. Si tienes dudas, contáctanos.</p>
    </div>
    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Nereida Martín Studio · Nereida Martín</p>
    </div>
  </div>
</body>
</html>`;
}

function slotBlock({ label, startTime, endTime, treatmentName }) {
  return `
      <div style="background:${E.panel};border-radius:12px;padding:20px;margin:0 0 12px;">
        <p style="color:${E.accent};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">${label}</p>
        <p style="color:${E.text};font-size:16px;font-weight:600;margin:0;text-transform:capitalize;">${formatDate(startTime)}</p>
        <p style="color:${E.muted};font-size:13px;margin:4px 0 0;">${formatTime(startTime)}${endTime ? ` – ${formatTime(endTime)}` : ''}</p>
        ${treatmentName ? `<p style="color:${E.muted};font-size:13px;margin:8px 0 0;">${treatmentName}</p>` : ''}
      </div>`;
}

function buildRescheduleHTML({
  clientName,
  treatment,
  previousTreatment,
  previousStartTime,
  previousEndTime,
  startTime,
  endTime,
  changedBy = 'studio',
}) {
  const intro =
    changedBy === 'client'
      ? 'Has cambiado los datos de tu cita. Resumen:'
      : 'El estudio ha cambiado los datos de tu cita. Resumen:';
  const prevName = previousTreatment?.name || treatment?.name || 'Cita';
  const nextName = treatment?.name || prevName;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Nereida Martín Studio</h1>
      <p style="color:${E.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Cita reprogramada</p>
    </div>
    <div style="background:${E.white};border-radius:16px;padding:28px;box-shadow:0 2px 12px ${E.shadow};">
      <p style="color:${E.text};font-size:16px;margin:0 0 16px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 20px;">${intro}</p>
      ${slotBlock({
        label: 'Cita anterior',
        startTime: previousStartTime,
        endTime: previousEndTime,
        treatmentName: prevName,
      })}
      ${slotBlock({
        label: 'Nueva cita',
        startTime,
        endTime,
        treatmentName: nextName,
      })}
      <p style="color:${E.muted};font-size:13px;margin:8px 0 0;">Si tienes dudas, contáctanos.</p>
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
    subject: `✨ Cita confirmada – ${treatment.name} · ${formatTime(startTime)} | Nereida Martín Studio`,
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

async function sendCancellationConfirmation({
  to,
  clientName,
  treatment,
  startTime,
  endTime,
  cancelledBy = 'client',
}) {
  const transport = getTransporter();
  const subjectTreatment = treatment?.name || 'Cita';
  const when = formatTime(startTime);

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Cita cancelada – ${subjectTreatment} · ${when} | Nereida Martín Studio`,
    html: buildCancellationHTML({
      clientName,
      treatment,
      startTime,
      endTime,
      cancelledBy,
    }),
  });
}

async function sendRescheduleNotice({
  to,
  clientName,
  treatment,
  previousTreatment,
  previousStartTime,
  previousEndTime,
  startTime,
  endTime,
  changedBy = 'studio',
}) {
  const transport = getTransporter();
  const subjectTreatment = treatment?.name || previousTreatment?.name || 'Cita';

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Cita reprogramada – ${subjectTreatment} | Nereida Martín Studio`,
    html: buildRescheduleHTML({
      clientName,
      treatment,
      previousTreatment,
      previousStartTime,
      previousEndTime,
      startTime,
      endTime,
      changedBy,
    }),
  });
}

/** @deprecated Use sendRescheduleNotice. Kept for any leftover callers. */
async function sendGoogleChangeNotice(opts) {
  if (opts.changeType === 'cancelled') {
    return sendCancellationConfirmation({
      to: opts.to,
      clientName: opts.clientName,
      treatment: opts.treatment,
      startTime: opts.startTime,
      endTime: opts.endTime,
      cancelledBy: 'studio',
    });
  }
  return sendRescheduleNotice({
    to: opts.to,
    clientName: opts.clientName,
    treatment: opts.treatment,
    previousTreatment: opts.previousTreatment,
    previousStartTime: opts.previousStartTime || opts.startTime,
    previousEndTime: opts.previousEndTime || opts.endTime,
    startTime: opts.startTime,
    endTime: opts.endTime,
    changedBy: opts.changedBy || 'studio',
  });
}

async function sendReminder({ to, clientName, treatment, startTime, endTime }) {
  const transport = getTransporter();

  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `⏰ Recordatorio: Tu cita es hoy – ${treatment.name} · ${formatTime(startTime)} | Nereida Martín Studio`,
    html: buildReminderHTML({ clientName, treatment, startTime, endTime }),
  });
}

function buildRebookingHTML({ clientName, treatment, sameTreatmentUrl, bookUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Nereida Martín Studio</h1>
      <p style="color:${E.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">¿Repetimos?</p>
    </div>
    <div style="background:${E.white};border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px ${E.shadow};">
      <p style="color:${E.text};font-size:16px;margin:0 0 16px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 20px;">
        Esperamos que hayas disfrutado tu <strong>${treatment.name}</strong>. ¿Te gustaría reservar el mismo tratamiento u otro?
      </p>
    </div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 12px;">
      <tr>
        <td align="center" bgcolor="${E.accent}" style="background:${E.accent};border-radius:14px;">
          <a href="${sameTreatmentUrl}" style="display:block;padding:18px 20px;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${E.white};text-decoration:none;text-align:center;">
            Reservar ${treatment.name}
          </a>
        </td>
      </tr>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
      <tr>
        <td align="center" bgcolor="${E.white}" style="background:${E.white};border:2px solid ${E.accent};border-radius:14px;">
          <a href="${bookUrl}" style="display:block;padding:18px 20px;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${E.accent};text-decoration:none;text-align:center;">
            Ver otros tratamientos
          </a>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Nereida Martín Studio · Nereida Martín</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendRebookingFollowup({
  to,
  clientName,
  treatment,
  sameTreatmentUrl,
  bookUrl,
}) {
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `¿Quieres volver a reservar? – ${treatment.name} | Nereida Martín Studio`,
    html: buildRebookingHTML({ clientName, treatment, sameTreatmentUrl, bookUrl }),
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

async function sendOwnerAlert({ subject, title, body, actions, attachments }) {
  const to = getOwnerEmail();
  if (!to) return;
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: ownerAlertHTML({ title, body, actions }),
    attachments: attachments || undefined,
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
    actions: payload.reviewUrl
      ? [{ label: 'Revisar en la agenda', url: payload.reviewUrl }]
      : undefined,
  });
}

async function sendOwnerHennaAssessment({ body, reviewUrl, photoPath, treatmentName }) {
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
      title: `Nueva solicitud para revisar – ${label}`,
      body,
      actions: reviewUrl
        ? [{ label: 'Revisar en la agenda', url: reviewUrl }]
        : [],
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

async function sendJointCompanionConfirmRequest({
  to,
  companionName,
  primaryName,
  primaryTreatment,
  companionTreatment,
  primaryStartTime,
  primaryEndTime,
  companionStartTime,
  companionEndTime,
  confirmUrl,
  expiresAt,
}) {
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Confirma tu cita conjunta de perfilado | Nereida Martín Studio`,
    html: `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:${E.bg};padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
        <p>Hola <strong>${companionName}</strong>,</p>
        <p><strong>${primaryName}</strong> ha reservado una cita conjunta de perfilado contigo.</p>
        <div style="background:${E.infoBg};border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>${primaryName}:</strong> ${primaryTreatment.name} · ${formatDate(primaryStartTime)} ${formatTime(primaryStartTime)}–${formatTime(primaryEndTime)}</p>
          <p style="margin:0;"><strong>Tu cita:</strong> ${companionTreatment.name} · ${formatTime(companionStartTime)}–${formatTime(companionEndTime)}</p>
        </div>
        <p>Confirma en las próximas <strong>24 horas</strong>.</p>
        ${emailButton({ href: confirmUrl, label: 'Confirmar mi cita' })}
        <p style="color:${E.muted};font-size:12px;">Plazo: ${formatDate(expiresAt)} ${formatTime(expiresAt)}</p>
      </div></body></html>`,
  });
}

async function sendJointPrimaryPending({
  to,
  clientName,
  companionName,
  primaryTreatment,
  primaryStartTime,
  primaryEndTime,
  companionStartTime,
  companionEndTime,
}) {
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Reserva pendiente – esperando confirmación | Nereida Martín Studio`,
    html: `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:${E.bg};padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
        <p>Hola <strong>${clientName}</strong>,</p>
        <p>Tu cita conjunta con <strong>${companionName}</strong> queda pendiente hasta que confirme en 24 h.</p>
        <div style="background:${E.infoBg};border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>Tu cita:</strong> ${primaryTreatment.name} · ${formatDate(primaryStartTime)} ${formatTime(primaryStartTime)}–${formatTime(primaryEndTime)}</p>
          <p style="margin:0;"><strong>${companionName}:</strong> ${formatTime(companionStartTime)}–${formatTime(companionEndTime)}</p>
        </div>
      </div></body></html>`,
  });
}

async function sendJointExpired({ to, clientName, companionName, startTime }) {
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Cita conjunta expirada | Nereida Martín Studio`,
    html: `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:${E.bg};padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
        <p>Hola <strong>${clientName}</strong>,</p>
        <p>La reserva conjunta con ${companionName || 'tu acompañante'} del ${formatDate(startTime)} a las ${formatTime(startTime)} ha expirado.</p>
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

async function sendPasswordReset({ to, name, resetUrl }) {
  const transport = getTransporter();
  await transport.sendMail({
    from: `"Nereida Martín Studio" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Restablecer contraseña | Nereida Martín Studio',
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Nereida Martín Studio</h1>
      <p style="color:${E.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Restablecer contraseña</p>
    </div>
    <div style="background:${E.white};border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px ${E.shadow};">
      <p style="color:${E.text};font-size:16px;margin:0 0 20px;">Hola <strong>${name}</strong>,</p>
      <p style="color:${E.text};font-size:14px;line-height:1.6;margin:0 0 24px;">
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. El enlace caduca en 1 hora.
      </p>
      ${emailButton({ href: resetUrl, label: 'Elegir nueva contraseña', variant: 'primary' })}
      <p style="color:${E.muted};font-size:12px;line-height:1.5;margin:16px 0 0;">
        Si no solicitaste este cambio, puedes ignorar este email. Tu contraseña seguirá siendo la misma.
      </p>
    </div>
    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Nereida Martín Studio</p>
    </div>
  </div>
</body>
</html>`,
  });
}

module.exports = {
  sendConfirmation,
  sendCancellationConfirmation,
  sendRescheduleNotice,
  sendGoogleChangeNotice,
  sendReminder,
  sendRebookingFollowup,
  sendOwnerFirstVisitAlert,
  sendOwnerTreatmentFirstAlert,
  sendOwnerFlaggedAlert,
  sendOwnerHennaAssessment,
  sendClientHennaPending,
  sendClientHennaApproved,
  sendClientHennaRejected,
  sendJointCompanionConfirmRequest,
  sendJointPrimaryPending,
  sendJointExpired,
  sendPasswordReset,
};
