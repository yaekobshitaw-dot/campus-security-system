import { afterEach, describe, expect, it, vi } from 'vitest';
import mlService from './mlService';

describe('ML service API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the dedicated proxy prefix for ML API requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy', hotzones: [], risk_level: 'low' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await mlService.health();
    await mlService.detectHotzones();
    await mlService.predictRisk({ type: 'other' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/ml/health',
      '/api/ml/detect/hotzones',
      '/api/ml/predict/risk',
    ]);
  });
});
