import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../services/api';

const initialState = {
  incidents: [],
  recentIncidents: [],
  currentIncident: null,
  loading: false,
  error: null,
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
      const response = await api.post('/incidents', incidentData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to report incident');
    }
  }
);

const incidentSlice = createSlice({
  name: 'incidents',
  initialState,
  reducers: {
    addIncident: (state, action) => {
      state.incidents.unshift(action.payload);
      state.recentIncidents.unshift(action.payload);
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
      .addCase(reportIncident.fulfilled, (state, action) => {
        state.incidents.unshift(action.payload);
        state.recentIncidents.unshift(action.payload);
      });
  },
});

export const { addIncident, updateIncident } = incidentSlice.actions;
export default incidentSlice.reducer;