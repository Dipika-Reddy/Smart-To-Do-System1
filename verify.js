/**
 * Automated Verification Script (verify.js)
 * Tests validation parameters, Admin/User signups, task assignments, checklists, reviews, and logs.
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make HTTP Requests with custom cookies
function request(path, method, body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      let resCookie = '';
      
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        resCookie = setCookie[0].split(';')[0];
      }

      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({ status: res.statusCode, body: parsed, cookie: resCookie });
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
    // 1. Register Admin Account
    console.log('Test 1: Register Admin Account...');
    const adminEmail = `admin_${Date.now()}@example.com`;
    const regAdmin = await request('/api/auth/register', 'POST', {
      username: 'APITesterAdmin',
      name: 'System Administrator',
      email: adminEmail,
      password: 'SecurePassword123!',
      role: 'Admin'
    });
    console.log(`-> Status: ${regAdmin.status} (Expected: 201)`);
    if (regAdmin.status !== 201) throw new Error('Admin registration failed!');
    console.log('✅ Test 1 Passed.\n');

    // 2. Register Standard User Account
    console.log('Test 2: Register User Account...');
    const userEmail = `user_${Date.now()}@example.com`;
    const regUser = await request('/api/auth/register', 'POST', {
      username: 'APITesterUser',
      name: 'Regular Assignee',
      email: userEmail,
      password: 'SecurePassword123!',
      role: 'User'
    });
    console.log(`-> Status: ${regUser.status} (Expected: 201)`);
    if (regUser.status !== 201) throw new Error('User registration failed!');
    console.log('✅ Test 2 Passed.\n');

    // 3. Login as Admin
    console.log('Test 3: Log in as Admin...');
    const adminLogin = await request('/api/auth/login', 'POST', {
      username: 'APITesterAdmin',
      password: 'SecurePassword123!'
    });
    console.log(`-> Status: ${adminLogin.status} (Expected: 200)`);
    console.log(`-> Logged in as: "${adminLogin.body.user.username}" | Role: "${adminLogin.body.user.role}"`);
    if (adminLogin.status !== 200 || adminLogin.body.user.role !== 'Admin') {
      throw new Error('Admin login verification failed!');
    }
    const adminCookie = adminLogin.cookie;
    console.log('✅ Test 3 Passed.\n');

    // 4. Login as User
    console.log('Test 4: Log in as User...');
    const userLogin = await request('/api/auth/login', 'POST', {
      username: 'APITesterUser',
      password: 'SecurePassword123!'
    });
    console.log(`-> Status: ${userLogin.status} (Expected: 200)`);
    console.log(`-> Logged in as: "${userLogin.body.user.username}" | Role: "${userLogin.body.user.role}"`);
    if (userLogin.status !== 200 || userLogin.body.user.role !== 'User') {
      throw new Error('User login verification failed!');
    }
    const userCookie = userLogin.cookie;
    const userId = userLogin.body.user.id;
    console.log('✅ Test 4 Passed.\n');

    // 5. Admin fetches Categories
    console.log('Test 5: Retrieve seeded categories...');
    const catRes = await request('/api/categories', 'GET', null, adminCookie);
    console.log(`-> Status: ${catRes.status} (Expected: 200)`);
    console.log(`-> Seeded count: ${catRes.body.length}`);
    if (catRes.status !== 200 || catRes.body.length === 0) throw new Error('Categories fetch failed!');
    const firstCatId = catRes.body[0].id;
    console.log('✅ Test 5 Passed.\n');

    // 6. Admin creates a task and assigns it to User
    console.log('Test 6: Admin creates task assigned to User...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskRes = await request('/api/tasks', 'POST', {
      title: 'Database Schema Audit',
      description: 'Audit tables and integrity parameters',
      category_id: firstCatId,
      priority: 'High',
      due_date: tomorrow.toISOString().slice(0, 16),
      assigned_to: userId
    }, adminCookie);
    console.log(`-> Status: ${taskRes.status} (Expected: 201)`);
    console.log(`-> Assigned to ID: ${taskRes.body.task.assigned_to}`);
    if (taskRes.status !== 201 || taskRes.body.task.assigned_to !== userId) {
      throw new Error('Admin task creation and assignment failed!');
    }
    const taskId = taskRes.body.task.id;
    console.log('✅ Test 6 Passed.\n');

    // 7. Check User Notifications (Should receive task assignment alert)
    console.log('Test 7: Fetch user notifications...');
    const userNotifs = await request('/api/notifications', 'GET', null, userCookie);
    console.log(`-> Status: ${userNotifs.status} (Expected: 200)`);
    console.log(`-> Alerts count: ${userNotifs.body.length}`);
    if (userNotifs.status !== 200 || userNotifs.body.length === 0) {
      throw new Error('User did not receive task assignment notification!');
    }
    console.log(`-> Notification Title: "${userNotifs.body[0].title}"`);
    console.log('✅ Test 7 Passed.\n');

    // 8. User creates Checklist Item under assigned task
    console.log('Test 8: User creates Checklist Item under task...');
    const checklistRes = await request(`/api/checklists/tasks/${taskId}`, 'POST', {
      title: 'Verify SQLite Foreign Keys'
    }, userCookie);
    console.log(`-> Status: ${checklistRes.status} (Expected: 201)`);
    if (checklistRes.status !== 201) throw new Error('Checklist item creation failed!');
    const itemId = checklistRes.id || checklistRes.body.id;
    console.log('✅ Test 8 Passed.\n');

    // 9. User completes Checklist Item (Check progress updates)
    console.log('Test 9: User toggles checklist completion...');
    const checklistToggle = await request(`/api/checklists/${itemId}`, 'PUT', {
      is_completed: 1
    }, userCookie);
    console.log(`-> Status: ${checklistToggle.status} (Expected: 200)`);
    console.log(`-> Recalculated completion percentage: ${checklistToggle.body.completion_percentage}%`);
    if (checklistToggle.status !== 200 || checklistToggle.body.completion_percentage !== 100) {
      throw new Error('Checklist completion state recalculation failed!');
    }
    console.log('✅ Test 9 Passed.\n');

    // 10. User adds progress update comment to task
    console.log('Test 10: User adds progress note comment...');
    const commentRes = await request(`/api/tasks/${taskId}/updates`, 'POST', {
      comment: 'Schema verified, foreign key constraints are enabled.',
      progress_percentage: 100
    }, userCookie);
    console.log(`-> Status: ${commentRes.status} (Expected: 201)`);
    if (commentRes.status !== 201) throw new Error('Adding task progress update comment failed!');
    console.log('✅ Test 10 Passed.\n');

    // 11. User submits task to Review status
    console.log('Test 11: User submits task to Review status...');
    const submitReview = await request(`/api/tasks/${taskId}`, 'PUT', {
      title: 'Database Schema Audit',
      due_date: tomorrow.toISOString().slice(0, 16),
      status: 'Review',
      completion_percentage: 100,
      completion_notes: 'Fully audited. Waiting for approval.'
    }, userCookie);
    console.log(`-> Status: ${submitReview.status} (Expected: 200)`);
    if (submitReview.status !== 200) throw new Error('User submission to Review failed!');
    console.log('✅ Test 11 Passed.\n');

    // 12. Admin approves task (Review -> Completed)
    console.log('Test 12: Admin approves task submission...');
    const approveReview = await request(`/api/tasks/${taskId}/review`, 'PUT', {
      action: 'approve',
      comments: 'Excellent work. Schema validated.'
    }, adminCookie);
    console.log(`-> Status: ${approveReview.status} (Expected: 200)`);
    if (approveReview.status !== 200) throw new Error('Admin review approval failed!');
    console.log('✅ Test 12 Passed.\n');

    // 13. Verify Task Status is Completed
    console.log('Test 13: Fetch task details to check status completed...');
    const taskDetails = await request(`/api/tasks/${taskId}`, 'GET', null, adminCookie);
    console.log(`-> Status: ${taskDetails.status} (Expected: 200)`);
    console.log(`-> Final status check: "${taskDetails.body.status}"`);
    if (taskDetails.status !== 200 || taskDetails.body.status !== 'Completed') {
      throw new Error('Task was not completed successfully after admin review approval!');
    }
    console.log('✅ Test 13 Passed.\n');

    // 14. Admin fetches Analytics dashboard
    console.log('Test 14: Admin retrieves dashboard statistics aggregates...');
    const adminAnalytics = await request('/api/analytics/dashboard', 'GET', null, adminCookie);
    console.log(`-> Status: ${adminAnalytics.status} (Expected: 200)`);
    console.log(`-> Stats Completed Count: ${adminAnalytics.body.completed}`);
    console.log(`-> Productivity Score: ${adminAnalytics.body.productivityScore}%`);
    if (adminAnalytics.status !== 200 || adminAnalytics.body.completed < 1) {
      throw new Error('Analytics failed to reflect correct completion rates!');
    }
    console.log('✅ Test 14 Passed.\n');

    // 15. Admin fetches User Performance charts
    console.log('Test 15: Admin fetches User Performance analytics...');
    const userPerf = await request('/api/analytics/performance', 'GET', null, adminCookie);
    console.log(`-> Status: ${userPerf.status} (Expected: 200)`);
    console.log(`-> Performance Index records: ${userPerf.body.length}`);
    const testerPerf = userPerf.body.find(u => u.id === userId);
    console.log(`-> Assignee Completed Count: ${testerPerf.completed} | Completion Rate: ${testerPerf.completionRate}%`);
    if (userPerf.status !== 200 || !testerPerf || testerPerf.completed < 1) {
      throw new Error('User performance aggregates verification failed!');
    }
    console.log('✅ Test 15 Passed.\n');

    console.log('🎉 ALL COMPREHENSIVE BACKEND WORKFLOWS AND VALIDATIONS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('❌ VERIFICATION FAIL:', error.message);
    process.exit(1);
  }
}

runTests();
