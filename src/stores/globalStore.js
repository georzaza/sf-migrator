import { defineStore } from 'pinia';

export const useGlobalStore = defineStore('global', {

    // Add the persist plugin correctly here
    persist: true,

    state: () => ({

    }),

    actions: {

    },
});
