import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { Header } from './components/Header'
import { ModeSelector } from './components/ModeSelector'
import { TypingTest } from './components/TypingTest'
import { ResultsScreen } from './components/ResultsScreen'
import { useTypingTest } from './hooks/useTypingTest'
import { loadTheme, saveTheme } from './lib/storage'

export default function App() {
  const { state, session, restart, changeInput, keyDown, keyUp, blurInput, feedback, recording, isPersonalBest, personalBest } = useTypingTest()
  const [theme, setTheme] = useState(loadTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', theme === 'dark' ? '/favicon-dark.svg' : '/favicon.svg')
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--background').trim())
    saveTheme(theme)
  }, [theme])
  return (
    <div className="app-shell">
      <Header theme={theme} toggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />
      <main className="main-content">
        <ModeSelector mode={state.mode} onChange={restart} />
        {state.result && recording
          ? <ResultsScreen result={state.result} recording={recording} isPersonalBest={isPersonalBest} restart={() => restart()} />
          : <TypingTest state={state} session={session} feedback={feedback} changeInput={changeInput} keyDown={keyDown} keyUp={keyUp} blurInput={blurInput} restart={() => restart()} />}
      </main>
      <footer className="footer"><span><Keyboard size={15} />just you and the keys.</span><span>{personalBest ? <>personal best <strong>{Math.round(personalBest.wpm)} wpm</strong><span className="footer-separator">/</span></> : null}saved on this device</span></footer>
    </div>
  )
}
