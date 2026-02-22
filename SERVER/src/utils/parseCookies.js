import logger from '../lib/logger.js';
const log = logger.create('parseCookies');

function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) {
        log.debug('No cookies found in request headers');
        return cookies;
    }

    const cookiePairs = cookieHeader.split(';');
    for (const pair of cookiePairs) {
        const [name, value] = pair.trim().split('=');
        cookies[name] = decodeURIComponent(value);
    }
    return cookies;
}

export default parseCookies;
