import { isTheme, resolveTheme, toggleTheme } from './theme.ts'

console.assert(isTheme('light') && isTheme('dark'), 'light and dark are themes')
console.assert(!isTheme('auto') && !isTheme(null), 'unknown values are not themes')
console.assert(toggleTheme('light') === 'dark', 'light toggles to dark')
console.assert(toggleTheme('dark') === 'light', 'dark toggles to light')
console.assert(resolveTheme('light') === 'light', 'stored light wins')
console.assert(resolveTheme('dark') === 'dark', 'stored dark wins')

console.log('theme tests passed')
