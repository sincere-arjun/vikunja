import {describe, expect, it} from 'vitest'

import {formatDuration, parseDuration} from './duration'

describe('parseDuration', () => {
	it.each([
		['1h 30m', 5400],
		['1h30m', 5400],
		['90m', 5400],
		['1.5h', 5400],
		['2d 4h', 187200],
		['2d4h30m', 189000],
		['1d', 86400],
		['45m', 2700],
		['0.5m', 30],
		['30m 1h', 5400],
	])('parses "%s" as %i seconds', (input, expected) => {
		expect(parseDuration(input)).toBe(expected)
	})

	it.each([
		['1H 30M', 5400],
		['2D', 172800],
		['1h 30M', 5400],
	])('ignores case in "%s"', (input, expected) => {
		expect(parseDuration(input)).toBe(expected)
	})

	it.each([
		['  1h   30m  ', 5400],
		['1 h 30 m', 5400],
		['\t2d\t4h ', 187200],
	])('allows extra whitespace in "%s"', (input, expected) => {
		expect(parseDuration(input)).toBe(expected)
	})

	it.each([
		['90', 5400],
		[' 90 ', 5400],
		['1.5', 90],
		['0', 0],
	])('reads the bare number "%s" as minutes', (input, expected) => {
		expect(parseDuration(input)).toBe(expected)
	})

	it.each([
		[''],
		['   '],
	])('returns 0 for empty input %j', (input) => {
		expect(parseDuration(input)).toBe(0)
	})

	it.each([
		['abc'],
		['1x'],
		['h'],
		['1h 30'],
		['30 1h'],
		['1h foo'],
		['1h 1h'],
		['-1h'],
		['-30'],
		['1,5h'],
		['.5h'],
		['1.h'],
		['1hour'],
		['1w'],
		['1s'],
		['1h-30m'],
		['1e3'],
		['Infinity'],
		['NaN'],
	])('rejects "%s"', (input) => {
		expect(parseDuration(input)).toBeNull()
	})

	it('rejects durations beyond the safe integer range', () => {
		expect(parseDuration('9'.repeat(20) + 'd')).toBeNull()
		expect(parseDuration('9'.repeat(400))).toBeNull()
	})

	it('rounds fractional seconds', () => {
		expect(parseDuration('0.01m')).toBe(1)
		expect(parseDuration('0.001m')).toBe(0)
	})
})

describe('formatDuration', () => {
	it.each([
		[5400, '1h 30m'],
		[3600, '1h'],
		[60, '1m'],
		[2700, '45m'],
		[86400, '1d'],
		[187200, '2d 4h'],
		[189000, '2d 4h 30m'],
		[86460, '1d 1m'],
	])('formats %i seconds as "%s"', (seconds, expected) => {
		expect(formatDuration(seconds)).toBe(expected)
	})

	it.each([
		[0],
		[-60],
		[null],
		[undefined],
		[Number.NaN],
		[Number.POSITIVE_INFINITY],
	])('returns an empty string for %s', (seconds) => {
		expect(formatDuration(seconds)).toBe('')
	})

	it('rounds to the nearest minute', () => {
		expect(formatDuration(89)).toBe('1m')
		expect(formatDuration(90)).toBe('2m')
		expect(formatDuration(5399)).toBe('1h 30m')
	})

	it('never formats a positive duration as empty', () => {
		expect(formatDuration(1)).toBe('1m')
		expect(formatDuration(29)).toBe('1m')
	})

	it.each([
		['1h 30m'],
		['2d 4h'],
		['2d 4h 30m'],
		['45m'],
		['3d'],
	])('round-trips "%s"', (input) => {
		expect(formatDuration(parseDuration(input))).toBe(input)
	})
})
