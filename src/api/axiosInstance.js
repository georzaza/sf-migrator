import axios from 'axios';
import { predefinedHeaders } from './headers';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
    },
    validateStatus: status => status < 500,
    withCredentials: true,
});

axiosInstance.setHeaders = (action) => {
    const actionHeader = predefinedHeaders[action.toLowerCase()];
    if (actionHeader) {
        axiosInstance.defaults.headers = {
            ...axiosInstance.defaults.headers,
            ...actionHeader,
        };
    } else {
        console.error(`Action "${action}" is not predefined.`);
    }
};

axiosInstance.resetHeaders = () => {
    axiosInstance.defaults.headers = {
        'Content-Type': 'application/json; charset=utf-8'
    };
};

export default axiosInstance
