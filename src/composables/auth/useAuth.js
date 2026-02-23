import axiosInstance from '@/api/axiosInstance';
import { useUserStore } from '@/stores/userStore';
import { useOrgStore } from '@/stores/orgStore';

export function useAuth() {
    const userStore = useUserStore();
    const orgStore = useOrgStore();

    const login = async (email, password) => {
        try {
            const loginResponse = await axiosInstance.post('/auth/login',
                {
                    userIdentifier: email,
                    password: password
                },
                {
                    headers: {
                        'action': 'login',
                    }
                }
            );

            if (loginResponse.status === 200) {
                const whoamiResponse = await axiosInstance.get('/auth/whoami',
                    {
                        headers: {
                            'action': 'whoami',
                        },
                        withCredentials: true,
                    }
                );
                if (whoamiResponse.status === 200) {
                    userStore.setIsAuthenticated(true);
                    userStore.setEmail(whoamiResponse.data.data.email);
                    userStore.setUsername(whoamiResponse.data.data.username);
                    orgStore.loadOrgs(); // loads orgs
                }
                else {
                    console.error('Whoami request failed:', whoamiResponse);
                }
                return whoamiResponse;
            }

            return loginResponse;

        }
        catch (error) {
            console.error('Login failed.', error?.message);
            // mark server down on network errors so UI can react after redirect
            if (error.code === 'ERR_NETWORK' || !error.response) {
                userStore.serverDown = true;
            }
            return null;
        }
    };

    return { login };
}

export async function isLoggedIn() {
    const userStore = useUserStore();
    try {
        const whoamiResponse = await axiosInstance.get('/auth/whoami',
            {
                headers: {
                    'action': 'whoami',
                },
                withCredentials: true,
            }
        );
        if (whoamiResponse.status === 200) {
            userStore.isAuthenticated = true;
            userStore.email = whoamiResponse.data.data.email;
            userStore.username = whoamiResponse.data.data.username;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking authentication status:', error);
        if (error.code === 'ERR_NETWORK' || !error.response) {
            userStore.serverDown = true;
        }
        return false;
    }
}
