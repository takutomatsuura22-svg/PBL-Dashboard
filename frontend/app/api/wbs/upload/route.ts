import { NextResponse } from 'next/server'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { generateAIUsage } from '@/lib/ai/ai_usage_generator'

/**
 * WBS（Work Breakdown Structure）ファイルをアップロードしてタスクデータを更新
 * 対応形式: JSON, CSV
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const wbsName = formData.get('name') as string || ''

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルがアップロードされていません' },
        { status: 400 }
      ) as Response
    }

    if (!wbsName || wbsName.trim() === '') {
      return NextResponse.json(
        { error: 'WBS名を入力してください' },
        { status: 400 }
      ) as Response
    }

    const fileContent = await file.text()
    const fileName = file.name.toLowerCase()

    let tasks: any[] = []

    // ファイル形式に応じてパース
    if (fileName.endsWith('.json')) {
      const jsonData = JSON.parse(fileContent)
      tasks = jsonData.tasks || jsonData || []
    } else if (fileName.endsWith('.csv')) {
      tasks = parseCSV(fileContent)
    } else {
      return NextResponse.json(
        { error: 'サポートされていないファイル形式です。JSONまたはCSVをアップロードしてください。' },
        { status: 400 }
      ) as Response
    }

    // WBSデータを整理
    const processedTasks = tasks.map((task: any) => {
      // 担当者IDを配列形式に変換（複数対応）
      let assigneeId: string | string[] | undefined = undefined
      if (task.assignee_id || task.assignee) {
        const assigneeValue = task.assignee_id || task.assignee
        if (Array.isArray(assigneeValue)) {
          assigneeId = assigneeValue
        } else if (typeof assigneeValue === 'string' && assigneeValue.includes(',')) {
          assigneeId = assigneeValue.split(',').map((id: string) => id.trim()).filter((id: string) => id)
        } else if (assigneeValue) {
          assigneeId = assigneeValue
        }
      }
      
      // 開始日と終了日の処理
      const startDate = task.start_date || task.start || ''
      const endDate = task.end_date || task.end || task.deadline || ''
      
      // AI活用方法を生成（既存の値がない場合）
      let aiUsage = task.ai_usage || task.ai_usage_method || ''
      if (!aiUsage) {
        try {
          aiUsage = generateAIUsage({
            task_id: task.task_id || '',
            title: task.title || task.name || '',
            description: task.description || '',
            category: task.category || '実行',
            difficulty: task.difficulty || 3
          })
        } catch (error) {
          console.error('Error generating AI usage:', error)
          // エラーが発生した場合は空文字列のまま
        }
      }
      
      return {
        task_id: task.task_id || `T${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: task.title || task.name || '',
        description: task.description || '',
        category: task.category || '実行',
        difficulty: task.difficulty || 3,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        deadline: endDate || undefined, // 後方互換性のため
        status: task.status || 'pending',
        assignee_id: assigneeId,
        required_skills: task.required_skills || [],
        ai_usage: aiUsage
      }
    })

    // WBSを個別ファイルとして保存
    const dataDir = join(process.cwd(), '..', 'backend', 'data')
    const wbsDir = join(dataDir, 'wbs')
    
    // WBSディレクトリが存在しない場合は作成
    if (!existsSync(wbsDir)) {
      const { mkdirSync } = await import('fs')
      mkdirSync(wbsDir, { recursive: true })
    }

    // WBS IDを生成（タイムスタンプベース）
    const wbsId = `wbs_${Date.now()}`
    const wbsPath = join(wbsDir, `${wbsId}.json`)

    // WBSデータを保存
    const wbsData = {
      wbs_id: wbsId,
      name: wbsName.trim(),
      description: formData.get('description') as string || '',
      created_at: new Date().toISOString(),
      tasks: processedTasks
    }

    writeFileSync(
      wbsPath,
      JSON.stringify(wbsData, null, 2),
      'utf8'
    )

    return NextResponse.json({
      success: true,
      message: `WBS「${wbsName}」をアップロードしました（${processedTasks.length}件のタスク）。`,
      wbs_id: wbsId,
      total_tasks: processedTasks.length
    }) as Response
  } catch (error) {
    console.error('Error uploading WBS:', error)
    return NextResponse.json(
      { error: 'WBSファイルのアップロードに失敗しました' },
      { status: 500 }
    ) as Response
  }
}

/**
 * CSVをパースしてタスク配列に変換
 * より堅牢なCSVパーサー（カンマを含む値にも対応）
 */
function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  // ヘッダー行を取得（より正確なCSVパース）
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // メタ情報行をスキップしてヘッダー行を探す
  let headerIndex = 0
  let dataStartIndex = 1
  
  // ヘッダー行を探す（「ステータス」や「カテゴリ」などの列名を含む行）
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = parseCSVLine(lines[i])
    const firstCol = line[0]?.toLowerCase() || ''
    if (firstCol.includes('ステータス') || firstCol.includes('status') || 
        firstCol.includes('カテゴリ') || firstCol.includes('category')) {
      headerIndex = i
      dataStartIndex = i + 1
      break
    }
  }

  const headers = parseCSVLine(lines[headerIndex]).map(h => h.replace(/^"|"$/g, '').trim())
  console.log('📋 CSVヘッダー:', headers.join(', '))
  
  const tasks: any[] = []
  
  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim())
    const task: any = {}
    
    headers.forEach((header, index) => {
      const value = values[index] || ''
      const headerLower = header.toLowerCase()
      
      // 日本語の列名に対応
      if (headerLower.includes('ステータス') || headerLower === 'status') {
        // ステータスのマッピング: 完了→completed, 着手中→in_progress, 未着手→pending
        if (value.includes('完了')) {
          task.status = 'completed'
        } else if (value.includes('着手中') || value.includes('進行中')) {
          task.status = 'in_progress'
        } else if (value.includes('未着手') || value === '') {
          task.status = 'pending'
        } else {
          task.status = 'pending'
        }
      } else if (headerLower.includes('カテゴリ') || headerLower === 'category') {
        task.category = value || '実行'
      } else if (headerLower.includes('タスク1') || headerLower.includes('タスク2')) {
        // タスク1とタスク2を結合してtitleにする
        if (!task.title) {
          task.title = value
        } else {
          task.title = `${task.title} ${value}`.trim()
        }
      } else if (headerLower.includes('成果物') || headerLower.includes('deliverable')) {
        task.description = task.description ? `${task.description}\n成果物: ${value}` : `成果物: ${value}`
      } else if (headerLower.includes('担当者') || headerLower.includes('assignee')) {
        // 担当者名をそのまま保存（後でstudent_idに変換する必要がある場合がある）
        if (value) {
          task.assignee_id = value.trim()
        }
      } else if (headerLower.includes('レビュワー') || headerLower.includes('reviewer')) {
        // レビュワー情報はdescriptionに追加
        if (value) {
          task.description = task.description ? `${task.description}\nレビュワー: ${value}` : `レビュワー: ${value}`
        }
      } else if (headerLower.includes('開始日') || headerLower.includes('start')) {
        // 日付形式を変換（9/16 → 2024-09-16 または 2025-09-16）
        if (value) {
          task.start_date = convertDate(value)
        }
      } else if (headerLower.includes('終了日') || headerLower.includes('end')) {
        // 日付形式を変換
        if (value) {
          task.end_date = convertDate(value)
          task.deadline = convertDate(value)
        }
      }
    })
    
    // titleがあれば追加（空行やメタ情報行をスキップ）
    // カテゴリのみの行（タスク1とタスク2が両方空）はスキップ
    if (task.title && task.title.trim() && task.title.trim() !== '') {
      // task_idを生成（titleから）
      if (!task.task_id) {
        task.task_id = `T${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
      // 難易度のデフォルト値を設定
      if (!task.difficulty) {
        task.difficulty = 3
      }
      tasks.push(task)
    }
  }
  
  console.log(`📊 ${tasks.length}件のタスクをパースしました`)
  return tasks
}

// 日付形式を変換（9/16 → 2025-09-16）
function convertDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return ''
  
  // 既にYYYY-MM-DD形式の場合はそのまま返す
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr
  }
  
  // M/D形式を変換（例: 9/16 → 2025-09-16）
  const parts = dateStr.split('/')
  if (parts.length === 2) {
    const month = parts[0].padStart(2, '0')
    const day = parts[1].padStart(2, '0')
    // 現在の年を使用（または2025年をデフォルト）
    const year = new Date().getFullYear()
    return `${year}-${month}-${day}`
  }
  
  return dateStr
}

