import { useState, useEffect, useCallback } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'playground-theme'

function getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored
        }
    } catch {
        // localStorage unavailable
    }
    return 'system'
}

function applyTheme(theme: Theme) {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    const root = document.documentElement
    if (resolved === 'dark') {
        root.classList.add('dark')
    } else {
        root.classList.remove('dark')
    }
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(getStoredTheme)

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme)
        try {
            localStorage.setItem(STORAGE_KEY, newTheme)
        } catch {
            // localStorage unavailable
        }
        applyTheme(newTheme)
    }, [])

    // Apply theme on mount
    useEffect(() => {
        applyTheme(theme)
    }, [theme])

    // Listen for system theme changes when in 'system' mode
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => {
            if (theme === 'system') {
                applyTheme('system')
            }
        }
        mediaQuery.addEventListener('change', handler)
        return () => mediaQuery.removeEventListener('change', handler)
    }, [theme])

    const isDark = theme === 'system' ? getSystemTheme() === 'dark' : theme === 'dark'

    return { theme, setTheme, isDark }
}
