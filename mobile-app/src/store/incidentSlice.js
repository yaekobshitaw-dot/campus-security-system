import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../services/api';

const initialState = {
  incidents: [],
  recentIncidents: [],
  currentIncident: null,
  loading: false,
  error: null,
};

const getIncidentErrorMessage = (error) => {
  if (!error?.response) {
    return error?.message === 'Network Error'
      ? 'Network error. Please check your connection and try again.'
      : 'Unable to reach the campus security service. Please try again.';
  }

  if (error.response.status === 401) {
    return 'Your session expired. Please sign in again.';
  }

  if (error.response.status === 400) {
    return error.response?.data?.message || 'Please check the incident details and try again.';
  }

  if (error.response.status === 409) {
    return error.response?.data?.message || 'This incident was already submitted.';
  }

  if (error.response.status >= 500) {
    return 'The campus security service is temporarily unavailable. Please try again.';
  }

  return error.response?.data?.message || 'Failed to report incident';
};

const dedupeIncidentList = (list, incoming) => {
  if (!incoming) return list;
  const incidentId = incoming.incident_id || incoming.id;
  if (!incidentId) return list;
  return list.filter((item) => (item.incident_id || item.id) !== incidentId);
};

export const fetchIncidents = createAsyncThunk(
  'incidents/fetch',
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.get('/incidents', { params });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch incidents');
    }
  }
);

export const fetchRecentIncidents = createAsyncThunk(
  'incidents/fetchRecent',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/incidents', { params: { limit: 5 } });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch recent incidents');
    }
  }
);

export const reportIncident = createAsyncThunk(
  'incidents/report',
  async (incidentData, { rejectWithValue }) => {
    try {
      const response = await api.post('/incidents', incidentData, {
        timeout: 30000,
      });
      if (!response?.data?.success) {
        return rejectWithValue(response?.data?.message || 'Failed to report incident');
      }
      return response.data.data;
    } catch (error) {
      return rejectWithValue(getIncidentErrorMessage(error));
    }
  }
);

const incidentSlice = createSlice({
  name: 'incidents',
  initialState,
  reducers: {
    addIncident: (state, action) => {
      const incident = action.payload;
      if (!incident) return;
      const deduped = dedupeIncidentList(state.incidents, incident);
      state.incidents = [incident, ...deduped];
      const recentDeduped = dedupeIncidentList(state.recentIncidents, incident);
      state.recentIncidents = [incident, ...recentDeduped];
    },
    updateIncident: (state, action) => {
      const index = state.incidents.findIndex(
        (i) => i.incident_id === action.payload.incident_id
      );
      if (index !== -1) {
        state.incidents[index] = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIncidents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchIncidents.fulfilled, (state, action) => {
        state.loading = false;
        state.incidents = action.payload;
      })
      .addCase(fetchIncidents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchRecentIncidents.fulfilled, (state, action) => {
        state.recentIncidents = action.payload;
      })
      .addCase(reportIncident.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(reportIncident.fulfilled, (state, action) => {
        state.loading = false;
        const incident = action.payload;
        if (!incident) return;
        const deduped = dedupeIncidentList(state.incidents, incident);
        state.incidents = [incident, ...deduped];
        const recentDeduped = dedupeIncidentList(state.recentIncidents, incident);
        state.recentIncidents = [incident, ...recentDeduped];
      })
      .addCase(reportIncident.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { addIncident, updateIncident } = incidentSlice.actions;
export default incidentSlice.reducer;