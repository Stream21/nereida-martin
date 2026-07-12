const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const validateBooking = require('../middleware/validateBooking');
const { blockDurationMinutes } = require('../utils/slotGrid');
const availabilityService = require('../services/availabilityService');
const { formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');
const { canCancel, formatDeadlineSpanish, POLICY_TEXT } = require('../utils/cancellationPolicy');
const {
  buildBookingSummary,
  buildBookingDescription,
  getEventColorId,
  formatIntakeSummary,
} = require('../utils/webCalendarEvent');
const {
  isFirstStudioVisit,
  hasTreatmentBefore,
  resolveVisitContext,
} = require('../services/clientService');
const {
  evaluateIntakeFlags,
  getStudioQuestions,
  getTreatmentQuestions,
} = require('../config/intakeQuestions');
const { createOwnerActionToken, buildOwnerActionUrl } = require('../utils/ownerTokens');

const router = Router();

async function fetchBookingByToken(token) {
  const result = await query(
    `SELECT b.id, b.start_time, b.end_time, b.status, b.source, b.cancel_token,
            b.google_event_id, t.name AS treatment_name, t.tag AS treatment_tag,
            c.name AS client_name, c.email AS client_email
     FROM bookings b
     JOIN clients c ON b.client_id = c.id
     LEFT JOIN treatments t ON b.treatment_id = t.id
     WHERE b.cancel_token = $1`,
    [token]
  );
  return result.rows[0] || null;
}

function formatBookingResponse(row) {
  const startTime = new Date(row.start_time);
  const endTime = new Date(row.end_time);
  const cancellable = row.status === 'confirmed' && canCancel(startTime);

  return {
    booking: {
      id: row.id,
      treatmentName: row.treatment_name || 'Cita',
      treatmentTag: row.treatment_tag || '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: row.status,
    },
    client: { name: row.client_name, email: row.client_email },
    cancellation: {
      policy: POLICY_TEXT,
      deadline: formatDeadlineSpanish(startTime),
      canCancel: cancellable,
    },
  };
}

router.get('/cancel/:token', async (req, res) => {
  try {
    const row = await fetchBookingByToken(req.params.token);

    if (!row) {
      return res.status(404).json({ error: 'Reserva no encontrada', code: 'INVALID_TOKEN' });
    }

    if (row.status === 'cancelled') {
      return res.status(410).json({
        error: 'Esta reserva ya ha sido cancelada',
        code: 'ALREADY_CANCELLED',
        ...formatBookingResponse(row),
      });
    }

    res.json(formatBookingResponse(row));
  } catch (err) {
    console.error('Error fetching cancel info:', err);
    res.status(500).json({ error: 'Error al obtener la reserva' });
  }
});

router.post('/cancel/:token', async (req, res) => {
  const client = await getClient();

  try {
    const row = await fetchBookingByToken(req.params.token);

    if (!row) {
      return res.status(404).json({ error: 'Reserva no encontrada', code: 'INVALID_TOKEN' });
    }

    if (row.status === 'cancelled') {
      return res.status(410).json({
        error: 'Esta reserva ya ha sido cancelada',
        code: 'ALREADY_CANCELLED',
      });
    }

    const startTime = new Date(row.start_time);

    if (!canCancel(startTime)) {
      return res.status(403).json({
        error: 'Plazo de cancelación expirado',
        code: 'DEADLINE_PASSED',
        message: `Solo puedes cancelar hasta el ${formatDeadlineSpanish(startTime)}. Si necesitas ayuda, contáctanos por WhatsApp.`,
        cancellation: {
          policy: POLICY_TEXT,
          deadline: formatDeadlineSpanish(startTime),
          canCancel: false,
        },
      });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE bookings SET status = 'cancelled', last_sync_source = 'web', updated_at = NOW()
       WHERE id = $1 AND status = 'confirmed'`,
      [row.id]
    );

    await client.query('COMMIT');

    if (row.google_event_id) {
      try {
        const googleCalendar = require('../services/googleCalendar');
        await googleCalendar.deleteEvent(row.google_event_id);
        await query('UPDATE bookings SET sync_pending = false WHERE id = $1', [row.id]);
      } catch (err) {
        console.error('Google Calendar delete failed:', err.message);
        await query('UPDATE bookings SET sync_pending = true WHERE id = $1', [row.id]);
      }
    }

    try {
      const emailService = require('../services/emailService');
      await emailService.sendCancellationConfirmation({
        to: row.client_email,
        clientName: row.client_name,
        treatment: { name: row.treatment_name || 'Cita', tag: row.treatment_tag || '' },
        startTime,
        endTime: new Date(row.end_time),
      });
    } catch (err) {
      console.error('Cancellation email failed:', err.message);
    }

    res.json({
      success: true,
      message: 'Tu cita ha sido cancelada correctamente',
      booking: {
        id: row.id,
        status: 'cancelled',
        startTime: startTime.toISOString(),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cancelling booking:', err);
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res) => {
  const { startTime, treatmentId } = req.body;

  if (!startTime) {
    return res.status(400).json({ error: 'startTime es obligatorio' });
  }

  try {
    const bookingResult = await query(
      `SELECT b.*, c.name AS client_name, c.email AS client_email,
              t.name AS treatment_name, t.tag AS treatment_tag, t.duration_min, t.duration_max
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       LEFT JOIN treatments t ON b.treatment_id = t.id
       WHERE b.id = $1 AND b.status = 'confirmed'`,
      [req.params.id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const booking = bookingResult.rows[0];
    const start = new Date(startTime);

    if (!canCancel(new Date(booking.start_time))) {
      return res.status(403).json({
        error: 'Plazo de modificación expirado',
        message: `Solo puedes modificar hasta el ${formatDeadlineSpanish(new Date(booking.start_time))}.`,
      });
    }

    const blockDuration = blockDurationMinutes(
      booking.duration_max || booking.duration_min || 60
    );
    const end = new Date(start.getTime() + blockDuration * 60000);

    const dateStr = formatStudioDate(start);
    const timeStr = formatStudioTime(start);
    const slotAvailable = await availabilityService.hasSlotAvailable(
      dateStr,
      timeStr,
      blockDuration,
      booking.id
    );

    if (!slotAvailable) {
      return res.status(409).json({ error: 'Horario no disponible' });
    }

    const newTreatmentId = treatmentId || booking.treatment_id;

    await query(
      `UPDATE bookings SET start_time = $1, end_time = $2, treatment_id = $3,
       last_sync_source = 'web', updated_at = NOW()
       WHERE id = $4`,
      [start.toISOString(), end.toISOString(), newTreatmentId, booking.id]
    );

    if (booking.google_event_id) {
      try {
        const googleCalendar = require('../services/googleCalendar');
        const event = await googleCalendar.updateEvent(booking.google_event_id, {
          summary: buildBookingSummary({
            treatmentName: booking.treatment_name || 'Cita',
            clientName: booking.client_name,
          }),
          description: buildBookingDescription({
            treatmentName: booking.treatment_name || 'Cita',
            treatmentTag: booking.treatment_tag || '',
            clientName: booking.client_name,
            clientEmail: booking.client_email,
            bookingId: booking.id,
          }),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          clientEmail: booking.client_email,
          isWebBooking: true,
          bookingId: booking.id,
        });

        await query(
          `UPDATE bookings SET google_etag = $1, google_updated_at = $2 WHERE id = $3`,
          [event.etag || null, event.updated ? new Date(event.updated).toISOString() : null, booking.id]
        );
      } catch (err) {
        console.error('Google Calendar update failed:', err.message);
      }
    }

    res.json({
      booking: {
        id: booking.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'confirmed',
      },
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ error: 'Error al actualizar la reserva' });
  }
});

router.post('/', validateBooking, async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const {
      treatmentId,
      startTime,
      clientName,
      clientEmail,
      clientPhone,
      declaredProfile,
      consents,
      intakeAnswers,
      intakeType,
      intakeSignature,
      hennaAssessmentId,
    } = req.body;

    const requiredConsents = ['privacy', 'booking_terms'];
    let consentList = Array.isArray(consents) ? [...consents] : [];

    const cancelToken = uuidv4();

    const treatmentResult = await client.query(
      'SELECT id, name, tag, category, duration_min, duration_max FROM treatments WHERE id = $1 AND active = true',
      [treatmentId]
    );

    if (treatmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    const treatment = treatmentResult.rows[0];
    const isHenna = treatmentId === 'brow-henna';
    const blockDuration = blockDurationMinutes(treatment.duration_max || treatment.duration_min);

    const start = new Date(startTime);
    const end = new Date(start.getTime() + blockDuration * 60000);

    const dateStr = formatStudioDate(start);
    const timeStr = formatStudioTime(start);
    const slotAvailable = await availabilityService.hasSlotAvailable(dateStr, timeStr, blockDuration);

    if (!slotAvailable) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Horario no disponible',
        message: 'Este horario ya ha sido reservado. Por favor selecciona otro.',
      });
    }

    const clientResult = await client.query(
      `INSERT INTO clients (name, email, phone, declared_profile)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         name = $1,
         phone = COALESCE($3, clients.phone),
         declared_profile = COALESCE($4, clients.declared_profile)
       RETURNING id`,
      [
        clientName.trim(),
        clientEmail.trim().toLowerCase(),
        clientPhone.trim(),
        declaredProfile || null,
      ]
    );
    const clientId = clientResult.rows[0].id;

    const existingConsents = await client.query(
      'SELECT consent_type FROM client_consents WHERE client_id = $1',
      [clientId]
    );
    const mergedConsents = [
      ...new Set([
        ...consentList,
        ...existingConsents.rows.map((r) => r.consent_type),
      ]),
    ];

    for (const c of requiredConsents) {
      if (!mergedConsents.includes(c)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debes aceptar la política de privacidad y las condiciones de reserva' });
      }
    }
    consentList = mergedConsents;

    for (const consentType of consentList) {
      await client.query(
        `INSERT INTO client_consents (client_id, consent_type)
         VALUES ($1, $2)
         ON CONFLICT (client_id, consent_type) DO UPDATE SET accepted_at = NOW()`,
        [clientId, consentType]
      );
    }

    const firstStudio = await isFirstStudioVisit(clientId);
    const firstTreatment = !(await hasTreatmentBefore(clientId, treatmentId));
    const visitContext = resolveVisitContext({ isFirstStudio: firstStudio, isFirstTreatment: firstTreatment });

    let intakeId = null;
    let flagged = false;
    let flagReason = null;
    let intakeSummary = null;
    let signatureSignerName = null;

    if (intakeAnswers && intakeType) {
      const questions =
        intakeType === 'studio'
          ? getStudioQuestions()
          : getTreatmentQuestions(treatment.category, treatmentId);

      if (!intakeSignature?.dataUrl || typeof intakeSignature.dataUrl !== 'string') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Debes firmar el cuestionario de aptitud',
          code: 'SIGNATURE_REQUIRED',
        });
      }

      if (!intakeSignature.dataUrl.startsWith('data:image/png;base64,')) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Formato de firma no válido',
          code: 'INVALID_SIGNATURE',
        });
      }

      const signerName = (intakeSignature.signerName || clientName || '').trim();
      if (signerName.length < 2) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Nombre del firmante requerido',
          code: 'SIGNER_NAME_REQUIRED',
        });
      }

      const flags = evaluateIntakeFlags(questions, intakeAnswers);
      flagged = flags.length > 0;
      flagReason = flags.join('; ');
      intakeSummary = formatIntakeSummary(intakeAnswers);

      if (!consentList.includes('treatment_consent_signed')) {
        consentList.push('treatment_consent_signed');
      }
      if (!consentList.includes('health_data')) {
        consentList.push('health_data');
      }

      signatureSignerName = signerName;

      const intakeResult = await client.query(
        `INSERT INTO booking_intakes (
           client_id, treatment_id, intake_type, answers, flagged, flag_reason,
           signature_data, signer_name, signed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id`,
        [
          clientId,
          treatmentId,
          intakeType,
          JSON.stringify(intakeAnswers),
          flagged,
          flagReason,
          intakeSignature.dataUrl,
          signerName,
        ]
      );
      intakeId = intakeResult.rows[0].id;

      for (const extraConsent of ['treatment_consent_signed', 'health_data']) {
        await client.query(
          `INSERT INTO client_consents (client_id, consent_type)
           VALUES ($1, $2)
           ON CONFLICT (client_id, consent_type) DO UPDATE SET accepted_at = NOW()`,
          [clientId, extraConsent]
        );
      }
    }

    const bookingStatus = isHenna ? 'pending_review' : 'confirmed';
    const reviewType = isHenna ? 'henna_photo' : null;

    const bookingResult = await client.query(
      `INSERT INTO bookings (client_id, treatment_id, start_time, end_time, status, source, cancel_token, visit_context, review_type, intake_id)
       VALUES ($1, $2, $3, $4, $5, 'web', $6, $7, $8, $9)
       RETURNING id, start_time, end_time, status, cancel_token, created_at`,
      [
        clientId,
        treatmentId,
        start.toISOString(),
        end.toISOString(),
        bookingStatus,
        cancelToken,
        visitContext,
        reviewType,
        intakeId,
      ]
    );
    const booking = bookingResult.rows[0];

    if (isHenna && hennaAssessmentId) {
      await client.query(
        `UPDATE henna_assessments SET booking_id = $1 WHERE id = $2 AND client_id = $3`,
        [booking.id, hennaAssessmentId, clientId]
      );
    }

    await client.query(
      `UPDATE clients SET
         first_booking_at = COALESCE(first_booking_at, NOW()),
         last_booking_at = NOW()
       WHERE id = $1`,
      [clientId]
    );

    await client.query('COMMIT');

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    let hennaPhotoUrl = null;
    if (isHenna && hennaAssessmentId) {
      const photoRes = await query('SELECT photo_path FROM henna_assessments WHERE id = $1', [hennaAssessmentId]);
      if (photoRes.rows[0]) {
        hennaPhotoUrl = `${backendUrl}/uploads/${photoRes.rows[0].photo_path}`;
      }
    }

    const pendingReview = bookingStatus === 'pending_review';
    const summary = buildBookingSummary({
      treatmentName: treatment.name,
      clientName,
      visitContext,
      reviewType,
      pendingReview,
    });
    const description = buildBookingDescription({
      treatmentName: treatment.name,
      treatmentTag: treatment.tag,
      clientName,
      clientEmail,
      clientPhone,
      bookingId: booking.id,
      visitContext,
      reviewType,
      pendingReview,
      intakeSummary,
      signatureSignerName,
      flagged,
      flagReason,
      hennaPhotoUrl,
    });
    const colorId = getEventColorId({ visitContext, reviewType, pendingReview, flagged });

    let googleEventId = null;
    try {
      const googleCalendar = require('../services/googleCalendar');
      const event = await googleCalendar.createEvent({
        summary,
        description,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        clientEmail,
        isWebBooking: true,
        bookingId: booking.id,
        colorId,
      });

      googleEventId = event.id;

      if (googleEventId) {
        await query(
          `UPDATE bookings SET google_event_id = $1, google_etag = $2, google_updated_at = $3,
           last_sync_source = 'web', updated_at = NOW()
           WHERE id = $4`,
          [
            googleEventId,
            event.etag || null,
            event.updated ? new Date(event.updated).toISOString() : null,
            booking.id,
          ]
        );
      }
    } catch (err) {
      console.error('Google Calendar event creation failed (non-blocking):', err.message);
    }

    const frontendUrl = process.env.FRONTEND_URL || '';
    const cancelUrl = `${frontendUrl}/cancelar/${cancelToken}`;

    let emailSent = false;
    try {
      const emailService = require('../services/emailService');

      const ownerBody = [
        `Cliente: ${clientName}`,
        `Email: ${clientEmail}`,
        `Tel: ${clientPhone || 'N/A'}`,
        `Tratamiento: ${treatment.name} (${treatment.tag})`,
        `Fecha: ${formatStudioDate(start)} ${formatStudioTime(start)}`,
        `Perfil declarado: ${declaredProfile || 'N/A'}`,
        `Contexto: ${visitContext}`,
        intakeSummary ? `\nCuestionario:\n${intakeSummary}` : '',
        signatureSignerName ? `\nFirmado por: ${signatureSignerName}` : '',
      ].join('\n');

      if (visitContext === 'first_studio_visit') {
        await emailService.sendOwnerFirstVisitAlert({ clientName, body: ownerBody });
      }
      if (visitContext === 'first_treatment') {
        await emailService.sendOwnerTreatmentFirstAlert({ clientName, body: ownerBody });
      }
      if (flagged) {
        await emailService.sendOwnerFlaggedAlert({
          clientName,
          body: `${ownerBody}\n\n⚠️ Motivo: ${flagReason}`,
        });
      }

      if (isHenna && hennaAssessmentId) {
        const approveToken = await createOwnerActionToken({
          action: 'henna_approve',
          entityType: 'henna_assessment',
          entityId: hennaAssessmentId,
        });
        const rejectToken = await createOwnerActionToken({
          action: 'henna_reject',
          entityType: 'henna_assessment',
          entityId: hennaAssessmentId,
        });
        const photoRes = await query('SELECT photo_path FROM henna_assessments WHERE id = $1', [hennaAssessmentId]);
        await emailService.sendOwnerHennaAssessment({
          body: ownerBody,
          approveUrl: buildOwnerActionUrl(approveToken, 'approve'),
          rejectUrl: buildOwnerActionUrl(rejectToken, 'reject'),
          photoPath: photoRes.rows[0]?.photo_path,
        });
        await emailService.sendClientHennaPending({
          to: clientEmail,
          clientName,
          treatment,
          startTime: start,
          endTime: end,
        });
        emailSent = true;
      } else {
        await emailService.sendConfirmation({
          to: clientEmail,
          clientName,
          treatment,
          startTime: start,
          endTime: end,
          bookingId: booking.id,
          cancelUrl,
          cancellationDeadline: formatDeadlineSpanish(start),
        });
        emailSent = true;
        await query('UPDATE bookings SET confirmation_sent = true WHERE id = $1', [booking.id]);
      }
    } catch (err) {
      console.error('Email failed (non-blocking):', err.message);
    }

    const calendarFile = require('../services/calendarFile');
    const googleCalendarUrl = calendarFile.generateGoogleCalendarUrl({
      title: `${treatment.name} – Studio Anuelblingding`,
      startTime: start,
      endTime: end,
      description: `${treatment.name}: ${treatment.tag}`,
      location: 'Studio Anuelblingding',
    });

    res.status(201).json({
      booking: {
        id: booking.id,
        treatmentName: treatment.name,
        treatmentTag: treatment.tag,
        treatmentId: treatment.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: booking.status,
        visitContext,
        pendingReview: isHenna,
      },
      client: { name: clientName, email: clientEmail },
      cancelUrl,
      cancellationDeadline: formatDeadlineSpanish(start),
      icsUrl: `${frontendUrl}/api/bookings/${booking.id}/calendar`,
      googleCalendarUrl,
      emailSent,
    });
  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23P01') {
      return res.status(409).json({
        error: 'Horario no disponible',
        message: 'Este horario acaba de ser reservado por otra persona.',
      });
    }

    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  } finally {
    client.release();
  }
});

router.get('/:id/calendar', async (req, res) => {
  try {
    const result = await query(
      `SELECT b.start_time, b.end_time, t.name, t.tag, c.name AS client_name
       FROM bookings b
       LEFT JOIN treatments t ON b.treatment_id = t.id
       JOIN clients c ON b.client_id = c.id
       WHERE b.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const row = result.rows[0];
    const calendarFile = require('../services/calendarFile');
    const icsContent = calendarFile.generateICS({
      title: `${row.name || 'Cita'} – Studio Anuelblingding`,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      description: `${row.name}: ${row.tag}`,
      location: 'Studio Anuelblingding',
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cita-${req.params.id}.ics"`);
    res.send(icsContent);
  } catch (err) {
    console.error('Error generating calendar file:', err);
    res.status(500).json({ error: 'Error al generar archivo de calendario' });
  }
});

module.exports = router;
