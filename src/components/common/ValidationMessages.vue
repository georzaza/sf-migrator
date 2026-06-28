<script setup>
/**
 * ValidationMessages - Renders a list of advisory validation warnings.
 *
 * Props:
 *   warnings - Array of { code, message, field? } objects
 *   severity - PrimeVue Message severity ('warn' | 'info' | 'error' | 'success')
 */
defineProps({
    warnings: {
        type: Array,
        default: () => [],
    },
    severity: {
        type: String,
        default: 'warn',
    },
});
</script>

<template>
    <div v-if="warnings && warnings.length" class="validation-messages">
        <Message
            v-for="(warning, index) in warnings"
            :key="`${warning.code || 'warning'}-${index}`"
            :severity="severity"
            :closable="false"
            class="validation-message"
        >
            {{ warning.message }}
        </Message>
    </div>
</template>

<style scoped>
.validation-messages {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.validation-message {
    margin: 0;
}
</style>
