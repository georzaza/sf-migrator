<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useOrgAnalysis } from '@/composables/useOrgAnalysis';
import OAuthRedirectOverlay from '@/components/OAuthRedirectOverlay.vue';
import OrgFormDialog from '@/components/dashboard/OrgFormDialog.vue';

const orgStore = useOrgStore();
const toast = useToast();
const confirm = useConfirm();

const {
    analyzingOrgId,
    showingOAuthOverlay,
    oauthOrgName,
    hasAnalysis,
    checkingAnalysis,
    checkOrgAnalysis,
    doAnalysis,
    stopPolling,
    resetState,
} = useOrgAnalysis();

// ─── Local State ────────────────────────────────────────
const orgFormVisible = ref(false);
const orgFormOrg = ref(null);

// ─── Computed ───────────────────────────────────────────
const selectedOrg = computed({
    get: () => orgStore.selectedOrg,
    set: (val) => orgStore.setSelectedOrg(val),
});

const isAnalyzing = computed(() => analyzingOrgId.value === orgStore.selectedOrg?.id);

const analyzedDate = computed(() => {
    const org = orgStore.selectedOrg;
    if (!org || org.analysisStatus !== 'complete') return null;
    const d = org.analysisStartedAt ? new Date(org.analysisStartedAt) : null;
    if (!d || isNaN(d)) return null;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
});

// ─── Lifecycle ──────────────────────────────────────────
onMounted(async () => {
    if (!orgStore.orgs.length) await orgStore.loadOrgs();

    const urlParams = new URLSearchParams(window.location.search);
    const autoAnalyzeOrgId = urlParams.get('autoAnalyzeOrgId');
    const oauthError = urlParams.get('oauthError');

    if (oauthError) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('oauthError');
        cleanUrl.searchParams.delete('autoAnalyzeOrgId');
        window.history.replaceState({}, '', cleanUrl);
        toast.add({ severity: 'error', summary: 'Authorization Failed', detail: oauthError, life: 8000 });

        if (autoAnalyzeOrgId) {
            const org = orgStore.orgs.find(o => o.id === autoAnalyzeOrgId);
            if (org) {
                skipNextOrgWatch = true;
                orgStore.setSelectedOrg(org);
            }
        }
    } else if (autoAnalyzeOrgId) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('autoAnalyzeOrgId');
        window.history.replaceState({}, '', cleanUrl);

        const org = orgStore.orgs.find(o => o.id === autoAnalyzeOrgId);
        if (org) {
            skipNextOrgWatch = true;
            orgStore.setSelectedOrg(org);
            doAnalysis();
        }
    } else if (orgStore.selectedOrg) {
        await checkOrgAnalysis(orgStore.selectedOrg.id);
    }
});

onUnmounted(() => {
    stopPolling();
});

let skipNextOrgWatch = false;
watch(() => orgStore.selectedOrg, async (org) => {
    if (skipNextOrgWatch) {
        skipNextOrgWatch = false;
        return;
    }
    resetState();
    if (org) await checkOrgAnalysis(org.id);
});

// ─── Org Actions ────────────────────────────────────────
function onAddOrg() {
    orgFormOrg.value = null;
    orgFormVisible.value = true;
}

function onEditOrg() {
    orgFormOrg.value = orgStore.selectedOrg;
    orgFormVisible.value = true;
}

function onOpenOrg() {
    if (orgStore.selectedOrg?.loginURL) {
        window.open(orgStore.selectedOrg.loginURL, '_blank', 'noopener,noreferrer');
    }
}

function onDeleteOrg() {
    const org = orgStore.selectedOrg;
    if (!org) return;
    confirm.require({
        message: `Are you sure you want to delete "${org.name}"? This cannot be undone.`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete',
        rejectLabel: 'Cancel',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                const success = await orgStore.deleteOrg(org.id);
                if (success) {
                    toast.add({ severity: 'success', summary: 'Deleted', detail: `${org.name} has been deleted.`, life: 3000 });
                } else {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete org.', life: 3000 });
                }
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to delete org.', life: 3000 });
            }
        },
    });
}

function onAnalyzeOrg() {
    const org = orgStore.selectedOrg;
    if (!org) return;
    confirm.require({
        message: "Analysis might take a while depending on your org's complexity. Proceed?",
        header: 'Confirm Analysis',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Proceed',
        rejectLabel: 'Cancel',
        acceptClass: 'p-button-primary',
        accept: () => {
            doAnalysis();
        },
    });
}
</script>

<template>
    <OAuthRedirectOverlay
        :show="showingOAuthOverlay"
        :orgName="oauthOrgName"
    />

    <div class="card flex items-center gap-3 pt-1"
         style="height:3rem; padding-bottom: 1rem; padding-top: 1rem; background:var(--surface-card); border-color:var(--surface-border)">

        <div class="flex items-center rounded-lg overflow-hidden shrink-0"
             style="border:1px solid var(--surface-border); height:2.5rem">
            <span class="flex items-center px-2.5 h-full text-xs font-semibold uppercase tracking-wide select-none whitespace-nowrap"
                  style="background:var(--surface-ground); border-right:1px solid var(--surface-border); color:var(--text-color-secondary)">
                Selected Org
            </span>

            <Select
                v-model="selectedOrg"
                :options="orgStore.orgs"
                optionLabel="name"
                placeholder="— none —"
                size="small"
                class="w-64"
                :pt="{ root: { style: 'border:none; box-shadow:none; border-radius:0' } }"
            />
        </div>

        <div class="flex items-center gap-1">
            <Button
                icon="pi pi-plus"
                rounded
                outlined
                raised
                size="small"
                severity="primary"
                v-tooltip.bottom="'Add org'"
                @click="onAddOrg"
            />
            <Button
                icon="pi pi-pencil"
                rounded
                outlined
                raised
                size="small"
                severity="info"
                v-tooltip.bottom="'Edit org'"
                :disabled="!selectedOrg"
                @click="onEditOrg"
            />
            <Button
                icon="pi pi-trash"
                rounded
                outlined
                raised
                size="small"
                severity="danger"
                v-tooltip.bottom="'Delete org'"
                :disabled="!selectedOrg && (isAnalyzing || checkingAnalysis)"
                @click="onDeleteOrg"
            />
            <Button
                icon="pi pi-external-link"
                rounded
                outlined
                raised
                severity="secondary"
                size="small"
                v-tooltip.bottom="'Open in Salesforce'"
                :disabled="!selectedOrg"
                @click="onOpenOrg"
            />
        </div>

        <!-- ANALYSIS -->
        <template v-if="selectedOrg">
            <span v-if="isAnalyzing || checkingAnalysis" class="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <ProgressSpinner
                    style="width:2rem;height:2rem"
                    strokeWidth="6"
                />
                {{ checkingAnalysis ? 'Checking…' : 'Analyzing…' }}
            </span>

            <Button v-else
                label="Analyze"
                icon="pi pi-chart-bar"
                size="small"
                raised
                v-tooltip.bottom="'Run org analysis'"
                @click="onAnalyzeOrg"
            />
            <span v-if="analyzedDate" class="flex items-center gap-1 text-xs whitespace-nowrap" style="color:var(--text-color-secondary)">
                Last analyzed on {{ analyzedDate }}
            </span>
        </template>
    </div>

    <OrgFormDialog v-model:visible="orgFormVisible" :org="orgFormOrg" />
</template>
