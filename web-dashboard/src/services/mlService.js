// Robust ML service client that tries the relative API proxy first, then a local ML service.

let resolvedBase = import.meta.env.VITE_ML_API_URL || null;
const LOCAL_FALLBACK = 'http://127.0.0.1:5001';
const RELATIVE_PROXY = '/api/ml';

async function tryRequest(path, options) {
  const candidates = [];
  if (resolvedBase) candidates.push(resolvedBase.replace(/\/+$/, ''));
  // try relative proxy (useful in Vite and Docker/nginx deployments)
  candidates.push(RELATIVE_PROXY);
  // finally try localhost where the ML dev server usually runs
  candidates.push(LOCAL_FALLBACK);

  let lastError = null;
  for (const base of candidates) {
    const baseUrl = base.replace(/\/+$/g, '');
    const url = baseUrl + path;
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        lastError = new Error(`Request failed ${res.status} ${res.statusText} for ${url}`);
        continue;
      }
      const json = await res.json();
      // cache the working base for subsequent calls
      resolvedBase = base;
      return { json, base };
    } catch (err) {
      lastError = err;
      // try next candidate
    }
  }
  throw lastError || new Error('No ML endpoints reachable');
}

export const mlService = {
  getResolvedBase: () => resolvedBase,

  // Health check
  health: async () => {
    try {
      const result = await tryRequest('/health', { method: 'GET' });
      return { ...result.json, _base: result.base };
    } catch (error) {
      console.error('ML Health check failed:', error);
      return null;
    }
  },

  // Predict risk
  predictRisk: async (incidentData) => {
    try {
      const result = await tryRequest('/predict/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentData)
      });
      return result.json;
    } catch (error) {
      console.error('Risk prediction failed:', error);
      return null;
    }
  },

  // Detect hotzones
  detectHotzones: async (campusLocations = [], incidents = []) => {
    try {
      const result = await tryRequest('/detect/hotzones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campus_locations: campusLocations, incidents })
      });
      return result.json;
    } catch (error) {
      console.error('Hotzone detection failed:', error);
      return null;
    }
  },

  // Classify incident
  classifyIncident: async (incidentData) => {
    try {
      const result = await tryRequest('/classify/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentData)
      });
      return result.json;
    } catch (error) {
      console.error('Incident classification failed:', error);
      return null;
    }
  }
};

export default mlService;
