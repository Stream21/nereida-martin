const FIRST_TREATMENT_QUESTIONS = [
  {
    id: 'first_time',
    type: 'yes_no',
    label: '¿Es tu primera vez realizando este tratamiento?',
    required: true,
  },
  {
    id: 'pregnancy',
    type: 'select',
    label: '¿Estás embarazada o en periodo de lactancia?',
    required: true,
    options: [
      { value: 'no', label: 'No' },
      { value: 'pregnant', label: 'Embarazada' },
      { value: 'breastfeeding', label: 'Lactancia' },
    ],
    flagValues: ['pregnant', 'breastfeeding'],
    flagReason: 'Embarazo o lactancia — revisar aptitud',
  },
  {
    id: 'medications',
    type: 'text',
    label: '¿Tomas alguna medicación que pueda afectar a la piel?',
    required: true,
    placeholder: 'Indica "Ninguna" si no aplica',
  },
  {
    id: 'allergies',
    type: 'text',
    label: '¿Tienes alguna alergia conocida?',
    required: true,
    placeholder: 'Indica "Ninguna" si no aplica',
  },
  {
    id: 'dye_henna_reaction',
    type: 'yes_no',
    label: '¿Has tenido alguna reacción previa a tintes o hennas?',
    required: true,
    flagWhenYes: 'Reacción previa a tintes o hennas',
  },
  {
    id: 'brow_skin_condition',
    type: 'text',
    label: '¿Tienes alguna enfermedad de la piel en la zona de las cejas?',
    required: true,
    placeholder: 'Indica "Ninguna" si no aplica',
    flagUnlessValues: ['ninguna', 'no', 'ninguno', 'n/a', 'na'],
    flagReason: 'Enfermedad de piel en zona de cejas',
  },
  {
    id: 'previous_micropigmentation',
    type: 'yes_no',
    label: '¿Llevas micropigmentación previa?',
    required: true,
    flagWhenYes: 'Micropigmentación previa — revisar',
  },
  {
    id: 'additional_notes',
    type: 'text',
    label: '¿Hay algo que deba saber antes de tu cita?',
    required: false,
    placeholder: 'Opcional',
  },
];

const STUDIO_QUESTIONS = [
  {
    id: 'purpose',
    type: 'select',
    label: '¿Cuál es el motivo principal de tu visita?',
    required: true,
    options: [
      { value: 'treatment', label: 'Recibir un tratamiento de belleza' },
      { value: 'consultation', label: 'Asesoramiento profesional' },
      { value: 'maintenance', label: 'Mantenimiento de un tratamiento previo' },
    ],
    flagValues: [],
  },
  {
    id: 'professional_intent',
    type: 'boolean',
    label: 'Confirmo que acudo al estudio para recibir un servicio profesional de belleza y estética.',
    required: true,
    flagWhenFalse: 'Intención no profesional declarada',
  },
  {
    id: 'allergies',
    type: 'text',
    label: '¿Tienes alergias conocidas a cosméticos, tintes o ácidos?',
    required: true,
    placeholder: 'Indica "Ninguna" si no aplica',
  },
  {
    id: 'medications',
    type: 'text',
    label: '¿Tomas medicación que pueda afectar a la piel o el vello?',
    required: true,
    placeholder: 'Indica "Ninguna" si no aplica',
  },
  {
    id: 'pregnancy',
    type: 'select',
    label: '¿Estás embarazada o en periodo de lactancia?',
    required: true,
    options: [
      { value: 'no', label: 'No' },
      { value: 'pregnant', label: 'Embarazada' },
      { value: 'breastfeeding', label: 'Lactancia' },
    ],
    flagValues: ['pregnant', 'breastfeeding'],
    flagReason: 'Embarazo o lactancia — revisar aptitud',
  },
  {
    id: 'skin_conditions',
    type: 'text',
    label: '¿Tienes alguna condición de piel activa (acné severo, rosácea, dermatitis, heridas)?',
    required: true,
    placeholder: 'Indica "Ninguna" si no aplica',
  },
  {
    id: 'expectations',
    type: 'text',
    label: '¿Qué resultado esperas de tu visita?',
    required: true,
  },
];

const INTAKE_LABELS = {
  first_time: 'Primera vez en este tratamiento',
  pregnancy: 'Embarazo / lactancia',
  medications: 'Medicación',
  allergies: 'Alergias',
  dye_henna_reaction: 'Reacción a tintes/hennas',
  brow_skin_condition: 'Enfermedad piel (cejas)',
  previous_micropigmentation: 'Micropigmentación previa',
  additional_notes: 'Notas adicionales',
  purpose: 'Motivo de visita',
  professional_intent: 'Intención profesional',
  skin_conditions: 'Condición de piel',
  expectations: 'Expectativas',
  brow_history: 'Historial cejas',
  brow_sensitivity: 'Sensibilidad piel',
  lash_extensions: 'Extensiones pestañas',
  eye_conditions: 'Condiciones oculares',
  facial_treatments: 'Tratamientos faciales recientes',
  retinoids: 'Retinoides',
  skin_sensitivity_dep: 'Sensibilidad depilación',
  dental_work: 'Trabajo dental',
  henna_previous: 'Henna previa',
  henna_irritation: 'Irritación henna',
};

const YES_NO_LABELS = { yes: 'Sí', no: 'No' };
const PREGNANCY_LABELS = { no: 'No', pregnant: 'Embarazada', breastfeeding: 'Lactancia' };
const PURPOSE_LABELS = {
  treatment: 'Recibir un tratamiento de belleza',
  consultation: 'Asesoramiento profesional',
  maintenance: 'Mantenimiento de un tratamiento previo',
};

function isYes(value) {
  return value === true || value === 'yes';
}

function isNo(value) {
  return value === false || value === 'no';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function evaluateIntakeFlags(questions, answers) {
  const flags = [];

  for (const q of questions) {
    const value = answers[q.id];
    if (value === undefined || value === null || value === '') continue;

    if (q.flagWhenTrue && isYes(value)) {
      flags.push(q.flagWhenTrue);
    }
    if (q.flagWhenYes && isYes(value)) {
      flags.push(q.flagWhenYes);
    }
    if (q.flagWhenFalse && isNo(value)) {
      flags.push(q.flagWhenFalse);
    }
    if (q.flagValues?.includes(value)) {
      flags.push(q.flagReason || `Respuesta marcada: ${q.id}`);
    }
    if (q.flagUnlessValues && q.type === 'text') {
      const normalized = normalizeText(value);
      if (normalized && !q.flagUnlessValues.includes(normalized)) {
        flags.push(q.flagReason || `Respuesta marcada: ${q.id}`);
      }
    }
    if (q.id === 'purpose' && value !== 'treatment' && value !== 'consultation' && value !== 'maintenance') {
      flags.push('Motivo de visita inusual');
    }
  }

  return flags;
}

function formatAnswerValue(key, value) {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (YES_NO_LABELS[value]) return YES_NO_LABELS[value];
  if (key === 'pregnancy' && PREGNANCY_LABELS[value]) return PREGNANCY_LABELS[value];
  if (key === 'purpose' && PURPOSE_LABELS[value]) return PURPOSE_LABELS[value];
  return String(value);
}

function parseIntakeAnswers(answers) {
  if (!answers) return null;
  if (typeof answers === 'string') {
    try {
      return JSON.parse(answers);
    } catch {
      return null;
    }
  }
  if (typeof answers === 'object') return answers;
  return null;
}

function formatIntakeSummary(answers) {
  const parsed = parseIntakeAnswers(answers);
  if (!parsed) return null;
  return Object.entries(parsed)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => {
      const label = INTAKE_LABELS[key] || key;
      return `${label}: ${formatAnswerValue(key, value)}`;
    })
    .join('\n');
}

function formatIntakeForOwner(answers) {
  const parsed = parseIntakeAnswers(answers);
  if (!parsed) return [];
  return Object.entries(parsed)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => ({
      id: key,
      label: INTAKE_LABELS[key] || key,
      displayValue: formatAnswerValue(key, value),
    }));
}

function getStudioQuestions() {
  return STUDIO_QUESTIONS;
}

function getTreatmentQuestions(_category, _treatmentId) {
  return [...FIRST_TREATMENT_QUESTIONS];
}

module.exports = {
  getStudioQuestions,
  getTreatmentQuestions,
  evaluateIntakeFlags,
  formatIntakeSummary,
  formatIntakeForOwner,
  INTAKE_LABELS,
  FIRST_TREATMENT_QUESTIONS,
};
