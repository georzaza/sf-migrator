const STORAGE_KEY = 'sf-migrator:migration-selection';

export function loadMigrationSelection() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return {
            sourceOrgId: parsed.sourceOrgId || null,
            targetOrgId: parsed.targetOrgId || null,
        };
    } catch {
        return { sourceOrgId: null, targetOrgId: null };
    }
}

export function saveMigrationSelection({ sourceOrgId = null, targetOrgId = null }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sourceOrgId, targetOrgId }));
}

export function findOrgById(orgs, id) {
    if (!id) return null;
    return (orgs || []).find((org) => String(org.id) === String(id)) || null;
}
