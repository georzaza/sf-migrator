import axios from 'axios';
import { predefinedHeaders } from './headers';

const axiosInstance = axios.create({
    baseURL: 'http://127.0.0.1:3000',
    headers: {
        'Content-Type': 'application/json',
    },
    validateStatus: status => status < 500
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
        'Content-Type': 'application/json'
    };
};

export default axiosInstance
