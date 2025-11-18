'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/Card'

interface CheckInForm {
  student_id: string
  date: string
  motivation_score: number
  energy_level: number
  stress_level: number
  comments: string
  factors: {
    task_progress: 'positive' | 'neutral' | 'negative'
    team_communication: 'positive' | 'neutral' | 'negative'
    personal_issues: 'none' | 'minor' | 'major'
    achievements: string[]
    challenges: string[]
  }
}

export default function CheckInPage() {
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [form, setForm] = useState<CheckInForm>({
    student_id: '',
    date: new Date().toISOString().split('T')[0],
    motivation_score: 3,
    energy_level: 3,
    stress_level: 3,
    comments: '',
    factors: {
      task_progress: 'neutral',
      team_communication: 'neutral',
      personal_issues: 'none',
      achievements: [],
      challenges: []
    }
  })
  const [achievementInput, setAchievementInput] = useState('')
  const [challengeInput, setChallengeInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastCheckIn, setLastCheckIn] = useState<any>(null)

  useEffect(() => {
    fetch('/api/students')
      .then(res => res.json())
      .then(data => {
        setStudents(Array.isArray(data) ? data : [])
        if (data.length > 0 && !selectedStudentId) {
          setSelectedStudentId(data[0].student_id)
          setForm(prev => ({ ...prev, student_id: data[0].student_id }))
        }
      })
      .catch(err => console.error('Error fetching students:', err))
  }, [])

  useEffect(() => {
    if (selectedStudentId) {
      setForm(prev => ({ ...prev, student_id: selectedStudentId }))
      fetch(`/api/checkins?student_id=${selectedStudentId}&days=1`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            const latest = data[data.length - 1]
            setLastCheckIn(latest)
            setForm(prev => ({
              ...prev,
              motivation_score: latest.motivation_score || 3,
              energy_level: latest.energy_level || 3,
              stress_level: latest.stress_level || 3,
            }))
          }
        })
        .catch(err => console.error('Error fetching last checkin:', err))
    }
  }, [selectedStudentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (response.ok) {
        alert('チェックインが保存されました！')
        window.location.href = `/student/${form.student_id}`
      } else {
        alert('エラーが発生しました')
      }
    } catch (error) {
      console.error('Error submitting checkin:', error)
      alert('エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  const addAchievement = () => {
    if (achievementInput.trim()) {
      setForm(prev => ({
        ...prev,
        factors: {
          ...prev.factors,
          achievements: [...prev.factors.achievements, achievementInput.trim()]
        }
      }))
      setAchievementInput('')
    }
  }

  const removeAchievement = (index: number) => {
    setForm(prev => ({
      ...prev,
      factors: {
        ...prev.factors,
        achievements: prev.factors.achievements.filter((_, i) => i !== index)
      }
    }))
  }

  const addChallenge = () => {
    if (challengeInput.trim()) {
      setForm(prev => ({
        ...prev,
        factors: {
          ...prev.factors,
          challenges: [...prev.factors.challenges, challengeInput.trim()]
        }
      }))
      setChallengeInput('')
    }
  }

  const removeChallenge = (index: number) => {
    setForm(prev => ({
      ...prev,
      factors: {
        ...prev.factors,
        challenges: prev.factors.challenges.filter((_, i) => i !== index)
      }
    }))
  }

  const ScoreSlider = ({ label, value, onChange, color }: { label: string, value: number, onChange: (v: number) => void, color: string }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-[#1d1d1f]">{label}</label>
        <span className={`text-lg font-semibold ${color}`}>{value}/5</span>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-[#e8e8ed] rounded-lg appearance-none cursor-pointer accent-[#007aff]"
      />
      <div className="flex justify-between text-xs text-[#86868b] mt-1">
        <span>低</span>
        <span>中</span>
        <span>高</span>
      </div>
    </div>
  )

  return (
    <>
      <div className="min-h-screen bg-[#f5f5f7] p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-[#1d1d1f] mb-2 tracking-tight">
              日次チェックイン
            </h1>
            <p className="text-[#86868b]">今日のモチベーションと状態を記録</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  学生を選択
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-4 py-3 border border-[#e8e8ed] rounded-xl bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                >
                  {students.map(student => (
                    <option key={student.student_id} value={student.student_id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  日付
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-[#e8e8ed] rounded-xl bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>

              <ScoreSlider
                label="モチベーション"
                value={form.motivation_score}
                onChange={(v) => setForm(prev => ({ ...prev, motivation_score: v }))}
                color="text-[#007aff]"
              />

              <ScoreSlider
                label="エネルギー"
                value={form.energy_level}
                onChange={(v) => setForm(prev => ({ ...prev, energy_level: v }))}
                color="text-[#34c759]"
              />

              <ScoreSlider
                label="ストレス"
                value={form.stress_level}
                onChange={(v) => setForm(prev => ({ ...prev, stress_level: v }))}
                color="text-[#ff3b30]"
              />

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  コメント
                </label>
                <textarea
                  value={form.comments}
                  onChange={(e) => setForm(prev => ({ ...prev, comments: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 border border-[#e8e8ed] rounded-xl bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent resize-none"
                  placeholder="今日の気持ちや状況を記録..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  タスク進捗
                </label>
                <div className="flex gap-3">
                  {(['positive', 'neutral', 'negative'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, factors: { ...prev.factors, task_progress: option } }))}
                      className={`flex-1 px-4 py-3 rounded-xl border transition-all ${
                        form.factors.task_progress === option
                          ? 'bg-[#007aff] text-white border-[#007aff]'
                          : 'bg-white text-[#1d1d1f] border-[#e8e8ed] hover:bg-[#fafafa]'
                      }`}
                    >
                      {option === 'positive' ? '良好' : option === 'neutral' ? '普通' : '悪い'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  チームコミュニケーション
                </label>
                <div className="flex gap-3">
                  {(['positive', 'neutral', 'negative'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, factors: { ...prev.factors, team_communication: option } }))}
                      className={`flex-1 px-4 py-3 rounded-xl border transition-all ${
                        form.factors.team_communication === option
                          ? 'bg-[#007aff] text-white border-[#007aff]'
                          : 'bg-white text-[#1d1d1f] border-[#e8e8ed] hover:bg-[#fafafa]'
                      }`}
                    >
                      {option === 'positive' ? '良好' : option === 'neutral' ? '普通' : '悪い'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  達成事項
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={achievementInput}
                    onChange={(e) => setAchievementInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
                    className="flex-1 px-4 py-2 border border-[#e8e8ed] rounded-xl bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                    placeholder="達成したことを入力..."
                  />
                  <button
                    type="button"
                    onClick={addAchievement}
                    className="px-4 py-2 bg-[#007aff] text-white rounded-xl hover:bg-[#0051d5] transition-colors"
                  >
                    追加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.factors.achievements.map((achievement, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-[#34c759]/10 text-[#34c759] rounded-full text-sm"
                    >
                      {achievement}
                      <button
                        type="button"
                        onClick={() => removeAchievement(index)}
                        className="hover:text-[#1d1d1f]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  課題・困難
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={challengeInput}
                    onChange={(e) => setChallengeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addChallenge())}
                    className="flex-1 px-4 py-2 border border-[#e8e8ed] rounded-xl bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                    placeholder="課題や困難を入力..."
                  />
                  <button
                    type="button"
                    onClick={addChallenge}
                    className="px-4 py-2 bg-[#007aff] text-white rounded-xl hover:bg-[#0051d5] transition-colors"
                  >
                    追加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.factors.challenges.map((challenge, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-[#ff3b30]/10 text-[#ff3b30] rounded-full text-sm"
                    >
                      {challenge}
                      <button
                        type="button"
                        onClick={() => removeChallenge(index)}
                        className="hover:text-[#1d1d1f]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-4 bg-[#007aff] text-white rounded-xl font-medium hover:bg-[#0051d5] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '保存中...' : 'チェックインを保存'}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}
