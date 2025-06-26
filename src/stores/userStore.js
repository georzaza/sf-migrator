import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {

    // Add the persist plugin correctly here
    persist: true,

    state: () => ({
        isAuthenticated: false,
    }),

    actions: {

    },
});
