<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type Minutes = 5 | 10 | 15 | 75

const options: Minutes[] = [5, 10, 15, 75]
const hovered = ref<Minutes | null>(null)
const customMinutes = ref('')

const running = ref(false)
const startTime = ref<Date | null>(null)
const endTime = ref<Date | null>(null)
const remainingMs = ref(0)
let tickHandle: number | null = null

function formatClock(d: Date | null): string {
  if (!d) return '--:--'
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const countdown = computed(() => {
  const ms = Math.max(0, remainingMs.value)
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const hoveredExpiresAt = computed(() => {
  if (!hovered.value) return null
  const now = Date.now()
  const d = new Date(now + hovered.value * 60_000)
  return d
})

const parsedCustomMinutes = computed<number | null>(() => {
  const n = Number(customMinutes.value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
})

const customExpiresAt = computed(() => {
  if (!parsedCustomMinutes.value) return null
  return new Date(Date.now() + parsedCustomMinutes.value * 60_000)
})

function clearTimer() {
  if (tickHandle !== null) {
    window.clearInterval(tickHandle)
    tickHandle = null
  }
}

function cancel() {
  clearTimer()
  running.value = false
  startTime.value = null
  endTime.value = null
  remainingMs.value = 0
}

function start(minutes: number) {
  // reset existing timer
  clearTimer()
  const start = new Date()
  const end = new Date(start.getTime() + minutes * 60_000)
  startTime.value = start
  endTime.value = end
  running.value = true
  const update = () => {
    const now = Date.now()
    const diff = end.getTime() - now
    remainingMs.value = Math.max(0, diff)
    if (diff <= 0) {
      clearTimer()
      running.value = false
    }
  }
  update()
  tickHandle = window.setInterval(update, 250)
}

function startCustom() {
  if (!parsedCustomMinutes.value) return
  start(parsedCustomMinutes.value)
  customMinutes.value = ''
}

onBeforeUnmount(() => clearTimer())
</script>

<template>
  <main class="container">
    <h1 class="title">Break Timer</h1>

    <section class="picker">
      <h2 class="sr-only">Choose a duration</h2>
      <div class="buttons">
        <button
          v-for="m in options"
          :key="m"
          class="option"
          :title="
            hovered && hovered === m
              ? `Expires at ${formatClock(hoveredExpiresAt)}`
              : `Start ${m} minute timer`
          "
          @mouseenter="hovered = m"
          @mouseleave="hovered = null"
          @click="start(m)"
        >
          {{ m }} min
        </button>
      </div>

      <p v-if="hoveredExpiresAt" class="hover-hint">
        Expires at {{ formatClock(hoveredExpiresAt) }}
      </p>

      <div class="custom">
        <label for="custom-minutes" class="custom-label">Custom minutes</label>
        <input
          id="custom-minutes"
          inputmode="numeric"
          type="number"
          min="1"
          placeholder="e.g. 25"
          class="custom-input"
          v-model="customMinutes"
        />
        <button class="custom-start" :disabled="!parsedCustomMinutes" @click="startCustom">
          Start
        </button>
      </div>
      <p v-if="customExpiresAt" class="hover-hint">Expires at {{ formatClock(customExpiresAt) }}</p>
    </section>

    <section v-if="running" class="status">
      <div class="row">
        <span class="label">Started:</span>
        <span class="value">{{ formatClock(startTime) }}</span>
      </div>
      <div class="row">
        <span class="label">Expires:</span>
        <span class="value">{{ formatClock(endTime) }}</span>
      </div>
      <div class="countdown" :class="{ done: remainingMs === 0 }">
        {{ countdown }}
      </div>
      <div class="actions">
        <button class="cancel" @click="cancel">Cancel</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.container {
  max-width: 720px;
  margin: 3rem auto;
  padding: 0 1rem;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Helvetica,
    Arial,
    'Apple Color Emoji',
    'Segoe UI Emoji';
  color: #1f2937;
}

.title {
  font-size: 2.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.picker {
  margin-bottom: 1.5rem;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.option {
  background: #111827;
  color: #fff;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition:
    transform 120ms ease,
    background 120ms ease,
    box-shadow 120ms ease;
}
.option:hover {
  transform: translateY(-1px);
  background: #0b1220;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
}
.option:active {
  transform: translateY(0);
}

.hover-hint {
  margin-top: 0.5rem;
  color: #4b5563;
}

.custom {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.custom-label {
  color: #6b7280;
}
.custom-input {
  width: 7rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  outline: none;
}
.custom-input:focus {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.15);
}
.custom-start {
  background: #111827;
  color: #fff;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
}
.custom-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status {
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.row {
  display: flex;
  gap: 0.5rem;
  margin: 0.25rem 0;
}
.label {
  color: #6b7280;
  min-width: 4.5rem;
}
.value {
  font-variant-numeric: tabular-nums;
}

.countdown {
  margin-top: 0.75rem;
  font-size: 3rem;
  line-height: 1;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.countdown.done {
  color: #dc2626;
}

.actions {
  margin-top: 0.75rem;
}
.cancel {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
}
.cancel:hover {
  background: #dc2626;
}
</style>
