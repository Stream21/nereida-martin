const nodemailer = require('nodemailer');

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

function buildConfirmationHTML({ clientName, treatment, startTime, endTime, bookingId }) {
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
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#433D3C;font-size:22px;font-weight:600;margin:0;">Studio Anuelblingding</h1>
      <p style="color:#FF8A8A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Tu cita ha sido confirmada</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px rgba(67,61,60,0.06);">
      <p style="color:#433D3C;font-size:16px;margin:0 0 20px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:#433D3C;font-size:14px;line-height:1.6;margin:0 0 24px;">Tu reserva ha sido confirmada. Aquí tienes los detalles:</p>

      <div style="background:#FAF7F2;border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="color:#FF8A8A;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Tratamiento</p>
        <p style="color:#433D3C;font-size:16px;font-weight:600;margin:0;">${treatment.name}</p>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">${treatment.tag}</p>
      </div>

      <div style="background:#FAF7F2;border-radius:12px;padding:20px;">
        <p style="color:#FF8A8A;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Fecha y hora</p>
        <p style="color:#433D3C;font-size:16px;font-weight:600;margin:0;text-transform:capitalize;">${formatDate(startTime)}</p>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">${formatTime(startTime)} – ${formatTime(endTime)}</p>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${googleUrl}" target="_blank" style="display:inline-block;background:#FF8A8A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Agregar a Google Calendar
      </a>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${icsUrl}" style="color:#FF8A8A;font-size:13px;text-decoration:underline;">Descargar recordatorio (.ics)</a>
    </div>

    <div style="background:#FFF5F5;border-radius:12px;padding:16px;border:1px solid rgba(255,138,138,0.15);">
      <p style="color:#433D3C;font-size:13px;line-height:1.6;margin:0;">
        Puedes cancelar o reprogramar sin cargo hasta <strong>24 horas antes</strong> de tu cita.
      </p>
    </div>

    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid rgba(67,61,60,0.08);">
      <p style="color:#999;font-size:11px;margin:0;">Studio Anuelblingding · Nere Martín</p>
    </div>
  </div>
</body>
</html>`;
}

function buildReminderHTML({ clientName, treatment, startTime, endTime }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#433D3C;font-size:22px;font-weight:600;margin:0;">Studio Anuelblingding</h1>
      <p style="color:#FF8A8A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Recordatorio de cita</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px rgba(67,61,60,0.06);">
      <p style="color:#433D3C;font-size:16px;margin:0 0 20px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:#433D3C;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Te recordamos que tu cita es <strong>hoy en unas horas</strong>. ¡Te esperamos!
      </p>

      <div style="background:#FAF7F2;border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="color:#FF8A8A;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Tratamiento</p>
        <p style="color:#433D3C;font-size:16px;font-weight:600;margin:0;">${treatment.name}</p>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">${treatment.tag}</p>
      </div>

      <div style="background:#FAF7F2;border-radius:12px;padding:20px;">
        <p style="color:#FF8A8A;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Fecha y hora</p>
        <p style="color:#433D3C;font-size:16px;font-weight:600;margin:0;text-transform:capitalize;">${formatDate(startTime)}</p>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">${formatTime(startTime)} – ${formatTime(endTime)}</p>
      </div>
    </div>

    <div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid rgba(67,61,60,0.08);">
      <p style="color:#999;font-size:11px;margin:0;">Studio Anuelblingding · Nere Martín</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendConfirmation({ to, clientName, treatment, startTime, endTime, bookingId }) {
  const transport = getTransporter();

  await transport.sendMail({
    from: `"Studio Anuelblingding" <${process.env.GMAIL_USER}>`,
    to,
    subject: `✨ Cita confirmada – ${treatment.name} | Studio Anuelblingding`,
    html: buildConfirmationHTML({ clientName, treatment, startTime, endTime, bookingId }),
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

module.exports = { sendConfirmation, sendReminder };
