<script setup>
import { useLayout } from '@/layout/composables/layout';
import { onMounted, ref, watch } from 'vue';

const { getPrimary, getSurface, isDarkTheme } = useLayout();

const props = defineProps({
    title: {
        type: String,
        required: true
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
    data: {
        type: Array,
        default: () => []
    },
    type: {
        type: String,
        required: true
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
    }
});

const chartOptions = ref(null);
const showMessage = ref(false);

function setChartOptions(type) {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    if (type === 'bar') {
        return {
            plugins: {
                legend: {
                    labels: {
                        fontColor: textColor
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: textColorSecondary,
                        font: {
                            weight: 500
                        }
                    },
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                },
                y: {
                    ticks: {
                        color: textColorSecondary
                    },
                    grid: {
                        color: surfaceBorder,
                        drawBorder: false
                    }
                }
            }
        };
    }

    if (type === 'scatter') {
        return {
            responsive: true,
            scales: {
                x: {
                    type: "linear",
                    position: "bottom",
                },
                y: {
                    type: "linear",
                },
            },
            plugins: {
                legend: {
                    position: "top",
                },
            }
        };
    }

    if (type === 'pie') {
        return {
            options: {
                plugins: {
                    legend: {
                        labels: {
                            usePointStyle: true,
                            color: textColor
                        }
                    }
                }
            }
        }
    }
}

function toggleMessage() {
    showMessage.value = !showMessage.value;
}

watch([getPrimary, getSurface, isDarkTheme, props], () => {
    chartOptions.value = setChartOptions(props.type);
});

onMounted(() => {
    chartOptions.value = setChartOptions(props.type);
});
</script>


<template>
    <div class="flex justify-start mb-2">
        <div>
            <h4 class="font-semibold mb-1 text-lg"> {{props.title}}
                <i class="pi pi-info-circle text-muted-color !text-l" v-tooltip="insights" ></i>
            </h4>
            <span v-if="description" class="text-muted-color">{{ props.description }}</span>
        </div>
        <div v-if="false" class="relative flex items-center justify-center rounded-border"
            style="width: 2.5rem; height: 2.5rem">
            <i v-if="true" class="pi pi-exclamation-circle warning !text-xl mr-4" @mouseover="showMessage = true" @mouseleave="showMessage = false"></i>
            <i class="pi pi-comment iqvia-blue-light !text-xl" @click="toggleMessage"></i>
        </div>
    </div>

    <div v-if="false" class="flex justify-end relative">
        <div class="absolute top-[-24px] left-0/5 transform -translate-x-0/5">{{ sliderRangeAccountsPerTerritory }}</div>
        <Slider v-model="sliderRangeAccountsPerTerritory" range class="w-56" :min="minValue" :max="maxValue"/>
    </div>
    <div :class="{ 'flex justify-center': type === 'pie' }">
        <Chart :type="type" :data="data" :options="chartOptions"></Chart>
    </div>
</template>
