// Robust ML service client with a production endpoint, relative proxy, and local fallback.

const PRODUCTION_ML_API = 'https://blissful-forgiveness-production-f7ae.up.railway.app';
const configuredBase = String(
    import.meta.env.VITE_ML_API_URL || '').trim();
const isProduction = Boolean(
    import.meta.env.PROD);
let resolvedBase = configuredBase || (isProduction ? PRODUCTION_ML_API : null);
const LOCAL_FALLBACK = 'http://127.0.0.1:5001';
const RELATIVE_PROXY = '/api/ml';

async function tryRequest(path, options) {
    const candidates = isProduction ?
        [configuredBase, PRODUCTION_ML_API] :
        [resolvedBase, RELATIVE_PROXY, LOCAL_FALLBACK];
    const uniqueCandidates = [...new Set(candidates.filter(Boolean).map((base) => base.replace(/\/+$/, '')))];

    let lastError = null;
    for (const baseUrl of uniqueCandidates) {
        const url = baseUrl + path;
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                lastError = new Error(`Request failed ${res.status} ${res.statusText} for ${url}`);
                continue;
            }
            const json = await res.json();
            // cache the working base for subsequent calls
            resolvedBase = baseUrl;
            return { json, base: baseUrl };
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
    health: async() => {
        try {
            const result = await tryRequest('/health', { method: 'GET' });
            return {...result.json, _base: result.base };
        } catch (error) {
            console.error('ML Health check failed:', error);
            return null;
        }
    },

    // Predict risk
    predictRisk: async(incidentData) => {
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
    detectHotzones: async(campusLocations = [], incidents = []) => {
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
    classifyIncident: async(incidentData) => {
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