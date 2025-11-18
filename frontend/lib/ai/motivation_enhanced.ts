/**
 * モチベーション推定ロジック（改善版）
 * チェックインデータと行動データを統合してモチベーションを1〜5で返す
 */

interface StudentProfile {
  student_id: string
  MBTI: string
  animal_type: string
  // スキル値（1-5スケール）
  skill_企画?: number
  skill_実行?: number
  skill_調整?: number
  skill_探索?: number
  skill_デザイン?: number
  skill_開発?: number
  skill_分析?: number
  skill_ドキュメント作成?: number
  skill_コミュニケーション?: number
  skill_リーダーシップ?: number
  skill_プレゼンテーション?: number
  skill_問題解決?: number
  // 後方互換性のため（段階的移行）
  strengths?: string[]
  weaknesses?: string[]
  preferred_partners: string[]
  avoided_partners: string[]
}

interface TaskData {
  task_id: string
  status: 'pending' | 'in_progress' | 'completed'
  difficulty: number
  category: string
}

interface TeamCompatibility {
  partner_ids: string[]
  preferred_partners: string[]
  avoided_partners: string[]
}

interface CheckInData {
  date: string
  motivation_score: number
  energy_level: number
  stress_level: number
  factors: {
    task_progress: 'positive' | 'neutral' | 'negative'
    team_communication: 'positive' | 'neutral' | 'negative'
    personal_issues: 'none' | 'minor' | 'major'
  }
}

interface ActivityData {
  task_updates: number // 過去7日間のタスク更新回数
  commits: number // 過去7日間のコミット数
  messages: number // 過去7日間のメッセージ数
  meeting_attendance: number // 過去7日間の会議出席率
}

/**
 * 改善されたモチベーション計算（チェックインデータ統合版）
 */
export function calculateMotivationEnhanced(
  profile: StudentProfile,
  tasks: TaskData[],
  compatibility: TeamCompatibility,
  recentCheckIns: CheckInData[], // 過去7-14日間のチェックイン
  activityData?: ActivityData
): {
  score: number
  confidence: number
  breakdown: {
    selfReported: number
    taskBased: number
    teamCompatibility: number
    mbtiBase: number
    activityBased?: number
  }
} {
  let score = 0
  let weightSum = 0
  const breakdown: any = {}

  // 1. 自己申告データ（チェックイン）（重み: 35%）
  let selfReportedScore = 3.0 // デフォルト
  let checkInConfidence = 0
  
  if (recentCheckIns.length > 0) {
    // 最近のチェックインの平均（重み付き：新しいほど重い）
    const weights = recentCheckIns.map((_, idx) => {
      const daysAgo = recentCheckIns.length - idx - 1
      return Math.max(0.5, 1.0 - (daysAgo * 0.1)) // 新しいものほど重い
    })
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    
    selfReportedScore = recentCheckIns.reduce((sum, checkin, idx) => {
      return sum + (checkin.motivation_score * weights[idx])
    }, 0) / totalWeight

    // チェックインの信頼度（データの新しさと量）
    const daysSinceLastCheckIn = recentCheckIns.length > 0 
      ? Math.floor((new Date().getTime() - new Date(recentCheckIns[recentCheckIns.length - 1].date).getTime()) / (1000 * 60 * 60 * 24))
      : 7
    checkInConfidence = Math.max(0.3, 1.0 - (daysSinceLastCheckIn / 7) * 0.5) // 7日以上前なら信頼度低下
    checkInConfidence = Math.min(1.0, checkInConfidence * (recentCheckIns.length / 7)) // データが多いほど信頼度高い
  }

  const selfReportedWeight = 0.35 * checkInConfidence
  score += selfReportedScore * selfReportedWeight
  weightSum += selfReportedWeight
  breakdown.selfReported = selfReportedScore

  // 2. タスク完了率によるスコア（重み: 25% → チェックインがない場合は40%）
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0.5
  const taskScore = completionRate * 5
  
  const taskWeight = recentCheckIns.length > 0 ? 0.25 : 0.40
  score += taskScore * taskWeight
  weightSum += taskWeight
  breakdown.taskBased = taskScore

  // 3. タスクの難易度と自分のスキルのマッチ度（重み: 20% → チェックインがない場合は25%）
  const strengthMatch = tasks
    .filter(t => t.status !== 'completed')
    .reduce((sum, task) => {
      // スキル値から判定（3.5以上を得意とする）
      let skillValue = 3.0 // デフォルト
      const categoryMap: Record<string, keyof StudentProfile> = {
        '企画': 'skill_企画',
        '実行': 'skill_実行',
        '調整': 'skill_調整',
        '探索': 'skill_探索',
        'デザイン': 'skill_デザイン',
        '開発': 'skill_開発',
        '分析': 'skill_分析',
        'ドキュメント作成': 'skill_ドキュメント作成'
      }
      const skillKey = categoryMap[task.category]
      if (skillKey && profile[skillKey] !== undefined) {
        skillValue = profile[skillKey] as number
      } else if (profile.strengths && profile.strengths.includes(task.category)) {
        // 後方互換性: strengthsが存在する場合は使用
        skillValue = 4.0
      }
      
      // スキル値が3.5以上の場合、マッチ度を計算
      const match = skillValue >= 3.5 ? (skillValue / 5) : 0
      return sum + match * (task.difficulty / 5)
    }, 0)
  const avgStrengthMatch = tasks.length > 0 ? strengthMatch / tasks.length : 0
  const strengthScore = avgStrengthMatch * 5
  
  const strengthWeight = recentCheckIns.length > 0 ? 0.20 : 0.25
  score += strengthScore * strengthWeight
  weightSum += strengthWeight
  breakdown.strengthMatch = strengthScore

  // 4. チーム相性スコア（重み: 15%）
  const preferredCount = compatibility.partner_ids.filter(id => 
    compatibility.preferred_partners.includes(id)
  ).length
  const avoidedCount = compatibility.partner_ids.filter(id => 
    compatibility.avoided_partners.includes(id)
  ).length
  const compatibilityScore = Math.max(0, Math.min(5, 
    3 + (preferredCount * 0.5) - (avoidedCount * 1.0)
  ))
  score += compatibilityScore * 0.15
  weightSum += 0.15
  breakdown.teamCompatibility = compatibilityScore

  // 5. MBTI特性によるベーススコア（重み: 5% → チェックインがある場合は軽減）
  const mbtiBase = getMBTIBaseScore(profile.MBTI)
  const mbtiWeight = recentCheckIns.length > 0 ? 0.05 : 0.15
  score += mbtiBase * mbtiWeight
  weightSum += mbtiWeight
  breakdown.mbtiBase = mbtiBase

  // 6. 活動データベースのスコア（オプション、重み: 5%）
  if (activityData) {
    const activityScore = calculateActivityScore(activityData)
    score += activityScore * 0.05
    weightSum += 0.05
    breakdown.activityBased = activityScore
  }

  const finalScore = weightSum > 0 ? score / weightSum : 3
  const confidence = Math.max(0.5, Math.min(1.0, 
    checkInConfidence * 0.6 + (recentCheckIns.length > 0 ? 0.4 : 0.2)
  ))

  return {
    score: Math.max(1, Math.min(5, Math.round(finalScore * 10) / 10)),
    confidence,
    breakdown
  }
}

/**
 * MBTIタイプからベーススコアを取得（1-5）
 */
function getMBTIBaseScore(mbti: string): number {
  if (mbti.startsWith('EN')) return 4.0
  if (mbti.startsWith('ES')) return 3.5
  if (mbti.startsWith('IN')) return 3.0
  if (mbti.startsWith('IS')) return 2.5
  return 3.0 // デフォルト
}

/**
 * 活動データからモチベーションスコアを計算
 */
function calculateActivityScore(activity: ActivityData): number {
  let score = 3.0 // ベーススコア

  // タスク更新頻度（高いほど良い）
  if (activity.task_updates > 0) {
    const taskUpdateScore = Math.min(5, 3 + (activity.task_updates / 5) * 2)
    score = (score * 0.4) + (taskUpdateScore * 0.6)
  }

  // コミット頻度（高いほど良い）
  if (activity.commits > 0) {
    const commitScore = Math.min(5, 3 + (activity.commits / 10) * 2)
    score = (score * 0.5) + (commitScore * 0.5)
  }

  // メッセージ頻度（適度なコミュニケーション）
  if (activity.messages > 0) {
    const messageScore = Math.min(5, 3 + Math.min(1, activity.messages / 20) * 2)
    score = (score * 0.6) + (messageScore * 0.4)
  }

  // 会議出席率（高いほど良い）
  if (activity.meeting_attendance > 0) {
    const attendanceScore = activity.meeting_attendance * 5
    score = (score * 0.7) + (attendanceScore * 0.3)
  }

  return Math.max(1, Math.min(5, score))
}

/**
 * モチベーションの変化を検知
 */
export function detectMotivationChange(
  recentScores: number[], // 過去7-14日間のスコア
  historicalAverage: number
): {
  changeType: 'sudden_drop' | 'gradual_decline' | 'sudden_rise' | 'gradual_improvement' | 'stable'
  magnitude: number
  duration: number
  confidence: number
  potentialCauses: string[]
  recommendedActions: string[]
} {
  if (recentScores.length < 3) {
    return {
      changeType: 'stable',
      magnitude: 0,
      duration: 0,
      confidence: 0.3,
      potentialCauses: [],
      recommendedActions: []
    }
  }

  const latest = recentScores[recentScores.length - 1]
  const previous = recentScores[recentScores.length - 2]
  const change = latest - previous
  const avgRecent = recentScores.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, recentScores.length)
  const avgHistorical = historicalAverage

  // 急激な変化の検知（±1.0以上）
  if (Math.abs(change) >= 1.0) {
    const changeType = change < 0 ? 'sudden_drop' : 'sudden_rise'
    const magnitude = Math.abs(change)
    
    return {
      changeType,
      magnitude,
      duration: 1,
      confidence: 0.9,
      potentialCauses: generateCauses(changeType, magnitude),
      recommendedActions: generateActions(changeType, magnitude)
    }
  }

  // 継続的な傾向の検知（線形回帰）
  const trend = calculateTrend(recentScores)
  if (Math.abs(trend) > 0.1) {
    const changeType = trend < 0 ? 'gradual_decline' : 'gradual_improvement'
    const magnitude = Math.abs(trend) * recentScores.length
    
    return {
      changeType,
      magnitude,
      duration: recentScores.length,
      confidence: 0.7,
      potentialCauses: generateCauses(changeType, magnitude),
      recommendedActions: generateActions(changeType, magnitude)
    }
  }

  return {
    changeType: 'stable',
    magnitude: 0,
    duration: 0,
    confidence: 0.8,
    potentialCauses: [],
    recommendedActions: []
  }
}

/**
 * 線形トレンドを計算
 */
function calculateTrend(scores: number[]): number {
  const n = scores.length
  const sumX = (n * (n - 1)) / 2
  const sumY = scores.reduce((a, b) => a + b, 0)
  const sumXY = scores.reduce((sum, y, x) => sum + x * y, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return slope
}

/**
 * 変化の原因を生成
 */
function generateCauses(
  changeType: 'sudden_drop' | 'gradual_decline' | 'sudden_rise' | 'gradual_improvement',
  magnitude: number
): string[] {
  if (changeType === 'sudden_drop' || changeType === 'gradual_decline') {
    return [
      'タスク負荷の増加',
      'チーム内のコミュニケーション問題',
      '個人的な問題やストレス',
      'タスクの難易度が高すぎる',
      'プロジェクトの方向性への疑問',
      'チームメンバーとの相性問題'
    ]
  } else {
    return [
      'タスクの完了による達成感',
      'チーム内のコミュニケーション改善',
      '適切なタスクの割り当て',
      'プロジェクトの進捗が良好',
      'チームメンバーとの協働が順調'
    ]
  }
}

/**
 * 推奨アクションを生成
 */
function generateActions(
  changeType: 'sudden_drop' | 'gradual_decline' | 'sudden_rise' | 'gradual_improvement',
  magnitude: number
): string[] {
  if (changeType === 'sudden_drop' || changeType === 'gradual_decline') {
    const actions = [
      '個別面談を実施して状況を確認',
      'タスクの優先順位を見直し',
      'タスクの再分配を検討',
      'チームメンバーとのコミュニケーションを促進',
      '必要に応じてタスクの難易度を調整'
    ]
    
    if (magnitude >= 1.5) {
      actions.unshift('緊急の介入が必要 - プロジェクトマネージャーと相談')
    }
    
    return actions
  } else {
    return [
      '良好な状態を維持',
      'リーダーシップを発揮してもらう',
      '他のメンバーのサポートを依頼',
      'より挑戦的なタスクを割り当てることを検討'
    ]
  }
}

