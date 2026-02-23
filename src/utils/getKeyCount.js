/**
 *  Counts the occurrences of a key in an array of objects.
 */
export function getKeyCount(data, key) {
    return data.reduce((acc, item) => {
        const keyValue = item[key];
        acc[keyValue] = (acc[keyValue] || 0) + 1;
        return acc;
    }, {});
}
