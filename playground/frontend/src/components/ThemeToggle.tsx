import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Theme } from '../hooks/useTheme'

interface ThemeToggleProps {
    theme: Theme
    setTheme: (theme: Theme) => void
    isDark: boolean
}

export default function ThemeToggle({ theme, setTheme, isDark }: ThemeToggleProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer"
                    title="Toggle theme"
                >
                    {isDark ? (
                        <Moon className="h-4 w-4 transition-transform duration-200" />
                    ) : (
                        <Sun className="h-4 w-4 transition-transform duration-200" />
                    )}
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem
                    onClick={() => setTheme('system')}
                    className={`gap-2 cursor-pointer ${theme === 'system' ? 'font-semibold' : ''}`}
                >
                    <Monitor className="h-4 w-4" />
                    System
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme('light')}
                    className={`gap-2 cursor-pointer ${theme === 'light' ? 'font-semibold' : ''}`}
                >
                    <Sun className="h-4 w-4" />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme('dark')}
                    className={`gap-2 cursor-pointer ${theme === 'dark' ? 'font-semibold' : ''}`}
                >
                    <Moon className="h-4 w-4" />
                    Dark
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
