import express from 'express';
import ExerciseAttempt from '../models/ExerciseAttempt.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const TIMEZONE = process.env.TIMEZONE || 'America/Mexico_City';

const requireAuth = async (req, res, next) => {
  // 1) Sesión (Passport)
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
    return next();
  }

  // 2) Bearer token (fallback)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_jwt_secret');
      const userId = decoded?.id || decoded?._id;
      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      const user = await User.findById(userId);
      if (!user) return res.status(401).json({ message: 'No autenticado' });

      req.user = user;
      return next();
    } catch {
      return res.status(401).json({ message: 'No autenticado' });
    }
  }

  return res.status(401).json({ message: 'No autenticado' });
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const dayKeyInTimeZone = (date) => {
  // yyyy-mm-dd en la zona horaria configurada
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(date));
};

const buildDayKeysInTimeZone = (days) => {
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    result.push(dayKeyInTimeZone(d));
  }
  return result;
};

const formatDayLabelEs = (dayKey) => {
  // dayKey: yyyy-mm-dd (en TIMEZONE)
  const [y, m, d] = dayKey.split('-').map(Number);
  // Usar mediodía UTC para evitar bordes de DST
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('es-MX', { timeZone: TIMEZONE }).format(date);
};

router.post('/attempts', requireAuth, async (req, res) => {
  try {
    const { category, exerciseType, exerciseId, score, maxScore, completed, durationMs } = req.body || {};

    if (!category || !exerciseType) {
      return res.status(400).json({ message: 'category y exerciseType son requeridos' });
    }

    const parsedScore = Number(score);
    const parsedMax = Number(maxScore);

    if (!Number.isFinite(parsedScore) || !Number.isFinite(parsedMax)) {
      return res.status(400).json({ message: 'score y maxScore deben ser números' });
    }

    if (parsedMax < 1) {
      return res.status(400).json({ message: 'maxScore debe ser >= 1' });
    }

    const normalizedScore = clampNumber(parsedScore, 0, parsedMax);

    const attempt = await ExerciseAttempt.create({
      userId: req.user._id,
      category,
      exerciseType,
      exerciseId: exerciseId ?? null,
      score: normalizedScore,
      maxScore: parsedMax,
      completed: Boolean(completed),
      durationMs: Number.isFinite(Number(durationMs)) ? Math.max(0, Number(durationMs)) : 0,
    });

    return res.status(201).json({ message: 'Progreso guardado', attemptId: attempt._id });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar progreso', error: err.message });
  }
});

router.get('/timeseries', requireAuth, async (req, res) => {
  try {
    const category = String(req.query.category || 'reading');
    const days = clampNumber(Number(req.query.days || 7), 1, 180);

    const allowed = new Set(['reading', 'writing', 'comprehension']);
    if (!allowed.has(category)) {
      return res.status(400).json({ message: 'category inválida' });
    }

    const start = new Date(Date.now() - (days - 1) * 86400000);

    const agg = await ExerciseAttempt.aggregate([
      {
        $match: {
          userId: req.user._id,
          category,
          completed: true,
          createdAt: { $gte: start },
        },
      },
      {
        $addFields: {
          dayKey: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIMEZONE },
          },
          percent: {
            $multiply: [
              { $divide: ['$score', '$maxScore'] },
              100,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$dayKey',
          score: { $avg: '$percent' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const map = new Map(agg.map((r) => [r._id, Math.round(r.score)]));
    const dayKeys = buildDayKeysInTimeZone(days);

    const data = dayKeys.map((dayKey) => ({
      date: formatDayLabelEs(dayKey),
      score: map.get(dayKey) ?? 0,
    }));

    return res.json({ category, days, data });
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener serie temporal', error: err.message });
  }
});

const avgPercentInRange = async (userId, category, start, end) => {
  const match = {
    userId,
    completed: true,
    createdAt: { $gte: start, $lt: end },
  };
  if (category) match.category = category;

  const result = await ExerciseAttempt.aggregate([
    { $match: match },
    {
      $addFields: {
        percent: {
          $multiply: [{ $divide: ['$score', '$maxScore'] }, 100],
        },
      },
    },
    { $group: { _id: null, avg: { $avg: '$percent' } } },
  ]);

  return result[0]?.avg ?? null;
};

const computeStreakDays = (dayKeysDesc) => {
  if (!dayKeysDesc.length) return 0;

  const todayKey = dayKeyInTimeZone(new Date());
  let currentKey = todayKey;
  let streak = 0;

  const set = new Set(dayKeysDesc);

  while (set.has(currentKey)) {
    streak += 1;
    const [y, m, d] = currentKey.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    prev.setUTCDate(prev.getUTCDate() - 1);
    currentKey = dayKeyInTimeZone(prev);
  }

  return streak;
};

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    const completedExercises = await ExerciseAttempt.countDocuments({
      userId,
      completed: true,
    });

    // Días únicos con al menos 1 ejercicio completado
    const activeDays = await ExerciseAttempt.aggregate([
      { $match: { userId, completed: true } },
      {
        $addFields: {
          dayKey: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIMEZONE },
          },
        },
      },
      { $group: { _id: '$dayKey' } },
      { $sort: { _id: -1 } },
      { $limit: 365 },
    ]);

    const dayKeysDesc = activeDays.map((d) => d._id);
    const streakDays = computeStreakDays(dayKeysDesc);

    // Mejoría: últimos 7 días vs 7 días anteriores (promedio %)
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const last7Start = new Date(end);
    last7Start.setUTCDate(last7Start.getUTCDate() - 7);

    const prev7Start = new Date(last7Start);
    prev7Start.setUTCDate(prev7Start.getUTCDate() - 7);

    const categories = ['reading', 'writing', 'comprehension'];

    const perCategory = {};
    for (const c of categories) {
      const last = await avgPercentInRange(userId, c, last7Start, end);
      const prev = await avgPercentInRange(userId, c, prev7Start, last7Start);
      const delta = last !== null && prev !== null ? Math.round(last - prev) : 0;
      perCategory[c] = {
        last7Avg: last !== null ? Math.round(last) : 0,
        prev7Avg: prev !== null ? Math.round(prev) : 0,
        delta,
      };
    }

    const lastAll = await avgPercentInRange(userId, null, last7Start, end);
    const prevAll = await avgPercentInRange(userId, null, prev7Start, last7Start);

    const overallImprovement = lastAll !== null && prevAll !== null ? Math.round(lastAll - prevAll) : 0;

    let bestCategory = null;
    for (const c of categories) {
      if (!bestCategory || perCategory[c].delta > perCategory[bestCategory].delta) {
        bestCategory = c;
      }
    }

    return res.json({
      completedExercises,
      streakDays,
      overallImprovement,
      bestCategory,
      perCategory,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener resumen', error: err.message });
  }
});

export default router;
