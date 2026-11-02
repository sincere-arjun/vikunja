<template>
	<div
		class="estimated-duration-input"
		tabindex="-1"
		@focus="input?.focus()"
	>
		<!-- The task detail focuses a field through its root element; hand that focus to the input. -->
		<FormInput
			ref="input"
			v-model="text"
			type="text"
			:placeholder="$t('task.detail.estimatedDurationPlaceholder')"
			:aria-label="$t('task.attributes.estimatedDuration')"
			:class="{'is-danger': invalid}"
			:disabled="disabled"
			:error="invalid ? $t('task.detail.estimatedDurationInvalid') : null"
			@blur="commit"
			@keydown.enter.prevent="commit"
			@keydown.esc.prevent.stop="!$event.isComposing && reset()"
		/>
	</div>
</template>

<script setup lang="ts">
import {ref, useTemplateRef, watch} from 'vue'

import FormInput from '@/components/input/FormInput.vue'
import {formatDuration, parseDuration} from '@/helpers/time/duration'

withDefaults(defineProps<{
	disabled?: boolean
}>(), {
	disabled: false,
})

const estimatedDuration = defineModel<number>({required: true})

const input = useTemplateRef<InstanceType<typeof FormInput>>('input')
const text = ref<string | number>('')
const invalid = ref(false)

watch(estimatedDuration, seconds => {
	text.value = formatDuration(seconds)
	invalid.value = false
}, {immediate: true})

function reset() {
	text.value = formatDuration(estimatedDuration.value)
	invalid.value = false
}

function commit() {
	// Comparing text, not seconds: 30 seconds set through the API shows as "1m", which must not save on blur.
	if (String(text.value) === formatDuration(estimatedDuration.value)) {
		invalid.value = false
		return
	}

	const seconds = parseDuration(String(text.value))
	if (seconds === null) {
		invalid.value = true
		return
	}

	invalid.value = false
	text.value = formatDuration(seconds)
	if (seconds !== estimatedDuration.value) {
		estimatedDuration.value = seconds
	}
}
</script>

<style lang="scss" scoped>
.estimated-duration-input:focus {
	outline: none;
}
</style>
