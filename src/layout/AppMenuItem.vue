<script setup>
import { useLayout } from '@/layout/composables/layout';
import { onBeforeMount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const { layoutState, setActiveMenuItem, toggleMenu } = useLayout();

const props = defineProps({
    item: {
        type: Object,
        default: () => ({})
    },
    index: {
        type: Number,
        default: 0
    },
    root: {
        type: Boolean,
        default: true
    },
    parentItemKey: {
        type: String,
        default: null
    }
});

const isActiveMenu = ref(false);
const itemKey = ref(null);

onBeforeMount(() => {
    itemKey.value = props.parentItemKey ? props.parentItemKey + '-' + props.index : String(props.index);

    const activeItem = layoutState.activeMenuItem;

    isActiveMenu.value = activeItem === itemKey.value || activeItem ? activeItem.startsWith(itemKey.value + '-') : false;
});

watch(
    () => layoutState.activeMenuItem,
    (newVal) => {
        isActiveMenu.value = newVal === itemKey.value || newVal.startsWith(itemKey.value + '-');
    }
);

function itemClick(event, item) {
    if (item.disabled) {
        event.preventDefault();
        return;
    }

    if ((item.to || item.url) && (layoutState.staticMenuMobileActive || layoutState.overlayMenuActive)) {
        toggleMenu();
    }

    if (item.command) {
        item.command({ originalEvent: event, item: item });
    }

    const foundItemKey = item.items ? (isActiveMenu.value ? props.parentItemKey : itemKey) : itemKey.value;

    setActiveMenuItem(foundItemKey);
}

function checkActiveRoute(item) {
    return route.path === item.to;
}
</script>

<template>
    <li :class="{ 'layout-root-menuitem': root, 'active-menuitem': isActiveMenu }">
        <!-- If root and has command, render as clickable -->
        <div v-if="root && item.visible !== false && item.command && (item.key === 'add-project' || item.key.endsWith('_add-org'))" class="layout-menuitem-root-text clickable menu-action-highlight" @click="itemClick($event, item, index)">
            <i v-if="!item.imgIcon" :class="item.icon" class="layout-menuitem-icon"></i>
            <span v-else class="layout-menuitem-icon"><img :src="item.imgIcon" alt="icon" style="height: 1.2em; width: 1.2em; vertical-align: middle; object-fit: contain;" /></span>
            <span class="layout-menuitem-text">{{ item.label }}</span>
        </div>
        <div v-else-if="root && item.visible !== false && item.command" class="layout-menuitem-root-text clickable" @click="itemClick($event, item, index)">
            <i v-if="!item.imgIcon" :class="item.icon" class="layout-menuitem-icon"></i>
            <span v-else class="layout-menuitem-icon"><img :src="item.imgIcon" alt="icon" style="height: 1.2em; width: 1.2em; vertical-align: middle; object-fit: contain;" /></span>
            <span class="layout-menuitem-text">{{ item.label }}</span>
        </div>
        <!-- If root and no command, render as plain label -->
        <div v-else-if="root && item.visible !== false" class="layout-menuitem-root-text">{{ item.label }}</div>
        <a v-if="(!item.to || item.items) && item.visible !== false" :href="item.url" @click="itemClick($event, item, index)" :class="[item.class, item.styleClass, (item.key === 'add-project' || item.key.endsWith('-add-org')) ? 'menu-action-highlight' : '']" :target="item.target" tabindex="0">
            <i v-if="!item.imgIcon" :class="item.icon" class="layout-menuitem-icon"></i>
            <span v-else class="layout-menuitem-icon"><img :src="item.imgIcon" alt="icon" style="height: 1.2em; width: 1.2em; vertical-align: middle; object-fit: contain;" /></span>
            <span class="layout-menuitem-text">{{ item.label }}</span>
            <i class="pi pi-fw pi-angle-down layout-submenu-toggler" v-if="item.items"></i>
        </a>
        <router-link v-if="item.to && !item.items && item.visible !== false" @click="itemClick($event, item, index)" :class="[item.class, item.styleClass, (item.key === 'add-project' || item.key.endsWith('_add-org')) ? 'menu-action-highlight' : '', { 'active-route': checkActiveRoute(item) }]" tabindex="0" :to="item.to">
            <i v-if="!item.imgIcon" :class="item.icon" class="layout-menuitem-icon"></i>
            <span v-else class="layout-menuitem-icon"><img :src="item.imgIcon" alt="icon" style="height: 1.2em; width: 1.2em; vertical-align: middle; object-fit: contain;" /></span>
            <span class="layout-menuitem-text">{{ item.label }}</span>
            <i class="pi pi-fw pi-angle-down layout-submenu-toggler" v-if="item.items"></i>
        </router-link>
        <Transition v-if="item.items && item.visible !== false" name="layout-submenu">
            <ul v-show="root ? true : isActiveMenu" class="layout-submenu">
                <app-menu-item v-for="(child, i) in item.items" :key="child" :index="i" :item="child" :parentItemKey="itemKey" :root="false"></app-menu-item>
            </ul>
        </Transition>
    </li>
</template>

<style lang="scss" scoped>
.clickable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
}
.clickable:hover {
    background: #e3f2fd;
}
.menu-action-highlight {
    background: #f4f8fd !important;
    color: #1976d2 !important;
    border-radius: 6px;
    font-weight: 500;
    transition: background 0.2s, color 0.2s;
}
.menu-action-highlight:hover {
    background: #e3f2fd !important;
    color: #125ea2 !important;
}
</style>
