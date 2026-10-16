const NORMALIZERS = ['none', 'localPart', 'lowercase', 'localPartLowercase'];

function assertApiName(name) {
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`Invalid reference resolution API name: ${name}`);
    }
    return name;
}

function validateReferenceResolution(config) {
    if (!config || !['id-map', 'match-existing'].includes(config.strategy)) {
        throw new Error('Reference resolution strategy must be id-map or match-existing');
    }
    if (config.strategy === 'id-map') return { strategy: 'id-map' };
    const normalizer = config.normalizer ?? 'none';
    if (!NORMALIZERS.includes(normalizer)) throw new Error('Invalid reference resolution normalizer');
    return {
        strategy: 'match-existing',
        sourceField: assertApiName(config.sourceField),
        targetField: assertApiName(config.targetField),
        normalizer,
    };
}

function normalizeReferenceKey(value, normalizer = 'none') {
    if (!NORMALIZERS.includes(normalizer)) throw new Error('Invalid reference resolution normalizer');
    if (value === null || value === undefined || value === '') return null;
    let key = String(value);
    if (normalizer === 'localPart' || normalizer === 'localPartLowercase') key = key.split('@')[0];
    if (normalizer === 'lowercase' || normalizer === 'localPartLowercase') key = key.toLowerCase();
    return key === '' ? null : key;
}

async function buildTargetMatchIndex(conn, objectName, matchField, normalizer) {
    const stream = await conn.bulk2.query(`SELECT Id, ${assertApiName(matchField)} FROM ${assertApiName(objectName)}`);
    const index = new Map();
    for await (const row of stream) {
        const key = normalizeReferenceKey(row[matchField], normalizer);
        if (key === null || !row.Id) continue;
        // A duplicate key is deliberately unresolvable, never first/last-wins.
        index.set(key, index.has(key) ? null : row.Id);
    }
    return index;
}

export { assertApiName, validateReferenceResolution, normalizeReferenceKey, buildTargetMatchIndex };
