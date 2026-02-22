export default function sendResponse(res, status, success, message, data = undefined) {
    const response = { success, message };
    if (data !== undefined) response.data = data;
    const requestId = res.getHeader('X-Request-ID');
    if (requestId) response.requestId = requestId;
    return res.status(status).json(response);
}
