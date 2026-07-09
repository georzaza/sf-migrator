/**
 * SourceObject Extract Filter service.
 *
 * The extract filter is a property of a *source object* (it controls which
 * records are pulled from the source org during extraction). It is intentionally
 * NOT per (source, target) pair: the same source object is extracted once per
 * run regardless of how many target objects consume its data.
 */

import metadataRepo from '../repositories/metadataRepository.js';
import logger from '../lib/logger.js';

const log = logger.create('sourceObjectFilterService');

function sanitizeFilter(raw) {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim();
    if (!text) return null;
    if (text.length > 4000) {
        throw new Error('extractFilter exceeds 4000 characters');
    }
    if (text.includes(';')) {
        throw new Error('extractFilter must not contain ";"');
    }
    return text;
}

async function getExtractFilter(sourceObjectId) {
    if (!sourceObjectId) throw new Error('sourceObjectId is required');
    const obj = await metadataRepo.findObjectById(sourceObjectId);
    if (!obj) throw new Error(`Source object not found: ${sourceObjectId}`);
    return obj.extractFilter ?? null;
}

async function setExtractFilter(sourceObjectId, rawFilter) {
    if (!sourceObjectId) throw new Error('sourceObjectId is required');
    const obj = await metadataRepo.findObjectById(sourceObjectId);
    if (!obj) throw new Error(`Source object not found: ${sourceObjectId}`);
    const clean = sanitizeFilter(rawFilter);
    await metadataRepo.updateObjectExtractFilter(sourceObjectId, clean);
    log.info('Source object extract filter saved', { sourceObjectId, hasFilter: clean !== null });
    return clean;
}

export default {
    getExtractFilter,
    setExtractFilter,
};
