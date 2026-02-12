import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {

    persist: true,

    state: () => ({
        isAuthenticated: false,
        email: '', //although it's present in the cookie, it's helpful to have it also handy in local state.
        username: '',//although it's present in the cookie, it's helpful to have it also handy in local state.
    }),

    actions: {
        setEmail(email) {
            this.email = email;
        },

        setUsername(username) {
            this.username = username;
        },

        setIsAuthenticated(isAuthenticated) {
            this.isAuthenticated = isAuthenticated;
        }
    },
});
