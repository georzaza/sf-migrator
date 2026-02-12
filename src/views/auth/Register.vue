<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/auth/useAuth';
import axiosInstance from '@/api/axiosInstance';

const router = useRouter();
const { login } = useAuth();

const email = ref('');
const password = ref('');
const firstname = ref('');
const lastname = ref('');
const username = ref('');

const userExists = ref(false);
const formErrorMissingInput = ref(false);
const formErrorEmail = ref(false);
const formErrorUsername = ref(false);
const formErrorPassword = ref(false);
const formErrorMessage = ref('');

const showRedirectAlert = ref(false);

const handleRegister = async () => {
    userExists.value             = false;
    formErrorEmail.value         = false;
    formErrorUsername.value      = false;
    formErrorPassword.value      = false;
    formErrorMessage.value       = '';
    formErrorMissingInput.value  = false;

    try {
        const response = await axiosInstance.post('/auth/register',
        {
            email: email.value,
            password: password.value,
            firstname: firstname.value,
            lastname: lastname.value,
            username: username.value
        },
        {
            headers: {
                'action': 'register',
            },
        });

        switch (response.status) {
            case 201:
                try {
                    const loginResponse = await login(email.value, password.value);
                    if (loginResponse.status !== 200)
                        console.error('Login failed:', loginResponse.data.message);
                    showRedirectAlert.value = true;
                    setTimeout(() => { router.push('/'); }, 1000);
                }
                catch (error) {
                    if (error.response?.status === 401) {
                        console.error('Register | Login after register failed: Invalid credentials?');
                        router.push('/auth/access');
                        return;
                    }
                    console.error('Register | Login after register failed:', error.response?.data || error.message);
                    alert('An error occurred during logging in with the new credentials. Try again to login.');
                }
                break;
            case 409:
                userExists.value = true;
                break;
            case 400:
                switch (response.data?.message) {
                    case 'All fields are required.':
                        formErrorMissingInput.value = true;
                        break;
                    case 'Invalid email format.':
                    case 'Email is required.':
                        formErrorEmail.value = true;
                        break;
                    case 'Did you also set your password to "password"?':
                    case 'Username can only contain letters, numbers, underscores, and dots.':
                    case 'Username must be between 3 and 32 characters.':
                    case 'Username is required.':
                        formErrorUsername.value = true;
                        break;
                    case 'Password must contain at least one lowercase letter.':
                    case 'Password must contain at least one uppercase letter.':
                    case 'Password must contain at least one digit.':
                    case 'Password must contain at least one special character.':
                    case 'Password must be between 8 and 64 characters long.':
                        formErrorPassword.value = true;
                        break;
                    default:
                        alert('There is an issue with the form. Check your inputs and try again.');
                        break;
                }
                console.error(response.data?.message);
                break;
            default:
                break;
        }
        formErrorMessage.value = response.data?.message || 'An unexpected error occurred. Please try again.';
    }
    catch (error) {
        console.error('Register failed:', error?.message);
        alert('There might be an issue with the server. Please try again later.');
    }
};

</script>


<template>
    <FloatingConfigurator />
    <div
        class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden"
        :style="{ opacity: showRedirectAlert ? 0.3 : 1 }"
    >
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <img src="../../../../assets/logos/1024.webp" alt="Logo" class="w-16 h-16 mx-auto mb-4"  style="object-fit: cover;" />
                    <h3 class="text-surface-900 dark:text-surface-0 text-xl mb-8 text-center">Register</h3>

                    <div>
                        <label for="firstname1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">First Name</label>
                        <InputText id="firstname1" type="text" placeholder="First name" class="w-full md:w-[30rem] mb-8" :class="{ 'p-invalid': formErrorMissingInput }" v-model="firstname" />

                        <label for="lastname1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Last Name</label>
                        <InputText id="lastname1" type="text" placeholder="Last name" class="w-full md:w-[30rem] mb-8" :class="{ 'p-invalid': formErrorMissingInput }" v-model="lastname" />

                        <label for="username1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Username</label>
                        <InputText id="username1" type="text" placeholder="Username" class="w-full md:w-[30rem] mb-8" :class="{ 'p-invalid': formErrorMissingInput || formErrorUsername || userExists }" v-model="username" />

                        <label for="email1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
                        <InputText id="email1" type="text" placeholder="Email address" class="w-full md:w-[30rem] mb-8" :class="{ 'p-invalid': formErrorMissingInput || formErrorEmail || userExists }" v-model="email" />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password id="password1" v-model="password" placeholder="Password" :toggleMask="true" class="mb-8" :class="{ 'p-invalid': formErrorMissingInput || formErrorPassword }" fluid :feedback="false"></Password>

                        <Button label="Sign Up" class="w-full mb-4" severity="success" rounded @click="handleRegister"></Button>

                        <Message v-if="formErrorEmail || formErrorUsername || formErrorPassword || formErrorMissingInput || userExists" severity="error" class="mt-4">
                            <span> {{ formErrorMessage }}</span>
                        </Message>

                        <Button label="Login" class="w-full mb-4" severity="info" rounded @click="router.push('/auth/login/')"></Button>

                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Redirect Alert Overlay -->
    <div v-if="false" class="fixed inset-0 bg-transparent flex items-center justify-center z-50">
        <div class="bg-white p-8 rounded-lg shadow-lg text-center">
            <p class="text-gray-700">Redirecting to Dashboard...</p>
        </div>
    </div>
</template>


<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}

.fixed {
    position: fixed;
}

.inset-0 {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.bg-transparent {
    background-color: transparent;
}

.z-50 {
    z-index: 50;
}

.p-invalid {
    border-color: #f87171;
    box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.2);
}
</style>
