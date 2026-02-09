<script setup>
const currentYear = new Date().getFullYear();
</script>

<template>
    <div class="layout-footer">
        <div class="footer-content">
            <span class="footer-text">
                © {{ currentYear }} SF Migrator. Developed by
                <a href="mailto:georzaza@gmail.com" class="footer-link">George Zazanis</a>
            </span>
            <span class="footer-divider">|</span>
            <span class="footer-text">Salesforce Data Migration Tool</span>
        </div>
    </div>
</template>

<style scoped>
.layout-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
}

.footer-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
}

.footer-text {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
}

.footer-link {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s;
}

.footer-link:hover {
    color: var(--primary-color);
    text-decoration: underline;
}

.footer-divider {
    color: var(--surface-border);
    font-size: 0.875rem;
}

@media (max-width: 768px) {
    .footer-content {
        flex-direction: column;
        gap: 0.25rem;
    }

    .footer-divider {
        display: none;
    }
}
</style>
