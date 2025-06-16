<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axiosInstance from '@/api/axiosInstance';

const router = useRouter();

const email = ref('');
const password = ref('');
const checked = ref(false);

const handleLogin = async () => {
    try {
        axiosInstance.setActionHeader('login');

        const response = await axiosInstance.post('http://127.0.0.1:3000/auth/login', {
            email: email.value,
            password: password.value
        });

        if (response.status === 200) {
            console.log('Login successful:', response.data);
            //router.push('/');
        }
        else
            console.error('Login failed:', response.data.message || 'Unexpected response');
    } catch (error) {
        if (error.response?.status === 401) {
            console.error('Login failed: Invalid credentials');
            router.push('/auth/access');
            return;
        }

        console.error('Login failed:', error.response?.data || error.message);
        alert('An error occurred during login. Please try again.');
    }
};

</script>


<template>
    <FloatingConfigurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <img src="../../../../assets/logos/1024.webp" alt="Logo" class="w-16 h-16 mx-auto mb-4"  style="object-fit: cover;" />
                        <h3 class="text-surface-900 dark:text-surface-0 text-xl mb-8 text-center">Login</h3>
                    </div>

                    <div>
                        <label for="email1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
                        <InputText id="email1" type="text" placeholder="Email address" class="w-full md:w-[30rem] mb-8" v-model="email" />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password id="password1" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false"></Password>

                        <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" id="rememberme1" binary class="mr-2"></Checkbox>
                                <label for="rememberme1">Remember me</label>
                            </div>
                            <span class="font-medium no-underline ml-2 text-right cursor-pointer text-primary">Forgot password?</span>
                        </div>
                        <Button label="Sign In" class="w-full" @click="handleLogin"></Button>
                    </div>
                </div>
            </div>
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
</style>
