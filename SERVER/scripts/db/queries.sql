
SELECT * FROM public."Users" ORDER BY id ASC;

SELECT * FROM public."SfOrgs" ORDER BY "userId", id ASC;

SELECT "id", "analysisStatus" from public."SfOrgs" WHERE "id" = '00000000-0000-4000-8000-000000000010';

UPDATE public."SfOrgs" SET "analysisStatus"='idle' WHERE "id" = '00000000-0000-4000-8000-000000000010';
UPDATE public."SfOrgs" SET "analysisStatus"='idle' WHERE "id" = '00000000-0000-4000-8000-000000000110';

UPDATE public."SfOrgs" SET "analysisStatus"='idle';

-- GROUP objects per org
SELECT COUNT("id"), "sfOrgId"
FROM public."SfObjectMetadata"
GROUP BY "sfOrgId"
;

-- ALL fields, objects, orgs
SELECT
	orgs."id" orgid,
	orgs."name" orgname,
	objects."name",
	fields.*
FROM public."SfOrgs" "orgs"
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId")
JOIN public."SfFieldMetadata" "fields"
  ON (fields."objectMetadataId" = objects."id")
;


-- GROUP / SELECT ALL
SELECT
    count(*),
    users."username" user,
	orgs."name" org,
	objects."name" object,
	fields."name" field
FROM public."Users" "users"
JOIN public."SfOrgs" "orgs"
  ON (orgs."userId" = users."id")
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId")
JOIN public."SfFieldMetadata" "fields"
  ON (fields."objectMetadataId" = objects."id")
GROUP BY
	users."username",
	orgs."name",
	objects."name",
	fields."name"
;

-- GROUP objects per org, user
SELECT
    count(*) totalObjects,
    users."username" user,
	orgs."name" org
FROM public."Users" "users"
JOIN public."SfOrgs" "orgs"
  ON (orgs."userId" = users."id")
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId")
GROUP BY
	users."id",
	orgs."id"
;

-- GROUP fields per object, org, user
SELECT
    count(*) totalFields,
    users."username" user,
	orgs."name" org,
	objects."name" object
FROM public."Users" "users"
JOIN public."SfOrgs" "orgs"
  ON (orgs."userId" = users."id")
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId")
JOIN public."SfFieldMetadata" "fields"
  ON (fields."objectMetadataId" = objects."id")
GROUP BY
	users."id",
	orgs."id",
	objects."id"
ORDER BY object, org, user;




-----------------------------------
-----------------------------------
-----------------------------------

-- INDEXes
SELECT schemaname, tablename, indexname
FROM pg_indexes;

--
DROP INDEX IF EXISTS "unique_org_object";
drop index if exists "sf_object_metadata_sf_org_id";
