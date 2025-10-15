

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCredentials, logout as reduxLogout, setCurrentCompany } from '../auth/authSlice';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { userInfo, currentCompany } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    withCredentials: true,
  });

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if user is already logged in (via session cookie)
        const { data } = await api.get('/api/auth/me', { withCredentials: true });
        if (data.user) {
          dispatch(setCredentials({
            user: data.user,
            currentCompany: data.currentCompany || null
          }));
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [dispatch]);

  const hasPermission = (requiredPermission) => {
    if (!userInfo || !userInfo.permissions) return false;
    return userInfo.permissions.includes(requiredPermission);
  };

  const clearAuthData = useCallback(() => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    dispatch(reduxLogout());
  }, [dispatch]);

  const switchCompany = async (companyId) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.get(`/api/switch/${companyId}`, {
        withCredentials: true
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to switch company');
      }

      // Update the current company in Redux store
      dispatch(setCurrentCompany({
        company: data.data.sessionData.company || data.company,
        fiscalYear: data.data.sessionData.fiscalYear
      }));
      const companyRes = await api.get('/api/my-company');

      return data || companyRes;
    } catch (err) {
      const error = err.response?.data?.message || err.message || 'Failed to switch company';
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData, options = {}) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.post('/api/auth/register', userData);

      if (options.autoLogin && data.token) {
        localStorage.setItem('token', data.token);
        await validateToken(data.token);
      }

      return data;
    } catch (err) {
      console.error('Registration error:', err);
      const error = err.response?.data?.error ||
        err.response?.data?.message ||
        'Registration failed';
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const validateToken = async (token) => {
    try {
      const { data } = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      dispatch(setCredentials({
        user: data.user,
        currentCompany: data.currentCompany || null
      }));
      return data.user;
    } catch (err) {
      clearAuthData();
      throw err;
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.post('/api/auth/login', credentials, {
        withCredentials: true
      });

      if (!data.success) {
        // Handle email verification case
        if (data.requiresEmailVerification) {
          throw new Error('Please verify your email before logging in');
        }
        // Handle other cases
        throw new Error(data.message || 'Login failed');
      }

      dispatch(setCredentials({
        user: data.user,
        currentCompany: data.currentCompany || null
      }));
      return data;
    } catch (err) {
      let errorMessage = err.response?.data?.message || err.message || 'Login failed';

      // Standardize the invalid credentials message
      if (err.response?.status === 401 &&
        (err.response.data.message === 'Invalid email or password' ||
          err.response.data.message === 'Invalid credentials')) {
        errorMessage = 'Invalid email or password';
      }

      setError(errorMessage);
      throw errorMessage;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await api.post('/api/auth/logout', {}, {
        withCredentials: true
      });

      // Clear frontend auth state
      clearAuthData();

      window.location.href = '/auth/login';
      
    } catch (err) {
      console.error('Logout error:', err);
      clearAuthData();
    } finally {
      setLoading(false);
    }
  }, [clearAuthData]);

  const value = {
    currentUser: userInfo,
    currentCompany,
    loading,
    error,
    hasPermission,
    register,
    login,
    logout,
    switchCompany,
    clearError: () => setError(null),
    validateToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
