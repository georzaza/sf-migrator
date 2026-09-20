<script setup>
import { useLayout } from '@/layout/composables/layout';
import AppConfigurator from './AppConfigurator.vue';
import axiosInstance from '@/api/axiosInstance';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/userStore';
import { useOrgStore } from '@/stores/orgStore';

const { toggleDarkMode, isDarkTheme } = useLayout();

const router = useRouter();
const userStore = useUserStore();
const orgStore = useOrgStore();

const logout = async () => {
    // Clear persisted storage
    localStorage.clear();
    sessionStorage.clear();
    // Reset all Pinia store state in-memory
    userStore.$reset();
    orgStore.$reset();
    try {
        axiosInstance.get('/auth/logout',
        {
            headers: {
                action: 'logout'
            },
            withCredentials: true
        })
        .then( res => {
            if (res.status === 200) {
                console.log('Logout successful');
            }
            else {
                console.error('Failed to logout from server:', res);
            }
        })
        .catch(error => {
            console.error('Error during logout:', error);
        })
        .finally( () => {
            // Redirect to login page after logout
            router.push({ name: 'login' });
        });
    }
    catch (error) {
        console.error('Error during logout:', error);
    }
}

</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
        </div>

        <nav class="layout-topbar-nav">
            <router-link to="/migration-workspace" class="layout-topbar-nav-link">
                <i class="pi pi-sitemap"></i>
                <span>Workspace</span>
            </router-link>
            <router-link to="/pipeline" class="layout-topbar-nav-link">
                <i class="pi pi-play"></i>
                <span>Pipeline</span>
            </router-link>
        </nav>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <div class="relative">

                    <AppConfigurator />
                </div>
            </div>

            <button
                class="layout-topbar-menu-button layout-topbar-action"
                v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'animate-scalein', leaveToClass: 'hidden', leaveActiveClass: 'animate-fadeout', hideOnOutsideClick: true }"
            >
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <button type="button" class="layout-topbar-action" @click="logout">
                        <i class="pi pi-sign-out"></i>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.layout-topbar-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 2rem;
}

.layout-topbar-nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.9rem;
    border-radius: 8px;
    color: var(--text-color-secondary);
    font-weight: 500;
    text-decoration: none;
    transition: background-color 0.15s, color 0.15s;
}

.layout-topbar-nav-link:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.layout-topbar-nav-link.router-link-active {
    background: var(--highlight-bg, var(--surface-hover));
    color: var(--primary-color);
}

@media (max-width: 768px) {
    .layout-topbar-nav span {
        display: none;
    }
    .layout-topbar-nav {
        margin-left: 0.75rem;
    }
}
</style>



