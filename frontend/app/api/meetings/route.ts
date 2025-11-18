import { NextResponse } from 'next/server'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'

const dataDir = join(process.cwd(), '..', 'backend', 'data')
const meetingsDir = join(dataDir, 'meetings')

// ディレクトリが存在しない場合は作成
if (!existsSync(meetingsDir)) {
  mkdirSync(meetingsDir, { recursive: true })
}

interface MeetingRecord {
  meeting_id: string
  date: string
  title: string
  participants: string[]
  agenda: string[]
  content: string
  decisions: string[]
  action_items: Array<{
    task: string
    assignee: string
    deadline?: string
  }>
  created_by: string
  created_at: string
}

/**
 * 議事録を取得
 * GET /api/meetings
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const studentId = searchParams.get('student_id')

    const allMeetings: MeetingRecord[] = []

    // すべての議事録ファイルを読み込む
    if (existsSync(meetingsDir)) {
      const files = readdirSync(meetingsDir).filter(f => f.endsWith('.json'))
      
      for (const file of files) {
        const filePath = join(meetingsDir, file)
        const meetings: MeetingRecord[] = JSON.parse(readFileSync(filePath, 'utf8'))
        allMeetings.push(...meetings)
      }
    }

    // フィルタリング
    let filtered = allMeetings

    if (date) {
      filtered = filtered.filter(m => m.date === date)
    }

    if (studentId) {
      filtered = filtered.filter(m => 
        m.participants.includes(studentId) || m.created_by === studentId
      )
    }

    // 日付でソート（新しい順）
    filtered.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return NextResponse.json(filtered) as Response
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    ) as Response
  }
}

/**
 * 議事録を保存
 * POST /api/meetings
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const meetingData = await request.json()

    // バリデーション
    if (!meetingData.date || !meetingData.title || !meetingData.content || !meetingData.created_by) {
      return NextResponse.json(
        { error: 'date, title, content, and created_by are required' },
        { status: 400 }
      ) as Response
    }

    // meeting_idを生成
    const meetingId = `M${Date.now()}`

    const meeting: MeetingRecord = {
      meeting_id: meetingId,
      date: meetingData.date,
      title: meetingData.title,
      participants: meetingData.participants || [],
      agenda: meetingData.agenda || [],
      content: meetingData.content,
      decisions: meetingData.decisions || [],
      action_items: meetingData.action_items || [],
      created_by: meetingData.created_by,
      created_at: new Date().toISOString()
    }

    // 日付ごとにファイルを分ける
    const dateStr = meetingData.date.replace(/-/g, '')
    const meetingFile = join(meetingsDir, `${dateStr}.json`)

    // 既存の議事録を読み込む
    let allMeetings: MeetingRecord[] = []
    if (existsSync(meetingFile)) {
      allMeetings = JSON.parse(readFileSync(meetingFile, 'utf8'))
    }

    // 追加
    allMeetings.push(meeting)

    // 保存
    writeFileSync(meetingFile, JSON.stringify(allMeetings, null, 2), 'utf8')

    // Airtableにも保存（オプション）
    try {
      await saveToAirtable(meeting)
    } catch (error) {
      console.warn('Failed to save to Airtable:', error)
      // Airtableへの保存に失敗しても、ローカルファイルには保存されているので続行
    }

    return NextResponse.json({ success: true, meeting }) as Response
  } catch (error) {
    console.error('Error saving meeting:', error)
    return NextResponse.json(
      { error: 'Failed to save meeting' },
      { status: 500 }
    ) as Response
  }
}

/**
 * Airtableに保存（オプション）
 */
async function saveToAirtable(meeting: MeetingRecord) {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  const meetingsTable = process.env.AIRTABLE_MEETINGS_TABLE || 'Meetings'

  if (!apiKey || !baseId) {
    return // Airtableが設定されていない場合はスキップ
  }

  // @ts-ignore
  const Airtable = require('airtable')
  const base = new Airtable({ apiKey }).base(baseId)

  try {
    await base(meetingsTable).create([
      {
        fields: {
          meeting_id: meeting.meeting_id,
          date: meeting.date,
          title: meeting.title,
          participants: meeting.participants,
          agenda: meeting.agenda.join('\n'),
          content: meeting.content,
          decisions: meeting.decisions.join('\n'),
          action_items: JSON.stringify(meeting.action_items),
          created_by: meeting.created_by,
          created_at: meeting.created_at
        }
      }
    ])
  } catch (error) {
    // テーブルが存在しない場合はスキップ
    if (error.message && error.message.includes('NOT_FOUND')) {
      console.warn(`Airtable table "${meetingsTable}" not found. Skipping.`)
      return
    }
    throw error
  }
}

