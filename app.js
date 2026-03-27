const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'clinic.db');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    // 創建表格
    db.run(`CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      chief_complaint TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      visited INTEGER DEFAULT 0,
      created_date TEXT DEFAULT CURRENT_DATE
    )`);
    saveDB();
  }
  console.log('資料庫已初始化');
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// 新增病患
app.post('/api/patients', (req, res) => {
  const { name, chief_complaint, appointment_time } = req.body;
  
  if (!name || !chief_complaint || !appointment_time) {
    return res.status(400).json({ error: '所有欄位必填' });
  }

  try {
    db.run(
      'INSERT INTO patients (name, chief_complaint, appointment_time, visited) VALUES (?, ?, ?, 0)',
      [name, chief_complaint, appointment_time]
    );
    saveDB();
    res.json({ success: true, message: '病患已新增' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取得今日看診清單
app.get('/api/patients', (req, res) => {
  try {
    const results = db.exec(
      'SELECT id, name, chief_complaint, appointment_time, visited FROM patients WHERE created_date = date("now") ORDER BY appointment_time ASC'
    );
    
    let patients = [];
    if (results.length > 0) {
      const columns = results[0].columns;
      const values = results[0].values;
      patients = values.map(row => {
        return {
          id: row[0],
          name: row[1],
          chief_complaint: row[2],
          appointment_time: row[3],
          visited: row[4] === 1
        };
      });
    }
    
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 標記已看診
app.put('/api/patients/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    db.run('UPDATE patients SET visited = 1 WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, message: '已標記為看診完畢' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`伺服器啟動：http://localhost:${PORT}`);
  });
});