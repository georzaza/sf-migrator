<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axiosInstance from '@/api/axiosInstance';

const router = useRouter();

const email = ref('');
const password = ref('');

const userExists = ref(false);
const showRedirectAlert = ref(false);

// todo handle actual response for user exists case, or password strength.
// todo add same validations for password strength as in the server?
// todo maybe server is just enough for handling this, but add focus to password strength validation errors in the UI.
const handleRegister = async () => {
    try {
        axiosInstance.setActionHeader('register');

        const response = await axiosInstance.post('http://127.0.0.1:3000/auth/register', {
            email: email.value,
            password: password.value
        });

        if (response.status === 200) {
            console.log('Register successful:', response.data);
            showRedirectAlert.value = true;
            setTimeout ( () => {
                router.push('/');
            }, 3000);

        }
        else {
            console.error('Register failed:', response.data.message || 'Unexpected response');
            userExists.value = true;
        }
    } catch (error) {
        if (error.response?.status === 409) {
            console.error('Register failed: User exists.');
            userExists.value = true;
        }

        console.error('Register failed:', error.response?.data || error.message);
        alert('An error occurred during Register. Please try again.');
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
                        <h3 class="text-surface-900 dark:text-surface-0 text-xl mb-8">Register</h3>

                    <div>
                        <!-- todo update reactive class condition based on the response from the server, aka handle userExists assignment correctly.-->
                        <label for="email1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
                        <InputText id="email1" type="text" placeholder="Email address" class="w-full md:w-[30rem] mb-8" :class="{ 'p-invalid': userExists }" v-model="email" />

                        <!-- todo add error focus if password strength validation does not pass -->
                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password id="password1" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false"></Password>

                        <Button label="Sign Up" class="w-full mb-8" @click="handleRegister"></Button>

                        <Message v-if="userExists" severity="error" class="mt-4">
                            <span>User already exists.</span>
                        </Message>

                        <Message severity="info" class="mt-4 mx-auto text-center" style="max-width: fit-content;">
                            <button class="text-blue-500 hover:text-blue-700" severity="info" rounded outlined>
                                <a href="/auth/login/"><span>Back to Login</span></a>
                            </button>
                        </Message>

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
</style>
