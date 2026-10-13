import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { Header } from './components/Header'
import { ModeSelector } from './components/ModeSelector'
import { TypingTest } from './components/TypingTest'
import { ResultsScreen } from './components/ResultsScreen'
import { useTypingTest } from './hooks/useTypingTest'
import { loadTheme, saveTheme } from './lib/storage'

export default function App() {
  const { state, session, restart, changeInput, feedback, isPersonalBest, personalBest } = useTypingTest()
  const [theme, setTheme] = useState(loadTheme)
  useEffect(() => { document.documentElement.dataset.theme = theme; saveTheme(theme) }, [theme])
  return (
    <div className="app-shell">
      <Header theme={theme} toggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />
      <main>
        <ModeSelector mode={state.mode} onChange={restart} />
        {state.result
          ? <ResultsScreen result={state.result} isPersonalBest={isPersonalBest} restart={() => restart()} />
          : <TypingTest state={state} session={session} feedback={feedback} changeInput={changeInput} restart={() => restart()} />}
      </main>
      <footer className="footer"><span><Keyboard size={15} />just you and the keys.</span><span>{personalBest ? <>personal best <strong>{Math.round(personalBest.wpm)} wpm</strong><span className="footer-separator">/</span></> : null}saved on this device</span></footer>
    </div>
  )
}
