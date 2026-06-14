<script setup>
import AppFooter from './AppFooter.vue';
import AppTopbar from './AppTopbar.vue';
import Orgbar from '@/components/Orgbar.vue';
</script>

<template>
    <div class="layout-wrapper layout-static layout-static-inactive">
        <app-topbar></app-topbar>
        <div class="layout-main-container">
            <div class="layout-main">
                <Orgbar />
                <router-view></router-view>
            </div>
            <app-footer></app-footer>
        </div>
    </div>
    <Toast />
    <ConfirmDialog />
</template>
