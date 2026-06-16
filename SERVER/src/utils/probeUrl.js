import https from 'https';
import http from 'http';

/**
 * Quick HTTP probe: resolves true if the given URL returns any HTTP response
 * within the timeout (default 6s). Resolves false on connection error, DNS
 * failure, timeout, or non-HTTP schemes.
 */
function probeUrl(rawUrl, timeoutMs = 6000) {
    return new Promise((resolve) => {
        let parsed;

        try { parsed = new URL(rawUrl); }
        catch { return resolve(false); }

        const lib = parsed.protocol === 'https:' ? https : http;

        const req = lib.request(
            {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: '/',
                method: 'HEAD',
                timeout: timeoutMs
            },
            () => {
                req.destroy();
                resolve(true);
            }
        );

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.end();
    });
}

export default probeUrl;
