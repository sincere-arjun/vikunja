import {describe, it, expect} from 'vitest'
import {mount} from '@vue/test-utils'

import EstimatedDurationInput from './EstimatedDurationInput.vue'

function mountInput(modelValue: number) {
	const wrapper = mount(EstimatedDurationInput, {
		props: {
			modelValue,
			'onUpdate:modelValue': (value: number) => wrapper.setProps({modelValue: value}),
		},
		global: {
			mocks: {$t: (key: string) => key},
		},
	})
	return wrapper
}

function emitted(wrapper: ReturnType<typeof mountInput>) {
	return wrapper.emitted<[number]>('update:modelValue')?.map(([value]) => value) ?? []
}

describe('EstimatedDurationInput', () => {
	it('shows the formatted model value', () => {
		const wrapper = mountInput(5400)
		expect(wrapper.find('input').element.value).toBe('1h 30m')
	})

	// The task detail focuses and scrolls to a field through the component's root element.
	it('renders a single root element', () => {
		expect(mountInput(0).vm.$el).toBeInstanceOf(HTMLElement)
	})

	it('saves once when Enter is followed by blur', async () => {
		const wrapper = mountInput(0)
		const input = wrapper.find('input')
		await input.setValue('1.5h')
		await input.trigger('keydown', {key: 'Enter'})
		await input.trigger('blur')

		expect(emitted(wrapper)).toEqual([5400])
		expect(input.element.value).toBe('1h 30m')
	})

	it('saves whole minutes once and shows them formatted', async () => {
		const wrapper = mountInput(0)
		const input = wrapper.find('input')
		await input.setValue('1.4m')
		await input.trigger('blur')
		await input.trigger('blur')

		expect(emitted(wrapper)).toEqual([60])
		expect(input.element.value).toBe('1m')
	})

	it('does not overwrite an estimate that is not whole minutes when left untouched', async () => {
		const wrapper = mountInput(30)
		const input = wrapper.find('input')
		expect(input.element.value).toBe('1m')
		await input.trigger('blur')

		expect(emitted(wrapper)).toEqual([])
	})

	it('does not save an unchanged duration typed differently', async () => {
		const wrapper = mountInput(5400)
		const input = wrapper.find('input')
		await input.setValue('90m')
		await input.trigger('blur')

		expect(emitted(wrapper)).toEqual([])
		expect(input.element.value).toBe('1h 30m')
	})

	it('shows an error and keeps the text for invalid input without saving', async () => {
		const wrapper = mountInput(5400)
		const input = wrapper.find('input')
		await input.setValue('1h 30')
		await input.trigger('blur')

		expect(emitted(wrapper)).toEqual([])
		expect(input.element.value).toBe('1h 30')
		expect(input.attributes('aria-invalid')).toBe('true')
		expect(wrapper.find('.help.is-danger').text()).toBe('task.detail.estimatedDurationInvalid')

		await input.setValue('2h')
		await input.trigger('blur')
		expect(emitted(wrapper)).toEqual([7200])
		expect(wrapper.find('.help.is-danger').exists()).toBe(false)
	})

	it('restores the saved estimate on Escape without saving', async () => {
		const wrapper = mountInput(7200)
		const input = wrapper.find('input')
		await input.setValue('soon')
		await input.trigger('blur')
		expect(wrapper.find('.help.is-danger').exists()).toBe(true)

		await input.setValue('')
		await input.trigger('keydown', {key: 'Escape'})
		expect(input.element.value).toBe('2h')
		expect(input.attributes('aria-invalid')).not.toBe('true')
		expect(wrapper.find('.help.is-danger').exists()).toBe(false)

		await input.trigger('blur')
		expect(emitted(wrapper)).toEqual([])
	})

	it('clears the estimate when the input is emptied', async () => {
		const wrapper = mountInput(5400)
		const input = wrapper.find('input')
		await input.setValue('')
		await input.trigger('blur')

		expect(emitted(wrapper)).toEqual([0])
	})
})
