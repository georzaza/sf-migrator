<script setup>
/* todo
import { onMounted, onBeforeUnmount } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import { useToast } from 'primevue/usetoast';
import axiosInstance from '@/api/axiosInstance';

const orgStore = useOrgStore();
const toast = useToast();

// in-memory map to avoid duplicate notifications: { orgId: lastCompletedAnalysisId }
const lastSeenCompleted = {};
let pollInterval = null;

onMounted(async () => {
    // Ensure orgs are loaded
    await orgStore.loadProjects();

    pollInterval = setInterval(async () => {
        try {
            for (const org of orgStore.orgs || []) {
                try {
                    const resp = await axiosInstance.get('/analysis', {
                        headers: { action: 'get-latest-analysis', orgid: org.id }
                    });
                    if (resp.data.success && resp.data.data) {
                        const analysis = resp.data.data;
                        if (analysis.status === 'completed') {
                            const prev = lastSeenCompleted[org.id];
                            if (!prev || prev !== analysis.id) {
                                lastSeenCompleted[org.id] = analysis.id;
                                toast.add({ severity: 'success', summary: 'Analysis Complete', detail: `Analysis for ${org.name} is complete.`, life: 4000 });
                            }
                        }
                    }
                } catch (err) {
                    // ignore per-org polling errors
                }
            }
        } catch (err) {
            // ignore
        }
    }, 3000);
});

onBeforeUnmount(() => {
    if (pollInterval) clearInterval(pollInterval);
});
*/
</script>


<template>
    <router-view />
</template>


<style scoped>

</style>
