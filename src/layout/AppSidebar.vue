<script setup>
import AppMenu from './AppMenu.vue';
import EditOrgDialog from '@/components/EditOrgDialog.vue';
import AddProjectDialog from '@/components/AddProjectDialog.vue';
import AddOrgDialog from '@/components/AddOrgDialog.vue';
</script>

<template>
    <div class="layout-sidebar">
        <app-menu></app-menu>
        <edit-org-dialog></edit-org-dialog>
        <add-project-dialog></add-project-dialog>
        <add-org-dialog></add-org-dialog>
    </div>
</template>

<style lang="scss" scoped></style>
