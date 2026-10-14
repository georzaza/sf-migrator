##   0. UX
###  0.1.    User selects one source and one target org.
###  0.2.    User selects the object to work with / migrate.
###  0.2.1   User selects any filter criteria to be applied in the source object for the extraction.
###  0.2.2   User creates the mappings. Have an auto-map option?
#### 0.2.2.1 The app stores which fields are mapped so that the extraction SOQL is later generated.
###  0.2.3   User selects how the operation should happen for that object (insert / update / upsert)
If update/upsert, the app checks if there exists a mapping with a target ext id field.
If not, prompts the user to map one and displays the valid external ids on target.
The user must have an option to either 
- map to a source external Id,  
- map to a combination of other source fields   

## 

##  1 Extraction

### 1.1 Extract and store to STG1 table

redis + bullqm put the migration in the queue.
redis + bullqm start the extraction jobs for migrationJob1

extractionJob1 belongs to migrationJob1.
We start the job by passing the orgId.
The job should take care of saving the data to DB, by ensuring it stores the orgid and it's uuid.
**If the extraction involves millions of records, it would take a lot of memory for the redis job to stay on memory. Need to read Bulk API extraction on how to implement this. Maybe use Dataloader instead of this complex job framework?**


account - STG1 - extraction
────────────────────────────────────────────────────────────────────────────
   jobId   |  orgId  | Operation | AccId |  accName | srcField  |  srcExtId
extrctJob1 | srcOrg1 |  upsert   |  id1  |   name1  | YYY1M1DD  |  1
extrctJob1 | srcOrg1 |  upsert   |  id2  |   name2  | YYY2M2DD  |  2
extrctJob2 | srcOrg1 |  upsert   |  id3  |   name3  | YYY3M3DD  |  null
extrctJob2 | srcOrg1 |  upsert   |  id4  |   name4  | errordata |  4
────────────────────────────────────────────────────────────────────────────

account - STG2 - before transformations. If operation is update/upsert, we need to pass the target's external Id field to the job.
───────────────────────────────────────────────────────────────────────────────────────────────────
   jobId   |  orgId  | Operation | AccId |  accName | srcField  | srcExtId | tgtField1 | tgtField2 
extrctJob1 | srcOrg1 |  upsert   |  id1  |   name1  | YYY1M1DD  |     1    |   null    |     null  
extrctJob1 | srcOrg1 |  upsert   |  id2  |   name2  | YYY2M2DD  |     2    |   null    |     null  
extrctJob2 | srcOrg1 |  upsert   |  id3  |   name3  | YYY3M3DD  |   null   |   null    |     null  
extrctJob2 | srcOrg1 |  upsert   |  id4  |   name4  | errordata |     4    |   null    |     null  
───────────────────────────────────────────────────────────────────────────────────────────────────

account - STG2 - after transformations
───────────────────────────────────────────────────────────────────────────────────────────────────────────────
   jobId   |  orgId  | Operation | AccId |  accName | srcField  | srcExtId | tgtField1 | tgtField2 | hasError |
extrctJob1 | srcOrg1 |  upsert   |  id1  |   name1  | YYY1M1DD  |     1    |   null    |     null  | false    |
extrctJob1 | srcOrg1 |  upsert   |  id2  |   name2  | YYY2M2DD  |     2    |   null    |     null  | false    |
extrctJob2 | srcOrg1 |  upsert   |  id3  |   name3  | YYY3M3DD  |   null   |   null    |     null  | true     |
extrctJob2 | srcOrg1 |  upsert   |  id4  |   name4  | errordata |     4    |   null    |     null  | true     |
───────────────────────────────────────────────────────────────────────────────────────────────────────────────


##  2. Pre-processing and validation

##  3. Transformation
### 3.1 Apply transformation rules
### 3.2 Report errors to users and let them adjust transformation rules


##  4 Load
### 4.1 prepare csv
### 4.2 give users the option of reviewing the csvs to be loaded and update them (e.g. remove rows)
### 4.2 push to salesforce
### 4.3 monitor jobs completion


##  5. Reporting
### 5.1 Validate all records were migrated
### 5.2 Generate Success & Error logs


create generic rate limiter framework for requests. 
create generic function for composite API.
get record counts with the Composite API and rate limiter.

Based on record count, we decide how to export. Create functions for both
Option 1: normal export
Option 2: Bulk API 2.0



Create a function for each endpoint of Bulk API:
1. Start a job
    POST /services/data/vXX.X/jobs/query with authentication bearer
    Request
        {
            "operation" : "query",
            "query" : "SELECT Id FROM Account",
            "contentType" : "CSV",
            "columnDelimiter" : "CARET",
            "lineEnding" : "CRLF"
        }
    Response
        {
            "id" : "750R0000000zlh9IAA",
            "operation" : "query",
            "object" : "Account",
            "createdById" : "005R0000000GiwjIAC",
            "createdDate" : "2018-12-10T17:50:19.000+0000",
            "systemModstamp" : "2018-12-10T17:50:19.000+0000",
            "state" : "UploadComplete",
            "concurrencyMode" : "Parallel",
            "contentType" : "CSV",
            "apiVersion" : 46.0,
            "lineEnding" : "LF",
            "columnDelimiter" : "COMMA"
        }

2. Query the job
    GET /services/data/vXX.X/jobs/query/queryJobId
    https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/query_get_one_job.htm

3. Get the results once completed - serially
    GET /services/data/vXX.X/jobs/query/queryJobId/results
    GET /services/data/vXX.X/jobs/query/queryJobId/results?locator=locator&maxRecords=maxRecords
    The job must have the state jobComplete.
    get the Sforce-NumberOfRecords from response header. 
    get the Sforce-Locator from response. If not null, use it to get the next records.

3. Get the results once completed - in parallel
    GET /services/data/vXX.X/jobs/query/queryJobId/resultPages
    Returns up to five URIs in one response to use to get results for a query job. The job must have the state jobComplete.
    Check done - if true then stop. 
    Response:
     {"resultPages": [
            {  "resultUrl": "/services/data/vXX.X/jobs/query/750R0000000zxr8IAA/results?locator=aBcDeFg4N"  },
            {  "resultUrl": "/services/data/vXX.X/jobs/query/750R0000000zxr8IAA/results?locator=HiJkLmN4N"  },
            {  "resultUrl": "/services/data/vXX.X/jobs/query/750R0000000zxr8IAA/results?locator=oPQrStU4N"  },
            {  "resultUrl": "/services/data/vXX.X/jobs/query/750R0000000zxr8IAA/results?locator=vWxYzz4N"   },
            {  "resultUrl": "/services/data/vXX.X/jobs/query/750R0000000zxr8IAA/results?locator=NiKmABC4N"  }
        ],
        "nextRecordsUrl": "/services/data/vXX.X/jobs/query/750R0000000zxr8IAA/resultpages?locator=YcApWm4N",
        "done": false -- if true then stop
    }

4. optionally create a function that will retrieve info on all bulk query jobs:
    /services/data/vXX.X/jobs/query, returns the jobs in the array "records", the "nextRecordsUrl" and "done".

5. make all Bulk API query functions work with gzip compression.

6. create function for bulk api ingest jobs
    one batch per 10000 records is created.
    If Salesforce can’t process all the records in a batch within 5 minutes, the batch fails.
    Up to 20 retries
    If 20 retries fail, the entire ingest job becomes Failed and rest of the data isn’t processed.
    
7. create function that prepares a csv
    Each field-name header in the file must be the same as the field’s Field Name (for standard fields) or API Name (for custom fields).
    Files must be in UTF-8 format and not exceed 100MB
    Use correct line ending and delimiter.
    Double quotes if the actual data contains the delimiter.
    To set a field value to null, use a field value of #N/A.

8. create function to start the ingest job
    https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/create_job.htm#upload_multipart
    REQUEST
    {
        "object" : "Contact",
        "contentType" : "CSV",
        "operation" : "upsert",
        "externalIdFieldName" : "ExternalId__c"
    }

9. create function to upload the data
    PUT /services/data/vXX.X/jobs/ingest/jobID/batches
    Returns a status code of 201

10. create function to lock the job before starting
    PATCH /services/data/vXX.X/jobs/ingest/jobID
    body {state: UploadComplete}

11. create function to pool the ingest job
    GET /services/data/vXX.X/jobs/ingest/jobID

12. create function to get successes
    GET /services/data/vXX.X/jobs/ingest/jobID/successfulResults/
    https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/get_job_successful_results.htm

13. create function to retrieve failures
    GET /services/data/vXX.X/jobs/ingest/jobID/failedResults/
    https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/get_job_failed_results.htm

14. create function to retrieve failures
    GET /services/data/vXX.X/jobs/ingest/jobID/unprocessedrecords/
    https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/get_job_unprocessed_results.htm

15. create function to get info on all ingest jobs
    GET /services/data/vXX.X/jobs/ingest
    https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/get_all_jobs.htm

16. create an orchestrator function for bulk query jobs. Execute them in parallel.

17. create an orchestrator function for bulk ingest jobs.

19. create a dependency graph based on the saved mappings to be applied.

18. create mappings table (belongs to migration job?)

19. create a table for mapping ids

20. create a jobs table 

21. create a migration job table (master of jobs)

user should first select what objects & fields they need from source. 
once selected and confirmed -> they can go to the extraction screen that will display the extraction jobs. Once confirmed, a migration job id is created.
once the extractions are completed -> they can go to the mapping screen where they can define their mappings.
If they forgot e.g. a field, add button where they can add additional fields to extract
create functions for each transformation that will be allowed, e.g. concat fields, split text, toText, etc
validate their mapping is correct before saving by defining mapping rules, e.g. validate fields' byteLength allows the mapping.
save the mapping to the db, link it to the migration job id.

The tables approach is not robust. If an object has 300 fields, then a table with 300+ fields will be created?
we need to field data as json. 
maybe a table with with JSON columns extracted_data, transformed_data, load_data, (boolean) hasError -> for each row to be processed  ? 
