export const metrics = {
  incrementCounter:     jest.fn(),
  recordRequestDuration: jest.fn(),
  getMetrics:           jest.fn().mockResolvedValue(''),
  setGaugeValue:        jest.fn(),
};
