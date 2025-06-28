<script setup>
import { computed } from 'vue';
import { useOrgStore } from '@/stores/orgStore';

import AppMenuItem from './AppMenuItem.vue';


const orgStore = useOrgStore();
const model = computed(() => orgStore.menuItems);

</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
