const { Router } = require('express');
const {
  getStudioQuestions,
  getTreatmentQuestions,
} = require('../config/intakeQuestions');

const router = Router();

router.get('/studio', (_req, res) => {
  res.json({ questions: getStudioQuestions() });
});

router.get('/treatment/:category', (req, res) => {
  const { treatmentId } = req.query;
  res.json({
    questions: getTreatmentQuestions(req.params.category, treatmentId || null),
  });
});

module.exports = router;
