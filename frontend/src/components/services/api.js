// services/api.js
import axios from 'axios';
import { useLoading } from '../../context/LoadingContext';

// const api = axios.create({
//   baseURL: 'http://localhost:5000/api', // Backend API base URL
// });
const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    withCredentials: true,
});
// Inject loading functions into Axios interceptors
export const setupInterceptors = (showLoading, hideLoading) => {
    api.interceptors.request.use(
        (config) => {
            showLoading();
            return config;
        },
        (error) => {
            hideLoading();
            return Promise.reject(error);
        }
    );

    api.interceptors.response.use(
        (response) => {
            hideLoading();
            return response;
        },
        (error) => {
            hideLoading();
            return Promise.reject(error);
        }
    );
};

export default api;