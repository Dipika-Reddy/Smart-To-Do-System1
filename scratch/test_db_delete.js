const db = require('../src/config/database');

async function testDelete() {
  try {
    await db.initDatabase();
    console.log('Database initialized.');

    // Find any existing task
    const [tasks] = await db.query('SELECT * FROM tasks LIMIT 5');
    console.log('Existing tasks count:', tasks.length);
    if (tasks.length === 0) {
      console.log('No tasks found in database to delete.');
      return;
    }

    const task = tasks[0];
    console.log(`Attempting to delete existing task ID: ${task.id}, title: ${task.title}`);

    // Attempt delete
    await db.query('DELETE FROM tasks WHERE id = ?', [task.id]);
    console.log('Task deleted successfully!');

  } catch (err) {
    console.error('Task deletion failed with error:', err);
  } finally {
    process.exit(0);
  }
}

testDelete();
