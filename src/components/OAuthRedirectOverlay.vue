<script setup>
defineProps({
    show:    { type: Boolean, default: false },
    orgName: { type: String,  default: 'this org' },
});
</script>

<template>
    <Teleport to="body">
        <Transition name="oauth-fade">
            <div v-if="show" class="sf-oauth-overlay">
                <div class="sf-oauth-card">
                    <div class="sf-oauth-icon">&#128274;</div>
                    <h3 class="sf-oauth-title">Redirecting to Salesforce</h3>
                    <p class="sf-oauth-body">
                        Please complete the Salesforce authorization in the popup window for
                        <strong>{{ orgName }}</strong>.
                        This page will continue automatically once authorization is complete.
                    </p>
                    <div class="sf-oauth-hint">Waiting for authorization…</div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.sf-oauth-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
}

.sf-oauth-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2.5rem 3rem;
    max-width: 440px;
    text-align: center;
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e5e7eb);
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.18);
}

.sf-oauth-icon {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    background: var(--p-primary-50, #eff6ff);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    color: var(--p-primary-500, #3b82f6);
}

.sf-oauth-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-color, #111827);
}

.sf-oauth-body {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--text-color-secondary, #6b7280);
}

.sf-oauth-hint {
    opacity: 0.6;
    font-size: 0.85rem;
    color: var(--text-color-secondary, #6b7280);
}

/* Fade + slight scale-up on enter, fade-out on leave */
.oauth-fade-enter-active,
.oauth-fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}
.oauth-fade-enter-from,
.oauth-fade-leave-to {
    opacity: 0;
    transform: scale(0.97);
}
</style>
