import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { isLoggedIn } from '@/composables/auth/useAuth';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            redirect: '/welcome',
            children: [
                {
                    path: '/welcome',
                    name: 'welcome',
                    component: () => import('@/components/Welcome.vue')
                },
            ]
        },
        {
            path: '/',
            component: AppLayout,
            redirect: ' ',
            children: [
                {
                    path: '/org-stats',
                    name: 'org-stats',
                    component: () => import('@/views/OrgStatsView.vue')
                },
                {
                    path: '/migration-workspace',
                    name: 'migration-workspace',
                    component: () => import('@/views/MigrationWorkspace.vue')
                },
                {
                    path: '/field-mapping/:mappingId',
                    name: 'field-mapping',
                    component: () => import('@/views/FieldMapping.vue')
                },
            ]
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/auth/Login.vue')
        },
        {
            path: '/auth/register',
            name: 'register',
            component: () => import('@/views/auth/Register.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/auth/Access.vue')
        },
        /* /auth/error
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/auth/Error.vue')
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
    const publicPages = ['/auth/login', '/auth/register', '/auth/access']; // Define public routes
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
