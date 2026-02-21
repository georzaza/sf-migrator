/**
 * Build a tiny HTML page that postMessages a result to the opener window.
 * Falls back to a plain redirect if not opened as a popup.
 *
 * @param {object} messageObj  - Payload for postMessage (e.g. { type, message })
 * @param {string} fallbackUrl - URL to redirect to when there is no window.opener
 */
function popupResultHtml(messageObj, fallbackUrl) {
    const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const msgJson = JSON.stringify(messageObj);
    const fallbackJson = JSON.stringify(fallbackUrl);
    return `<!DOCTYPE html><html><head><title>Authorizing…</title></head><body>
        <script>
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage(${msgJson}, '${frontendOrigin}');
        } else {
            window.location.href = ${fallbackJson};
        }
        <\/script>
        <p style="font-family:sans-serif;text-align:center;margin-top:4rem">Completing authorization…</p>
        </body></html>`;
}

module.exports = popupResultHtml;
