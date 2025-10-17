/**
 * Spell Checker Utility
 * Uses Typo.js for spell checking and suggestions
 */

import Typo from 'typo-js'

let dictionary = null
let isLoading = false
let loadPromise = null
let customWords = new Set()

// Load custom words from localStorage
function loadCustomWords() {
  try {
    const stored = localStorage.getItem('customDictionary')
    if (stored) {
      customWords = new Set(JSON.parse(stored))
      console.log(`Loaded ${customWords.size} custom words`)
    }
  } catch (error) {
    console.error('Failed to load custom words:', error)
  }
}

// Save custom words to localStorage
function saveCustomWords() {
  try {
    localStorage.setItem('customDictionary', JSON.stringify([...customWords]))
  } catch (error) {
    console.error('Failed to save custom words:', error)
  }
}

// Initialize custom words on module load
loadCustomWords()

/**
 * Initialize the spell checker
 * Loads the dictionary files asynchronously
 */
export async function initSpellChecker() {
  if (dictionary) return dictionary
  if (isLoading) return loadPromise

  isLoading = true
  loadPromise = (async () => {
    try {
      // Load dictionary files
      const [affData, dicData] = await Promise.all([
        fetch('/dictionaries/en_US.aff').then(r => r.text()),
        fetch('/dictionaries/en_US.dic').then(r => r.text())
      ])

      dictionary = new Typo('en_US', affData, dicData)
      console.log('Spell checker initialized')
      return dictionary
    } catch (error) {
      console.error('Failed to load spell checker:', error)
      return null
    } finally {
      isLoading = false
    }
  })()

  return loadPromise
}

/**
 * Check if a word is spelled correctly
 * @param {string} word - The word to check
 * @returns {boolean} - True if spelled correctly
 */
export function checkWord(word) {
  if (!dictionary) return true // If dictionary not loaded, assume correct
  if (!word || word.trim() === '') return true

  // Remove punctuation and check
  const cleanWord = word.replace(/[.,!?;:'"]/g, '')

  // Check custom dictionary first
  if (customWords.has(cleanWord.toLowerCase())) {
    return true
  }

  return dictionary.check(cleanWord)
}

/**
 * Get spelling suggestions for a misspelled word
 * @param {string} word - The misspelled word
 * @returns {string[]} - Array of suggestions (up to 5)
 */
export function getSuggestions(word) {
  if (!dictionary) return []
  if (!word || word.trim() === '') return []

  // Remove punctuation
  const cleanWord = word.replace(/[.,!?;:'"]/g, '')
  const suggestions = dictionary.suggest(cleanWord)

  // Return up to 5 suggestions
  return suggestions.slice(0, 5)
}

/**
 * Add a word to the custom dictionary
 * @param {string} word - The word to add
 */
export function addToCustomDictionary(word) {
  if (!word || word.trim() === '') return

  const cleanWord = word.replace(/[.,!?;:'"]/g, '').toLowerCase()
  customWords.add(cleanWord)
  saveCustomWords()
  console.log(`Added "${cleanWord}" to custom dictionary`)
}

/**
 * Remove a word from the custom dictionary
 * @param {string} word - The word to remove
 */
export function removeFromCustomDictionary(word) {
  if (!word || word.trim() === '') return

  const cleanWord = word.replace(/[.,!?;:'"]/g, '').toLowerCase()
  customWords.delete(cleanWord)
  saveCustomWords()
  console.log(`Removed "${cleanWord}" from custom dictionary`)
}

/**
 * Get all custom words
 * @returns {string[]} - Array of custom words
 */
export function getCustomWords() {
  return [...customWords].sort()
}
