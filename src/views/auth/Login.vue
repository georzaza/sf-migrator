<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/auth/useAuth';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const { login } = useAuth();
const toast = useToast();

const userIdentifier = ref('');
const password = ref('');
const checked = ref(false);

const handleLogin = async () => {
    try {
        const loginResponse = await login(userIdentifier.value, password.value);
        if (loginResponse.status !== 200) {
            console.error('Login failed:', loginResponse.data.message);
            router.push('/auth/access');
            return;
        }
        setTimeout(() => { router.push('/dashboard'); }, 1000);
    }
    catch (error) {
        if (error.response?.status === 401) {
            console.error('Login failed: Invalid credentials');
            router.push('/auth/access');
            return;
        }

        console.error('Login failed:', error.response?.data || error.message);
        toast.add({ severity: 'error', summary: 'Login Error', detail: 'Error occurred during login. Is the server up and running?', life: 6000 });
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
                        <img src="../../../assets/logos/1024.webp" alt="Logo" class="w-16 h-16 mx-auto mb-4"  style="object-fit: cover;" />

                        <h3 class="text-surface-900 dark:text-surface-0 text-xl mb-8 text-center">Login</h3>
                    </div>

                    <div>
                        <label for="email1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Username or Email</label>
                        <InputText id="email1" type="text" placeholder="Email address" class="w-full md:w-[30rem] mb-8" v-model="userIdentifier" />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password id="password1" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false"></Password>

                        <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" id="rememberme1" binary class="mr-2"></Checkbox>
                                <label for="rememberme1">Remember me</label>
                            </div>
                            <span class="font-medium no-underline ml-2 text-right cursor-pointer text-primary">Forgot password?</span>
                        </div>

                        <div class="flex flex-col gap-4">
                            <Button label="Sign In" class="text-center" severity="success" rounded @click="handleLogin">
                            </Button>

                            <Button label="Register" class="text-center" severity="info" rounded @click="router.push('/auth/register')">
                            </Button>
                        </div>
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
