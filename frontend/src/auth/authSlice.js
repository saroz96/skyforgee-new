
import { createSlice } from '@reduxjs/toolkit';

// Helper function to safely parse localStorage items
const getLocalStorageItem = (key) => {
  try {
    return localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : null;
  } catch (error) {
    console.error(`Error parsing localStorage item ${key}:`, error);
    return null;
  }
};

const initialState = {
  userInfo: getLocalStorageItem('userInfo'),
  token: localStorage.getItem('token') || null,
  currentCompany: getLocalStorageItem('currentCompany'),
  currentFiscalYear: getLocalStorageItem('currentFiscalYear'),
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.userInfo = action.payload.user;
      state.token = action.payload.token;
      
      // Only update currentCompany if provided in payload
      if (action.payload.currentCompany) {
        state.currentCompany = action.payload.currentCompany;
        localStorage.setItem('currentCompany', JSON.stringify(action.payload.currentCompany));
      }
      
      // Only update currentFiscalYear if provided in payload
      if (action.payload.currentFiscalYear) {
        state.currentFiscalYear = action.payload.currentFiscalYear;
        localStorage.setItem('currentFiscalYear', JSON.stringify(action.payload.currentFiscalYear));
      }
      
      localStorage.setItem('userInfo', JSON.stringify(action.payload.user));
      localStorage.setItem('token', action.payload.token);
    },
    
    setCurrentCompany: (state, action) => {
      state.currentCompany = action.payload.company;
      state.currentFiscalYear = action.payload.fiscalYear;
      localStorage.setItem('currentCompany', JSON.stringify(action.payload.company));
      localStorage.setItem('currentFiscalYear', JSON.stringify(action.payload.fiscalYear));
    },
    
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    setError: (state, action) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    logout: (state) => {
      state.userInfo = null;
      state.token = null;
      state.currentCompany = null;
      state.currentFiscalYear = null;
      state.loading = false;
      state.error = null;
      
      localStorage.removeItem('userInfo');
      localStorage.removeItem('token');
      localStorage.removeItem('currentCompany');
      localStorage.removeItem('currentFiscalYear');
    }
  }
});

export const { 
  setCredentials, 
  setCurrentCompany,
  setLoading,
  setError,
  clearError,
  logout 
} = authSlice.actions;

export default authSlice.reducer;