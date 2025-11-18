import { NextResponse } from 'next/server'
import { join } from 'path'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { getStudents, getTasks } from '@/lib/datastore'
import { calculateMotivationEnhanced, detectMotivationChange } from '@/lib/ai/motivation_enhanced'

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

/**
 * 改善されたモチベーション計算（チェックインデータ統合）
 * GET /api/students/[id]/motivation-enhanced
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const studentId = params.id

    // 学生データを取得
    const students = await getStudents()
    const student = students.find(s => s.student_id === studentId)

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      ) as Response
    }

    // タスクデータを取得
    const tasks = await getTasks()
    const studentTasks = tasks.filter(t => {
      if (Array.isArray(t.assignee_id)) {
        return t.assignee_id.includes(studentId)
      }
      return t.assignee_id === studentId
    })

    // チェックインデータを取得
    const checkinsDir = join(process.cwd(), '..', 'backend', 'data', 'checkins')
    let recentCheckIns: CheckInData[] = []
    
    if (existsSync(checkinsDir)) {
      const checkinFile = join(checkinsDir, `${studentId}.json`)
      if (existsSync(checkinFile)) {
        const allCheckins: CheckInData[] = JSON.parse(readFileSync(checkinFile, 'utf8'))
        // 過去14日間のチェックインを取得
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 14)
        
        recentCheckIns = allCheckins
          .filter(checkin => new Date(checkin.date) >= cutoffDate)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
    }

    // チーム相性データを取得
    const teams = await import('@/lib/datastore').then(m => m.getTeams())
    const studentTeam = teams.find(t => 
      t.students.some(s => s.student_id === studentId)
    )

    const compatibility = {
      partner_ids: studentTeam?.students.map(s => s.student_id) || [],
      preferred_partners: student.preferred_partners || [],
      avoided_partners: student.avoided_partners || []
    }

    // 改善されたモチベーション計算
    const result = calculateMotivationEnhanced(
      {
        student_id: student.student_id,
        MBTI: student.MBTI || 'UNKNOWN',
        animal_type: student.animal_type || '',
        strengths: student.strengths || [],
        weaknesses: student.weaknesses || [],
        preferred_partners: student.preferred_partners || [],
        avoided_partners: student.avoided_partners || []
      },
      studentTasks.map(t => ({
        task_id: t.task_id,
        status: t.status as any,
        difficulty: t.difficulty || 3,
        category: t.category || ''
      })),
      compatibility,
      recentCheckIns
    )

    // 変化検知
    const motivationScores = recentCheckIns.map(c => c.motivation_score)
    const historicalAverage = student.motivation_score || 3.0
    const changeDetection = detectMotivationChange(motivationScores, historicalAverage)

    return NextResponse.json({
      student_id: studentId,
      motivation_score: result.score,
      confidence: result.confidence,
      breakdown: result.breakdown,
      checkin_count: recentCheckIns.length,
      change_detection: changeDetection,
      recommendation: generateRecommendation(result, changeDetection)
    }) as Response
  } catch (error) {
    console.error('Error calculating enhanced motivation:', error)
    return NextResponse.json(
      { error: 'Failed to calculate enhanced motivation' },
      { status: 500 }
    ) as Response
  }
}

function generateRecommendation(result: any, changeDetection: any): string {
  if (changeDetection.changeType === 'sudden_drop' || changeDetection.changeType === 'gradual_decline') {
    return `モチベーションが低下しています（${changeDetection.magnitude.toFixed(1)}ポイント）。${changeDetection.recommendedActions[0]}を推奨します。`
  } else if (changeDetection.changeType === 'sudden_rise' || changeDetection.changeType === 'gradual_improvement') {
    return `モチベーションが向上しています（${changeDetection.magnitude.toFixed(1)}ポイント）。良好な状態を維持してください。`
  } else if (result.confidence < 0.7) {
    return `データの信頼度が低いため、定期的なチェックインを推奨します。`
  } else {
    return `モチベーションは安定しています。現状維持を推奨します。`
  }
}

