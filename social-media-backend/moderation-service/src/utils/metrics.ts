import { register, Counter, Histogram, Gauge } from 'prom-client';

register.setDefaultLabels({ service: 'moderation-service' });

export const casesCreatedTotal = new Counter({
  name: 'moderation_cases_created_total',
  help: 'Total moderation cases created',
  labelNames: ['reason', 'entity_type'],
});

export const decisionsTotal = new Counter({
  name: 'moderation_decisions_total',
  help: 'Total moderation decisions made',
  labelNames: ['decision'],
});

export const mlAnalysisDuration = new Histogram({
  name: 'moderation_ml_analysis_duration_seconds',
  help: 'Duration of ML analysis calls',
  labelNames: ['provider', 'type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const pendingCasesGauge = new Gauge({
  name: 'moderation_pending_cases',
  help: 'Number of moderation cases currently pending',
});

export const appealsTotal = new Counter({
  name: 'moderation_appeals_total',
  help: 'Total appeals submitted',
});

export { register };
