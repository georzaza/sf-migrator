import axiosInstance from '@/api/axiosInstance';
import { useUserStore } from '@/stores/userStore';
import axios from 'axios';

const userStore = useUserStore();

/**
 * Issues a login request to the server.
 * If the response is 200, modifies the userStore.
 * @returns the response.
 */
export function useAuth() {

    const login = async (email, password) => {
        try {
            axiosInstance.resetHeaders();
            axiosInstance.setHeaders('login');
            const loginResponse = await axiosInstance.post('/auth/login', {
                userIdentifier: email,
                password: password
            });
            console.warn('Login response:', loginResponse);

            if (loginResponse.status === 200) {
                axiosInstance.resetHeaders();
                axiosInstance.setHeaders('whoami');
                const whoamiResponse = await axiosInstance.get('/auth/whoami', {withCredentials: true});
                console.warn('Whoami response:', whoamiResponse);
                if (whoamiResponse.status === 200) {
                    userStore.isAuthenticated = true;
                    userStore.email = whoamiResponse.data.data.email;
                    userStore.username = whoamiResponse.data.data.username;
                }
                else {
                    console.error('Whoami request failed:', whoamiResponse);
                }
                return whoamiResponse;
            }

            return loginResponse;

        }
        catch (error) {
            console.error('Login failed. Is the server up and running?', error?.message);
            return null;
        }
    };

    return { login };
}
