/**
 * sfObjectMapper
 *
 * Single source of truth for mapping a raw jsforce SObject descriptor to the
 * normalised shape stored in SfObjectMetadata.
 *
 * Works with both describeGlobal() (limited fields) and full describe() responses —
 * any missing properties default to null.
 */

/**
 * All writable SfObjectMetadata columns except 'id', 'sfOrgId', 'recordCount',
 * and 'lastAnalyzed' (those are managed separately by the repository).
 * Used as the updateOnDuplicate list in bulk upserts.
 */
const SF_OBJECT_COLUMNS = [
    'name', 'label', 'labelPlural', 'custom', 'customSetting', 'keyPrefix',
    'recordTypeInfos', 'updatedAt',
];

/**
 * Maps a raw jsforce SObject descriptor to the normalised SfObjectMetadata shape.
 * @param {object} obj  Raw SObject from jsforce describeGlobal or describe response.
 * @returns {object}    Normalised object data ready for DB insert/update.
 */
function mapSfObject(obj) {
    return {
        name:            obj.name,
        label:           obj.label,
        labelPlural:     obj.labelPlural     ?? null,
        custom:          obj.custom          ?? null,
        customSetting:   obj.customSetting   ?? null,
        keyPrefix:       obj.keyPrefix       ?? null,
        recordTypeInfos: obj.recordTypeInfos?.length
            ? obj.recordTypeInfos.map(r => ({
                name:          r.name,
                developerName: r.developerName,
                active:        r.active,
                master:        r.master,
                recordTypeId:  r.recordTypeId,
            }))
            : null,
    };
}

export { mapSfObject, SF_OBJECT_COLUMNS };
