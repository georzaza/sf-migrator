function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) {
        console.warn('parseCookies | No cookies found in request headers.');
        return cookies;
    }

    const cookiePairs = cookieHeader.split(';');
    for (const pair of cookiePairs) {
        const [name, value] = pair.trim().split('=');
        cookies[name] = decodeURIComponent(value);
    }
    return cookies;
}

module.exports = parseCookies;
