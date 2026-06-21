import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.create('filesystemService');

const fsp = fs.promises;


// save stats under data/{orgid}/timestamp_stats.json
async function saveOrgStatsToFile(orgId, stats) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(__dirname, '..', '..', 'data', orgId);
    try {
        await fsp.mkdir(dir, { recursive: true });
        const filepath = path.join(dir, `${timestamp}_stats.json`);
        await fsp.writeFile(filepath, JSON.stringify(stats, null, 2), 'utf8');
        log.info('Org stats saved to file.', { orgId, filepath });
        return filepath;
    } catch (err) {
        log.error('Error writing stats to file.', { orgId, dir, error: err });
        throw err;
    }
}


// retrieves the latest stats file for an org
async function getLatestOrgStats(orgId) {
    const dir = path.join(__dirname, '..', '..', 'data', orgId);
    try {
        const files = await fsp.readdir(dir);
        const statsFiles = files.filter(f => f.endsWith('_stats.json'));
        if (statsFiles.length === 0) {
            log.warn('No stats files found for org.', { orgId, dir });
            return null;
        }
        const latestFile = statsFiles.sort().reverse()[0];
        const filepath = path.join(dir, latestFile);
        const data = await fsp.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            log.warn('No stats directory found for org.', { orgId, dir });
            return null;
        }
        log.error('Error reading latest stats file.', { orgId, dir, error: err });
        throw err;
    }
}


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
    saveOrgStatsToFile,
    getLatestOrgStats,
    saveObjectDescribes,
    saveFieldDescribes,
}
