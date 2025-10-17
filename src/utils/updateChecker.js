/**
 * Update Checker Utility
 * Checks GitHub releases for new versions of QuestScribe
 */

const GITHUB_REPO = 'theserialhobbyist/questscribe'
const CURRENT_VERSION = '0.2.0'

/**
 * Compares two semantic version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  // Remove 'v' prefix and -alpha, -beta suffixes for comparison
  const clean1 = v1.replace(/^v/, '').split('-')[0]
  const clean2 = v2.replace(/^v/, '').split('-')[0]

  const parts1 = clean1.split('.').map(Number)
  const parts2 = clean2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0

    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }

  return 0
}

/**
 * Checks GitHub for the latest release
 * Returns null if no update available, or update info if available
 */
export async function checkForUpdates() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )

    if (!response.ok) {
      console.error('Failed to check for updates:', response.statusText)
      return null
    }

    const release = await response.json()
    const latestVersion = release.tag_name // e.g., "v0.2.0"

    // Check if this update has been ignored
    const ignoredVersion = localStorage.getItem('ignoredUpdateVersion')
    if (ignoredVersion === latestVersion) {
      return null // User ignored this version
    }

    // Compare versions
    if (compareVersions(latestVersion, CURRENT_VERSION) > 0) {
      return {
        version: latestVersion,
        url: release.html_url,
        releaseNotes: release.body,
        publishedAt: release.published_at
      }
    }

    return null // No update available
  } catch (error) {
    console.error('Error checking for updates:', error)
    return null
  }
}

/**
 * Marks a specific version as ignored by the user
 */
export function ignoreUpdate(version) {
  localStorage.setItem('ignoredUpdateVersion', version)
}

/**
 * Clears the ignored update (useful for testing)
 */
export function clearIgnoredUpdate() {
  localStorage.removeItem('ignoredUpdateVersion')
}
