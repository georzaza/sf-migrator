# Matching lookup fields to existing target records

In the parent object pair's **Migration Settings**, select **Match existing target
records**, then choose the source match field, target match field, and normalizer.
For example, match `User.Username` on both sides with **Local part (before @)** to
rewire `OwnerId` across orgs with different username domains. **Local part +
lowercase** also ignores case.

This setting is stored in `MigrationSetting.metadata.referenceResolution`:

```json
{
    "strategy": "match-existing",
    "sourceField": "Username",
    "targetField": "Username",
    "normalizer": "localPart"
}
```

Rerun extraction after changing this setting: it extracts the source parent's
`Id` and match field, even if that parent has no field mappings. During loading,
the target is queried once per match configuration and indexed by normalized
key. The parent pair is **not inserted or upserted**. Thus, configuring an Account
pair this way lets `Contact.AccountId` reference existing Accounts without
migrating Accounts.

Both sides use the same normalizer: `none` (exact match, default), `localPart`,
`lowercase`, or `localPartLowercase`. Blank keys, missing target records, and
duplicate normalized target keys cannot resolve; dependent child rows are
skipped with a lookup error. Null lookups remain null. Source extraction filters
still apply to parent rows. Configure only one match-existing target pair per
source parent in an org pair; conflicting pairs are rejected during resolution.
Without this setting (or with `strategy: "id-map"`), the existing load-time
record ID mapping remains unchanged.

# Installation

Feel free to ask me and I can temporarily deploy the app and have it running live on one of my servers, so you can avoid all installation & running steps altogether. 

The sections below are outdated and I haven't found the time to create a proper installation guide.

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
