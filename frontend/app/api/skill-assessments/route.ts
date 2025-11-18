import { NextResponse } from 'next/server'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const dataDir = join(process.cwd(), '..', 'backend', 'data')
const assessmentsDir = join(dataDir, 'skill-assessments')

// ディレクトリが存在しない場合は作成
if (!existsSync(assessmentsDir)) {
  mkdirSync(assessmentsDir, { recursive: true })
}

interface SkillAssessment {
  skill: string
  score: number
  confidence: number
  reason?: string
}

interface SkillAssessmentRecord {
  student_id: string
  date: string // YYYY-MM-DD
  skills: SkillAssessment[]
  is_initial: boolean // 初期セットアップかどうか
}

/**
 * スキル評価を取得
 * GET /api/skill-assessments?student_id=S001
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('student_id')

    if (!studentId) {
      return NextResponse.json(
        { error: 'student_id is required' },
        { status: 400 }
      ) as Response
    }

    const assessmentFile = join(assessmentsDir, `${studentId}.json`)
    if (!existsSync(assessmentFile)) {
      return NextResponse.json([]) as Response
    }

    const allAssessments: SkillAssessmentRecord[] = JSON.parse(
      readFileSync(assessmentFile, 'utf8')
    )

    return NextResponse.json(allAssessments) as Response
  } catch (error) {
    console.error('Error fetching skill assessments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch skill assessments' },
      { status: 500 }
    ) as Response
  }
}

/**
 * スキル評価を保存
 * POST /api/skill-assessments
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const assessment: SkillAssessmentRecord = await request.json()

    // バリデーション
    if (!assessment.student_id || !assessment.date) {
      return NextResponse.json(
        { error: 'student_id and date are required' },
        { status: 400 }
      ) as Response
    }

    if (!assessment.skills || !Array.isArray(assessment.skills)) {
      return NextResponse.json(
        { error: 'skills array is required' },
        { status: 400 }
      ) as Response
    }

    // 各スキルのバリデーション
    for (const skill of assessment.skills) {
      if (skill.score < 1 || skill.score > 5) {
        return NextResponse.json(
          { error: `Skill ${skill.skill} score must be between 1 and 5` },
          { status: 400 }
        ) as Response
      }
      if (skill.confidence < 1 || skill.confidence > 5) {
        return NextResponse.json(
          { error: `Skill ${skill.skill} confidence must be between 1 and 5` },
          { status: 400 }
        ) as Response
      }
    }

    const assessmentFile = join(assessmentsDir, `${assessment.student_id}.json`)

    // 既存の評価を読み込む
    let allAssessments: SkillAssessmentRecord[] = []
    if (existsSync(assessmentFile)) {
      allAssessments = JSON.parse(readFileSync(assessmentFile, 'utf8'))
    }

    // 同じ日付の評価がある場合は更新、なければ追加
    const existingIndex = allAssessments.findIndex(
      a => a.date === assessment.date
    )
    if (existingIndex >= 0) {
      allAssessments[existingIndex] = assessment
    } else {
      allAssessments.push(assessment)
    }

    // 日付でソート
    allAssessments.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // 保存
    writeFileSync(
      assessmentFile,
      JSON.stringify(allAssessments, null, 2),
      'utf8'
    )

    // Airtableにも保存（オプション）
    try {
      await saveToAirtable(assessment)
    } catch (error) {
      console.warn('Failed to save to Airtable:', error)
      // Airtableへの保存に失敗しても、ローカルファイルには保存されているので続行
    }

    return NextResponse.json({ success: true, assessment }) as Response
  } catch (error) {
    console.error('Error saving skill assessment:', error)
    return NextResponse.json(
      { error: 'Failed to save skill assessment' },
      { status: 500 }
    ) as Response
  }
}

/**
 * Airtableに保存（オプション）
 */
async function saveToAirtable(assessment: SkillAssessmentRecord) {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  const studentsTable = process.env.AIRTABLE_STUDENTS_TABLE || 'Students'

  if (!apiKey || !baseId) {
    return // Airtableが設定されていない場合はスキップ
  }

  // @ts-ignore
  const Airtable = require('airtable')
  const base = new Airtable({ apiKey }).base(baseId)

  // 学生レコードを検索
  const records = await base(studentsTable)
    .select({
      filterByFormula: `{student_id} = "${assessment.student_id}"`,
      maxRecords: 1
    })
    .firstPage()

  if (records.length === 0) {
    console.warn(`Student ${assessment.student_id} not found in Airtable`)
    return
  }

  const record = records[0]

  // スキル値を更新
  const updates: any = {}
  for (const skill of assessment.skills) {
    const fieldName = `skill_${skill.skill}`
    updates[fieldName] = skill.score
  }

  // 最新の評価日を記録（オプション）
  updates['last_skill_assessment_date'] = assessment.date

  await base(studentsTable).update(record.id, updates)
}

