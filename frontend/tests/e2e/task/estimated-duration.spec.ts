import type {APIRequestContext, Page} from '@playwright/test'
import {test, expect} from '../../support/fixtures'
import {TaskFactory} from '../../factories/task'
import {createProjects} from '../project/prepareProjects'
import {apiRootUrl} from '../../support/apiUrl'

async function storedEstimate(apiContext: APIRequestContext, userToken: string, taskId: number) {
	const response = await apiContext.get(`${apiRootUrl(process.env.API_URL || 'http://localhost:3456')}/api/v2/tasks/${taskId}`, {
		headers: {Authorization: `Bearer ${userToken}`},
	})
	expect(response.ok()).toBe(true)
	return (await response.json()).estimated_duration ?? 0
}

function taskSaved(page: Page, taskId: number) {
	return page.waitForResponse(response =>
		response.request().method() !== 'GET' &&
		new URL(response.url()).pathname.endsWith(`/tasks/${taskId}`),
	)
}

function estimateField(page: Page) {
	return page.locator('.task-view .columns.details .column').filter({hasText: 'Estimate'})
}

function countSaveRequests(page: Page, taskId: number) {
	const counter = {count: 0}
	page.on('request', request => {
		if (request.method() !== 'GET' && new URL(request.url()).pathname.endsWith(`/tasks/${taskId}`)) {
			counter.count++
		}
	})
	return counter
}

async function showEstimateColumn(page: Page) {
	await page.getByRole('button', {name: 'Columns', exact: true}).click()
	await page.locator('.columns-filter').getByText('Estimate', {exact: true}).click()
	await page.getByRole('button', {name: 'Columns', exact: true}).click()
}

test.describe('Task estimated duration', () => {
	test('sets an estimate in the task detail and shows it in the list and table', async ({authenticatedPage: page, apiContext, userToken}) => {
		await createProjects(1)
		const [task] = await TaskFactory.create(1, {project_id: 1, title: 'Estimated task'})

		await page.goto(`/tasks/${task.id}`)
		await expect(estimateField(page)).toHaveCount(0)
		await page.locator('.task-view .action-buttons .button').filter({hasText: 'Set Estimate'}).click()

		const input = page.getByRole('textbox', {name: 'Estimate'})
		await expect(input).toBeFocused()
		await input.fill('1h 30m')
		const saved = taskSaved(page, task.id)
		await input.press('Enter')
		expect((await saved).ok()).toBe(true)
		await expect(input).toHaveValue('1h 30m')

		await page.reload()
		await expect(page.getByRole('textbox', {name: 'Estimate'})).toHaveValue('1h 30m')
		expect(await storedEstimate(apiContext, userToken, task.id)).toBe(5400)

		await page.goto('/projects/1/1')
		await expect(page.getByRole('img', {name: 'Estimate: 1h 30m'})).toBeVisible()

		await page.goto('/projects/1/3')
		await showEstimateColumn(page)
		const row = page.locator('.project-table tbody tr').filter({hasText: 'Estimated task'})
		await expect(row.locator('td').filter({hasText: '1h 30m'})).toBeVisible()
	})

	test('rejects invalid input without saving it', async ({authenticatedPage: page, apiContext, userToken}) => {
		await createProjects(1)
		const [task] = await TaskFactory.create(1, {
			project_id: 1,
			estimated_duration: 3600,
		})

		await page.goto(`/tasks/${task.id}`)
		const input = page.getByRole('textbox', {name: 'Estimate'})
		await expect(input).toHaveValue('1h')

		const saveRequests = countSaveRequests(page, task.id)
		await input.fill('soon')
		await input.press('Enter')
		await input.blur()

		await expect(estimateField(page).locator('.help.is-danger'))
			.toHaveText('Enter a duration with a unit, like 1.5h, 90m or 1h 30m.')
		await expect(input).toHaveAttribute('aria-invalid', 'true')
		await expect(input).toHaveValue('soon')
		expect(saveRequests.count).toBe(0)

		await page.reload()
		await expect(page.getByRole('textbox', {name: 'Estimate'})).toHaveValue('1h')
		expect(await storedEstimate(apiContext, userToken, task.id)).toBe(3600)
	})

	test('Escape restores the saved estimate without saving', async ({authenticatedPage: page, apiContext, userToken}) => {
		await createProjects(1)
		const [task] = await TaskFactory.create(1, {
			project_id: 1,
			estimated_duration: 7200,
		})

		await page.goto(`/tasks/${task.id}`)
		const input = page.getByRole('textbox', {name: 'Estimate'})
		await expect(input).toHaveValue('2h')

		const saveRequests = countSaveRequests(page, task.id)
		await input.fill('soon')
		await input.press('Enter')
		await expect(estimateField(page).locator('.help.is-danger')).toBeVisible()

		// Emptying the field and leaving it would clear the estimate; Escape backs out instead.
		await input.fill('')
		await input.press('Escape')
		await expect(input).toHaveValue('2h')
		await expect(estimateField(page).locator('.help.is-danger')).toHaveCount(0)
		await input.blur()
		await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`))
		expect(saveRequests.count).toBe(0)

		await page.reload()
		await expect(page.getByRole('textbox', {name: 'Estimate'})).toHaveValue('2h')
		expect(await storedEstimate(apiContext, userToken, task.id)).toBe(7200)
	})

	test('clearing the input removes the estimate', async ({authenticatedPage: page, apiContext, userToken}) => {
		await createProjects(1)
		const [task] = await TaskFactory.create(1, {
			project_id: 1,
			estimated_duration: 7200,
		})

		await page.goto(`/tasks/${task.id}`)
		const input = page.getByRole('textbox', {name: 'Estimate'})
		await expect(input).toHaveValue('2h')
		await input.fill('')
		const saved = taskSaved(page, task.id)
		await input.press('Enter')
		expect((await saved).ok()).toBe(true)
		await expect(estimateField(page)).toHaveCount(0)

		await page.reload()
		await expect(page.locator('.task-view .action-buttons .button').filter({hasText: 'Set Estimate'})).toBeVisible()
		await expect(estimateField(page)).toHaveCount(0)
		expect(await storedEstimate(apiContext, userToken, task.id)).toBe(0)
	})

	test('shows the estimate on list rows that have one', async ({authenticatedPage: page}) => {
		await createProjects(1)
		const [withEstimate, withoutEstimate] = await TaskFactory.create(2, {
			project_id: 1,
			title: (i: number) => `Estimate task ${i}`,
			estimated_duration: (i: number) => i === 1 ? 189000 : 0,
		})

		await page.goto('/projects/1/1')
		const row = (title: string) => page.locator('.tasks .single-task').filter({
			has: page.getByRole('link', {name: title, exact: true}),
		})
		await expect(row(withEstimate.title).getByRole('img', {name: 'Estimate: 2d 4h 30m'})).toHaveText('2d 4h 30m')
		await expect(row(withoutEstimate.title)).toBeVisible()
		await expect(row(withoutEstimate.title).locator('.estimated-duration')).toHaveCount(0)
	})

	test('filters the list by estimate in seconds', async ({authenticatedPage: page}) => {
		await createProjects(1)
		await TaskFactory.create(3, {
			project_id: 1,
			title: (i: number) => ['Short task', 'Long task', 'Unestimated task'][i - 1],
			estimated_duration: (i: number) => [1800, 7200, 0][i - 1],
		})

		await page.goto('/projects/1/1')
		await expect(page.locator('.tasks')).toContainText('Unestimated task')

		await page.locator('.filter-container button').filter({hasText: 'Filters'}).click()
		await page.locator('.filter-popup .filter-input .ProseMirror').fill('estimatedDuration > 3600')
		await page.locator('.filter-popup button').filter({hasText: 'Show results'}).click()

		// The URL holds the filter as the API expects it.
		await expect(page).toHaveURL(/filter=estimated_duration/)
		await expect(page.locator('.tasks')).toContainText('Long task')
		await expect(page.locator('.tasks')).not.toContainText('Short task')
		await expect(page.locator('.tasks')).not.toContainText('Unestimated task')
	})

	test('shows a sortable estimate column in the table view', async ({authenticatedPage: page}) => {
		await createProjects(1)
		// Asymmetric values so neither insertion order nor id order matches either sort.
		await TaskFactory.create(3, {
			project_id: 1,
			title: (i: number) => `Table task ${i}`,
			estimated_duration: (i: number) => [3600, 600, 90000][i - 1],
		})

		await page.goto('/projects/1/3')
		await showEstimateColumn(page)

		const header = page.locator('.project-table table.table th').filter({hasText: 'Estimate'})
		await expect(header).toBeVisible()

		const estimateCells = async () => {
			const index = await page.locator('.project-table table.table th').evaluateAll(
				headers => headers.findIndex(th => th.textContent?.includes('Estimate')),
			)
			return page.locator(`.project-table tbody tr td:nth-child(${index + 1})`).allTextContents()
		}

		await page.getByRole('button', {name: 'Sort by Estimate'}).click()
		await expect(header).toHaveAttribute('aria-sort', 'descending')
		await expect.poll(async () => (await estimateCells()).map(text => text.trim()))
			.toEqual(['1d 1h', '1h', '10m'])

		await page.getByRole('button', {name: 'Sort by Estimate'}).click()
		await expect(header).toHaveAttribute('aria-sort', 'ascending')
		await expect.poll(async () => (await estimateCells()).map(text => text.trim()))
			.toEqual(['10m', '1h', '1d 1h'])
	})
})
