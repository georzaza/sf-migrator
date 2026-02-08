SELECT *
FROM public."SfOrgs"
ORDER BY "projectId", id ASC;

SELECT *
FROM public."Projects"
ORDER BY "userId", id ASC;

SELECT *
FROM public."Users"
ORDER BY id ASC;

-- GROUP objects per org
SELECT COUNT("id"), "sfOrgId"
FROM public."SfObjectMetadata"
GROUP BY "sfOrgId"
;

-- ALL fields, objects, orgs
SELECT
	orgs."id" orgid,
	orgs."name" orgname,
	objects."objectName",
	fields."fieldName",
	fields."dataType"
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
	objects."objectName" object,
	fields."fieldName" field
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
	objects."objectName",
	fields."fieldName"
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
	objects."objectName" object
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

