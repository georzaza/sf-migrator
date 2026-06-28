SELECT * FROM public."Users";
SELECT * FROM public."SfOrgs";
SELECT * FROM public."SfObjectMetadata";
SELECT * FROM public."SfFieldMetadata"  where name = 'ContactId';

SELECT orgs.name org, extractionstats.id, runid, objectname object, status, recordsexported, errormessage, startedat, stg1tablename, sourceobjectid objId, queryfilepath queryFile, csvfilepath csvFile, fieldsexported
FROM public.ext_00000000_0000_4000_8000_000000000100_extraction_stats extractionstats
JOIN public."SfObjectMetadata" objects
  ON (extractionstats.sourceobjectid = objects.id)
JOIN public."SfOrgs" orgs
  ON (objects."sfOrgId" = orgs.id)
ORDER BY extractionstats.objectname;


SELECT * FROM public.stg1_00000000_0000_4000_8000_000000000100_Account;
SELECT * FROM public.stg1_00000000_0000_4000_8000_000000000100_Asset;

SELECT fields."id", fields."objectMetadataId", fields."name", fields."type", fields."idLookup", fields."relationshipName", fields."referenceTo"
FROM public."SfFieldMetadata" fields
JOIN public."SfObjectMetadata" objects
  ON (objects."name" = 'Account') ;

SELECT
    users."username" user,
	users."id"		 userid						,
	orgs."name"      	org						,
	orgs."id"			orgId					,
	objects."name" 		    object				,
	objects."id" 		    objectId			,
    fields."id"                 field_id       ,
    fields."name"               field          ,
    fields."type"               field_Type     ,
    fields."idLookup"           field_Lookup   ,
    fields."relationshipName"   field_Rel      ,
    fields."referenceTo"        field_Ref       
FROM public."Users" "users"
JOIN public."SfOrgs" "orgs"
  ON (orgs."userId" = users."id"				and orgs."id"      = '00000000-0000-4000-8000-000000000000')
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId" 			and objects."name" = 'Account')
JOIN public."SfFieldMetadata" "fields"
  ON (fields."objectMetadataId" = objects."id")
ORDER BY object, org, user, field;