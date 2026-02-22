
SELECT * FROM public."Users" ORDER BY id ASC;

SELECT * FROM public."Projects" ORDER BY "userId", id ASC;

SELECT * FROM public."SfOrgs" ORDER BY "projectId", id ASC;


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
	projects."name" project,
	orgs."name" org,
	objects."name" object,
	fields."name" field
FROM public."Users" "users"
JOIN public."Projects" 	"projects"
  ON (users."id" = projects."userId")
JOIN public."SfOrgs" "orgs"
  ON (orgs."projectId"=projects."id")
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId")
JOIN public."SfFieldMetadata" "fields"
  ON (fields."objectMetadataId" = objects."id")
GROUP BY
	users."username",
	projects."name",
	orgs."name",
	objects."name",
	fields."name"
;

-- GROUP objects per org, project, user
SELECT
    count(*) totalObjects,
    users."username" user,
	projects."name" project,
	orgs."name" org
FROM public."Users" "users"
JOIN public."Projects" 	"projects"
  ON (users."id" = projects."userId")
JOIN public."SfOrgs" "orgs"
  ON (orgs."projectId"=projects."id")
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId")
GROUP BY
	users."id",
	projects."id",
	orgs."id"
;

-- GROUP fields per object, org, project, user
SELECT
    count(*) totalFields,
    users."username" user,
	projects."name" project,
	orgs."name" org,
	objects."name" object
FROM public."Users" "users"
JOIN public."Projects" 	"projects"
  ON (users."id" = projects."userId")
JOIN public."SfOrgs" "orgs"
  ON (orgs."projectId"=projects."id")
JOIN public."SfObjectMetadata" "objects"
  ON (orgs."id" = objects."sfOrgId")
JOIN public."SfFieldMetadata" "fields"
  ON (fields."objectMetadataId" = objects."id")
GROUP BY
	users."id",
	projects."id",
	orgs."id",
	objects."id"
ORDER BY object, org, project, user;




-----------------------------------
-----------------------------------
-----------------------------------

-- INDEXes
SELECT schemaname, tablename, indexname
FROM pg_indexes;

--
DROP INDEX IF EXISTS "unique_org_object";
drop index if exists "sf_object_metadata_sf_org_id";
