<script>
import { FilterMatchMode } from '@primevue/core/api'
import {ref} from 'vue'

export default {
    name: 'TableSortable',
    props: {
        title: {
            type: String,
            required: true
        },
        data: {
            type: Array,
            required: true,
            default: () => []
        },
        description: {
            type: String,
            required: false
        },
        insights: {
            type: String,
            required: true,
            default: "Insight Delivered"
        },
        dataKey: {
            type: String,
            required: true
        },
        columns: {
            type: Array,
            required: true
        },
        rows: {
            type: Number,
            required: false,
            default: 10
        },
        results: {
            type: Array,
            required: false
        },
        progress: {
            Type: Number,
            required: false
        },
        intervals: {
            type: Array,
            required: false,
            default: () => [30, 60]
        },
        order: {
            type: Number,
            required: false
        },
        ispercentage: {
            type: Boolean,
            required: false,
            default: () => true
        }
    },
    data() {
        return {
            showMessage: false,
        }
    },
    /*
    computed: {
    },
    */
    methods: {
        toggleMessage() {
            this.showMessage = !this.showMessage;
        }
    },
    setup(props) {
        const getColorByPercentage = (order, progress, intervals) => {
            if(order == null){ order = 0}
            if (order == 0) { // green, yellow, red
                if (!progress) return { bg: 'bg-gray-200', text: 'text-gray-400' };
                if (progress <= intervals[0]) return { bg: 'bg-green-800', text: 'text-green-800' };
                if (progress <= intervals[1]) return { bg: 'bg-yellow-700', text: 'text-yellow-700' };
                return { bg: 'bg-red-800', text: 'text-red-800' };
            } else { // red, yellow, green
                if (!progress) return { bg: 'bg-gray-200', text: 'text-gray-400' };
                if (progress <= intervals[0]) return { bg: 'bg-red-800', text: 'text-red-800' };
                if (progress <= intervals[1]) return { bg: 'bg-yellow-700', text: 'text-yellow-700' };
                return { bg: 'bg-green-800', text: 'text-green-800' };
            }
        };

        const filters = ref({
            global: { value: null, matchMode: FilterMatchMode.CONTAINS }
        })
        return {filters, getColorByPercentage}
    }
}
</script>

<template>
    <DataTable
    :value="data"
    dataKey="id"
    :paginator="true"
    :rows="rows"
    :filters="filters"
    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
    currentPageReportTemplate="Showing {first} to {last} of {totalRecords} records"
    class="text-sm"
    >
        <template #header>
            <div class="flex flex-wrap gap-2 items-center justify-between mb-2">
                <div class="font-semibold m-0 text-base"> {{title}}
                    <i class="pi pi-info-circle text-muted-color !text-l" v-tooltip="insights" ></i>
                </div>
            </div>
            <div class="flex flex-wrap items-center justify-between">
                <div class="flex items-center">
                    <span class="blue-info dark:text-surface-0 font-semibold text-2xl">{{data.length}}</span>
                    <div v-if="progress && ispercentage" class="flex items-center ml-4 mt-2">
                        <div class="bg-surface-300 dark:bg-surface-500 rounded-border overflow-hidden w-40 lg:w-24" style="height: 8px">
                            <div :class="[getColorByPercentage(order, progress, intervals).bg, 'h-full']" :style="{ width: progress + '%' }"></div>
                        </div>
                        <span :class="[getColorByPercentage(order, progress, intervals).text, 'ml-4 font-medium']"> {{progress}} %</span>
                    </div>
                </div>
                <div class="flex items-center lg:w-1/3 w-full">
                    <IconField class="ml-auto flex items-center">
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="filters['global'].value" placeholder="Search..." />
                    </IconField>
                </div>
            </div>
        </template>

        <template v-for="(column, index) in columns" :key="index">
            <Column
            :field="column.field"
            :header="column.label"
            :sortable="column.sortable"
            :style="column.style"
            ></Column>
        </template>
    </DataTable>

</template>
