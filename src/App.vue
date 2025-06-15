<script setup>
import { useGlobalStore } from './store';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router'


const router = useRouter();
const store = useGlobalStore();

</script>


<template>
    <router-view />
</template>


<style scoped>

</style>
