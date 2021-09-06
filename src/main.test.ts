import * as core from '@actions/core'
import { run } from './main'
import { RequestError } from '@octokit/request-error'
import * as dependabotCommits from './dependabot/verified_commits'

beforeEach(() => {
  jest.restoreAllMocks()

  jest.spyOn(core, 'info').mockImplementation(jest.fn())
  jest.spyOn(core, 'setFailed').mockImplementation(jest.fn())
  jest.spyOn(core, 'startGroup').mockImplementation(jest.fn())
})

test('it early exits with an error if github-token is not set', async () => {
  jest.spyOn(core, 'getInput').mockReturnValue('')

  await run()

  expect(core.setFailed).toHaveBeenCalledWith(
    expect.stringContaining('github-token is not set!')
  )
  /* eslint-disable no-unused-expressions */
  expect(dependabotCommits.getMessage).not.toHaveBeenCalled
  /* eslint-enable no-unused-expressions */
})

test('it does nothing if there is no metadata in the commit', async () => {
  jest.spyOn(core, 'getInput').mockReturnValue('mock-token')
  jest.spyOn(dependabotCommits, 'getMessage').mockImplementation(jest.fn(
    () => Promise.resolve('Just a commit message, nothing to see here.')
  ))

  await run()

  expect(core.info).toHaveBeenCalledWith(
    expect.stringContaining('PR does not contain metadata, nothing to do.')
  )
})

test('it sets the updated dependency as an output for subsequent actions', async () => {
  const mockCommitMessage =
    'Bumps [coffee-rails](https://github.com/rails/coffee-rails) from 4.0.1 to 4.2.2.\n' +
    '- [Release notes](https://github.com/rails/coffee-rails/releases)\n' +
    '- [Changelog](https://github.com/rails/coffee-rails/blob/master/CHANGELOG.md)\n' +
    '- [Commits](rails/coffee-rails@v4.0.1...v4.2.2)\n' +
    '\n' +
    '---\n' +
    'updated-dependencies:\n' +
    '- dependency-name: coffee-rails\n' +
    '  dependency-type: direct:production\n' +
    '  update-type: version-update:semver-minor\n' +
    '...\n' +
    '\n' +
    'Signed-off-by: dependabot[bot] <support@github.com>'

  jest.spyOn(core, 'getInput').mockReturnValue('mock-token')
  jest.spyOn(dependabotCommits, 'getMessage').mockImplementation(jest.fn(
    () => Promise.resolve(mockCommitMessage)
  ))
  jest.spyOn(core, 'setOutput').mockImplementation(jest.fn())

  await run()

  expect(core.startGroup).toHaveBeenCalledWith(
    expect.stringContaining('Outputting metadata for 1 updated dependency')
  )

  expect(core.setOutput).toHaveBeenCalledWith(
    'updated-dependencies-json',
    [
      {
        dependencyName: 'coffee-rails',
        dependencyType: 'direct:production',
        updateType: 'version-update:semver-minor'
      }
    ]
  )

  expect(core.setOutput).toBeCalledWith('dependency-names', 'coffee-rails')
  expect(core.setOutput).toBeCalledWith('dependency-type', 'direct:production')
  expect(core.setOutput).toBeCalledWith('update-type', 'version-update:semver-minor')
})

test('if there are multiple dependencies, it summarizes them', async () => {
  const mockCommitMessage =
    'Bumps [coffee-rails](https://github.com/rails/coffee-rails) from 4.0.1 to 4.2.2.\n' +
    '- [Release notes](https://github.com/rails/coffee-rails/releases)\n' +
    '- [Changelog](https://github.com/rails/coffee-rails/blob/master/CHANGELOG.md)\n' +
    '- [Commits](rails/coffee-rails@v4.0.1...v4.2.2)\n' +
    '\n' +
    '---\n' +
    'updated-dependencies:\n' +
    '- dependency-name: coffee-rails\n' +
    '  dependency-type: direct:production\n' +
    '  update-type: version-update:semver-minor\n' +
    '- dependency-name: coffeescript\n' +
    '  dependency-type: indirect\n' +
    '  update-type: version-update:semver-major\n' +
    '...\n' +
    '\n' +
    'Signed-off-by: dependabot[bot] <support@github.com>'

  jest.spyOn(core, 'getInput').mockReturnValue('mock-token')
  jest.spyOn(dependabotCommits, 'getMessage').mockImplementation(jest.fn(
    () => Promise.resolve(mockCommitMessage)
  ))
  jest.spyOn(core, 'setOutput').mockImplementation(jest.fn())

  await run()

  expect(core.startGroup).toHaveBeenCalledWith(
    expect.stringContaining('Outputting metadata for 2 updated dependencies')
  )

  expect(core.setOutput).toHaveBeenCalledWith(
    'updated-dependencies-json',
    [
      {
        dependencyName: 'coffee-rails',
        dependencyType: 'direct:production',
        updateType: 'version-update:semver-minor'
      },
      {
        dependencyName: 'coffeescript',
        dependencyType: 'indirect',
        updateType: 'version-update:semver-major'
      }
    ]
  )

  expect(core.setOutput).toBeCalledWith('dependency-names', 'coffee-rails, coffeescript')
  expect(core.setOutput).toBeCalledWith('dependency-type', 'direct:production')
  expect(core.setOutput).toBeCalledWith('update-type', 'version-update:semver-major')
})

test('it sets the action to failed if there is an unexpected exception', async () => {
  jest.spyOn(core, 'getInput').mockReturnValue('mock-token')
  jest.spyOn(dependabotCommits, 'getMessage').mockImplementation(jest.fn(
    () => Promise.reject(new Error('Something bad happened!'))
  ))

  await run()

  expect(core.setFailed).toHaveBeenCalledWith(
    expect.stringContaining('Something bad happened!')
  )
})

test('it sets the action to failed if there is a request error', async () => {
  jest.spyOn(core, 'getInput').mockReturnValue('mock-token')
  jest.spyOn(dependabotCommits, 'getMessage').mockImplementation(jest.fn(
    () => Promise.reject(new RequestError('Something bad happened!', 500, {
      headers: {},
      request: {
        method: 'GET',
        url: 'https://api.github.com/repos/dependabot/dependabot/pulls/101/commits',
        headers: {
          authorization: 'foo'
        }
      }
    }))
  ))

  await run()

  expect(core.setFailed).toHaveBeenCalledWith(
    expect.stringContaining('(500) Something bad happened!')
  )
})
