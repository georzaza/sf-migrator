class Tooltips {
    constructor() {
        this.platformTooltips = this.initializePlatformTooltipsMap();
    }

    initializePlatformTooltipsMap() {
        const platformTooltips = {
            customObjectsInTheOrg : {
                title: "Custom Objects",
                description: "",
                insights: "Indication of the data model customization beyond standard Salesforce functionality. Each custom object should be evaluated to determine the necessity of bringing it over to the new org.",
                unitMeasure: "",
                key: "number-of-custom-objects",
            },
            customFields : {
                title: "Custom Fields",
                description: "",
                insights: "Number of custom fields created under any standard or custom objects. Each custom field should be evaluated to determine the necessity of bringing it over to the new org.",
                unitMeasure: "",
                key: "number-of-custom-fields",
            },
            recordTypes : {
                title: "Custom Record Types",
                description: "",
                insights: "The number of custom record types reflects the level of business process differentiation and data categorization within the org. It is recommended to evaluate each record type to determine whether it represents a genuine business requirement or you can leverage those provided by the IQVIA OCE Personal package. A review should establish clear criteria for when new record types are justified versus leveraging existing functionality to meet business needs like Dynamic Forms.",
                unitMeasure: "",
                key: "number-of-custom-record-types-per-object",
            },
            apexTriggersOrg : {
                title: "Apex Triggers",
                description: "",
                insights: "Triggers represent custom code that executes before or after specific database events on Salesforce objects. Each trigger should be evaluated as it might have dependencies with other metadata components and could require refactoring to fit the new org's data model or leverage new platform features.",
                unitMeasure: "",
                key: "top-apex-trigger-executed",
            },
            apexClassesOrg : {
                title: "Custom Apex Classes",
                description: "",
                insights: "Custom code developed in Apex that may serve the purposes of flows, triggers and other functions. Each class should be evaluated to determine whether it represents a critical function that needs to be migrated, or if it can be retired or replaced with out-of-the-box features in the new org.",
                unitMeasure: "",
                key: "top-apex-trigger-per-average-runtime",
            },
            customLWCs : {
                title: "LWCs",
                description: "",
                insights: "Custom Lightning Web Components indicate specialized user interface implementations that go beyond standard Salesforce functionality. It is recommended to assess whether this level of customization will be required in the org.",
                unitMeasure: "",
                key: "top-apex-trigger-per-average-runtime",
            },
            customApexPages : {
                title: "Visualforce Pages",
                description: "",
                insights: "Visualforce Pages represent legacy custom user interface solutions that may need to be substituted. It is recommended to evaluate whether these pages serve critical functions or if they can be replaced with Lightning Web Component / Flow capabilities.",
                unitMeasure: "",
                key: "top-apex-trigger-per-average-runtime",
            },
            aura : {
                title: "Aura Components",
                description: "",
                insights: "The use of Aura Components should be minimized in favor of Lightning Web Components (LWCs), which provide better performance, modern standards, and improved maintainability. If Aura Components are still in use, it is recommended to review their necessity and consider a migration plan to LWC where applicable.",
                unitMeasure: "",
                key: "top-apex-trigger-per-average-runtime",
            },
            flows : {
                title: "Flows",
                description: "",
                insights: "The number of Flows in the org. Includes out-of-the-box flows provided by Salesforce upon on the org's creation and any custom Flows that are in an Active status. Has dependencies on custom objects and fields, record types, custom metadata, custom settings and Apex code.",
                unitMeasure: "",
                key: "number-of-custom-flows-per-type",
            },
            activeProcessBuilders : {
                title: "Active Process Builders",
                description: "",
                insights: "Active Process Builders represent a deprecated automation mechanism that requires migration planning.",
                unitMeasure: "",
                key: "",
            },
            activeWorkflowRules : {
                title: "Active Workflow Rules",
                description: "",
                insights: "Active Workflow Rules represent a deprecated automation mechanism that requires migration planning.",
                unitMeasure: "",
                key: "",
            },
            ApexUnexpectedExceptions : {
                title: "Apex Unexpected Exceptions",
                description: "",
                insights: "Apex Unexpected Exceptions indicate potential code instability and error handling issues within custom development. It is recommended to analyze the root causes of these exceptions to identify critical bugs, refactoring needs, or areas where additional error handling should be implemented to improve code robustness and reliability.",
                unitMeasure: "",
                key: "queued-execution",
            },
            dataStorage : {
                title: "Data Storage used %",
                description: "",
                insights: "While planning the migration, it is critical to utilize appropriate extraction filters to avoid bringing over redundant data. Data archiving strategies for non-required data should be considered, to free up storage and reduce migration complexity, while ensuring data retention policies compliance.",
                unitMeasure: "",
                key: "top-apex-trigger-per-average-runtime",
            },


            apexClasses : {
                title: "Apex Classes # of executions vs. runtime",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "top-apex-trigger-per-average-runtime"
            },
            topRestApiRuntime : {
                title: "Top 5 ApexRestAPI per Average run time",
                description: "",
                insights: "",
                unitMeasure: " ms",
                key: "top-5-rest-api-per-average-runtime"
            },
            apexREST : {
                title: "Apex Rest API  # of executions vs. runtime",
                description: "",
                insights: "",
                unitMeasure: " ms",
                key: "top-5-rest-api-per-average-runtime"
            },
            topSoapAPIRuntime : {
                title: "Top 5 ApexSOAPAPI per Average run time",
                description: "",
                insights: "",
                unitMeasure: " ms",
                key: "top-5-soap-api-per-average-runtime"
            },
            soapApiExecution : {
                title: "ApexSOAPAPI # of execution",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "soap-api-execution"
            },
            apexSOAP : {
                title: "Apex SOAP API  # of executiions vs. runtime",
                description: "",
                insights: "",
                unitMeasure: " ms",
                key: "soap-api-execution"
            },
            topQueuedExecutionRuntime : {
                title: "Top 5 QueuedExecution per #  Average run time",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "top-5-queued-execution-per-average-runtime"
            },
            queuedExecution : {
                title: "Number of Queued Execution",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "queued-execution"
            },
            topExecutionErrors : {
                title: "Top 10 Apex unexpected Exceptions",
                description: "",
                insights: "",
                unitMeasure: "",
                key: ""
            },
            sObjectsLimitsCovered : {
                title: "",
                description: "",
                insights: "",
                unitMeasure: "",
                key: ""
            },
            topLimitsReachedUsage : {
                title: "Top 5 Limits reached 70% of usage",
                description: "",
                insights: "Hitting these limits could prevent the normal flow of execution.",
                unitMeasure: "",
                key: "top-5-limits-reached"
            },
            topObjectsPerLimitsCovered : {
                title: "Top 10 objects per Limits per % covered",
                description: "",
                insights: "Might hint over-customizations or possible data model complexity.",
                unitMeasure: "",
                key: "top-5-objects-per-limits"
            },
            topEntitlements : {
                title: "Top 5 Entitlements per % used",
                description: "and also a description",
                insights: "",
                unitMeasure: "",
                key: "top-5-entitlements"
            },
            topStorage : {
                title: "Storage (Top 10 Objects)",
                description: "",
                insights: "",
                unitMeasure: "",
                key: ""
            },
            dailyApiRequests : {
                title: "Daily Api Requests",
                description: "",
                insights: "",
                unitMeasure: "",
                key: ""
            },
            dangerousProfiles : {
                title: "Risk Profiles and Permission Sets",
                description: "Identification of Risk Profiles and Permission Sets to evalute the assignment of extensive privileges.",
                insights: "Identification of Risk Profiles and Permission Sets to evalute the assignment of extensive privileges.",
                unitMeasure: "",
                key: "risk-profiles-and-pm-sets"
            },
            topApexTriggersRuntime : {
                title: "",
                description: "",
                insights: "",
                unitMeasure: " ms",
                key: ""
            },
            topApexTriggersExecuted : {
                title: "Top 5 # of ApexTrigger executed",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "top-apex-trigger-executed"
            },
            apexTriggers : {
                title: "Apex Triggers # of executions vs. runtime",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "top-apex-trigger-executed"
            },
            topApexClassesRuntime : {
                title: "Top 5 ApexTrigger per Average run time",
                description: "",
                insights: "",
                unitMeasure: " ms",
                key: "top-apex-trigger-per-average-runtime"
            },
            topApexClassesExecuted : {
                title: "",
                description: "",
                insights: "",
                unitMeasure: "",
                key: ""
            },
            restApiCalls : {
                title: "",
                description: "",
                insights: "",
                unitMeasure: "",
                key: ""
            },
            topObjectsStorage : {
                title: "Top 10 objects per storage",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "top-10-objects-per-storage"
            },
            activeUsersPercentages : {
                title: "Active Users",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "active-users-percentage"
            },
            activeUsersLast30Days : {
                title: "% Active User in the last 30 days",
                description: "",
                insights: "",
                unitMeasure: "",
                key: "last-30-days-active-users-percentage"
            },

        }
        return platformTooltips;
    }

    getPlatformTooltips(){
        return this.platformTooltips;
    }
}

export default Tooltips;
