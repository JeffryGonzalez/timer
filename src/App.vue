<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type Minutes = 5 | 10 | 15 | 75

const options: Minutes[] = [5, 10, 15, 75]
const pendingMinutes = ref<number | null>(null)
const pendingExactEnd = ref<Date | null>(null)
const customMinutes = ref('')
const preciseEndLocal = ref('')

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
  if (pendingExactEnd.value) return pendingExactEnd.value
  if (pendingMinutes.value == null) return null
  const now = Date.now()
  return new Date(now + pendingMinutes.value * 60_000)
})

const pendingDurationMs = computed<number | null>(() =>
  pendingExactEnd.value ? pendingExactEnd.value.getTime() - Date.now() : null,
)

const parsedCustomMinutes = computed<number | null>(() => {
  const n = Number(customMinutes.value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
})

const customExpiresAt = computed(() => {
  if (!parsedCustomMinutes.value) return null
  return new Date(Date.now() + parsedCustomMinutes.value * 60_000)
})

const parsedPreciseEnd = computed<Date | null>(() => {
  if (!preciseEndLocal.value) return null
  const d = new Date(preciseEndLocal.value)
  return Number.isNaN(d.getTime()) ? null : d
})

const preciseEndIsFuture = computed(() => {
  return parsedPreciseEnd.value != null && parsedPreciseEnd.value.getTime() > Date.now()
})

const preciseDurationMs = computed(() =>
  parsedPreciseEnd.value ? parsedPreciseEnd.value.getTime() - Date.now() : 0,
)

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

function startUntil(end: Date) {
  clearTimer()
  const start = new Date()
  startTime.value = start
  endTime.value = end
  running.value = true
  const update = () => {
    const now = Date.now()
    remainingMs.value = end.getTime() - now
  }
  update()
  tickHandle = window.setInterval(update, 250)
}

function startCustom() {
  if (!parsedCustomMinutes.value) return
  pendingExactEnd.value = null
  pendingMinutes.value = parsedCustomMinutes.value
}

function choosePreset(m: Minutes) {
  pendingExactEnd.value = null
  pendingMinutes.value = m
}

function confirmStart() {
  if (pendingExactEnd.value) {
    startUntil(pendingExactEnd.value)
  } else if (pendingMinutes.value != null) {
    start(pendingMinutes.value)
  } else {
    return
  }
  pendingMinutes.value = null
  pendingExactEnd.value = null
  // keep preciseEndLocal as-is so the user can adjust if needed
}

function cancelPending() {
  pendingMinutes.value = null
  pendingExactEnd.value = null
}

function previewPreciseEnd() {
  if (!preciseEndIsFuture.value || !parsedPreciseEnd.value) return
  pendingMinutes.value = null
  pendingExactEnd.value = parsedPreciseEnd.value
}

function toDatetimeLocalValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${hh}:${mm}`
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function setPrecise(date: Date) {
  // ensure minute precision for datetime-local
  date.setSeconds(0, 0)
  preciseEndLocal.value = toDatetimeLocalValue(date)
  // immediately preview to show confirmation
  if (date.getTime() > Date.now()) {
    pendingMinutes.value = null
    pendingExactEnd.value = date
  }
}

function shortcutHalfPast() {
  const now = new Date()
  const d = new Date(now)
  if (now.getMinutes() >= 30) d.setHours(now.getHours() + 1)
  d.setMinutes(30, 0, 0)
  setPrecise(d)
}

function shortcutEndOfHour() {
  const now = new Date()
  const d = new Date(now)
  d.setMinutes(59, 0, 0)
  if (d.getTime() <= now.getTime()) {
    d.setHours(d.getHours() + 1)
    d.setMinutes(59, 0, 0)
  }
  setPrecise(d)
}

function shortcutNextHour() {
  const now = new Date()
  const d = new Date(now)
  d.setHours(now.getHours() + 1, 0, 0, 0)
  setPrecise(d)
}

function shortcutNoon() {
  const now = new Date()
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  setPrecise(d)
}

function shortcutEndOfDay() {
  // Compute next 5:00 PM Eastern Time and set as precise end
  const timeZone = 'America/New_York'
  const now = new Date()
  // Get current date parts in ET
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  })
  const partsNow = dtf.formatToParts(now)
  const map: Record<string, string> = {}
  for (const p of partsNow) map[p.type] = p.value
  let year = Number(map.year)
  let month = Number(map.month)
  let day = Number(map.day)

  // Helper to get timezone offset at a timestamp
  const getOffsetMs = (ts: number) => {
    const dtfFull = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = dtfFull.formatToParts(new Date(ts))
    const m: Record<string, string> = {}
    for (const p of parts) m[p.type] = p.value
    const asUTC = Date.UTC(
      Number(m.year),
      Number(m.month) - 1,
      Number(m.day),
      Number(m.hour),
      Number(m.minute),
      Number(m.second),
    )
    return asUTC - ts
  }

  const zonedTimeToUtc = (y: number, mo: number, d: number, h: number, mi: number) => {
    const initial = Date.UTC(y, mo - 1, d, h, mi, 0, 0)
    const off1 = getOffsetMs(initial)
    const guess = initial - off1
    const off2 = getOffsetMs(guess)
    return initial - off2
  }

  // Target 17:00 ET today
  let targetMs = zonedTimeToUtc(year, month, day, 17, 0)
  if (targetMs <= now.getTime()) {
    // move to tomorrow 17:00 ET
    const todayInEt = new Date(zonedTimeToUtc(year, month, day, 12, 0))
    const tomorrowEt = new Date(todayInEt.getTime() + 24 * 60 * 60 * 1000)
    const partsTomorrow = dtf.formatToParts(tomorrowEt)
    const mt: Record<string, string> = {}
    for (const p of partsTomorrow) mt[p.type] = p.value
    year = Number(mt.year)
    month = Number(mt.month)
    day = Number(mt.day)
    targetMs = zonedTimeToUtc(year, month, day, 17, 0)
  }

  setPrecise(new Date(targetMs))
}

onBeforeUnmount(() => clearTimer())
</script>

<template>
  <main class="container">
    <h1 class="title">Break Timer</h1>

    <section v-if="!running" class="picker">
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

      <div v-if="pendingMinutes !== null || pendingExactEnd" class="confirm">
        <div>
          <template v-if="pendingExactEnd">
            Start a timer until
            <span class="confirm-expire">{{ formatClock(pendingExpiresAt) }}</span>
            ?
          </template>
          <template v-else>
            Start a {{ pendingMinutes }}-minute timer?
            <span class="confirm-expire"
              >It will expire at {{ formatClock(pendingExpiresAt) }}</span
            >
          </template>
        </div>
        <div v-if="pendingExactEnd && pendingDurationMs" class="confirm-note">
          Duration {{ formatDuration(pendingDurationMs) }}
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

      <div class="custom precise">
        <label for="precise-end" class="custom-label">Precise end time</label>
        <input
          id="precise-end"
          type="datetime-local"
          class="custom-input"
          v-model="preciseEndLocal"
        />
        <button class="custom-start" :disabled="!preciseEndIsFuture" @click="previewPreciseEnd">
          Preview
        </button>
      </div>
      <div class="precise-shortcuts">
        <span class="shortcut-label">Shortcuts:</span>
        <button class="shortcut" @click="shortcutHalfPast">:30</button>
        <button class="shortcut" @click="shortcutEndOfHour">:59</button>
        <button class="shortcut" @click="shortcutNextHour">Next hour</button>
        <button class="shortcut" @click="shortcutNoon">Noon</button>
        <button class="shortcut" @click="shortcutEndOfDay">5:00 ET</button>
      </div>
      <p v-if="preciseEndIsFuture && pendingExactEnd === null" class="hover-hint">
        Expires at {{ formatClock(parsedPreciseEnd) }} · Duration
        {{ formatDuration(preciseDurationMs) }}
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
.confirm-note {
  margin-top: 0.25rem;
  color: #6b7280;
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
.custom.precise .custom-input {
  width: 16rem;
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

.precise-shortcuts {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.shortcut-label {
  color: #6b7280;
}
.shortcut {
  background: #f3f4f6;
  color: #111827;
  border: 1px solid #e5e7eb;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
}
.shortcut:hover {
  background: #e5e7eb;
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
