const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2');


const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '000000',
  database: 'hrms'
});


// Multer setup for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); 

module.exports = (db) => {



  // Login API
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT id, name, email, grp_id, status 
    FROM users 
    WHERE (email = ? OR employee_id = ?) AND password = ? 
  `;

  db.query(sql, [email, email, password], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.length > 0) {
      const user = results[0];

      
      if (user.status === 'paused') {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account has been temporarily paused. Please contact HR for assistance.' 
        });
      }

      const dashboardMap = {
        1: '/admin-dashboard',
        2: '/hr-dashboard',
        3: '/emp-dashboard'
      };

      const dashboardRoute = dashboardMap[user.grp_id] || '/emp-dashboard';

      res.json({
        success: true,
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          grp_id: user.grp_id,
          status: user.status 
        },
        dashboardRoute,
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });
});


  //  Profile submission API
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });
  
  const upload = multer({ storage });
  
  const cpUpload = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'aadharPdf', maxCount: 1 },
    { name: 'panPdf', maxCount: 1 },
    { name: 'salarySlips', maxCount: 10 },
    { name: 'educationDocs', maxCount: 10 },
    { name: 'experienceDocs', maxCount: 10 },
  ]);
  
  router.post('/profile', cpUpload, (req, res) => {
    try {
      // Logging the request to check fields and files
      console.log('Request Body:', req.body);
      console.log('Uploaded Files:', req.files);
  
      const {
        employeeId, name, contactNo, email, alternateContact, emergencyContact,
        bloodGroup, permanentAddress, currentAddress, aadharNumber, panNumber,
        department, jobRole, dob, doj
      } = req.body;
  
      const formatDate = (isoString) => {
        if (!isoString) return null;
        const date = new Date(isoString);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      };
  
      const formattedDob = formatDate(dob);
      const formattedDoj = formatDate(doj);
  
      if (!formattedDob || !formattedDoj) {
        return res.status(400).json({ success: false, message: 'Invalid date format' });
      }
  
      const files = req.files || {};
      const profileImage = files['profileImage']?.[0]?.filename || null;
      const aadharPdf = files['aadharPdf']?.[0]?.filename || null;
      const panPdf = files['panPdf']?.[0]?.filename || null;
      const salarySlips = files['salarySlips']?.map(f => f.filename) || [];
      const educationDocs = files['educationDocs']?.map(f => f.filename) || [];
      const experienceDocs = files['experienceDocs']?.map(f => f.filename) || [];
  
      const sql = `INSERT INTO employee_profiles 
        (employee_id, name, contact_no, email, alternate_contact, emergency_contact,
        blood_group, permanent_address, current_address, aadhar_number, pan_number,
        department, job_role, dob, doj, profile_image,
        aadhar_card, pan_card, salary_slips, educational_certificates, experience_letters)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name),
          contact_no = VALUES(contact_no),
          email = VALUES(email),
          alternate_contact = VALUES(alternate_contact),
          emergency_contact = VALUES(emergency_contact),
          blood_group = VALUES(blood_group),
          permanent_address = VALUES(permanent_address),
          current_address = VALUES(current_address),
          aadhar_number = VALUES(aadhar_number),
          pan_number = VALUES(pan_number),
          department = VALUES(department),
          job_role = VALUES(job_role),
          dob = VALUES(dob),
          doj = VALUES(doj),
          profile_image = VALUES(profile_image),
          aadhar_card = VALUES(aadhar_card),
          pan_card = VALUES(pan_card),
          salary_slips = VALUES(salary_slips),
          educational_certificates = VALUES(educational_certificates),
          experience_letters = VALUES(experience_letters)`;
  
      const values = [
        employeeId, name, contactNo, email, alternateContact, emergencyContact,
        bloodGroup, permanentAddress, currentAddress, aadharNumber, panNumber,
        department, jobRole, formattedDob, formattedDoj, profileImage,
        aadharPdf, panPdf, JSON.stringify(salarySlips),
        JSON.stringify(educationDocs), JSON.stringify(experienceDocs)
      ];
  



      db.query(sql, values, (err, results) => {
        if (err) {
          console.error('❌ Database error:', err);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
  
        res.status(200).json({ success: true, message: 'Profile submitted successfully' });
      });
    } catch (err) {
      console.error('❌ Error processing profile submission:', err);
      res.status(400).json({ success: false, message: 'File upload failed' });
    }
  });
  


  // Get all employee profiles
  router.get('/employee-profiles', (req, res) => {
    const sql = 'SELECT * FROM employee_profiles';

    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      res.status(200).json({ success: true, data: results });
    });
  });


  // Delete employee by email
  router.delete('/employee-profiles/email/:email', (req, res) => {
    const email = req.params.email;
    const sql = 'DELETE FROM employee_profiles WHERE email = ?';

    db.query(sql, [email], (err, result) => {
      if (err) {
        console.error('Error deleting employee:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      res.status(200).json({ success: true, message: 'Employee deleted successfully' });
    });
  });

  //  Create Employee API

  router.post('/create-employee', (req, res) => {
    const { name, email, password, grp_id, employeeId } = req.body;

    if (!name || !email || !password || !grp_id || !employeeId) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Check if the Employee ID already exists
    const checkEmployeeIdSql = 'SELECT * FROM users WHERE employee_id = ?';
    db.query(checkEmployeeIdSql, [employeeId], (err, results) => {
      if (err) {
        console.error('Database error (check existing employee ID):', err);
        return res.status(500).json({ success: false, message: 'Server error checking employee ID' });
      }

      if (results.length > 0) {
        return res.status(409).json({ success: false, message: 'Employee ID already exists' });
      }

      // Check if email already exists
      const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
      db.query(checkEmailSql, [email], (err, results) => {
        if (err) {
          console.error('Database error (check existing email):', err);
          return res.status(500).json({ success: false, message: 'Server error checking email' });
        }

        if (results.length > 0) {
          return res.status(409).json({ success: false, message: 'User already exists with this email' });
        }

        // Insert the new employee
        const insertSql = `INSERT INTO users (name, email, password, grp_id, employee_id) VALUES (?, ?, ?, ?, ?)`;
        const values = [name, email, password, grp_id, employeeId];

        db.query(insertSql, values, (err, results) => {
          if (err) {
            console.error('Database error (insert):', err);
            return res.status(500).json({ success: false, message: 'Server error inserting employee' });
          }

          console.log('Employee created successfully:', results);
          res.status(200).json({ success: true, message: 'Employee created successfully' });
        });
      });
    });
  });

// API to fetch user profile by user ID
// API to fetch logged-in user profile
// GET user profile by email
router.get('/user/profile', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const query = `
    SELECT 
      id,
      employee_id AS employeeId,
      name,
      contact_no AS contactNo,
      email,
      alternate_contact AS alternateContact,
      emergency_contact AS emergencyContact,
      blood_group AS bloodGroup,
      permanent_address AS permanentAddress,
      current_address AS currentAddress,
      aadhar_number AS aadharNumber,
      pan_number AS panNumber,
      department,
      job_role AS jobRole,
      dob,
      doj,
      profile_image AS profileImage,
      aadhar_card AS aadharPdf,
      pan_card AS panPdf,
      salary_slips AS salarySlips,
      educational_certificates AS educationDocs,
      experience_letters AS experienceDocs
    FROM employee_profiles
    WHERE email = ?
  `;

  db.query(query, [email], (err, result) => {
    if (err) {
      console.error('❌ Error fetching profile data:', err);
      return res.status(500).json({ message: 'Error fetching profile data' });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'No profile found for this user' });
    }

    const profile = result[0];

    // Parse arrays safely
    try {
      profile.salarySlips = JSON.parse(profile.salarySlips || '[]');
      profile.educationDocs = JSON.parse(profile.educationDocs || '[]');
      profile.experienceDocs = JSON.parse(profile.experienceDocs || '[]');
    } catch (parseErr) {
      console.warn('⚠️ JSON parse error:', parseErr);
    }

    // Build unified documents array
    profile.documents = [];

    if (profile.aadharPdf) {
      profile.documents.push({ documentType: 'Aadhar Card', documentPath: profile.aadharPdf });
    }
    if (profile.panPdf) {
      profile.documents.push({ documentType: 'PAN Card', documentPath: profile.panPdf });
    }
    profile.salarySlips.forEach((file, i) => {
      profile.documents.push({ documentType: `Salary Slip ${i + 1}`, documentPath: file });
    });
    profile.educationDocs.forEach((file, i) => {
      profile.documents.push({ documentType: `Education Certificate ${i + 1}`, documentPath: file });
    });
    profile.experienceDocs.forEach((file, i) => {
      profile.documents.push({ documentType: `Experience Letter ${i + 1}`, documentPath: file });
    });

    res.json(profile);
  });
});



router.post('/leave-requests', (req, res) => {
  const { emailId, leaveType, fromDate, toDate, status, reason } = req.body;

  // Query to insert a new leave request
  const sql = `
    INSERT INTO all_leaves (emailid, leavetype, fromdate, todate, status, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const values = [emailId, leaveType, fromDate, toDate, status, reason];

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Error inserting leave request:', error);
      return res.status(500).json({ error: 'Failed to submit leave request' });
    }
    res.status(200).json({ message: 'Leave request submitted successfully', data: results });
  });
});



router.get('/get-leave-requests', (req, res) => {
  console.log("Request to /api/get-leave-requests received");
  const query = 'SELECT * FROM all_leaves WHERE status = "Pending"';
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error fetching leave requests' });
    }
    console.log("Fetched results:", results); // Add this line
    res.json({ leaveRequests: results });
  });
});




// In your router file (e.g., routes.js or api.js)
router.get('/leave-requests-emp', (req, res) => {
  const emailId = req.query.emailId;  // Get the emailId from the query parameter
  const sql = 'SELECT * FROM all_leaves WHERE emailId = ?';

  db.query(sql, [emailId], (err, result) => {
    if (err) {
      console.error('Error fetching leave requests:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(result);
  });
});





// Handle DELETE request for leave cancellation by email
router.delete('/leave-requests-del', (req, res) => {
  const email = req.query.emailId;
  const id = parseInt(req.query.id, 10); // Convert to number

  if (!email || isNaN(id)) {
    return res.status(400).json({ error: 'Valid Email and Leave ID are required' });
  }

  // Step 1: Get leave details
  const getLeaveQuery = `
    SELECT DATEDIFF(toDate, fromDate) + 1 AS number_of_days
    FROM all_leaves 
    WHERE emailId = ? AND id = ?
  `;

  db.query(getLeaveQuery, [email, id], (err, results) => {
    if (err) {
      console.error('Error fetching leave info:', err);
      return res.status(500).json({ error: 'Failed to fetch leave info' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No leave found for this email and ID' });
    }

    const number_of_days = results[0].number_of_days;

    // Step 2: Restore leave balance
    const restoreQuery = `
      UPDATE users 
      SET remaining_leaves = remaining_leaves + ? 
      WHERE email = ?
    `;

    db.query(restoreQuery, [number_of_days, email], (err) => {
      if (err) {
        console.error('Error restoring leave balance:', err);
        return res.status(500).json({ error: 'Failed to restore leave balance' });
      }

      // Step 3: Delete leave request
      const deleteQuery = `DELETE FROM all_leaves WHERE emailId = ? AND id = ?`;

      db.query(deleteQuery, [email, id], (err, result) => {
        if (err) {
          console.error('Error deleting leave request:', err);
          return res.status(500).json({ error: 'Failed to delete leave request' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'No leave request found to delete' });
        }

        return res.json({ message: 'Leave cancelled and balance restored successfully' });
      });
    });
  });
});


// Leave POST route
// router.post('/update-leave-status', (req, res) => {
//   const { leaveId, status } = req.body;
//   const query = 'UPDATE all_leaves SET status = ? WHERE id = ?';
//   db.query(query, [status, leaveId], (err, result) => {
//     if (err) {
//       return res.status(500).json({ message: 'Error updating leave status' });
//     }
//     res.json({ message: 'Leave status updated successfully' });
//   });
// });



router.post('/update-leave-status', (req, res) => {
  const { leaveId, status } = req.body;

  // Validate status
  if (status !== 'Approved' && status !== 'Rejected') {
    return res.status(400).send({ message: 'Invalid status' });
  }

  // Step 1: Get leave details (email, duration, and current status)
  const getLeaveQuery = `
    SELECT emailId, DATEDIFF(toDate, fromDate) + 1 AS number_of_days, status AS currentStatus
    FROM all_leaves 
    WHERE id = ?
  `;

  db.query(getLeaveQuery, [leaveId], (err, results) => {
    if (err) {
      console.error('Error fetching leave request:', err);
      return res.status(500).send({ message: 'Failed to fetch leave request' });
    }

    if (results.length === 0) {
      return res.status(404).send({ message: 'Leave request not found' });
    }

    const { emailId, number_of_days, currentStatus } = results[0];

    // Prevent re-processing already final statuses
    if (currentStatus === status) {
      return res.status(400).send({ message: `Leave is already ${status.toLowerCase()}` });
    }

    // Step 2: Update leave status
    const updateLeaveQuery = `UPDATE all_leaves SET status = ? WHERE id = ?`;

    db.query(updateLeaveQuery, [status, leaveId], (err) => {
      if (err) {
        console.error('Error updating leave status:', err);
        return res.status(500).send({ message: 'Failed to update leave status' });
      }

      // Step 3: If rejected, restore leave balance
      if (status === 'Rejected') {
        const updateUserLeaves = `
          UPDATE users 
          SET remaining_leaves = remaining_leaves + ? 
          WHERE email = ?
        `;

        db.query(updateUserLeaves, [number_of_days, emailId], (err, result) => {
          if (err) {
            console.error('Error restoring leave days:', err);
            return res.status(500).send({ message: 'Leave status updated, but failed to restore leave days' });
          }

          if (result.affectedRows === 0) {
            return res.status(404).send({ message: 'User not found. Leave restoration failed.' });
          }

          return res.send({ message: 'Leave rejected and days restored successfully' });
        });
      } else {
        return res.send({ message: `Leave request ${status.toLowerCase()} successfully` });
      }
    });
  });
});





router.get('/get-approved-leaves', (req, res) => {
  const query = 'SELECT * FROM all_leaves WHERE status = "Approved"';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching approved leaves: ', err);
      return res.status(500).json({ message: 'Error fetching approved leaves' });
    }
    res.json({ leaveRequests: results });
  });
});


// Node.js route to fetch rejected leaves
router.get('/get-rejected-leaves', (req, res) => {
  const query = 'SELECT * FROM all_leaves WHERE status = "Rejected"'; // Modify as needed
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to retrieve rejected leaves' });
    }
    res.json({ leaveRequests: results });
  });
});


// GET /api/employee-profiles/email/:email
router.get('/employee-profiles/email/:email', (req, res) => {
  const email = req.params.email;

  const query = 'SELECT * FROM employee_profiles WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('Error fetching employee profile:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const result = results[0];

    const formatted = {
  employeeId: result.employee_id,
  name: result.name,
  contactNo: result.contact_no,
  alternateContact: result.alternate_contact,
  emergencyContact: result.emergency_contact,
  email: result.email,
  bloodGroup: result.blood_group,
  dob: result.dob,
  doj: result.doj,
  aadharNumber: result.aadhar_number,
  panNumber: result.pan_number,
  permanentAddress: result.permanent_address,
  currentAddress: result.current_address,
  jobRole: result.job_role,
  department: result.department,
  profileImage: result.profile_image,
  documents: [
  { documentType: 'Aadhar Card', documentPath: result.aadhar_card },
  { documentType: 'PAN Card', documentPath: result.pan_card },
  { documentType: 'Salary Slip', documentPath: result.salary_slips },
  { documentType: 'Education Certificate', documentPath: result.educational_certificates },
  { documentType: 'Experience Letter', documentPath: result.experience_letters }
].filter(doc => doc.documentPath)
};

res.json({ success: true, data: formatted });

  });
});



router.get('/users', (req, res) => {
  db.query('SELECT * FROM users', (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result);
  });
});

// DELETE user by email
router.delete('/users/:email', (req, res) => {
  const email = req.params.email;
  db.query('DELETE FROM users WHERE email = ?', [email], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});






// Update user session status
router.post('/update-session-status', (req, res) => {
  const { email, status } = req.body;

  if (!email || !status) {
    return res.status(400).json({ success: false, message: 'Email and status are required' });
  }

  if (!['active', 'paused'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Must be "active" or "paused"' });
  }

  const sql = 'UPDATE users SET status = ? WHERE email = ?';

  db.query(sql, [status, email], (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: `User session ${status === 'paused' ? 'paused' : 'activated'} successfully` 
    });
  });
});






router.get('/remaining-leaves', (req, res) => {
  const email = req.query.emailId;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const sql = `
    SELECT 
      COALESCE(
        (SELECT remaining_leaves FROM users WHERE email = ?),
        15
      ) AS remainingLeaves
  `;

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('Error fetching remaining leaves:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      email,
      remainingLeaves: results[0].remainingLeaves
    });
  });
});



// Update remaining leaves after leave submission
router.post('/update-leave-balance', (req, res) => {
  const { email, days } = req.body;

  if (!email || days === undefined) {
    return res.status(400).json({ error: 'Email and days are required' });
  }

  const checkSql = 'SELECT * FROM users WHERE email = ?';

  db.query(checkSql, [email], (err, results) => {
    if (err) {
      console.error('Error checking leave balance:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (results.length > 0) {
      // Update existing record
      const updateSql = `
        UPDATE users 
        SET remaining_leaves = remaining_leaves - ? 
        WHERE email = ? AND remaining_leaves >= ?
      `;

      db.query(updateSql, [days, email, days], (err, result) => {
        if (err) {
          console.error('Error updating leave balance:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (result.affectedRows === 0) {
          return res.status(400).json({ error: 'Insufficient leave balance' });
        }

        res.json({ success: true });
      });
    } else {
      // Insert new record with initial balance 15 - days
      const insertSql = `
        INSERT INTO users (email, remaining_leaves)
        VALUES (?, 15 - ?)
      `;

      db.query(insertSql, [email, days], (err, result) => {
        if (err) {
          console.error('Error creating leave balance:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({ success: true });
      });
    }
  });
});




// ==================== ASSET MANAGEMENT APIs ====================

// Get all assets with filtering
router.get('/assets', (req, res) => {
  const { search, status, type, brand, vendor, page = 1, limit = 10 } = req.query;
  
 // In your /assets endpoint, modify the SQL query to include reason/notes:
let sql = `
  SELECT a.*, 
         v.name as vendor_name, 
         v.contact_person as vendor_contact_person,
         v.email as vendor_email,
         v.phone as vendor_phone,
         a.created_at,
         COALESCE(
           (SELECT ah.notes
            FROM asset_allocation_history ah
            WHERE ah.asset_id = a.asset_id
            ORDER BY ah.allocated_date DESC
            LIMIT 1),
           a.reason
         ) AS reason
  FROM assets a
  LEFT JOIN vendors v ON a.vendor = v.name
  WHERE 1=1
`;
  let params = [];

  if (search) {
    sql += ` AND (a.asset_id LIKE ? OR a.name LIKE ? OR a.model LIKE ? OR a.allocated_to LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status && status !== '') {
    sql += ` AND a.status = ?`;
    params.push(status);
  }

  if (type && type !== '') {
    sql += ` AND a.type = ?`;
    params.push(type);
  }

  if (brand && brand !== '') {
    sql += ` AND a.brand = ?`;
    params.push(brand);
  }

  if (vendor && vendor !== '') {
    sql += ` AND a.vendor = ?`;
    params.push(vendor);
  }

  // Add pagination
  const offset = (page - 1) * limit;
  sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  // Count query for pagination
  let countSql = `SELECT COUNT(*) as total FROM assets a WHERE 1=1`;
  let countParams = [];

  if (search) {
    countSql += ` AND (a.asset_id LIKE ? OR a.name LIKE ? OR a.model LIKE ? OR a.allocated_to LIKE ?)`;
    countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status && status !== '') {
    countSql += ` AND a.status = ?`;
    countParams.push(status);
  }

  if (type && type !== '') {
    countSql += ` AND a.type = ?`;
    countParams.push(type);
  }

  if (brand && brand !== '') {
    countSql += ` AND a.brand = ?`;
    countParams.push(brand);
  }

  if (vendor && vendor !== '') {
    countSql += ` AND a.vendor = ?`;
    countParams.push(vendor);
  }

  db.query(countSql, countParams, (err, countResult) => {
    if (err) {
      console.error('Error counting assets:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    const total = countResult[0].total;

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('Error fetching assets:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      res.json({
        success: true,
        data: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    });
  });
});

// Get next incremental asset ID

router.get('/assets/next-id', (req, res) => {
  const year = new Date().getFullYear();
  const prefix = `AID${year}`;
  
  const sql = `
    SELECT LPAD(COALESCE(MAX(CAST(SUBSTRING(asset_id, 8) AS UNSIGNED)), 0) + 1, 4, '0') AS seq
    FROM assets
    WHERE asset_id LIKE ?
  `;

  db.query(sql, [`${prefix}%`], (err, results) => {
    if (err) {
      console.error('Error fetching next asset id:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    const seq = results[0]?.seq || '0001';
    const nextId = `${prefix}${seq}`;
    
    res.json({ success: true, data: { nextId } });
  });
});
// Get asset by ID
router.get('/assets/:id', (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT a.*, 
           v.name as vendor_name, 
           v.contact_person as vendor_contact_person,
           v.email as vendor_email,
           v.phone as vendor_phone
    FROM assets a
    LEFT JOIN vendors v ON a.vendor = v.name
    WHERE a.asset_id = ? OR a.id = ?
  `;

  db.query(sql, [id, id], (err, results) => {
    if (err) {
      console.error('Error fetching asset:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.json({ success: true, data: results[0] });
  });
});

// Create new asset (auto-generate asset_id if not provided)
router.post('/assets', (req, res) => {
  let {
    asset_id,
    serial_number,
    name,
    type,
    brand,
    model,
    status,
    allocated_to,
    vendor,
    vendor_email,
    vendor_contact,
    warranty_expiry,
    purchase_date,
    purchase_cost
  } = req.body;

  // Allow alias from frontend
  asset_id = asset_id || serial_number;

  const insert = (finalAssetId) => {
    const sql = `
      INSERT INTO assets (
        asset_id, name, type, brand, model, status, allocated_to, 
        vendor, vendor_email, vendor_contact, warranty_expiry, 
        purchase_date, purchase_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      finalAssetId, name, type, brand, model, status || 'Available', allocated_to,
      vendor, vendor_email, vendor_contact, warranty_expiry,
      purchase_date, purchase_cost
    ];

    db.query(sql, values, (err, results) => {
      if (err) {
        console.error('Error creating asset:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, message: 'Asset ID already exists' });
        }
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      res.status(201).json({ 
        success: true, 
        message: 'Asset created successfully',
        data: { id: results.insertId, asset_id: finalAssetId }
      });
    });
  };

  if (asset_id) {
    return insert(asset_id);
  }

  const year = new Date().getFullYear();
  const prefix = `AID${year}`;
  const nextSql = `
    SELECT LPAD(COALESCE(MAX(CAST(SUBSTRING(asset_id, 8) AS UNSIGNED)), 0) + 1, 4, '0') AS seq
    FROM assets
    WHERE asset_id LIKE ?
  `;
  db.query(nextSql, [`${prefix}%`], (err, results) => {
    if (err) {
      console.error('Error generating next asset id:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    const seq = results[0]?.seq || '0001';
    const nextId = `${prefix}${seq}`;
    insert(nextId);
  });
});

// Update asset
router.put('/assets/:id', (req, res) => {
  const { id } = req.params;
  const {
    name,
    type,
    brand,
    model,
    status,
    allocated_to,
    vendor,
    vendor_email,
    vendor_contact,
    warranty_expiry,
    purchase_date,
    purchase_cost
  } = req.body;

  const sql = `
    UPDATE assets SET 
      name = ?, type = ?, brand = ?, model = ?, status = ?, 
      allocated_to = ?, vendor = ?, vendor_email = ?, vendor_contact = ?, 
      warranty_expiry = ?, purchase_date = ?, purchase_cost = ?
    WHERE asset_id = ?
  `;

  const values = [
    name, type, brand, model, status, allocated_to, vendor, 
    vendor_email, vendor_contact, warranty_expiry, purchase_date, 
    purchase_cost, id, id
  ];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error updating asset:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.json({ success: true, message: 'Asset updated successfully' });
  });
});

// Delete asset
router.delete('/assets/:id', (req, res) => {
  const { id } = req.params;

  const sql = 'DELETE FROM assets WHERE asset_id = ? OR id = ?';

  db.query(sql, [id, id], (err, results) => {
    if (err) {
      console.error('Error deleting asset:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.json({ success: true, message: 'Asset deleted successfully' });
  });
});

// Get filter options
router.get('/assets/filters/options', (req, res) => {
  const queries = [
    'SELECT DISTINCT status as value FROM assets WHERE status IS NOT NULL',
    'SELECT DISTINCT type as value FROM assets WHERE type IS NOT NULL',
    'SELECT DISTINCT brand as value FROM assets WHERE brand IS NOT NULL',
    'SELECT DISTINCT name as value FROM vendors WHERE name IS NOT NULL'
  ];

  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results.map(item => item.value));
      });
    })
  ))
  .then(([statusOptions, typeOptions, brandOptions, vendorOptions]) => {
    res.json({
      success: true,
      data: {
        status: statusOptions,
        type: typeOptions,
        brand: brandOptions,
        vendor: vendorOptions
      }
    });
  })
  .catch(err => {
    console.error('Error fetching filter options:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  });
});

// ==================== VENDOR MANAGEMENT APIs ====================

// Get all vendors
router.get('/vendors', (req, res) => {
  const sql = 'SELECT * FROM vendors ORDER BY name';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching vendors:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    res.json({ success: true, data: results });
  });
});

// Create new vendor
router.post('/vendors', (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;

  const sql = `
    INSERT INTO vendors (name, contact_person, email, phone, address)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [name, contact_person, email, phone, address], (err, results) => {
    if (err) {
      console.error('Error creating vendor:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Vendor already exists' });
      }
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Vendor created successfully',
      data: { id: results.insertId, name }
    });
  });
});

// Update vendor
router.put('/vendors/:id', (req, res) => {
  const { id } = req.params;
  const { name, contact_person, email, phone, address } = req.body;

  const sql = `
    UPDATE vendors SET 
      name = ?, contact_person = ?, email = ?, phone = ?, address = ?
    WHERE id = ?
  `;

  db.query(sql, [name, contact_person, email, phone, address, id], (err, results) => {
    if (err) {
      console.error('Error updating vendor:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.json({ success: true, message: 'Vendor updated successfully' });
  });
});

// Delete vendor
router.delete('/vendors/:id', (req, res) => {
  const { id } = req.params;

  // Check if vendor is used in assets
  const checkSql = 'SELECT COUNT(*) as count FROM assets WHERE vendor IN (SELECT name FROM vendors WHERE id = ?)';
  
  db.query(checkSql, [id], (err, results) => {
    if (err) {
      console.error('Error checking vendor usage:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete vendor. It is being used by one or more assets.' 
      });
    }

    const deleteSql = 'DELETE FROM vendors WHERE id = ?';
    
    db.query(deleteSql, [id], (err, results) => {
      if (err) {
        console.error('Error deleting vendor:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Vendor not found' });
      }

      res.json({ success: true, message: 'Vendor deleted successfully' });
    });
  });
});

// ==================== ASSET ALLOCATION APIs ====================

// Allocate asset to employee
router.post('/assets/:id/allocate', (req, res) => {
  const { id } = req.params;
  const { allocated_to, notes } = req.body;

  // Start transaction
  db.beginTransaction(err => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    // Update asset status
    const updateAssetSql = 'UPDATE assets SET status = "Allocated", allocated_to = ? WHERE asset_id = ? OR id = ?';
    
    db.query(updateAssetSql, [allocated_to, id, id], (err, results) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error updating asset:', err);
          res.status(500).json({ success: false, message: 'Server error' });
        });
      }

      if (results.affectedRows === 0) {
        return db.rollback(() => {
          res.status(404).json({ success: false, message: 'Asset not found' });
        });
      }

      // Add to allocation history
      const historySql = `
        INSERT INTO asset_allocation_history (asset_id, allocated_to, allocated_date, notes)
        VALUES (?, ?, CURDATE(), ?)
      `;

      db.query(historySql, [id, allocated_to, notes], (err, results) => {
        if (err) {
          return db.rollback(() => {
            console.error('Error adding to allocation history:', err);
            res.status(500).json({ success: false, message: 'Server error' });
          });
        }

        db.commit(err => {
          if (err) {
            return db.rollback(() => {
              console.error('Error committing transaction:', err);
              res.status(500).json({ success: false, message: 'Server error' });
            });
          }

          res.json({ success: true, message: 'Asset allocated successfully' });
        });
      });
    });
  });
});

// Return asset
router.post('/assets/:id/return', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  // Start transaction
  db.beginTransaction(err => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    // Update asset status
    const updateAssetSql = 'UPDATE assets SET status = "Available", allocated_to = NULL WHERE asset_id = ? OR id = ?';
    
    db.query(updateAssetSql, [id, id], (err, results) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error updating asset:', err);
          res.status(500).json({ success: false, message: 'Server error' });
        });
      }

      if (results.affectedRows === 0) {
        return db.rollback(() => {
          res.status(404).json({ success: false, message: 'Asset not found' });
        });
      }

      // Update allocation history
      const historySql = `
        UPDATE asset_allocation_history 
        SET returned_date = CURDATE(), notes = CONCAT(IFNULL(notes, ''), ?)
        WHERE asset_id = ? AND returned_date IS NULL
      `;

      db.query(historySql, [`\nReturned: ${notes}`, id], (err, results) => {
        if (err) {
          return db.rollback(() => {
            console.error('Error updating allocation history:', err);
            res.status(500).json({ success: false, message: 'Server error' });
          });
        }

        db.commit(err => {
          if (err) {
            return db.rollback(() => {
              console.error('Error committing transaction:', err);
              res.status(500).json({ success: false, message: 'Server error' });
            });
          }

          res.json({ success: true, message: 'Asset returned successfully' });
        });
      });
    });
  });
});

// Get allocation history for asset
router.get('/assets/:id/history', (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT * FROM asset_allocation_history 
    WHERE asset_id = ? 
    ORDER BY allocated_date DESC
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error('Error fetching allocation history:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    res.json({ success: true, data: results });
  });
});


// Departments and Employees APIs for allocation (based on grp_id in users)
router.get('/departments', (req, res) => {
  const GROUP_MAP = {
    1: 'Admin',
    2: 'HR', 
    3: 'Developers',
    4: 'Managers',
    5: 'Designing',
    6: 'Content',
    7: 'Motion Design'
  };

  const sql = 'SELECT DISTINCT grp_id FROM users WHERE grp_id IS NOT NULL ORDER BY grp_id';
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching departments (grp_id):', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    const departments = results
      .map(row => ({ 
        grp_id: row.grp_id, 
        name: GROUP_MAP[row.grp_id] || `Group ${row.grp_id}` 
      }))
      .filter(dept => dept.grp_id);

    res.json({ success: true, data: departments });
  });
});

router.get('/employees/by-group', (req, res) => {
  const { grp_id } = req.query;
  if (!grp_id) {
    return res.status(400).json({ success: false, message: 'grp_id is required' });
  }
  const sql = `
    SELECT employee_id, name, grp_id
    FROM users
    WHERE grp_id = ?
    ORDER BY name
  `;
  db.query(sql, [grp_id], (err, results) => {
    if (err) {
      console.error('Error fetching employees by grp_id:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true, data: results });
  });
});

  return router;
};


