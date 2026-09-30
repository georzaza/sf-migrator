# Installation

1. Install node, postgres. A sample configuration is for the postgres db is provided in `SERVER/config/config.json`
2. Navigate to folder SERVER and run `npm install` 
3. Navigate back to root folder and run `npm install`
4. Ensure postgres server is running.
   - To start the server manually for the provided config, navigate to the Postgres installation `bin` directory and run
      - Windows: `pg_ctl.exe start -D ..\data -U postgres`


5.TODO UPDATE BASED ON NEW npm run AVAILABLE COMMANS Navigate to SERVER folder and
    - Migrate the tables: `npm run migrate`
    - Seed the db: `npm run seed `

6. TODO UPDATE Start the server by navigating to SERVER/src/ and running `node server.js`
7. TODO UPDATE Start the VUe frontend by navigating to root folder/src and running `npm run dev`
8. TODO UPDATE Visit localhost:5173 on the browser.


Feel free to contact me or raise an issue if you have trouble during the installation steps. 
You want to generally install postgresql and run `npm install` on both the 'src' and 'SERVER' folder.
`npm run` is then your guidance. 

The app is configured for production, so you might need to make a few minor changes to have it up and running on your local. 

Feel free to ask me and I can temporarily deploy it and have it running live on one of my servers, so you can avoid all installation & running steps altogether. 
