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



  return router;
};


