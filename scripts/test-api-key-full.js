/**
 * 完全なAPIキーでテストするスクリプト
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 環境変数ファイルから読み込む
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    });
    return envVars;
  }
  return {};
}

const env = loadEnvFile();
const apiKey = process.env.AIRTABLE_API_KEY || env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE_ID || 'appmrazv5xBSDMt3J';

if (!apiKey) {
  console.error('❌ エラー: AIRTABLE_API_KEYが設定されていません');
  console.error('   .env.localファイルにAIRTABLE_API_KEYを設定してください');
  process.exit(1);
}

console.log('🔍 Airtable APIキーのテスト（完全版）\n');
console.log(`APIキー: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`);
console.log(`長さ: ${apiKey.length}文字`);
console.log(`Base ID: ${baseId}\n`);

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject({ status: res.statusCode, error: parsed });
          }
        } catch (e) {
          reject({ status: res.statusCode, body: body.substring(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testApiKey() {
  // Studentsテーブルからデータを取得してテスト（data.records:read権限で動作）
  const options = {
    hostname: 'api.airtable.com',
    path: `/v0/${baseId}/Students?maxRecords=1`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    console.log('📡 Airtable APIに接続中（Studentsテーブルからデータ取得）...\n');
    const result = await makeRequest(options);
    console.log('✅ 成功！APIキーは有効です\n');
    console.log(`ステータス: ${result.status}`);
    console.log(`レコード数: ${result.data.records?.length || 0}\n`);
    
    if (result.data.records && result.data.records.length > 0) {
      console.log('📋 最初のレコード:');
      const firstRecord = result.data.records[0];
      console.log(`   ID: ${firstRecord.id}`);
      console.log(`   フィールド: ${Object.keys(firstRecord.fields || {}).join(', ')}`);
    } else {
      console.log('ℹ️  テーブルは空です（これは正常です）');
    }
    
    console.log('\n✅ APIキーは正常に動作しています！\n');
    console.log('📝 次のステップ:');
    console.log('   開発サーバーを再起動して、サンプルデータ投入を試してください。\n');
  } catch (error) {
    console.error('❌ エラーが発生しました\n');
    console.error(`ステータス: ${error.status || 'Unknown'}`);
    if (error.error) {
      console.error(`エラータイプ: ${error.error.type || 'Unknown'}`);
      console.error(`メッセージ: ${error.error.message || error.body || 'Unknown error'}`);
    } else {
      console.error(`エラー: ${error.body || error.message || 'Unknown error'}`);
    }
    
    if (error.status === 401) {
      console.error('\n📋 認証エラー: APIキーが無効です');
    } else if (error.status === 403) {
      console.error('\n📋 権限エラー: APIキーに data.records:read 権限が必要です');
    } else if (error.status === 404) {
      console.error('\n📋 テーブルが見つかりません: Studentsテーブルが存在するか確認してください');
    }
  }
}

testApiKey();

