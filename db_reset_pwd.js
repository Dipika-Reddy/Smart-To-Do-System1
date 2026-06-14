const db = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function main() {
  try {
    console.log('Initializing database connection...');
    await db.initDatabase();
    const dbType = db.getDbType();
    console.log('Using database type:', dbType.toUpperCase());

    const targetEmpId = 'HPS260033';
    const rawPassword = 'saga@987';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Check if user exists (case-insensitive for employee_id)
    const checkSql = dbType === 'sqlite' 
      ? 'SELECT * FROM users WHERE LOWER(employee_id) = LOWER(?)'
      : 'SELECT * FROM users WHERE LOWER(employee_id) = LOWER($1)';

    const [rows] = await db.query(checkSql, [targetEmpId]);

    if (rows && rows.length > 0) {
      const user = rows[0];
      console.log(`User found (ID: ${user.id}, Username: ${user.username}, Employee ID: ${user.employee_id}). Updating password...`);
      
      const updateSql = dbType === 'sqlite'
        ? 'UPDATE users SET password = ? WHERE id = ?'
        : 'UPDATE users SET password = $1 WHERE id = $2';
      
      await db.query(updateSql, [hashedPassword, user.id]);
      console.log('Password updated successfully!');
    } else {
      console.log(`User with employee_id "${targetEmpId}" not found. Inserting new user...`);
      
      const insertSql = 'INSERT INTO users (employee_id, username, email, password, name, role) VALUES (?, ?, ?, ?, ?, ?)';
      const insertParams = [
        targetEmpId, 
        targetEmpId, 
        `${targetEmpId.toLowerCase()}@hps.internal`, 
        hashedPassword, 
        `HPS Employee ${targetEmpId}`, 
        'User'
      ];
      
      const [res] = await db.query(insertSql, insertParams);
      console.log(`User inserted successfully with ID: ${res.insertId}`);
    }
  } catch (err) {
    console.error('Error executing database update:', err);
  }
}

main().then(() => {
  console.log('Finished.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
