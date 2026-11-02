import {
	SECONDS_A_DAY,
	SECONDS_A_HOUR,
	SECONDS_A_MINUTE,
} from '@/constants/date'

const UNIT_MINUTES: Record<string, number> = {
	d: SECONDS_A_DAY / SECONDS_A_MINUTE,
	h: SECONDS_A_HOUR / SECONDS_A_MINUTE,
	m: 1,
}

const BARE_INTEGER = /^\d+$/
const DURATION = /^(?:\d+(?:\.\d+)?\s*[dhm]\s*)+$/
const DURATION_PART = /(\d+(?:\.\d+)?)\s*([dhm])/g

/**
 * Parses user input like "1h 30m", "1.5h", "2d 4h" or "90" (minutes) into seconds, rounded to whole minutes.
 * Returns 0 for empty input and null for anything it can't read.
 */
export function parseDuration(input: string): number | null {
	const text = input.trim().toLowerCase()
	if (text === '') {
		return 0
	}

	let minutes = 0
	if (BARE_INTEGER.test(text)) {
		minutes = Number(text)
	} else if (DURATION.test(text)) {
		const seenUnits = new Set<string>()
		for (const [, amount, unit] of text.matchAll(DURATION_PART)) {
			// "1h 2h" is more likely a typo than a sum.
			if (seenUnits.has(unit)) {
				return null
			}
			seenUnits.add(unit)
			minutes += Number(amount) * UNIT_MINUTES[unit]
		}
	} else {
		return null
	}

	// Store only what formatDuration can show.
	const roundedMinutes = Math.round(minutes)
	// "0.2m" must not clear the estimate; only an explicit zero does.
	if (roundedMinutes === 0 && minutes > 0) {
		return null
	}

	const seconds = roundedMinutes * SECONDS_A_MINUTE
	return Number.isSafeInteger(seconds) ? seconds : null
}

/**
 * Formats seconds as "2d 4h 30m", rounded to the minute. Empty for no duration.
 */
export function formatDuration(seconds: number | null | undefined): string {
	if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
		return ''
	}

	// The API accepts any number of seconds; a short estimate must not render as "no estimate".
	const totalMinutes = Math.max(1, Math.round(seconds / SECONDS_A_MINUTE))
	const minutesADay = SECONDS_A_DAY / SECONDS_A_MINUTE
	const minutesAnHour = SECONDS_A_HOUR / SECONDS_A_MINUTE

	const parts: [number, string][] = [
		[Math.floor(totalMinutes / minutesADay), 'd'],
		[Math.floor((totalMinutes % minutesADay) / minutesAnHour), 'h'],
		[totalMinutes % minutesAnHour, 'm'],
	]

	return parts
		.filter(([amount]) => amount > 0)
		.map(([amount, unit]) => `${amount}${unit}`)
		.join(' ')
}
