<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type Minutes = 5 | 10 | 15 | 75

const options: Minutes[] = [5, 10, 15, 75]
const pendingMinutes = ref<number | null>(null)
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

type USTZ = { label: string; zone: string }
const usTimezones: USTZ[] = [
  { label: 'Eastern', zone: 'America/New_York' },
  { label: 'Central', zone: 'America/Chicago' },
  { label: 'Mountain', zone: 'America/Denver' },
  { label: 'Arizona', zone: 'America/Phoenix' },
  { label: 'Pacific', zone: 'America/Los_Angeles' },
  { label: 'Alaska', zone: 'America/Anchorage' },
  { label: 'Hawaii', zone: 'Pacific/Honolulu' },
]

function formatInZone(d: Date | null, timeZone: string): string {
  if (!d) return '--:--'
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
      timeZoneName: 'short',
    }).format(d)
  } catch {
    // Fallback to local if timezone unsupported
    return formatClock(d)
  }
}

const expiresByZone = computed(() =>
  usTimezones.map((tz) => ({ ...tz, display: formatInZone(endTime.value, tz.zone) })),
)

const countdown = computed(() => {
  const ms = remainingMs.value
  const sign = ms < 0 ? '-' : ''
  const absMs = Math.abs(ms)
  const totalSeconds = Math.floor(absMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const pendingExpiresAt = computed(() => {
  if (pendingMinutes.value == null) return null
  const now = Date.now()
  return new Date(now + pendingMinutes.value * 60_000)
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
    remainingMs.value = diff
  }
  update()
  tickHandle = window.setInterval(update, 250)
}

function startCustom() {
  if (!parsedCustomMinutes.value) return
  pendingMinutes.value = parsedCustomMinutes.value
}

function choosePreset(m: Minutes) {
  pendingMinutes.value = m
}

function confirmStart() {
  if (pendingMinutes.value == null) return
  start(pendingMinutes.value)
  pendingMinutes.value = null
}

function cancelPending() {
  pendingMinutes.value = null
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
          :title="`Preview ${m} minute timer expiration`"
          @click="choosePreset(m)"
        >
          {{ m }} min
        </button>
      </div>

      <div v-if="pendingMinutes !== null" class="confirm">
        <div>
          Start a {{ pendingMinutes }}-minute timer?
          <span class="confirm-expire">It will expire at {{ formatClock(pendingExpiresAt) }}</span>
        </div>
        <div class="confirm-actions">
          <button class="confirm-start" @click="confirmStart">Start timer</button>
          <button class="confirm-cancel" @click="cancelPending">Cancel</button>
        </div>
      </div>

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
      <p v-if="customExpiresAt && pendingMinutes === null" class="hover-hint">
        Expires at {{ formatClock(customExpiresAt) }}
      </p>
    </section>

    <section v-if="running" class="status">
      <div v-if="remainingMs <= 0" class="overdue-banner" role="alert" aria-live="assertive">
        Break is over
      </div>
      <div class="row">
        <span class="label">Started:</span>
        <span class="value">{{ formatClock(startTime) }}</span>
      </div>
      <div class="row">
        <span class="label">Expires:</span>
        <span class="value">{{ formatClock(endTime) }}</span>
      </div>
      <div class="tz-block">
        <div class="tz-title">Expires across U.S. timezones</div>
        <ul class="tz-list">
          <li v-for="tz in expiresByZone" :key="tz.zone">
            <span class="tz-label">{{ tz.label }}</span>
            <span class="tz-time">{{ tz.display }}</span>
          </li>
        </ul>
      </div>
      <div class="countdown" :class="{ overdue: remainingMs <= 0 }">
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

.confirm {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0.5rem;
}
.confirm-expire {
  color: #6b7280;
  margin-left: 0.25rem;
}
.confirm-actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
}
.confirm-start {
  background: #111827;
  color: #fff;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
}
.confirm-cancel {
  background: #e5e7eb;
  color: #111827;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
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

.overdue-banner {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
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

.tz-block {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}
.tz-title {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}
.tz-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tz-list li {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  border-top: 1px dashed #e5e7eb;
}
.tz-list li:first-child {
  border-top: none;
}
.tz-label {
  color: #6b7280;
}
.tz-time {
  font-variant-numeric: tabular-nums;
}

.countdown {
  margin-top: 0.75rem;
  font-size: 3rem;
  line-height: 1;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.countdown.overdue {
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
