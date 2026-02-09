import AppLayout from '@/layout/AppLayout.vue';
import { useUserStore } from '@/stores/userStore';
import { createRouter, createWebHistory } from 'vue-router';
import { isLoggedIn } from '@/composables/auth/useAuth';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        /* / */
        {
            path: '/',
            component: AppLayout,
            redirect: '/dashboard',
            children: [
                {
                    path: '/dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/migrate/:projectId?',
                    name: 'migrate',
                    component: () => import('@/views/MigrationWorkspace.vue')
                },
            ]
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },
        /* /auth/login */
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        /* /auth/register */
        {
            path: '/auth/register',
            name: 'register',
            component: () => import('@/views/pages/auth/Register.vue')
        },
        /* /auth/access */
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        /* /auth/error
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        }
        */
    ]
});

// Global navigation guard (middleware-like)
router.beforeEach( async (to, from, next) => {
    if (to.path.startsWith('/auth/')) {
        next();
        return;
    }
    const publicPages = ['/auth/login', '/auth/register']; // Define public routes
    const authRequired = !publicPages.includes(to.path); // Check if the route requires authentication
    const loggedIn = await isLoggedIn(); // Check if the user is logged in
    console.log(`Navigating to: ${to.path}, Auth Required: ${authRequired}, Logged In? ${loggedIn}`);
    if (authRequired && !loggedIn) {
        next('/auth/login'); // Redirect to login if not authenticated
    } else {
        next(); // Allow navigation
    }
});

export default router;
