------------------------------------------
----------      S E T   U P    -----------
------------------------------------------
-- CONNECT AS postgres USER AND EXECUTE:
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS schema1 CASCADE;
CREATE SCHEMA IF NOT EXISTS schema1 AUTHORIZATION postgres;
COMMENT ON SCHEMA schema1 IS 'standard public schema recreated with authorization to SU only';
GRANT ALL ON SCHEMA schema1 TO postgres;


-- create the admin role/user
CREATE ROLE sf_migrator WITH
  LOGIN
  NOSUPERUSER
  NOINHERIT
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 10
  PASSWORD '1199';

-- create a custom tablespace. Use the default 'data' psql installation dir
-- if pg_ctl or initdb were used to init the db, then use the folder provided in the -D arg
-- see more here: https://www.postgresql.org/docs/18/creating-cluster.html
CREATE TABLESPACE ts_sf_migrator OWNER sf_migrator LOCATION E'C:\\Users\\creat\\ProgramFiles\\PostgreSQL\\data';
ALTER TABLESPACE ts_sf_migrator OWNER TO sf_migrator;


CREATE DATABASE sf_migrator_dev WITH
    OWNER = sf_migrator
    ENCODING = 'UTF8'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = ts_sf_migrator
    CONNECTION LIMIT = 10
    IS_TEMPLATE = False;

CREATE DATABASE sf_migrator_test WITH
    OWNER = sf_migrator
    ENCODING = 'UTF8'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = ts_sf_migrator
    CONNECTION LIMIT = 10
    IS_TEMPLATE = False;

CREATE DATABASE sf_migrator_prod WITH
    OWNER = sf_migrator
    ENCODING = 'UTF8'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = ts_sf_migrator
    CONNECTION LIMIT = 10
    IS_TEMPLATE = False;

-- While on the SERVER, run `npm run fresh:<ENV>`. No DB seeds run for Production.
-- While on the SERVER, start the server with `npm run start:<ENV>`
-- While on the frontend, run `npm run preview` for a production build, `npm run dev` otherwise.


------------------------------------------
------------------------------------------
------------------------------------------



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



