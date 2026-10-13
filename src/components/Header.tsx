import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../lib/types'

export function Header({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  return (
    <header className="header">
      <div className="brand">
        <img className="brand-logo" src={`/branding/wordmark-${theme}.svg`} alt="JustType" width={194} height={44} />
      </div>
      <div className="header-right">
        <span className="tagline">Find your rhythm.</span>
        <button className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
