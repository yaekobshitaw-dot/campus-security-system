// src/services/mlService.js
import api from './api';

// ML Service API URL
const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:5001';

export const mlService = {
  // Health check
  health: async () => {
    try {
      const response = await fetch(ML_API_URL + '/health');
      return response.json();
    } catch (error) {
      console.error('ML Health check failed:', error);
      return null;
    }
  },

  // Predict risk
  predictRisk: async (incidentData) => {
    try {
      const response = await fetch(ML_API_URL + '/predict/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentData)
      });
      return response.json();
    } catch (error) {
      console.error('Risk prediction failed:', error);
      return null;
    }
  },

  // Detect hotzones
  detectHotzones: async () => {
    try {
      const response = await fetch(ML_API_URL + '/detect/hotzones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    } catch (error) {
      console.error('Hotzone detection failed:', error);
      return null;
    }
  },

  // Classify incident
  classifyIncident: async (incidentData) => {
    try {
      const response = await fetch(ML_API_URL + '/classify/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentData)
      });
      return response.json();
    } catch (error) {
      console.error('Incident classification failed:', error);
      return null;
    }
  }
};

export default mlService;
