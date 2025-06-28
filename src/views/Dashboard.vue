<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useOrgStore } from '@/stores/orgStore';
import { useUserStore } from '@/stores/userStore';
import { useGlobalStore } from '@/stores/globalStore';
import axiosInstance from '@/api/axiosInstance';

const orgStore = useOrgStore();
const userStore = useUserStore();
const globalStore = useGlobalStore();
const router = useRouter();


onMounted( async () => {
    await orgStore.loadProjects();
})

</script>



<template>

</template>
