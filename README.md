# Installation

1. Install node, postgres. A sample configuration is for the postgres db is provided in `SERVER/config/config.json`
2. Navigate to folder SERVER and run `npm install` 
2. Navigate back to root folder and run `npm install`
3. Ensure postgres server is running. 
 - To start the server manually for the provided config: 
    - Windows: `pg_ctl.exe start -D ..\data -U postgres`

4. Navigate to SERVER folder and
    - Migrate the tables: `npm run migrate`
    - Seed the db: `npm run seed `
