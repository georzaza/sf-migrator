<script setup>

import { ref, onMounted, watchEffect, computed, watch } from "vue";

//import DWidgetStats from '@/components/dashboard/DWidgetStats.vue';
//import DCharts from '@/components/dashboard/DCharts.vue';
//import DTableSortable from '@/components/dashboard/DTableSortable.vue';

import Tooltips from '@/utils/tooltips';
import { getKeyCount } from '@/utils/getKeyCount';

const platformTooltips = ref(new Tooltips().getPlatformTooltips());

console.log('tooltips', platformTooltips._rawValue);

const orgStats = ref({});
/**

import { useGlobalStore } from '@/store';
import { getKeyCount } from '@/utils/getKeyCount';
import { recordSizes } from '../../utils/storageUtils';

const preamble = ref("Evaluation of the overall Organizatiions's health status. The goal of this evaluation is to assess the migration complexity according to the customization level and to increase efficiency, resolve issues, optimize solutions , and identify opportunities areas before the migration");

const orgStats = ref({});
const platformTooltips = ref(new Tooltips().getPlatformTooltips());
const store = useGlobalStore();
const prname = computed(() => store.project.prname);
const orgname = computed(() => store.project.orgname);
const orgId = computed(() => store.project.orgid)
const isTouchScreenDevice = computed(() => store.isTouchScreenDevice);
const breadcrumbItems = [
        { label: prname, url: '/pages/myprojects' },
        { label: orgname, url: '/pages/myprojects' },
        { label: 'Capability Overview', url: `/capability-overview` },
        { label: 'Platform Overview', url: '/platform-overview'}
    ];
const documentStyle = getComputedStyle(document.documentElement)
const pieBackgroundColor = [documentStyle.getPropertyValue('--iqvia-blue-dark'), documentStyle.getPropertyValue('--iqvia-blue-medium'), documentStyle.getPropertyValue('--iqvia-blue-light')]
const hoverBackgroundColor = [documentStyle.getPropertyValue('--iqvia-blue-dark'), documentStyle.getPropertyValue('--iqvia-blue-medium'), documentStyle.getPropertyValue('--iqvia-blue-light')]

const barChartRefs = {
    topQueuedExecutionRuntime: ref([]),
    topExecutionErrors: ref([])
};

const scatterPlotRefs = {
    apexTriggers: ref([]),
    apexClasses: ref([]),
    apexREST: ref([]),
    apexSOAP: ref([])
};

const eventMonitoringRefs = {
    apexTriggers: scatterPlotRefs['apexTriggers'],
    apexREST: scatterPlotRefs['apexREST'],
    apexSOAP: scatterPlotRefs['apexSOAP'],
    topQueuedExecutionRuntime: barChartRefs['topQueuedExecutionRuntime'],
    topExecutionErrors: barChartRefs['topExecutionErrors'],
    apexClasses: scatterPlotRefs['apexClasses'],
}

const listRefs = {
    topLimitsReachedUsage: ref({
        columns: [
            { field: 'Name', label: 'Name', sortable: true, style: 'width: 70%' },
            { field: 'PercentUsed', label: 'Used %', sortable: true, style: 'width: 30%' }
        ],
        title: platformTooltips?.value?.topLimitsReachedUsage?.title,
        dataRows: []
    }),

    topEntitlements: ref({
        columns: [
            { field: 'MasterLabel', label: 'Name', sortable: true, style: 'width: 70%' },
            { field: 'PercentUsed', label: 'Used %', sortable: true, style: 'width: 30%' }
        ],
        title: platformTooltips?.value?.topEntitlements?.title,
        dataRows: []
    }),

    topStorage: ref({
        columns: [
            { field: 'name', label: 'Name', sortable: true, style: 'width: 40%' },
            { field: 'count', label: 'Record Count', sortable: true, style: 'width: 20%' },
            { field: 'storageMB', label: 'Storage (MB)', sortable: true, style: 'width: 20%' },
            { field: 'percentUsed', label: 'Used %', sortable: true, style: 'width: 20%' },
        ],
        title: platformTooltips?.value?.topStorage?.title,
        dataRows: []
    }),

    topObjectsPerLimitsCovered: ref({
        columns: [
            { field: 'SObject', label: 'SObject', sortable: true, style: 'width: 30%' },
            { field: 'Type', label: 'Type', sortable: true, style: 'width: 30%' },
            { field: 'Label', label: 'Label', sortable: true, style: 'width: 70%' },
            { field: 'PercentageUsage', label: 'Used %', sortable: true, style: 'width: 30%' }
        ],
        title: platformTooltips?.value?.topObjectsPerLimitsCovered?.title,
        dataRows: []
    }),

    dailyApiRequests: ref({
        columns: [
            { field: 'Used', label: 'Used', sortable: false, style: 'width: 40%' },
            { field: 'Max', label: 'Max', sortable: false, style: 'width: 40%' },
            { field: 'PercentUsed', label: 'Used %', sortable: false, style: 'width: 20%' }
        ],
        title: platformTooltips?.value?.dailyApiRequests?.title,
        dataRows: []
    })
}

const selectedProfile = ref(null);
const op = ref(null);

// Function to open the popover
const openPopover = (event, profile) => {
    selectedProfile.value = profile; // Store the selected profile
    op.value.toggle(event); // Open the popover
};

// Initiliaze overview - fetch data and populate charts
async function initorgStats() {
    const resp = await ((await fetch(configs.LOCAL_HOST, {headers : {'action' : 'analyse capabilities', 'orgid' : orgId.value}}))).json();
    orgStats.value = resp;

    // General Statistics - Individual Cards
    platformTooltips.value.customObjectsInTheOrg.count = resp['Custom Objects'].length
    platformTooltips.value.customFields.count = resp['Custom Fields'].length
    platformTooltips.value.recordTypes.count = resp['Record Types'].length
    platformTooltips.value.apexTriggersOrg.count = resp['Apex Triggers'].length
    platformTooltips.value.apexClassesOrg.count = resp['Apex Classes'].length
    platformTooltips.value.customLWCs.count = resp['LWC'].length
    platformTooltips.value.customApexPages.count = resp['Visualforce'].length
    platformTooltips.value.aura.count = resp['Aura'].length
    platformTooltips.value.flows.count = resp['Flows'].length
    platformTooltips.value.activeProcessBuilders.count = resp['Process Builders'].length
    platformTooltips.value.activeWorkflowRules.count = resp['Workflow Rules'].length
    platformTooltips.value.ApexUnexpectedExceptions.count = resp['Event Monitoring for'].find(obj => obj.logFile === 'ApexUnexpectedException').result.length
    //platformTooltips.value.queuedExecution.count = resp['Event Monitoring for'].find(obj => obj.logFile === 'QueuedExecution').result.length
    let dataStorage = resp['Limits'].find(obj => obj.Name === 'DataStorageMB');
    let dataStorageMB = dataStorage.Max - dataStorage.Remaining;
    platformTooltips.value.dataStorage.count = dataStorage.PercentUsed.toFixed(2) + ' %'

    // Custom Fields Per SObject - BarChart
    let countByObj = getKeyCount(resp['Custom Fields'], 'SObject');
    const customFieldsPerObject = Object.entries(countByObj)
        .map(([SObject, number]) => ({ SObject, number }))
        .sort((a, b) => b.number - a.number);

    platformTooltips.value.customFieldsPerObject.type = 'bar'
    platformTooltips.value.customFieldsPerObject.data = {
        labels: customFieldsPerObject.map(item => item.SObject).slice(0, configs.TOP_X),
        datasets: [
            {
                label: '',
                data: customFieldsPerObject.map(item => item.number).slice(0, configs.TOP_X),
                backgroundColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                borderColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
            },
        ],
    }

    // Triggers per SObject - BarChart
    countByObj = getKeyCount(resp['Apex Triggers'], 'SObject');
    const triggersPerSObject = Object.entries(countByObj)
        .map(([SObject, number]) => ({ SObject, number }))
        .sort((a, b) => b.number - a.number);

    platformTooltips.value.triggersPerSObject.type = 'bar'
    platformTooltips.value.triggersPerSObject.data = {
        labels: triggersPerSObject.map(item => item.SObject).slice(0, configs.TOP_X),
        datasets: [
            {
                label: '',
                data: triggersPerSObject.map(item => item.number).slice(0, configs.TOP_X),
                backgroundColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                borderColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
            },
        ],
    }

    // RecordTypes per SObject - BarChart
    countByObj = getKeyCount(resp['Record Types'], 'SObject');
    const recordTypesPerObject = Object.entries(countByObj)
        .map(([SObject, number]) => ({ SObject, number }))
        .sort((a, b) => b.number - a.number);

    platformTooltips.value.recordTypesPerObject.type = 'bar'
    platformTooltips.value.recordTypesPerObject.data = {
        labels: recordTypesPerObject.map(item => item.SObject).slice(0, configs.TOP_X),
        datasets: [
            {
                label: '',
                data: recordTypesPerObject.map(item => item.number).slice(0, configs.TOP_X),
                backgroundColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                borderColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
            },
        ],
    }

    // Flows per Type - BarChart
    countByObj = getKeyCount(resp['Flows'], 'ProcessType');
    const flowsPerType = Object.entries(countByObj)
        .map(([ProcessType, number]) => ({ ProcessType, number }))
        .sort((a, b) => b.number - a.number);

    platformTooltips.value.flowsPerType.type = 'bar'
    platformTooltips.value.flowsPerType.data = {
        labels: flowsPerType.map(item => item.ProcessType).slice(0, configs.TOP_X),
        datasets: [
            {
                label: '',
                data: flowsPerType.map(item => item.number).slice(0, configs.TOP_X),
                backgroundColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                borderColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
            },
        ],
    }

    // Scatterplots
    const triggersScatterData = getScatterplotData(resp['Event Monitoring for'].find(obj => obj.logFile === 'ApexTrigger').result, configs.TOP_X, 0, 'ENTITY_NAME', ['avg EXEC_TIME', 'count']);
    constructScatterPlot(scatterPlotRefs['apexTriggers'], triggersScatterData, [platformTooltips.value.apexTriggers.title, platformTooltips.value.topApexTriggersRuntime.title, platformTooltips.value.topApexTriggersExecuted.title]);

    const apexScatterData = getScatterplotData(resp['Event Monitoring for'].find(obj => obj.logFile === 'ApexExecution').result, configs.TOP_X, 0, 'ENTITY_NAME', ['avg EXEC_TIME', 'count']);
    constructScatterPlot(scatterPlotRefs['apexClasses'], apexScatterData, [platformTooltips.value.apexClasses.title, platformTooltips.value.topApexClassesRuntime.title, platformTooltips.value.topApexClassesRuntime.title]);

    const restScatterData = getScatterplotData(resp['Event Monitoring for'].find(obj => obj.logFile === 'ApexRestApi').result, configs.TOP_X, 0, 'CLASS_NAME', ['avg RUN_TIME', 'count']);
    constructScatterPlot(scatterPlotRefs['apexREST'], restScatterData, [platformTooltips.value.apexREST.title, platformTooltips.value.topRestApiRuntime.title, platformTooltips.value.apexREST.title]);

    const soapScatterData = getScatterplotData(resp['Event Monitoring for'].find(obj => obj.logFile === 'ApexSoap').result, configs.TOP_X, 0, 'CLASS_NAME', ['avg RUN_TIME', 'count']);
    constructScatterPlot(scatterPlotRefs['apexSOAP'], soapScatterData, [platformTooltips.value.apexSOAP.title, platformTooltips.value.topSoapAPIRuntime.title, platformTooltips.value.soapApiExecution.title]);

    // Barcharts
    getTopApexStatistics(resp['Event Monitoring for'].find(obj => obj.logFile === 'ApexUnexpectedException').result, configs.TOP_X, 0, 'EXCEPTION_MESSAGE', 'count', barChartRefs['topExecutionErrors'], platformTooltips.value.topExecutionErrors.title);

    barChartRefs['topExecutionErrors'].value.data.labels = barChartRefs['topExecutionErrors'].value.data.labels.map(label => {
        const truncatedLabel = label.split(":")[1]?.trim()
        return truncatedLabel.length > 20 ? (truncatedLabel.slice(0, 20) + '...') : truncatedLabel
    }); // Top Exception Errors - BarChart

    getTopApexStatistics(resp['Event Monitoring for'].find(obj => obj.logFile === 'QueuedExecution').result, configs.TOP_X, 0, 'ENTRY_POINT', 'count', barChartRefs['topQueuedExecutionRuntime'], platformTooltips.value.queuedExecution.title); // Top QueuedExecution per # Average run time - BarChart

    listRefs['topObjectsPerLimitsCovered'].value.dataRows = resp['Object Limits'].flat()
        .sort((a, b) => b.PercentageUsage - a.PercentageUsage).slice(0, configs.TOP_X);

    // Lists
    listRefs['topLimitsReachedUsage'].value.dataRows = resp['Limits']
        .filter(limit => limit.PercentUsed > configs.TOP_Y)
        .map(limit => ({
            ...limit,
            PercentUsed: limit.PercentUsed.toFixed(2)
        }))
        .sort((a, b) => b.PercentUsed - a.PercentUsed).slice(0, configs.TOP_X);

    listRefs['topEntitlements'].value.dataRows = resp['Entitlements']
        .filter(limit => limit?.AmountUsed > 1)
        .map(limit => ({
            ...limit,
            PercentUsed: (limit.AmountUsed / limit.CurrentAmountAllowed * 100).toFixed(2)
        }))
        .sort((a, b) => b.PercentUsed - a.PercentUsed).slice(0, configs.TOP_X);

    listRefs['topStorage'].value.dataRows = resp['Storage']
        .sort((a, b) => b.count - a.count).slice(0, configs.TOP_X)
        .map(s =>  {
            let kb = recordSizes.find(obj => obj.name === s.name) ? recordSizes.find(obj => obj.name === s.name).size : recordSizes.find(obj => obj.name === 'default').size;
            let storageMB = ((s.count * kb) / 1024);
            return {
            'name' : s.name,
            'count' : s.count,
            'storageMB' : storageMB.toFixed(1),
            'percentUsed' : (storageMB / dataStorageMB *100).toFixed(0)
            }
        });

    for(let i = 0; i < resp['Limits'].length; i++) {
        if(resp['Limits'][i].Name === 'DailyApiRequests') {
            listRefs['dailyApiRequests'].value.dataRows.push({'Used' : (resp['Limits'][i].Max - resp['Limits'][i].Remaining), 'Max' : resp['Limits'][i].Max, 'PercentUsed' : resp['Limits'][i].PercentUsed.toFixed(2) + '%'});
            break;
        }
    }

    // Calculate Dangerous Profiles
    const dangerousProfiles = []
    resp['Dangerous Profiles'].forEach(profile => {
        const dangerousPermissions = [];

        Object.keys(profile).forEach(key => {
            if(profile[key] === true) {
                // Removes "Permissions" occurence and then splits the Pascal Case string with whitespaces.
                dangerousPermissions.push(key.replace(new RegExp("^" + 'Permissions'), "").replace(/([a-z])([A-Z])/g, "$1 $2"));
            }
        });

        dangerousProfiles.push ({
            'Name' : profile.Profile ? profile.Profile.Name : profile.Name,
            'Dangerous Permissions' : dangerousPermissions,
            'Total Users' : profile?.Assignments?.totalSize ? profile?.Assignments?.totalSize : 0
        })
    })
    dangerousProfiles.sort((a, b) => (b['Dangerous Permissions'].length - a['Dangerous Permissions'].length));
    platformTooltips.value.dangerousProfiles.dataRows = dangerousProfiles

    // Active Users
    let active = resp['Active Users % (Last 10 days)'].toFixed(2);
    platformTooltips.value.activeUsersPercentages.type = 'pie'
    platformTooltips.value.activeUsersPercentages.data = {
        labels: ['Active Users % (Last 10 Days)', 'InActive Users % (Last 10 Days)'],
        datasets: [
            {
                data: [active, 100-active],
                backgroundColor: pieBackgroundColor,
                hoverBackgroundColor: hoverBackgroundColor
            }
        ]
    }

    // Daily API Requests
    let api_usage = listRefs['dailyApiRequests'].value.dataRows[0].Used / listRefs['dailyApiRequests'].value.dataRows[0].Max;
    platformTooltips.value.dailyApiRequests.type = 'pie'
    platformTooltips.value.dailyApiRequests.data = {
        labels: ['API Requests Used', 'API Requests Remaining'],
        datasets: [
            {
                data: [api_usage, 100-api_usage],
                backgroundColor: pieBackgroundColor,
                hoverBackgroundColor: hoverBackgroundColor
            }
        ]
    }
}

// Prepare data for scatter plot
function getScatterplotData(payload, topX, topY, targetLabel, targetSpecs) {
    const ceiling = (payload.length < topX) ? payload.length : topX;
    payload.sort((a, b) => (b[targetSpecs[0]] - a[targetSpecs[0]]));

    let labelnames = [];
    let dataValues = [];
    let dataCounts = [];
    for(let i = 0; i < ceiling; i++) {
        if(topY > 0 && payload[i][targetSpecs[0]] < topY) {
            continue;
        }

        labelnames.push(payload[i][targetLabel]);
        dataValues.push(payload[i][targetSpecs[0]]);
        dataCounts.push(payload[i][targetSpecs[1]]);
    }

    return [labelnames, dataValues, dataCounts];
}

// Build a bar chart showing top Apex statistics based on a specific metric
function getTopApexStatistics(payload, topX, topY, targetLabel, targetSpec, targetChartTemplate, title) {
    const ceiling = (payload.length < topX) ? payload.length : topX;// Determine the actual number of records to display
    payload.sort((a, b) => (b[targetSpec] - a[targetSpec]));
    let labelnames = [];
    let dataValues = [];
    for(let i = 0; i < ceiling; i++) {
        if(topY > 0 && payload[i][targetSpec] < topY) {
            continue;
        }

        labelnames.push(payload[i][targetLabel]);
        dataValues.push(payload[i][targetSpec]);
    }

    targetChartTemplate.value = {
        type: 'bar',
        title: title !== null ? title : targetChartTemplate.value.data.title,
        data: {
            labels: labelnames,
            datasets: [
                {
                    label: "Event Monitoring",
                    backgroundColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                    borderColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                    data: dataValues
                }
            ]
        }
    };
}

// Create a bar chart showing top Apex statistics based on percentage usage
function getTopApexStatistics2(payload, topX, topY, targetLabel, targetSpec, targetChartTemplate, title) {
    const ceiling = (payload.length < topX) ? payload.length : topX;

    //payload.sort((a, b) => (b[targetSpec] - a[targetSpec]));

    const flatPaylod = payload.flat();
    flatPaylod.sort((a, b) => (b.PercentageUsage - a.PercentageUsage)).slice(0,10);

    targetChartTemplate.value = {
        type: 'bar',
        title: title !== null ? title : targetChartTemplate.value.data.title,
        data: {
            labels: flatPaylod,
            datasets: [
                {
                    label: "Event Monitoring",
                    backgroundColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                    borderColor: documentStyle.getPropertyValue('--iqvia-blue-dark'),
                    data: dataValues
                }
            ]
        }
    };
}
// Return the top X entitlements based on usage percentage and filters those above a given threshold
function getTopXEntitlementsYUsage(limits, topX, topY) {
    let topLimits = [];

    for(let i = 0; i < topX; i++) {
        topLimits.push({'Name' : limits[i].MasterLabel, 'PercentUsed' : (limits[i].AmountUsed / limits[i].CurrentAmountAllowed === null) ? 0 : (limits[i].AmountUsed / limits[i].CurrentAmountAllowed).toFixed(2)});
    }

    for(let i = 0; i < limits.length; i++) {
        if((limits[i].AmountUsed / limits[i].CurrentAmountAllowed) >= topY) {
            for(let j = 0; j < topLimits.length; j++) {
                if((limits[i].AmountUsed / limits[i].CurrentAmountAllowed) > topLimits[j].PercentUsed) {
                    topLimits[j].Name = limits[i].MasterLabel;
                    topLimits[j].PercentUsed = (limits[i].AmountUsed / limits[i].CurrentAmountAllowed) === null ? 0 : (limits[i].AmountUsed / limits[i].CurrentAmountAllowed);
                    topLimits[j].PercentUsed.toFixed(2);
                    break;
                }
            }
        }
    }

    return topLimits;
}

// Construct and assign configuration for a scatter plot
function constructScatterPlot(targetScatterPlot, payloadData, axisLabels) {
    let scatterData = payloadData[1].map((xValue, i) => ({
        x: xValue,
        y: payloadData[2][i],
        name: payloadData[0][i]
    }));

    targetScatterPlot.value = {
        type: 'scatter',
        title: axisLabels[0],
        data: {
            datasets: [
                {
                    label: '',
                    data: scatterData,
                    backgroundColor: documentStyle.getPropertyValue('--iqvia-blue-medium'),
                    borderColor: documentStyle.getPropertyValue('--iqvia-blue-medium'),
                    borderWidth: 1,
                },
            ],
        },
    };
}

watch(
    orgId,
    (newVal, oldVal) => {
        if (newVal && newVal !== oldVal) {
        initorgStats()
        }
    }
)

onMounted(() => {
  initorgStats();
});
*/
</script>

<template>


    <Fluid v-for="i in 5" :key="i" class="card grid grid-cols-12 gap-4">
        <div class="col-span-12 font-semibold text-base iqvia-blue-dark" style="text-align: center;">
            <h2>General Statistics</h2>
        </div>

        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.customObjectsInTheOrg" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.customFields" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.recordTypes" />
            </div>
        </div>

        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.apexTriggersOrg" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.apexClassesOrg" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.customLWCs" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.customApexPages" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.aura" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.flows" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.activeProcessBuilders" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.activeWorkflowRules" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.ApexUnexpectedExceptions" />
            </div>
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4">
            <div class=" grid grid-cols-1 gap-4">
                <DWidgetStats v-bind="platformTooltips.dataStorage" />
            </div>
        </div>
    </Fluid>


    <!--
    <Fluid class="card grid grid-cols-12 gap-4">
        <div class="col-span-12 font-semibold text-base iqvia-blue-dark" style="text-align: center;">Level of Customization</div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DCharts v-bind="platformTooltips.customFieldsPerObject"></DCharts>
            </div>
        </div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DCharts v-bind="platformTooltips.triggersPerSObject"></DCharts>
            </div>
        </div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DCharts v-bind="platformTooltips.recordTypesPerObject"></DCharts>
            </div>
        </div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DCharts v-bind="platformTooltips.flowsPerType"></DCharts>
            </div>
        </div>
    </Fluid>

    <Fluid class="card grid grid-cols-12 gap-4">
        <div class="col-span-12 font-semibold text-base iqvia-blue-dark" style="text-align: center;">Event Monitoring</div>
        <div v-for="([key, ref], index) in Object.entries(eventMonitoringRefs)" :key="index" class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DCharts v-if="ref.value && ref.value.data"
                    :type="ref.value.type"
                    :title="ref.value.title"
                    :data="ref.value.data"
                    :insights="platformTooltips[key].insights"
                    :description="platformTooltips[key].description"
                    :recommendation="platformTooltips[key]?.recommendation">
                </DCharts>
            </div>
        </div>
    </Fluid>

    <Fluid class="card grid grid-cols-12 gap-4">
        <div class="col-span-12 font-semibold text-base iqvia-blue-dark" style="text-align: center;">Limits</div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DTableSortable :title="listRefs['topLimitsReachedUsage'].value.title" :columns="listRefs['topLimitsReachedUsage'].value.columns" :insights="platformTooltips['topLimitsReachedUsage'].insights" :description="platformTooltips['topLimitsReachedUsage'].description" :data="listRefs['topLimitsReachedUsage'].value.dataRows" responsiveLayout="scroll" :recommendation="platformTooltips['topLimitsReachedUsage'].recommendation" />
            </div>
        </div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DTableSortable :title="listRefs['topEntitlements'].value.title" :columns="listRefs['topEntitlements'].value.columns" :insights="platformTooltips['topEntitlements'].insights" :description="platformTooltips['topEntitlements'].description" :data="listRefs['topEntitlements'].value.dataRows" responsiveLayout="scroll" :recommendation="platformTooltips['topEntitlements']?.recommendation" />
            </div>
        </div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DTableSortable :title="listRefs['topObjectsPerLimitsCovered'].value.title" :columns="listRefs['topObjectsPerLimitsCovered'].value.columns" :insights="platformTooltips['topObjectsPerLimitsCovered']?.insights" :recommendation="platformTooltips['topObjectsPerLimitsCovered']?.recommendation" :data="listRefs['topObjectsPerLimitsCovered'].value.dataRows" :description="platformTooltips['topObjectsPerLimitsCovered']?.description"></DTableSortable>
            </div>
        </div>
        <div class="col-span-12 xl:col-span-6 flex flex-col">
            <div class="card">
                <DTableSortable :title="listRefs['topStorage'].value.title" :columns="listRefs['topStorage'].value.columns" :insights="platformTooltips['topStorage'].insights" :description="platformTooltips['topStorage'].description" :data="listRefs['topStorage'].value.dataRows" responsiveLayout="scroll" :recommendation="platformTooltips['topStorage']?.recommendation" />
            </div>
        </div>
    </Fluid>

    <Fluid class="card grid grid-cols-12 gap-4">
        <div class="col-span-12 font-semibold text-base iqvia-blue-dark" style="text-align: center;">Usage</div>
        <div class="card col-span-12 md:col-span-6 xl:col-span-6 flex flex-col">
            <DCharts v-bind="platformTooltips.activeUsersPercentages"></DCharts>
        </div>
        <div class="card col-span-12 md:col-span-6 xl:col-span-6 flex flex-col">
            <DCharts v-bind="platformTooltips.dailyApiRequests"></DCharts>
        </div>
    </Fluid>

    <div class="card">
        <div class="font-semibold text-base" style="text-align: center;">{{ platformTooltips.dangerousProfiles.title }}
            <i v-if="isTouchScreenDevice" class="pi pi-info-circle text-muted-color " tabindex="0" v-tooltip.focus="platformTooltips['dangerousProfiles'].insights" ></i>
            <i v-else class="pi pi-info-circle text-muted-color" v-tooltip="platformTooltips['dangerousProfiles'].insights" ></i>
        </div>
        <div v-if="platformTooltips['dangerousProfiles'].description" class="text-muted-color mb-4" style="text-align: center;">{{ platformTooltips['dangerousProfiles'].description }}</div>
        <div class="grid gap-4" :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }">
            <Button
                v-for="(profile, index) in platformTooltips.dangerousProfiles.dataRows"
                :key="index"
                type="button"
                @click="openPopover($event, profile)"
                class="relative"
                style="background-color: rgba(102, 169, 199, 0.1); color: var(--iqvia-blue-dark); border: hidden;">

                <div class="flex items-center font-semibold">
                    {{ profile.Name }}
                </div>

                <span
                    v-if="profile['Dangerous Permissions'] && profile['Dangerous Permissions'].length > 0"
                    class="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center font-bold rounded-full bg-white dark:bg-black"
                    style="color: var(--iqvia-blue-dark);">
                    {{ profile['Dangerous Permissions'].length }}
                </span>
            </Button>
        </div>
        <div v-if="platformTooltips['dangerousProfiles']?.recommendation" class="flex border border-solid border-gray-100 rounded-lg p-2 text-muted-color mt-4">
            <i class="far fa-lightbulb"></i>
            <div class="ml-2">
                {{platformTooltips['dangerousProfiles']?.recommendation}}</div>
        </div>

        <Popover ref="op" id="overlay_panel" style="width: 450px">
            <DataTable v-if="selectedProfile" :value="[selectedProfile]" selectionMode="single">
                <p class="font-semibold text-xl text-center">Total Users: {{ selectedProfile['Total Users'] }}</p>
                <Column header="Dangerous Permissions" !sortable>
                    <template #body="slotProps">
                        <ul v-if="slotProps.data['Dangerous Permissions'].length">
                            <li v-for="(permission, i) in slotProps.data['Dangerous Permissions']" :key="i">
                                {{ permission }}
                            </li>
                        </ul>
                        <span v-else>No dangerous permissions!</span>
                    </template>
                </Column>
            </DataTable>
        </Popover>
    </div>
    -->
</template>

<style>

.card {
    background: var(--surface-card);
    padding: 2rem;
    margin-bottom: 2rem;
    border-radius: var(--content-border-radius);

    &:last-child {
        margin-bottom: 0;
    }
}

.card-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr); /* 4 equal columns */
    gap: 16px; /* Adjust spacing */
}

.card {
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 2px 4px var(--box-shadow);
}



.barChart {
    height: 20rem;
    width: 50rem;
}

.list-container {
    display: flex;
    gap: 16px;
    align-items: stretch; /* Equal height */
}

.list-container > * {
    flex: 1;
    max-width: 50%;
    box-sizing: border-box;
}

.list-container p {
  max-height: 100px; /* Prevents height differences */
  overflow-y: auto;  /* Enables scrolling if text is long */
}

.filter-input {
    float: right;
    width: 14rem;
    padding: 0.3rem;
    font-size: 16px;
    border: 2px solid #ccc;
    border-radius: 12px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
}

.filter-input:focus {
    border-color: #4caf50;
    box-shadow: 0 2px 10px rgba(0, 128, 0, 0.3);
    outline: none;
}

.filter-input::placeholder {
    color: #888;
}

</style>
