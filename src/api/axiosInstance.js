import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
    },
    validateStatus: status => status < 500,
    withCredentials: true,
});

/**
 * Generate a short unique request ID for tracing.
 */
function generateRequestId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().slice(0, 8);
    }
    return Math.random().toString(36).slice(2, 10);
}

// Request interceptor - attach X-Request-ID for end-to-end tracing
axiosInstance.interceptors.request.use(
    (config) => {
        const requestId = generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        console.log(`[${requestId}] API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            action: config.headers?.action,
        });
        return config;
    },
    (error) => {
        console.error('Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor - log with request ID correlation
axiosInstance.interceptors.response.use(
    (response) => {
        const requestId = response.config.headers?.['X-Request-ID'] || response.data?.requestId;
        if (response.config.headers?.action) {
            console.log(`[${requestId}] API Response: ${response.config.headers.action}`, {
                status: response.status,
                success: response.data?.success,
            });
        }
        return response;
    },
    (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'] || 'unknown';
        console.group(`[${requestId}] API Error`);
        console.error('Message:', error.message);

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response Data:', error.response.data);
            console.error('Request URL:', error.config?.url);
            console.error('Action:', error.config?.headers?.action);
        } else if (error.request) {
            console.error('No Response Received');
            console.error('Request URL:', error.config?.url);
        } else {
            console.error('Request Setup Error:', error.message);
        }

        console.groupEnd();
        return Promise.reject(error);
    }
);

export default axiosInstance
