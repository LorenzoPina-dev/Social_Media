export const metrics = {
  incrementCounter: jest.fn(),
  recordRequestDuration: jest.fn(),
  setGaugeValue: jest.fn(),
  incGauge: jest.fn(),
  decGauge: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue(''),
};
export default metrics;
export const startMetricsServer = jest.fn();
