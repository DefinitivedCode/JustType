import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../lib/types'

export function Header({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  return (
    <header className="header">
      <div className="brand" aria-label="JustType">
        <svg className="brand-symbol" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M3 7h18M12 7v18M27 7v18" />
        </svg>
        <span>just<span className="brand-type">type</span><span className="brand-period">.</span></span>
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
