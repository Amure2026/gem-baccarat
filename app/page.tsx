'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RotateCcw, Trash2, Globe } from 'lucide-react'
import { Language, GameMode, LANGUAGE_NAMES, LANGUAGE_FLAGS, translations, TranslationKey } from '@/lib/i18n'

const LANGUAGES: Language[] = ['ru', 'tr', 'en', 'pt', 'vi', 'id', 'es', 'ms', 'ko']

// Red numbers in European roulette
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

// ============ BACCARAT MODE TYPES ============
interface Prediction {
  id: number
  value: 1 | 2
  position: { row: number; col: number }
}

interface PredictionLog {
  id: number
  predicted: 1 | 2
  actual?: 1 | 2
  status: 'pending' | 'matched' | 'not_matched'
  isTie?: boolean
}

// ============ ROULETTE MODE TYPES ============
interface RouletteSpin {
  value: number
  color: 'red' | 'black' | 'green'
}

interface RoulettePrediction {
  id: number
  color: 'red' | 'black'
  position: { col: number; row: number }
}

interface RoulettePredictionLog {
  id: number
  predictedColor: 'red' | 'black'
  actualColor?: 'red' | 'black' | 'green'
  status: 'pending' | 'matched' | 'not_matched'
}

// English labels for buttons, history and predictions (always English)
const MODE_LABELS_EN: Record<GameMode, { name: string; label1: string; label2: string; labelT: string }> = {
  baccarat: { name: 'Baccarat', label1: 'PLAYER', label2: 'BANKER', labelT: 'TIE' },
  dragonTiger: { name: 'Dragon Tiger', label1: 'DRAGON', label2: 'TIGER', labelT: 'TIE' },
  football: { name: 'Football', label1: 'HOME', label2: 'AWAY', labelT: 'DRAW' },
  roulette: { name: 'Roulette', label1: 'RED', label2: 'BLACK', labelT: 'ZERO' }
}

const MODE_CONFIG: Record<GameMode, {
  color1: string
  color2: string
  colorT: string
}> = {
  baccarat: {
    color1: 'bg-blue-600 hover:bg-blue-700',
    color2: 'bg-red-600 hover:bg-red-700',
    colorT: 'bg-green-600 hover:bg-green-700',
  },
  dragonTiger: {
    color1: 'bg-red-600 hover:bg-red-700',
    color2: 'bg-yellow-500 hover:bg-yellow-600',
    colorT: 'bg-green-600 hover:bg-green-700',
  },
  football: {
    color1: 'bg-red-600 hover:bg-red-700',
    color2: 'bg-blue-600 hover:bg-blue-700',
    colorT: 'bg-green-600 hover:bg-green-700',
  },
  roulette: {
    color1: 'bg-red-600 hover:bg-red-700',
    color2: 'bg-gray-800 hover:bg-gray-900',
    colorT: 'bg-green-600 hover:bg-green-700',
  }
}

// Helper to get number color
function getNumberColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green'
  return RED_NUMBERS.has(num) ? 'red' : 'black'
}

function getNumberColorClass(num: number): string {
  const color = getNumberColor(num)
  switch (color) {
    case 'red': return 'bg-red-600 hover:bg-red-700 text-white'
    case 'black': return 'bg-gray-800 hover:bg-gray-900 text-white'
    case 'green': return 'bg-green-600 hover:bg-green-700 text-white'
  }
}

// Language Selection Screen
function LanguageScreen({ onSelect }: { onSelect: (lang: Language) => void }) {
  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">💎</div>
        <h1 className="text-3xl font-bold text-purple-500 mb-2">GEM</h1>
        <p className="text-gray-400 text-sm">Game Prediction Tracker</p>
      </div>

      <Card className="bg-[#262626] border-gray-700 w-full max-w-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-lg font-bold text-gray-200 text-center">
            🌐 Select Language
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-2">
            {LANGUAGES.map(lang => (
              <Button
                key={lang}
                onClick={() => onSelect(lang)}
                className="w-full flex items-center justify-center gap-3 py-4 text-base bg-[#333] hover:bg-purple-600 text-gray-200 hover:text-white border border-gray-600 hover:border-purple-600 transition-all"
                variant="outline"
              >
                <span className="text-2xl">{LANGUAGE_FLAGS[lang]}</span>
                <span className="font-medium">{LANGUAGE_NAMES[lang]}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Roulette Mode Component
function RouletteMode({
  language,
  t,
  haptic,
  notification
}: {
  language: Language
  t: (key: TranslationKey) => string
  haptic: (type: 'light' | 'medium' | 'heavy') => void
  notification: (type: 'success' | 'warning' | 'error') => void
}) {
  const [spins, setSpins] = useState<RouletteSpin[]>([])
  const [predictions, setPredictions] = useState<RoulettePrediction[]>([])
  const [predictionLogs, setPredictionLogs] = useState<RoulettePredictionLog[]>([])
  const [predCount, setPredCount] = useState(0)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, total: 0 })
  const [status, setStatus] = useState('ready')
  const [lastColor, setLastColor] = useState<'red' | 'black'>('black')

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gemRouletteSpins')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setSpins(parsed)
          // Restore last color
          const colors = parsed.filter(s => s.color !== 'green').map(s => s.color)
          if (colors.length > 0) {
            setLastColor(colors[colors.length - 1] as 'red' | 'black')
          }
        }
      } catch (e) {
        console.error('Failed to load roulette spins:', e)
      }
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('gemRouletteSpins', JSON.stringify(spins))
  }, [spins])

  // Prediction algorithm from roulred.py
  const calcPrediction = useCallback((col: number, row: number, tableData: RouletteSpin[][]): 'red' | 'black' | null => {
    // left = spins[(col - 1) * 10 + row]
    // top = spins[col * 10 + (row - 1)]
    const leftIdx = (col - 1) * 10 + row
    const topIdx = col * 10 + (row - 1)
    
    if (leftIdx < 0 || topIdx < 0) return null
    if (leftIdx >= spins.length || topIdx >= spins.length) return null
    
    const left = spins[leftIdx]
    const top = spins[topIdx]
    
    if (!left || !top) return null
    if (left.color === 'green' || top.color === 'green') return null
    
    if (left.color === top.color) {
      return left.color
    }
    return null
  }, [spins])

  const addSpin = useCallback((num: number) => {
    const color = getNumberColor(num)
    const newSpin: RouletteSpin = { value: num, color }
    
    // Update last color for 0 handling
    if (color !== 'green') {
      setLastColor(color)
    }
    
    const newSpins = [...spins, newSpin]
    setSpins(newSpins)
    
    const idx = newSpins.length - 1
    const col = Math.floor(idx / 10)
    const row = idx % 10
    
    // Check prediction
    const existingPrediction = predictions.find(
      p => p.position.col === col && p.position.row === row
    )
    
    if (existingPrediction && color !== 'green') {
      const matched = existingPrediction.color === color
      setStats(prev => ({
        ...prev,
        correct: matched ? prev.correct + 1 : prev.correct,
        incorrect: matched ? prev.incorrect : prev.incorrect + 1,
        total: prev.total + 1
      }))
      setPredictionLogs(prev => prev.map(log =>
        log.id === existingPrediction.id
          ? { ...log, actualColor: color, status: matched ? 'matched' as const : 'not_matched' as const }
          : log
      ))
      setPredictions(prev => prev.filter(p => p.id !== existingPrediction.id))
    }
    
    // Generate new predictions
    if (col > 0) {
      for (let r = row + 1; r < 10; r++) {
        if (predictions.some(p => p.position.col === col && p.position.row === r)) continue
        
        const topIdx = col * 10 + (r - 1)
        const leftIdx = (col - 1) * 10 + r
        
        if (topIdx < newSpins.length && leftIdx < newSpins.length) {
          const top = newSpins[topIdx]
          const left = newSpins[leftIdx]
          
          if (top && left && top.color !== 'green' && left.color !== 'green') {
            if (top.color === left.color) {
              const newPredId = predCount + 1 + (r - row - 1)
              setPredCount(newPredId)
              
              setPredictions(prev => [...prev, {
                id: newPredId,
                color: top.color as 'red' | 'black',
                position: { col, row: r }
              }])
              
              setPredictionLogs(prev => [...prev, {
                id: newPredId,
                predictedColor: top.color as 'red' | 'black',
                status: 'pending'
              }])
            }
          }
        } else {
          break
        }
      }
    }
    
    haptic('light')
    setStatus('added')
  }, [spins, predictions, predCount, haptic])

  const deleteLast = useCallback(() => {
    if (spins.length === 0) return
    
    const idx = spins.length - 1
    const col = Math.floor(idx / 10)
    const row = idx % 10
    
    // Remove prediction for this position
    const predForPosition = predictions.find(
      p => p.position.col === col && p.position.row === row
    )
    
    if (predForPosition) {
      setPredictions(prev => prev.filter(p => p.id !== predForPosition.id))
      setPredictionLogs(prev => prev.filter(log => log.id !== predForPosition.id))
    }
    
    // Also remove any pending predictions that were generated after this spin
    setPredictions(prev => prev.filter(p => p.position.col < col || (p.position.col === col && p.position.row < row)))
    setPredictionLogs(prev => prev.filter(log => {
      const pred = predictions.find(p => p.id === log.id)
      return pred ? (pred.position.col < col || (pred.position.col === col && pred.position.row < row)) : true
    }))
    
    setSpins(prev => prev.slice(0, -1))
    haptic('medium')
    setStatus('deleted')
  }, [spins, predictions, haptic])

  const clearAll = useCallback(() => {
    setSpins([])
    setPredictions([])
    setPredictionLogs([])
    setStats({ correct: 0, incorrect: 0, total: 0 })
    setPredCount(0)
    setLastColor('black')
    haptic('heavy')
    notification('warning')
    setStatus('cleared')
  }, [haptic, notification])

  const getStatusMessage = (): string => {
    switch (status) {
      case 'ready': return t('ready')
      case 'added': return `${t('addedResult')} ✅`
      case 'deleted': return `${t('deletedResult')} ✅`
      case 'cleared': return t('baseCleared')
      default: return t('ready')
    }
  }

  const recentSpins = spins.slice(-20)

  return (
    <>
      {/* Prediction Log */}
      <Card className="bg-[#262626] border-gray-700 mb-3">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm font-bold text-gray-200 flex items-center justify-between">
            <span>{t('predictionLog')}</span>
            <span className="text-xs text-gray-400">✅ {stats.correct} | ❌ {stats.incorrect} | 📊 {stats.total}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          {predictionLogs.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
              {predictionLogs.slice().reverse().map(log => (
                <div
                  key={log.id}
                  className={`py-1 px-2 rounded ${
                    log.status === 'pending'
                      ? 'text-gray-400 bg-[#333]'
                      : log.status === 'matched'
                        ? 'text-green-500 bg-green-500/10'
                        : 'text-red-500 bg-red-500/10'
                  }`}
                >
                  #{log.id}. {t('predicted')}: {log.predictedColor === 'red' ? 'RED' : 'BLACK'}
                  {log.status === 'matched' && ` → ${t('matched')}`}
                  {log.status === 'not_matched' && ` → ${t('notMatched')}`}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-xs text-center py-2">{t('noResults')}</p>
          )}
        </CardContent>
      </Card>

      {/* Status */}
      <div className="text-center text-xs text-gray-400 mb-2">
        {getStatusMessage()}
      </div>

      {/* Number Buttons Grid */}
      <Card className="bg-[#262626] border-gray-700 mb-3">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm font-bold text-gray-200">
            {t('quickInput')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="grid gap-1">
            {/* Row 0 */}
            <div className="flex gap-1 justify-center">
              <Button
                onClick={() => addSpin(0)}
                className="bg-green-600 hover:bg-green-700 text-white min-w-[2.5rem] h-8 p-0 text-sm font-bold"
              >
                0
              </Button>
            </div>
            {/* Row 1-9 */}
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 10 }, (_, i) => i).map(num => (
                <Button
                  key={num}
                  onClick={() => addSpin(num)}
                  className={`${getNumberColorClass(num)} min-w-[2rem] h-8 p-0 text-xs font-bold`}
                  size="sm"
                >
                  {num}
                </Button>
              ))}
            </div>
            {/* Row 10-19 */}
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 10 }, (_, i) => i + 10).map(num => (
                <Button
                  key={num}
                  onClick={() => addSpin(num)}
                  className={`${getNumberColorClass(num)} min-w-[2rem] h-8 p-0 text-xs font-bold`}
                  size="sm"
                >
                  {num}
                </Button>
              ))}
            </div>
            {/* Row 20-29 */}
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 10 }, (_, i) => i + 20).map(num => (
                <Button
                  key={num}
                  onClick={() => addSpin(num)}
                  className={`${getNumberColorClass(num)} min-w-[2rem] h-8 p-0 text-xs font-bold`}
                  size="sm"
                >
                  {num}
                </Button>
              ))}
            </div>
            {/* Row 30-36 */}
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 7 }, (_, i) => i + 30).map(num => (
                <Button
                  key={num}
                  onClick={() => addSpin(num)}
                  className={`${getNumberColorClass(num)} min-w-[2rem] h-8 p-0 text-xs font-bold`}
                  size="sm"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Control Buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          onClick={deleteLast}
          variant="outline"
          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white border-orange-600 h-10"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          {t('delete')}
        </Button>
        <Button
          onClick={clearAll}
          variant="outline"
          className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600 h-10"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {t('clear')}
        </Button>
      </div>

      {/* History */}
      <Card className="bg-[#262626] border-gray-700 mb-3">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm font-bold text-gray-200">
            {t('history')} ({spins.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          {recentSpins.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {recentSpins.map((spin, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center justify-center min-w-[1.75rem] h-7 rounded font-bold text-xs ${
                    spin.color === 'green' ? 'bg-green-600 text-white' :
                    spin.color === 'red' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
                  }`}
                >
                  {spin.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-xs">{t('noResults')}</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export default function GemApp() {
  const { haptic, notification, isTelegram } = useTelegram()

  const [isLoadingStorage, setIsLoadingStorage] = useState(true)
  const [languageSelected, setLanguageSelected] = useState(false)
  const [language, setLanguage] = useState<Language>('en')
  const [showLanguageSelector, setShowLanguageSelector] = useState(false)
  
  // Game state
  const [mode, setMode] = useState<GameMode>('baccarat')
  const [sequence, setSequence] = useState<number[]>([])
  const [displayHistory, setDisplayHistory] = useState<(1 | 2 | 'tie')[]>([]) // For UI display only
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [predCount, setPredCount] = useState(0)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, total: 0 })
  const [predictionLogs, setPredictionLogs] = useState<PredictionLog[]>([])
  const [status, setStatus] = useState('ready')

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key]
  }, [language])

  useEffect(() => {
    const savedLang = localStorage.getItem('gemLanguage') as Language
    if (savedLang && LANGUAGES.includes(savedLang)) {
      setLanguage(savedLang)
      setLanguageSelected(true)
    }

    const savedMode = localStorage.getItem('gemMode') as GameMode
    if (savedMode && ['baccarat', 'dragonTiger', 'football', 'roulette'].includes(savedMode)) {
      setMode(savedMode)
    }

    const savedSequence = localStorage.getItem('gemSequence')
    if (savedSequence) {
      try {
        const parsed = JSON.parse(savedSequence)
        if (Array.isArray(parsed)) {
          setSequence(parsed)
        }
      } catch (e) {
        console.error('Failed to load saved sequence:', e)
      }
    }

    setIsLoadingStorage(false)
  }, [])

  useEffect(() => {
    if (languageSelected) {
      localStorage.setItem('gemLanguage', language)
    }
  }, [language, languageSelected])

  useEffect(() => {
    localStorage.setItem('gemMode', mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem('gemSequence', JSON.stringify(sequence))
  }, [sequence])

  // Prediction algorithm
  const predictNext = useCallback((row: number, col: number, currentVal: number, tableData: number[][]) => {
    const nextRow = row + 1
    if (nextRow <= 5 && col > 0) {
      const leftVal = tableData[nextRow]?.[col - 1]
      if (leftVal !== undefined && currentVal === leftVal) {
        return currentVal as 1 | 2
      }
    }
    return null
  }, [])

  // Build table data from sequence
  const buildTableData = useCallback((seq: number[]): number[][] => {
    const table: number[][] = [[], [], [], [], [], []]
    seq.forEach((val, idx) => {
      const row = idx % 6
      const col = Math.floor(idx / 6)
      table[row].push(val)
    })
    return table
  }, [])

  const addResult = useCallback((result: 1 | 2 | 'tie') => {
    let val: number
    if (result === 'tie') {
      val = sequence.length > 0 ? sequence[sequence.length - 1] : 1
    } else {
      val = result
    }

    const newSequence = [...sequence, val]
    const idx = newSequence.length - 1
    const row = idx % 6
    const col = Math.floor(idx / 6)

    setSequence(newSequence)

    // Update display history (shows TIE to user)
    setDisplayHistory(prev => [...prev, result])

    // Check prediction
    const existingPrediction = predictions.find(
      p => p.position.row === row && p.position.col === col
    )

    if (existingPrediction) {
      if (result === 'tie') {
        // Tie counts as incorrect
        setStats(prev => ({
          ...prev,
          incorrect: prev.incorrect + 1,
          total: prev.total + 1
        }))
        setPredictionLogs(prev => prev.map(log => 
          log.id === existingPrediction.id 
            ? { ...log, status: 'not_matched' as const, isTie: true }
            : log
        ))
      } else {
        const matched = existingPrediction.value === val
        setStats(prev => ({
          ...prev,
          correct: matched ? prev.correct + 1 : prev.correct,
          incorrect: matched ? prev.incorrect : prev.incorrect + 1,
          total: prev.total + 1
        }))
        setPredictionLogs(prev => prev.map(log => 
          log.id === existingPrediction.id 
            ? { ...log, actual: val as 1 | 2, status: matched ? 'matched' as const : 'not_matched' as const }
            : log
        ))
      }
      setPredictions(prev => prev.filter(p => p.id !== existingPrediction.id))
    }

    // Make new prediction
    const tableData = buildTableData(newSequence)
    const prediction = predictNext(row, col, val, tableData)
    
    if (prediction) {
      const newPredId = predCount + 1
      setPredCount(newPredId)
      const nextRow = row + 1
      const nextCol = col
      
      setPredictions(prev => [...prev, {
        id: newPredId,
        value: prediction,
        position: { row: nextRow, col: nextCol }
      }])
      
      setPredictionLogs(prev => [...prev, {
        id: newPredId,
        predicted: prediction,
        status: 'pending'
      }])
    }

    haptic('light')
    setStatus('added')
  }, [sequence, predictions, predCount, buildTableData, predictNext, haptic])

  const deleteLast = useCallback(() => {
    if (sequence.length === 0) return
    
    const idx = sequence.length - 1
    const row = idx % 6
    const col = Math.floor(idx / 6)
    
    // Remove prediction for this position if exists
    const predForPosition = predictions.find(
      p => p.position.row === row && p.position.col === col
    )
    
    if (predForPosition) {
      setPredictions(prev => prev.filter(p => p.id !== predForPosition.id))
      setPredictionLogs(prev => prev.filter(log => log.id !== predForPosition.id))
    }
    
    setSequence(prev => prev.slice(0, -1))
    setDisplayHistory(prev => prev.slice(0, -1))
    haptic('medium')
    setStatus('deleted')
  }, [sequence, predictions, haptic])

  const clearAll = useCallback(() => {
    setSequence([])
    setDisplayHistory([])
    setPredictions([])
    setPredictionLogs([])
    setStats({ correct: 0, incorrect: 0, total: 0 })
    setPredCount(0)
    haptic('heavy')
    notification('warning')
    setStatus('cleared')
  }, [haptic, notification])

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    setShowLanguageSelector(false)
    haptic('light')
  }

  const getStatusMessage = (): string => {
    switch (status) {
      case 'ready': return t('ready')
      case 'added': return `${t('addedResult')} ✅`
      case 'deleted': return `${t('deletedResult')} ✅`
      case 'cleared': return t('baseCleared')
      default: return t('ready')
    }
  }

  const modeConfig = MODE_CONFIG[mode]
  const recentDisplayHistory = displayHistory.slice(-20)

  // Helper to get English label for value (1 or 2) based on current mode
  const getValueLabel = (val: 1 | 2): string => {
    return val === 1 ? MODE_LABELS_EN[mode].label1 : MODE_LABELS_EN[mode].label2
  }

  // Helper for display history (includes TIE)
  const getDisplayLabel = (val: 1 | 2 | 'tie'): string => {
    if (val === 'tie') return MODE_LABELS_EN[mode].labelT
    return val === 1 ? MODE_LABELS_EN[mode].label1 : MODE_LABELS_EN[mode].label2
  }

  if (isLoadingStorage) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💎</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!languageSelected) {
    return <LanguageScreen onSelect={(lang) => { setLanguage(lang); setLanguageSelected(true); haptic('medium') }} />
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-gray-100 p-3 pb-6">
      {/* Header */}
      <header className="text-center mb-3">
        <h1 className="text-xl font-bold text-purple-500 flex items-center justify-center gap-2">
          💎 {t('title')}
        </h1>
        {isTelegram && (
          <p className="text-xs text-gray-400 mt-1">Telegram Mini App</p>
        )}
      </header>

      {/* Language Selector */}
      <div className="relative mb-3">
        <div className="text-xs text-gray-400 mb-1 text-center">{t('selectLanguage')}</div>
        <button
          onClick={() => setShowLanguageSelector(!showLanguageSelector)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#262626] border border-gray-700 text-sm text-gray-300 hover:bg-[#333] transition-colors"
        >
          <Globe className="w-4 h-4" />
          <span>{LANGUAGE_FLAGS[language]} {LANGUAGE_NAMES[language]}</span>
        </button>

        {showLanguageSelector && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#262626] border border-gray-700 rounded-lg overflow-hidden z-50 shadow-lg">
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                onClick={() => changeLanguage(lang)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#333] transition-colors ${language === lang ? 'bg-purple-600/20 text-purple-500' : 'text-gray-300'}`}
              >
                <span className="text-lg">{LANGUAGE_FLAGS[lang]}</span>
                <span>{LANGUAGE_NAMES[lang]}</span>
                {language === lang && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {(['baccarat', 'dragonTiger', 'football', 'roulette'] as GameMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); haptic('light') }}
            className={`flex-1 py-2 px-2 text-xs font-medium rounded-lg transition-all ${
              mode === m 
                ? 'bg-purple-600 text-white' 
                : 'bg-[#262626] text-gray-400 hover:bg-[#333]'
            }`}
          >
            {MODE_LABELS_EN[m].name}
          </button>
        ))}
      </div>

      {/* Roulette Mode */}
      {mode === 'roulette' && (
        <RouletteMode
          language={language}
          t={t}
          haptic={haptic}
          notification={notification}
        />
      )}

      {/* Baccarat / Dragon Tiger / Football Mode */}
      {mode !== 'roulette' && (
        <>
          {/* Prediction Log */}
          <Card className="bg-[#262626] border-gray-700 mb-3">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-bold text-gray-200">
                {t('predictionLog')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {predictionLogs.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {predictionLogs.slice().reverse().map(log => (
                    <div 
                      key={log.id} 
                      className={`py-1 px-2 rounded ${
                        log.status === 'pending' 
                          ? 'text-gray-400 bg-[#333]' 
                          : log.status === 'matched' 
                            ? 'text-green-500 bg-green-500/10' 
                            : 'text-red-500 bg-red-500/10'
                      }`}
                    >
                      #{log.id}. {t('predicted')}: {getValueLabel(log.predicted)}
                      {log.status === 'matched' && ` → ${t('matched')}`}
                      {log.status === 'not_matched' && (log.isTie ? ` → ${t('tieResult')}` : ` → ${t('notMatched')} (${t('actual')}: ${log.actual ? getValueLabel(log.actual) : '-'})`)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs text-center py-2">{t('noResults')}</p>
              )}
            </CardContent>
          </Card>

          {/* Status */}
          <div className="text-center text-xs text-gray-400 mb-2">
            {getStatusMessage()}
          </div>

          {/* Input Buttons */}
          <Card className="bg-[#262626] border-gray-700 mb-3">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-bold text-gray-200">
                {t('quickInput')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => addResult(1)}
                  className={`flex-1 h-14 text-sm font-bold ${modeConfig.color1} text-white`}
                >
                  {MODE_LABELS_EN[mode].label1}
                </Button>
                <Button
                  onClick={() => addResult('tie')}
                  className={`flex-1 h-14 text-sm font-bold ${modeConfig.colorT} text-white`}
                >
                  {MODE_LABELS_EN[mode].labelT}
                </Button>
                <Button
                  onClick={() => addResult(2)}
                  className={`flex-1 h-14 text-sm font-bold ${modeConfig.color2} text-white`}
                >
                  {MODE_LABELS_EN[mode].label2}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Control Buttons */}
          <div className="flex gap-2 mb-3">
            <Button
              onClick={deleteLast}
              variant="outline"
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white border-orange-600 h-10"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              {t('delete')}
            </Button>
            <Button
              onClick={clearAll}
              variant="outline"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600 h-10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {t('clear')}
            </Button>
          </div>

          {/* History */}
          <Card className="bg-[#262626] border-gray-700 mb-3">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-bold text-gray-200">
                {t('history')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {recentDisplayHistory.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {recentDisplayHistory.map((val, index) => (
                    <span
                      key={index}
                      className={`inline-flex items-center justify-center min-w-[3rem] h-7 rounded font-bold text-xs ${
                        val === 'tie' ? 'bg-green-600 text-white' : val === 1 ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
                      }`}
                    >
                      {getDisplayLabel(val)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs">{t('noResults')}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
