<script>

export default {
    name: 'NumberCard',
    props: {
        title: {
            type: String,
            required: true
        },
        count: {
            type: Number,
            required: false
        },
        description: {
            type: String,
            required: false,
        },
        insights: {
            type: String,
            required: true,
            default: "Insight Delivered"
        },
        progress: {
            type: Number,
            required: false
        },
        intervals: {
            type: Array,
            required: false,
            default: () => [30, 60]
        },
        results: {
            type: Array,
            required: false
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
            showMessage: false
        }
    },
    methods: {
        toggleMessage() {
            this.showMessage = !this.showMessage;
        }
    }
};

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
</script>


<template>
    <div class="card">
        <div class="flex justify-between mb-4">
            <div>
                <div class="text-muted-color font-semibold mb-1 text-base">{{ title }}
                    <i class="pi pi-info-circle text-muted-color !text-l" v-tooltip="insights" ></i>
                </div>
                <span v-if="description" class="text-muted-color">{{ description }}</span>
            </div>
            <div v-if="false" class="relative flex items-center justify-center rounded-border bg-gray-100" style="width: 2.5rem; height: 2.5rem">
                <i class="pi pi-exclamation-triangle warning !text-xl" @mouseover="showMessage = true" @mouseleave="showMessage = false"></i>
                <i class="pi pi-comment iqvia-blue-light !text-xl" @click="toggleMessage"></i>
            </div>
        </div>

        <div class="flex justify-between mb-4">
            <span class="blue-info dark:text-surface-0 font-semibold text-2xl"> {{ count ? count : 0}}</span>
            <div v-if="progress && ispercentage" class="flex items-center mt-4">
                <div class="bg-surface-300 dark:bg-surface-500 rounded-border overflow-hidden w-40 lg:w-24" style="height: 8px">
                    <div :class="[getColorByPercentage(order, progress, intervals).bg, 'h-full']" :style="{ width: progress + '%' }"></div>
                </div>
                <span :class="[getColorByPercentage(order, progress, intervals).text, 'ml-4 font-medium']"> {{ progress }}% </span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.tooltip-content {
    visibility: hidden;
    opacity: 0;
    min-width: 400px;
    max-width: 400px;
    word-wrap: break-word;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 0.5rem;
    font-size: 1rem;
}

.relative:hover .tooltip-content {
    visibility: visible;
    opacity: 1;
}

.p-button {
    background: var(--iqvia-blue-dark);
    border: 1px solid var(--iqvia-blue-dark)
}

.p-button:not(:disabled):hover{
    background: var(--iqvia-blue-light);
    border: 1px solid var(--iqvia-blue-light);
}
</style>
