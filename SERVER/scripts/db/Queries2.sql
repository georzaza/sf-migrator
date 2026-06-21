SELECT * FROM public."SfOrgs"
ORDER BY id ASC;

SELECT *
FROM public."SfObjectMetadata";

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