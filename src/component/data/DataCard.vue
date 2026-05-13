<script setup lang="ts">
import { computed } from 'vue'
import { ElTag } from 'element-plus'
import type { CardField } from '../../types/dataType'

const props = defineProps<{
  data: Record<string, unknown>
  fields: CardField[]
  title?: string
}>()

const headerFields = computed(() => props.fields.filter((f) => f.section === 'header'))
const bodyFields = computed(() => props.fields.filter((f) => !f.section || f.section === 'body'))
const footerFields = computed(() => props.fields.filter((f) => f.section === 'footer'))

function fmt(val: unknown, field: CardField): string {
  const v = val ?? ''
  return field.unit ? `${v}${field.unit}` : String(v)
}

function tagType(field: CardField) {
  const val = String(props.data[field.key] ?? '')
  if (field.statusMap && field.statusMap[val]) return field.statusMap[val]
  return 'primary'
}
</script>

<template>
  <div class="data-card">
    <!-- 头部 -->
    <div v-if="headerFields.length || title" class="card-header">
      <div class="header-left">
        <slot name="header-left">
          <template v-for="f in headerFields" :key="f.key">
            <span v-if="!f.tag" class="header-title">{{ data[f.key] }}</span>
            <ElTag v-else :type="tagType(f)" size="small">{{ fmt(data[f.key], f) }}</ElTag>
          </template>
        </slot>
      </div>
      <div class="header-right">
        <slot name="header-right" />
      </div>
    </div>

    <!-- 主体 -->
    <div
      v-if="bodyFields.length"
      class="card-body"
      :style="{ gridTemplateColumns: `repeat(${Math.min(bodyFields.length, 2)}, 1fr)` }"
    >
      <div v-for="f in bodyFields" :key="f.key" class="data-item">
        <span class="item-label">{{ f.label }}</span>
        <span class="item-value">
          <ElTag v-if="f.tag" size="small" effect="plain" round>
            {{ fmt(data[f.key], f) }}
          </ElTag>
          <span v-else>{{ fmt(data[f.key], f) }}</span>
        </span>
      </div>
    </div>

    <!-- 底部 -->
    <div v-if="footerFields.length" class="card-footer">
      <template v-for="f in footerFields" :key="f.key">
        <span>{{ fmt(data[f.key], f) }}</span>
      </template>
    </div>

    <slot name="footer" />
  </div>
</template>

<style scoped>
.data-card {
  width: 100%;
  max-width: 400px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  background: #fff;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: linear-gradient(135deg, #ecf5ff, #d9ecff);
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.card-body {
  display: grid;
  gap: 0;
}

.data-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #f0f0f0;
}

.data-item:nth-child(2n) {
  border-right: none;
}

/* 单列时无右边框 */
.card-body[style*='1fr)'] .data-item {
  border-right: none;
}

.item-label {
  font-size: 12px;
  color: #909399;
}

.item-value {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.card-footer {
  padding: 12px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  font-size: 12px;
  color: #c0c4cc;
}

@media (max-width: 767px) {
  .card-body {
    grid-template-columns: 1fr !important;
  }
  .data-item {
    border-right: none;
  }
}
</style>
