import axiosInstance from '@/api/axiosInstance';
import { useUserStore } from '@/stores/userStore';

export function useAuth() {
    const userStore = useUserStore();

    const login = async (email, password) => {
        try {
            axiosInstance.resetHeaders();
            axiosInstance.setHeaders('login');
            const loginResponse = await axiosInstance.post('/auth/login', {
                userIdentifier: email,
                password: password
            });

            if (loginResponse.status === 200) {
                axiosInstance.resetHeaders();
                axiosInstance.setHeaders('whoami');
                const whoamiResponse = await axiosInstance.get('/auth/whoami', {withCredentials: true});
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

export async function isLoggedIn() {
    const userStore = useUserStore();
    try {
        axiosInstance.resetHeaders();
        axiosInstance.setHeaders('whoami');
        const whoamiResponse = await axiosInstance.get('/auth/whoami', {withCredentials: true});
        if (whoamiResponse.status === 200) {
            userStore.isAuthenticated = true;
            userStore.email = whoamiResponse.data.data.email;
            userStore.username = whoamiResponse.data.data.username;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking authentication status:', error);
        return false;
    }
}
