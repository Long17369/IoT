<script setup lang="ts">
import { ref } from 'vue'
import DataTable from '../component/data/DataTable.vue'
import DataChart from '../component/data/DataChart.vue'
import type { ColumnDef, SortInfo } from '../types/dataType'

const columns: ColumnDef[] = [
  { key: 'device', label: '设备', chartable: false, sortable: true },
  {
    key: 'temp',
    label: '温度',
    unit: '°C',
    unitPlacement: 'header',
    chartable: true,
    sortable: true,
  },
  {
    key: 'humidity',
    label: '湿度',
    unit: '%',
    unitPlacement: 'header',
    chartable: true,
    sortable: true,
  },
  {
    key: 'pm25',
    label: 'PM2.5',
    unit: 'µg/m³',
    unitPlacement: 'header',
    chartable: true,
    sortable: true,
  },
  {
    key: 'voltage',
    label: '电压',
    unit: 'V',
    unitPlacement: 'header',
    chartable: true,
    sortable: true,
  },
  { key: 'status', label: '状态', chartable: false },
]

const rawData = [
  { device: '传感器-A1', temp: 23.5, humidity: 65, pm25: 35, voltage: 3.3, status: '正常' },
  { device: '传感器-A2', temp: 24.1, humidity: 62, pm25: 42, voltage: 3.2, status: '正常' },
  { device: '传感器-B1', temp: 26.3, humidity: 70, pm25: 58, voltage: 3.1, status: '警告' },
  { device: '传感器-B2', temp: 22.8, humidity: 55, pm25: 28, voltage: 3.4, status: '正常' },
  { device: '传感器-C1', temp: 28.0, humidity: 72, pm25: 65, voltage: 3.0, status: '警告' },
  { device: '传感器-C2', temp: 21.5, humidity: 50, pm25: 20, voltage: 3.3, status: '正常' },
  { device: '传感器-D1', temp: 25.7, humidity: 68, pm25: 48, voltage: 3.2, status: '正常' },
  { device: '传感器-D2', temp: 27.2, humidity: 75, pm25: 72, voltage: 2.9, status: '异常' },
]

const displayData = ref([...rawData])

function onSortChange(info: SortInfo) {
  if (!info.order) {
    displayData.value = [...rawData]
    return
  }
  displayData.value = [...rawData].sort((a, b) => {
    const va = a[info.prop as keyof typeof a] as number
    const vb = b[info.prop as keyof typeof b] as number
    return info.order === 'ascending' ? va - vb : vb - va
  })
}
</script>

<template>
  <div class="data-view">
    <h3>传感器数据总览</h3>
    <span class="count-tip">共 {{ displayData.length }} 条</span>

    <!-- 上半：表格 -->
    <div class="table-section">
      <DataTable :data="displayData" :columns="columns" @sort-change="onSortChange" />
    </div>

    <!-- 下半：饼图 -->
    <div class="chart-section">
      <DataChart :data="displayData" :columns="columns" mode="pie" />
    </div>
  </div>
</template>

<style scoped>
.data-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}
.data-view h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.count-tip {
  color: #909399;
  font-size: 12px;
}

.table-section {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}

.chart-section {
  flex: 1;
  min-height: 200px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  overflow: hidden;
}

/* 手机端：减小圆角 */
@media (max-width: 767px) {
  .data-view {
    gap: 8px;
    padding: 2px 0;
  }
  .table-section,
  .chart-section {
    border-radius: 4px;
  }
}
</style>
