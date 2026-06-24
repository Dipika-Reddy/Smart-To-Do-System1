const app = require('./src/server');
const db = require('./src/config/database');
const http = require('http');
const bcrypt = require('bcryptjs');

let server;
const PORT = 4500;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to wrap HTTP requests in promises
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        let parsedData;
        try {
          parsedData = JSON.parse(responseBody);
        } catch (e) {
          parsedData = responseBody;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies: cookies,
          body: parsedData
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log(' Starting End-of-Day (EOD) System Integration Tests');
  console.log('==================================================');

  // Initialize DB and Start Server
  await db.initDatabase();
  server = app.listen(PORT);
  console.log(`Test server running at ${BASE_URL}`);

  try {
    // 1. Clean up potential old test users & data
    console.log('\nCleaning up old test data...');
    await db.query("DELETE FROM users WHERE username IN ('testuser', 'testadmin')");
    await db.query("DELETE FROM eod_reports");

    // 2. Register Test User (Standard User) and Test Admin
    console.log('\nRegistering test standard user and test admin...');
    const hashedUserPassword = await bcrypt.hash('TestPassword123!', 10);
    
    // Insert Standard User
    const [userRes] = await db.query(
      "INSERT INTO users (username, email, password, name, role, employee_id) VALUES (?, ?, ?, ?, ?, ?)",
      ['testuser', 'testuser@example.com', hashedUserPassword, 'Test User', 'User', 'EMP001']
    );
    const testUserId = userRes.insertId;
    console.log(`Standard user registered with ID: ${testUserId}`);

    // Insert Admin User
    const [adminRes] = await db.query(
      "INSERT INTO users (username, email, password, name, role, employee_id) VALUES (?, ?, ?, ?, ?, ?)",
      ['testadmin', 'testadmin@example.com', hashedUserPassword, 'Test Admin', 'Admin', 'EMP002']
    );
    const testAdminId = adminRes.insertId;
    console.log(`Admin user registered with ID: ${testAdminId}`);

    // Create a dummy completed and in progress tasks for the user to verify suggestions
    await db.query(
      "INSERT INTO tasks (user_id, title, status, due_date) VALUES (?, ?, ?, ?)",
      [testUserId, 'Buy Groceries', 'Completed', '2026-06-25 12:00:00']
    );
    await db.query(
      "INSERT INTO tasks (user_id, title, status, due_date) VALUES (?, ?, ?, ?)",
      [testUserId, 'Prepare Presentation', 'In Progress', '2026-06-25 15:00:00']
    );
    console.log('Created dummy tasks for testing EOD suggestions.');

    // 3. Log in as Standard User
    console.log('\nLogging in as testuser...');
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'EMP001',
      password: 'TestPassword123!'
    });

    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed with status: ${loginRes.statusCode}. ${JSON.stringify(loginRes.body)}`);
    }
    const userCookie = loginRes.cookies[0];
    console.log('Logged in successfully!');

    // 4. Test EOD Suggestions Endpoint
    console.log('\nTesting GET /api/eod/suggestions...');
    const suggestionsRes = await request('GET', '/api/eod/suggestions', null, {
      'Cookie': userCookie
    });

    if (suggestionsRes.statusCode !== 200) {
      throw new Error(`Suggestions fetch failed: ${suggestionsRes.statusCode}`);
    }
    console.log('Suggestions:', suggestionsRes.body);
    if (!suggestionsRes.body.completed.includes('Buy Groceries') || !suggestionsRes.body.inProgress.includes('Prepare Presentation')) {
      throw new Error('EOD Suggestions do not contain expected tasks.');
    }
    console.log('GET /api/eod/suggestions passed!');

    // 5. Test Submit EOD Status
    console.log('\nTesting POST /api/eod (Submit EOD)...');
    const submitRes = await request('POST', '/api/eod', {
      report_date: '2026-06-24',
      summary: 'Today I worked on EOD implementation and completed Groceries.',
      tasks_completed: 'Buy Groceries',
      tasks_in_progress: 'Prepare Presentation',
      blockers: 'No major blockers.'
    }, {
      'Cookie': userCookie
    });

    if (submitRes.statusCode !== 201) {
      throw new Error(`EOD submission failed with code ${submitRes.statusCode}: ${JSON.stringify(submitRes.body)}`);
    }
    console.log('Submit response:', submitRes.body);
    console.log('POST /api/eod (Submit) passed!');

    // 6. Test Fetch Today's EOD
    console.log("\nTesting GET /api/eod/today?date=2026-06-24...");
    const fetchTodayRes = await request('GET', '/api/eod/today?date=2026-06-24', null, {
      'Cookie': userCookie
    });

    if (fetchTodayRes.statusCode !== 200) {
      throw new Error(`Fetch today EOD failed: ${fetchTodayRes.statusCode}`);
    }
    console.log('Today EOD:', fetchTodayRes.body);
    if (fetchTodayRes.body.summary !== 'Today I worked on EOD implementation and completed Groceries.') {
      throw new Error('Fetched summary does not match submitted summary.');
    }
    console.log('GET /api/eod/today passed!');

    // 7. Test Update EOD Status (Same Date)
    console.log('\nTesting POST /api/eod (Update EOD)...');
    const updateRes = await request('POST', '/api/eod', {
      report_date: '2026-06-24',
      summary: 'Today I worked on EOD implementation and completed Groceries. (Updated summary)',
      tasks_completed: 'Buy Groceries\nReview tasks',
      tasks_in_progress: 'Prepare Presentation',
      blockers: 'A minor database glitch.'
    }, {
      'Cookie': userCookie
    });

    if (updateRes.statusCode !== 200) {
      throw new Error(`EOD update failed: ${updateRes.statusCode}`);
    }
    console.log('Update response:', updateRes.body);
    console.log('POST /api/eod (Update) passed!');

    // Verify update
    const verifyUpdateRes = await request('GET', '/api/eod/today?date=2026-06-24', null, {
      'Cookie': userCookie
    });
    if (verifyUpdateRes.body.summary !== 'Today I worked on EOD implementation and completed Groceries. (Updated summary)') {
      throw new Error('Updated summary was not saved.');
    }
    console.log('Verified EOD update successfully!');

    // 8. Test EOD History
    console.log('\nTesting GET /api/eod/history...');
    const historyRes = await request('GET', '/api/eod/history', null, {
      'Cookie': userCookie
    });

    if (historyRes.statusCode !== 200) {
      throw new Error(`Fetch history failed: ${historyRes.statusCode}`);
    }
    console.log('History items count:', historyRes.body.length);
    if (historyRes.body.length !== 1 || historyRes.body[0].report_date !== '2026-06-24') {
      throw new Error('History list is incorrect.');
    }
    console.log('GET /api/eod/history passed!');

    // 9. Log in as Admin
    console.log('\nLogging in as testadmin...');
    const adminLoginRes = await request('POST', '/api/auth/login', {
      username: 'EMP002',
      password: 'TestPassword123!'
    });

    if (adminLoginRes.statusCode !== 200) {
      throw new Error(`Admin login failed: ${adminLoginRes.statusCode}`);
    }
    const adminCookie = adminLoginRes.cookies[0];
    console.log('Admin logged in successfully!');

    // 10. Test Admin GET all EODs
    console.log('\nTesting Admin GET /api/eod/all?date=2026-06-24...');
    const adminAllRes = await request('GET', '/api/eod/all?date=2026-06-24', null, {
      'Cookie': adminCookie
    });

    if (adminAllRes.statusCode !== 200) {
      throw new Error(`Admin fetch all failed: ${adminAllRes.statusCode}`);
    }
    console.log('Admin EOD list:', adminAllRes.body);
    if (adminAllRes.body.length !== 1 || adminAllRes.body[0].username !== 'testuser') {
      throw new Error('Admin did not receive the test user EOD report.');
    }
    console.log('Admin GET /api/eod/all passed!');

    // 11. Test Standard User cannot access GET /api/eod/all
    console.log('\nTesting Standard User unauthorized check for GET /api/eod/all...');
    const standardUserAllRes = await request('GET', '/api/eod/all?date=2026-06-24', null, {
      'Cookie': userCookie
    });

    if (standardUserAllRes.statusCode !== 403) {
      throw new Error(`Standard User was not rejected with 403. Status: ${standardUserAllRes.statusCode}`);
    }
    console.log('Standard user was successfully blocked (403 Forbidden)!');

    // 12. Test Admin EOD Notification creation
    console.log('\nVerifying Notification was created for Admin...');
    const adminNotificationsRes = await request('GET', '/api/notifications', null, {
      'Cookie': adminCookie
    });
    const notification = adminNotificationsRes.body.find(n => n.title === 'EOD Status Submitted');
    if (!notification) {
      throw new Error('EOD submission notification not found for Admin.');
    }
    console.log(`Notification content: "${notification.message}"`);
    console.log('EOD Notifications passed!');

    console.log('\n==================================================');
    console.log(' ALL EOD TESTS PASSED SUCCESSFULLY! ✅');
    console.log('==================================================');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test users...');
    await db.query("DELETE FROM users WHERE username IN ('testuser', 'testadmin')");
    await db.query("DELETE FROM eod_reports");

    console.log('Stopping test server...');
    server.close(() => {
      console.log('Server stopped.');
    });
  }
}

runTests();
