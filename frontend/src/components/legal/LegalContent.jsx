const PHONE = '641 61 36 14'

export function PrivacyPolicyContent() {
  return (
    <>
      <p>
        En cumplimiento del Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica de
        Protección de Datos y Garantía de los Derechos Digitales (LOPDGDD), te informamos de lo siguiente:
      </p>
      <h4>Responsable del tratamiento</h4>
      <p>
        Nereida Martín Studio
        <br />
        Teléfono: +34 {PHONE}
        <br />
        Contacto: vía WhatsApp
      </p>
      <h4>Finalidad del tratamiento</h4>
      <p>
        Los datos personales se utilizan para gestionar citas, comunicación con clientes, cuestionarios
        de aptitud, valoración de tratamientos con imagen (cuando aplique) y envío de información
        relacionada con los servicios.
      </p>
      <h4>Datos de salud y fotografías</h4>
      <p>
        El cuestionario de aptitud puede incluir datos relativos a salud (alergias, medicación, embarazo).
        Las fotos de valoración (p. ej. Brow Henna) se tratan con consentimiento explícito y solo para
        evaluar la idoneidad del tratamiento.
      </p>
      <h4>Legitimación</h4>
      <p>
        El tratamiento se basa en el consentimiento del interesado (art. 6.1.a RGPD) y/o la ejecución de
        un contrato de prestación de servicios (art. 6.1.b RGPD).
      </p>
      <h4>Conservación de datos</h4>
      <p>
        Los datos de contacto se conservan mientras exista relación comercial. Los cuestionarios y fotos
        de valoración se conservan el tiempo necesario para la prestación del servicio y los plazos
        legalmente establecidos (fotos de valoración: hasta 12 meses salvo revocación previa).
      </p>
      <h4>Derechos del usuario</h4>
      <p>
        Puedes ejercer tus derechos de acceso, rectificación, supresión, portabilidad, limitación y
        oposición contactándonos por WhatsApp o teléfono.
      </p>
      <h4>Destinatarios</h4>
      <p>No se cederán datos a terceros salvo obligación legal o proveedores técnicos necesarios (email, calendario).</p>
    </>
  )
}

export function LegalNoticeContent() {
  return (
    <>
      <h4>Titular del sitio web</h4>
      <p>
        Nereida Martín
        <br />
        Servicios profesionales de belleza y estética.
      </p>
      <h4>Condiciones de uso</h4>
      <p>
        El uso de esta web implica la aceptación de las condiciones aquí descritas. La información publicada
        tiene carácter orientativo. Nos reservamos el derecho de modificar contenidos y disponibilidad del
        servicio de reserva online.
      </p>
      <h4>Propiedad intelectual</h4>
      <p>
        Los textos, imágenes y diseño de este sitio están protegidos. Queda prohibida su reproducción sin
        autorización expresa.
      </p>
      <h4>Contacto</h4>
      <p>+34 {PHONE} · WhatsApp</p>
    </>
  )
}

export function BookingTermsContent() {
  return (
    <>
      <h4>Reservas online</h4>
      <p>
        Al confirmar una reserva aceptas proporcionar datos veraces y cumplir con la política de
        cancelación del estudio.
      </p>
      <h4>Cancelación</h4>
      <p>
        Puedes cancelar hasta el día anterior a tu cita, a la misma hora. Ejemplo: cita el miércoles a las
        10:00 → cancelación hasta el martes a las 10:00.
      </p>
      <h4>Citas pendientes de valoración</h4>
      <p>
        Algunos tratamientos (como Brow Henna) requieren valoración previa con fotografía. La cita queda
        tentativa hasta que el estudio confirme tu aptitud. Si no eres apta, la cita se cancelará y se te
        notificará por email.
      </p>
      <h4>Cuestionario de aptitud</h4>
      <p>
        Es responsabilidad del cliente responder con veracidad al cuestionario de salud y aptitud. Una
        información incorrecta puede afectar al resultado del tratamiento o motivar la cancelación de la cita.
      </p>
      <h4>Puntualidad</h4>
      <p>
        Te pedimos llegar puntual. Retrasos significativos pueden reducir el tiempo del tratamiento o
        requerir reprogramación.
      </p>
    </>
  )
}

export function HealthConsentContent() {
  return (
    <>
      <h4>Finalidad</h4>
      <p>
        Autorizo el tratamiento de los datos de salud y aptitud que proporcione en el cuestionario de reserva
        con la finalidad exclusiva de evaluar si soy candidata/o adecuada/o para los servicios del estudio y
        garantizar mi seguridad durante el tratamiento.
      </p>
      <h4>Conservación</h4>
      <p>
        Estos datos se conservarán vinculados a mi historial de reservas durante el tiempo necesario para la
        prestación del servicio y los plazos legales aplicables.
      </p>
      <h4>Revocación</h4>
      <p>
        Puedo revocar este consentimiento en cualquier momento contactando con el estudio, sin perjuicio de
        la licitud del tratamiento basado en el consentimiento previo a su retirada.
      </p>
    </>
  )
}

export function PhotoConsentContent() {
  return (
    <>
      <h4>Finalidad</h4>
      <p>
        Autorizo la cesión de la fotografía de mis cejas con la finalidad exclusiva de valoración profesional
        para determinar si soy apta para el tratamiento Brow Henna.
      </p>
      <h4>Plazo de conservación</h4>
      <p>
        La imagen se conservará un máximo de 12 meses o hasta que se complete la valoración y el tratamiento,
        lo que ocurra antes, salvo que solicite su supresión.
      </p>
      <h4>Destinatarios</h4>
      <p>
        Solo el personal del estudio tendrá acceso a la imagen. No se publicará ni cederá a terceros con fines
        comerciales o de marketing sin consentimiento adicional.
      </p>
      <h4>Derechos</h4>
      <p>Puedo solicitar el acceso o la eliminación de la imagen contactando con el estudio.</p>
    </>
  )
}

export function CookiePolicyContent() {
  return (
    <>
      <h4>¿Qué son las cookies?</h4>
      <p>
        Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo al visitar un sitio web.
      </p>
      <h4>Cookies que utilizamos</h4>
      <p>
        <strong>Cookies técnicas (necesarias):</strong> Permiten la navegación y el uso de funciones básicas.
        Incluye el almacenamiento local de tus datos de reserva para facilitar futuras citas.
      </p>
      <p>
        <strong>Cookies analíticas:</strong> Solo se activan con tu consentimiento.
      </p>
      <h4>Más información</h4>
      <p>Para consultas: WhatsApp +34 {PHONE}.</p>
    </>
  )
}
