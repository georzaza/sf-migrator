/**
 * sfFieldMapper
 *
 * Single source of truth for salesforceService and DB.
 * DB columns are named exactly as the salesforceService returns them
 *
 * Note: 'isFormula' and 'isRollUpSummary' are GENERATED ALWAYS AS STORED
 */

/**
 * writable SfFieldMetadata columns except 'id' and 'objectMetadataId'.
 * Used as the updateOnDuplicate list in bulk upserts.
 */
const SF_FIELD_COLUMNS = [
    'name',
    'label', 'type', 'custom', 'autoNumber', 'unique', 'externalId',
    'picklistValues', 'restrictedPicklist', 'dependentPicklist',
    'calculated', 'calculatedFormula',
    'defaultedOnCreate', 'defaultValue', 'defaultValueFormula',
    'idLookup', 'relationshipName', 'referenceTo', 'nillable',
    'byteLength', 'length', 'digits', 'scale', 'precision',
    'encrypted', 'createable', 'updateable', 'compoundFieldName',
    'inlineHelpText', 'updatedAt',
];

/**
 * Maps a raw jsforce field descriptor to the normalised SfFieldMetadata shape.
 * @param {object} field  Raw field object from jsforce describe response.
 * @returns {object}      Normalised field data ready for DB insert/update.
 */
function mapSfField(field) {
    return {
        name:                field.name,
        label:               field.label,
        type:                field.type,
        custom:              field.custom              ?? null,
        autoNumber:          field.autoNumber          ?? null,
        unique:              field.unique              ?? null,
        externalId:          field.externalId          ?? null,
        picklistValues:      field.picklistValues?.length
                                ? field.picklistValues.map(p => ({ label: p.label, value: p.value, active: p.active }))
                                : null,
        restrictedPicklist:  field.restrictedPicklist  ?? null,
        dependentPicklist:   field.dependentPicklist   ?? null,
        calculated:          field.calculated          ?? null,
        calculatedFormula:   field.calculatedFormula   ?? null,
        defaultedOnCreate:   field.defaultedOnCreate   ?? null,
        defaultValue:        field.defaultValue != null ? String(field.defaultValue) : null,
        defaultValueFormula: field.defaultValueFormula ?? null,
        idLookup:            field.idLookup            ?? null,
        relationshipName:    field.relationshipName    ?? null,
        referenceTo:         field.referenceTo?.length ? field.referenceTo : null,
        nillable:            field.nillable            ?? null,
        byteLength:          field.byteLength          ?? null,
        length:              field.length              ?? null,
        digits:              field.digits              ?? null,
        scale:               field.scale               ?? null,
        precision:           field.precision           ?? null,
        encrypted:           field.encrypted           ?? null,
        createable:          field.createable          ?? null,
        updateable:          field.updateable          ?? null,
        compoundFieldName:   field.compoundFieldName   ?? null,
        inlineHelpText:      field.inlineHelpText      ?? null,
    };
}

module.exports = { mapSfField, SF_FIELD_COLUMNS };
