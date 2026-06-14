# Installation

1. Install node, postgres. A sample configuration is for the postgres db is provided in `SERVER/config/config.json`
2. Navigate to folder SERVER and run `npm install` 
3. Navigate back to root folder and run `npm install`
4. Ensure postgres server is running.
   - To start the server manually for the provided config: 
      - Windows: `pg_ctl.exe start -D ..\data -U postgres`


5.TODO UPDATE BASED ON NEW npm run AVAILABLE COMMANS Navigate to SERVER folder and
    - Migrate the tables: `npm run migrate`
    - Seed the db: `npm run seed `

6. Start the server by navigating to SERVER/src/ and running `node server.js`
7. Start the VUe frontend by navigating to root folder/src and running `npm run dev`
8. Visit localhost:5173 on the browser.
