import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.create('filesystemService');

const fsp = fs.promises;


// save object describes under data/{orgid}/timestamp_objects.json
async function saveObjectDescribes(orgId, objectDescribes) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(__dirname, '..', '..', 'data', orgId);
    try {
        await fsp.mkdir(dir, { recursive: true });
        const filepath = path.join(dir, `${timestamp}_objects.json`);
        await fsp.writeFile(filepath, JSON.stringify(objectDescribes, null, 2), 'utf8');
        log.info('Object describes saved to file.', { orgId, filepath, count: objectDescribes.length });
        return filepath;
    } catch (err) {
        log.error('Error writing object describes to file.', err, { orgId, dir });
        throw err;
    }
}


// save field describes under data/{orgid}/timestamp_fields.json
async function saveFieldDescribes(orgId, fieldDescribes) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(__dirname, '..', '..', 'data', orgId);
    try {
        await fsp.mkdir(dir, { recursive: true });
        const filepath = path.join(dir, `${timestamp}_fields.json`);
        await fsp.writeFile(filepath, JSON.stringify(fieldDescribes, null, 2), 'utf8');
        log.info('Field describes saved to file.', { orgId, filepath, count: fieldDescribes.length });
        return filepath;
    } catch (err) {
        log.error('Error writing field describes to file.', err, { orgId, dir });
        throw err;
    }
}


export default {
    saveObjectDescribes,
    saveFieldDescribes,
}
