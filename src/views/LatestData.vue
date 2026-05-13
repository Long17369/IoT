<script setup lang="ts">
import { Watch } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import DataCard from '../component/data/DataCard.vue'
import type { CardField } from '../types/dataType'

const record = {
  device: '传感器-A1',
  temp: 23.5,
  humidity: 65,
  pm25: 35,
  voltage: 3.3,
  status: '正常',
  time: '2026-05-13 14:32:10',
}

const fields: CardField[] = [
  { key: 'device', label: '', section: 'header', tag: false },
  {
    key: 'status',
    label: '',
    section: 'header',
    tag: true,
    statusMap: { 正常: 'success', 警告: 'warning', 异常: 'danger' },
  },
  { key: 'temp', label: '温度', unit: '°C', section: 'body', tag: true },
  { key: 'humidity', label: '湿度', unit: '%', section: 'body', tag: true },
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', section: 'body', tag: true },
  { key: 'voltage', label: '电压', unit: 'V', section: 'body', tag: true },
  { key: 'time', label: '', section: 'footer' },
]
</script>

<template>
  <div class="latest-data">
    <h3>
      <ElIcon><Watch /></ElIcon>
      最新数据
    </h3>
    <DataCard :data="record" :fields="fields" />
  </div>
</template>

<style scoped>
.latest-data {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  justify-content: center;
}
.latest-data h3 {
  margin: 0;
  font-size: 20px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
