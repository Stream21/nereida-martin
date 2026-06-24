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
    title: `${treatment.name} – Studio Anuelblingding`,
    startTime,
    endTime,
    description: `${treatment.name}: ${treatment.tag}`,
    location: 'Studio Anuelblingding',
  });

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
  const icsUrl = `${backendUrl}/api/bookings/${bookingId}/calendar`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${E.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Studio Anuelblingding</h1>
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

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${googleUrl}" target="_blank" style="display:inline-block;background:${E.accent};color:${E.white};text-decoration:none;padding:14px 32px;border-radius:12px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Agregar a Google Calendar
      </a>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${icsUrl}" style="color:${E.accent};font-size:13px;text-decoration:underline;">Descargar recordatorio (.ics)</a>
    </div>

    ${cancelUrl ? `
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${cancelUrl}" style="display:inline-block;border:1px solid ${E.accent};color:${E.accent};text-decoration:none;padding:12px 28px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Cancelar cita
      </a>
    </div>` : ''}

    <div style="background:${E.infoBg};border-radius:12px;padding:16px;border:1px solid ${E.accentBorder};">
      <p style="color:${E.text};font-size:13px;line-height:1.6;margin:0 0 8px;">
        ${POLICY_TEXT}
      </p>
      ${cancellationDeadline ? `<p style="color:${E.muted};font-size:12px;margin:0;">Para tu cita, el plazo límite es: <strong>${cancellationDeadline}</strong>.</p>` : ''}
    </div>

    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid ${E.border};">
      <p style="color:${E.muted};font-size:11px;margin:0;">Studio Anuelblingding · Nere Martín</p>
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
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Studio Anuelblingding</h1>
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
      <p style="color:${E.muted};font-size:11px;margin:0;">Studio Anuelblingding · Nere Martín</p>
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
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Studio Anuelblingding</h1>
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
      <p style="color:${E.muted};font-size:11px;margin:0;">Studio Anuelblingding · Nere Martín</p>
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
      <h1 style="color:${E.text};font-size:22px;font-weight:600;margin:0;">Studio Anuelblingding</h1>
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
      <p style="color:${E.muted};font-size:11px;margin:0;">Studio Anuelblingding · Nere Martín</p>
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
    from: `"Studio Anuelblingding" <${process.env.GMAIL_USER}>`,
    to,
    subject: `✨ Cita confirmada – ${treatment.name} | Studio Anuelblingding`,
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
    from: `"Studio Anuelblingding" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Cita cancelada – ${treatment.name} | Studio Anuelblingding`,
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
    from: `"Studio Anuelblingding" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${subjects[changeType] || subjects.updated} | Studio Anuelblingding`,
    html: buildGoogleChangeHTML({ clientName, treatment, startTime, endTime, changeType }),
  });
}

async function sendReminder({ to, clientName, treatment, startTime, endTime }) {
  const transport = getTransporter();

  await transport.sendMail({
    from: `"Studio Anuelblingding" <${process.env.GMAIL_USER}>`,
    to,
    subject: `⏰ Recordatorio: Tu cita es hoy – ${treatment.name} | Studio Anuelblingding`,
    html: buildReminderHTML({ clientName, treatment, startTime, endTime }),
  });
}

module.exports = {
  sendConfirmation,
  sendCancellationConfirmation,
  sendGoogleChangeNotice,
  sendReminder,
};
