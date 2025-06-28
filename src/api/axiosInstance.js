import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
    },
    validateStatus: status => status < 500,
    withCredentials: true,
});

export default axiosInstance
