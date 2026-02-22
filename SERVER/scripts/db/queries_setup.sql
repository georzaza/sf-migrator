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


CREATE DATABASE sf_migrator_dev WITH
    OWNER = sf_migrator
    ENCODING = 'UTF8'
    LOCALE_PROVIDER = 'libc'
    CONNECTION LIMIT = 10
    IS_TEMPLATE = False;

CREATE DATABASE sf_migrator_test WITH
    OWNER = sf_migrator
    ENCODING = 'UTF8'
    LOCALE_PROVIDER = 'libc'
    CONNECTION LIMIT = 10
    IS_TEMPLATE = False;

CREATE DATABASE sf_migrator_prod WITH
    OWNER = sf_migrator
    ENCODING = 'UTF8'
    LOCALE_PROVIDER = 'libc'
    CONNECTION LIMIT = 10
    IS_TEMPLATE = False;

