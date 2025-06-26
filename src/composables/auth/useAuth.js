import axiosInstance from '@/api/axiosInstance';
import { useUserStore } from '@/stores/userStore';
import { useRouter } from 'vue-router';

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

            if (loginResponse.status === 200) {
                userStore.isAuthenticated = true;
                userStore.email = loginResponse.data.data.email;
                userStore.username = loginResponse.data.data.username;
            }

            return await loginResponse;

        }
        catch (error) {
            console.error('Login failed. Is the server up and running?', error?.message);
            return null;
        }
    };

    return { login };
}
