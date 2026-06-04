/**
 * Automated Verification Script (verify.js)
 * Tests validation parameters, signup, login, CRUD tasks, categories, and logs.
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make HTTP Requests and track cookies
let sessionCookie = '';

function request(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (sessionCookie) {
      options.headers['Cookie'] = sessionCookie;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      
      // Capture session cookie on login
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        sessionCookie = setCookie[0].split(';')[0];
      }

      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AUTOMATED API VERIFICATION ===\n');

  try {
    // 1. Test Password Validation (Must fail)
    console.log('Test 1: Register with weak password...');
    const regFail = await request('/api/auth/register', 'POST', {
      username: 'tester',
      email: 'test@example.com',
      password: 'weak'
    });
    console.log(`-> Status: ${regFail.status} (Expected: 400)`);
    console.log(`-> Response error: "${regFail.body.error}"`);
    if (regFail.status !== 400) throw new Error('Password validation bypass detected!');
    console.log('✅ Test 1 Passed.\n');

    // 2. Test Registration with valid parameters
    console.log('Test 2: Register with valid password (complex)...');
    const email = `test_${Date.now()}@example.com`;
    const regSuccess = await request('/api/auth/register', 'POST', {
      username: 'APITester',
      email: email,
      password: 'SecurePassword123!'
    });
    console.log(`-> Status: ${regSuccess.status} (Expected: 201)`);
    console.log(`-> Response message: "${regSuccess.body.message}"`);
    if (regSuccess.status !== 201) throw new Error('Registration failed!');
    console.log('✅ Test 2 Passed.\n');

    // 3. Test Registration Duplicate Email Validation (Must fail)
    console.log('Test 3: Register with duplicate email...');
    const regDup = await request('/api/auth/register', 'POST', {
      username: 'APITester2',
      email: email, // same email
      password: 'SecurePassword123!'
    });
    console.log(`-> Status: ${regDup.status} (Expected: 400)`);
    console.log(`-> Response error: "${regDup.body.error}"`);
    if (regDup.status !== 400) throw new Error('Duplicate email bypass detected!');
    console.log('✅ Test 3 Passed.\n');

    // 4. Test Login
    console.log('Test 4: Login as tester...');
    const loginRes = await request('/api/auth/login', 'POST', {
      email: email,
      password: 'SecurePassword123!'
    });
    console.log(`-> Status: ${loginRes.status} (Expected: 200)`);
    console.log(`-> Logged in as: "${loginRes.body.user.username}"`);
    if (loginRes.status !== 200) throw new Error('Login failed!');
    console.log('✅ Test 4 Passed.\n');

    // 5. Test Categories Fetch (Must include Personal, Work, etc.)
    console.log('Test 5: Retrieve seeded categories...');
    const catRes = await request('/api/categories', 'GET');
    console.log(`-> Status: ${catRes.status} (Expected: 200)`);
    console.log(`-> Categories count: ${catRes.body.length}`);
    console.log(`-> Categories names: [${catRes.body.map(c => c.category_name).join(', ')}]`);
    if (catRes.status !== 200 || catRes.body.length < 5) throw new Error('Categories failed to load or seed!');
    console.log('✅ Test 5 Passed.\n');

    const firstCatId = catRes.body[0].id;

    // 6. Test Task Validation: Due date in past (Must fail)
    console.log('Test 6: Create task with past due date...');
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 2); // 2 hours ago
    const taskFail = await request('/api/tasks', 'POST', {
      title: 'Past Task',
      description: 'Should fail due to deadline validation',
      category_id: firstCatId,
      priority: 'High',
      due_date: pastDate.toISOString()
    });
    console.log(`-> Status: ${taskFail.status} (Expected: 400)`);
    console.log(`-> Response error: "${taskFail.body.error}"`);
    if (taskFail.status !== 400) throw new Error('Past due date validation bypass detected!');
    console.log('✅ Test 6 Passed.\n');

    // 7. Test Task Creation (Must succeed)
    console.log('Test 7: Create a valid task...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1); // Tomorrow
    const taskRes = await request('/api/tasks', 'POST', {
      title: 'Complete verification script',
      description: 'Ensure all tests pass and API is ready',
      category_id: firstCatId,
      priority: 'High',
      due_date: tomorrow.toISOString().slice(0, 16)
    });
    console.log(`-> Status: ${taskRes.status} (Expected: 201)`);
    console.log(`-> Created Task ID: ${taskRes.body.task.id}`);
    if (taskRes.status !== 201) throw new Error('Task creation failed!');
    console.log('✅ Test 7 Passed.\n');

    const createdTaskId = taskRes.body.task.id;

    // 8. Test Task Fetch List & Sorters
    console.log('Test 8: Fetch tasks...');
    const listRes = await request('/api/tasks', 'GET');
    console.log(`-> Status: ${listRes.status} (Expected: 200)`);
    console.log(`-> Task list size: ${listRes.body.length}`);
    console.log(`-> First task title: "${listRes.body[0].title}"`);
    if (listRes.status !== 200 || listRes.body.length === 0) throw new Error('Failed to fetch tasks list!');
    console.log('✅ Test 8 Passed.\n');

    // 9. Test Task Completion Update
    console.log('Test 9: Mark task as Completed...');
    const updateRes = await request(`/api/tasks/${createdTaskId}`, 'PUT', {
      title: 'Complete verification script',
      description: 'Ensure all tests pass and API is ready',
      category_id: firstCatId,
      priority: 'High',
      status: 'Completed',
      due_date: tomorrow.toISOString().slice(0, 16)
    });
    console.log(`-> Status: ${updateRes.status} (Expected: 200)`);
    console.log(`-> Updated Status: "${updateRes.body.task.status}"`);
    if (updateRes.status !== 200 || updateRes.body.task.status !== 'Completed') throw new Error('Task status update failed!');
    console.log('✅ Test 9 Passed.\n');

    // 10. Test Activity Log Fetching
    console.log('Test 10: Fetch user activity history...');
    const logsRes = await request('/api/tasks/activities', 'GET');
    console.log(`-> Status: ${logsRes.status} (Expected: 200)`);
    console.log(`-> Log records count: ${logsRes.body.length}`);
    console.log(`-> Last activity logged: "${logsRes.body[0].action} for ${logsRes.body[0].task_title}"`);
    if (logsRes.status !== 200 || logsRes.body.length < 2) throw new Error('Activity logging failed!');
    console.log('✅ Test 10 Passed.\n');

    // 11. Test Notes: Fetch initial empty notes
    console.log('Test 11: Fetch initial notes list...');
    const emptyNotes = await request('/api/notes', 'GET');
    console.log(`-> Status: ${emptyNotes.status} (Expected: 200)`);
    console.log(`-> Notes count: ${emptyNotes.body.length}`);
    if (emptyNotes.status !== 200 || emptyNotes.body.length !== 0) throw new Error('Notes list should initially be empty!');
    console.log('✅ Test 11 Passed.\n');

    // 12. Test Notes: Create plain text note
    console.log('Test 12: Create a yellow text note with lined pattern...');
    const textNote = await request('/api/notes', 'POST', {
      title: 'Shopping Checklist Idea',
      content: 'Purchase organic fruits and green tea.',
      type: 'Note',
      color_theme: 'yellow',
      pattern_theme: 'lined'
    });
    console.log(`-> Status: ${textNote.status} (Expected: 201)`);
    console.log(`-> Note Title: "${textNote.body.note.title}"`);
    console.log(`-> Note Color: "${textNote.body.note.color_theme}"`);
    console.log(`-> Note Pattern: "${textNote.body.note.pattern_theme}"`);
    if (textNote.status !== 201 || textNote.body.note.color_theme !== 'yellow' || textNote.body.note.pattern_theme !== 'lined') throw new Error('Text Note creation failed!');
    console.log('✅ Test 12 Passed.\n');

    const createdNoteId = textNote.body.note.id;

    // 13. Test Notes: Create a checklist note
    console.log('Test 13: Create a purple checklist note with grid pattern...');
    const checklistPayload = [
      { text: 'Verify Express Routing', checked: true },
      { text: 'Audit database constraints', checked: false }
    ];
    const listNote = await request('/api/notes', 'POST', {
      title: 'Project Checklist',
      content: JSON.stringify(checklistPayload),
      type: 'List',
      color_theme: 'purple',
      pattern_theme: 'grid'
    });
    console.log(`-> Status: ${listNote.status} (Expected: 201)`);
    console.log(`-> List Title: "${listNote.body.note.title}"`);
    console.log(`-> List Type: "${listNote.body.note.type}"`);
    console.log(`-> List Pattern: "${listNote.body.note.pattern_theme}"`);
    if (listNote.status !== 201 || listNote.body.note.type !== 'List' || listNote.body.note.pattern_theme !== 'grid') throw new Error('Checklist Note creation failed!');
    console.log('✅ Test 13 Passed.\n');

    const createdListId = listNote.body.note.id;

    // 14. Test Notes: Update note details (changing color, pattern and content)
    console.log('Test 14: Update Note details (yellow to blue, lined to dots, modify title)...');
    const updateNoteRes = await request(`/api/notes/${createdNoteId}`, 'PUT', {
      title: 'Healthy Grocery Shopping List',
      content: 'Purchase organic fruits, green tea, and whole-wheat bread.',
      type: 'Note',
      color_theme: 'blue',
      pattern_theme: 'dots'
    });
    console.log(`-> Status: ${updateNoteRes.status} (Expected: 200)`);
    console.log(`-> New Title: "${updateNoteRes.body.note.title}"`);
    console.log(`-> New Color: "${updateNoteRes.body.note.color_theme}"`);
    console.log(`-> New Pattern: "${updateNoteRes.body.note.pattern_theme}"`);
    if (updateNoteRes.status !== 200 || updateNoteRes.body.note.color_theme !== 'blue' || updateNoteRes.body.note.pattern_theme !== 'dots') throw new Error('Note update failed!');
    console.log('✅ Test 14 Passed.\n');

    // 15. Test Notes: Delete note
    console.log('Test 15: Delete a checklist note...');
    const deleteListRes = await request(`/api/notes/${createdListId}`, 'DELETE');
    console.log(`-> Status: ${deleteListRes.status} (Expected: 200)`);
    if (deleteListRes.status !== 200) throw new Error('Note deletion failed!');
    
    const finalNotes = await request('/api/notes', 'GET');
    console.log(`-> Remaining Notes count: ${finalNotes.body.length} (Expected: 1)`);
    if (finalNotes.body.length !== 1) throw new Error('Note delete was not reflected in notes list!');
    console.log('✅ Test 15 Passed.\n');

    console.log('🎉 ALL BACKEND ENDPOINTS AND CONSTRAINTS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('❌ VERIFICATION FAIL:', error.message);
    process.exit(1);
  }
}

runTests();
