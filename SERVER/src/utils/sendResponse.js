function sendResponse(res, status, success, message, data = undefined) {
    const response = { success, message };
    if (data !== undefined) response.data = data;
    return res.status(status).json(response);
}

module.exports = sendResponse;
