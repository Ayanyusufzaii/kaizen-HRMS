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

// ==================== ACTIVITY LOG HELPER FUNCTIONS ====================

const createActivityLog = (logData) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO activity_logs 
      (employee_id, employee_email, employee_name, action_type, action_description, 
       asset_id, ticket_id, performed_by, performed_by_name, additional_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      logData.employee_id || null,
      logData.employee_email || null,
      logData.employee_name || null,
      logData.action_type,
      logData.action_description,
      logData.asset_id || null,
      logData.ticket_id || null,
      logData.performed_by,
      logData.performed_by_name,
      logData.additional_data ? JSON.stringify(logData.additional_data) : null
    ];
    
    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Error creating activity log:', err);
        reject(err);
      } else {
        console.log('Activity log created successfully:', result.insertId);
        resolve(result);
      }
    });
  });
};

const getEmployeeDetailsByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT employee_id, name, email FROM users WHERE email = ?';
    db.query(sql, [email], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0] || { employee_id: null, name: 'Unknown Employee', email: email });
      }
    });
  });
};

const logTicketConversation = async (ticketId, actionType, description, performedBy, performedByName, additionalData = null) => {
  try {
    const getTicketSql = `
      SELECT mt.reported_by, mt.asset_id, u.employee_id, u.name 
      FROM maintenance_tickets mt 
      LEFT JOIN users u ON mt.reported_by = u.email 
      WHERE mt.ticket_id = ?
    `;
    
    return new Promise((resolve, reject) => {
      db.query(getTicketSql, [ticketId], async (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (results.length === 0) {
          reject(new Error('Ticket not found'));
          return;
        }
        
        const ticket = results[0];
        
        const logData = {
          employee_id: ticket.employee_id,
          employee_email: ticket.reported_by,
          employee_name: ticket.name || 'Unknown Employee',
          action_type: actionType,
          action_description: description,
          asset_id: ticket.asset_id,
          ticket_id: ticketId,
          performed_by: performedBy,
          performed_by_name: performedByName,
          additional_data: additionalData
        };
        
        try {
          const result = await createActivityLog(logData);
          resolve(result);
        } catch (logError) {
          reject(logError);
        }
      });
    });
  } catch (error) {
    console.error('Error logging ticket conversation:', error);
    throw error;
  }
};

// ==================== EXISTING ROUTES ====================

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

// Profile submission API
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const profileUpload = multer({ storage: profileStorage });

const cpUpload = profileUpload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'aadharPdf', maxCount: 1 },
  { name: 'panPdf', maxCount: 1 },
  { name: 'salarySlips', maxCount: 10 },
  { name: 'educationDocs', maxCount: 10 },
  { name: 'experienceDocs', maxCount: 10 },
]);

router.post('/profile', cpUpload, (req, res) => {
  try {
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

// Create Employee API
router.post('/create-employee', (req, res) => {
  const { name, email, password, grp_id, employeeId } = req.body;

  if (!name || !email || !password || !grp_id || !employeeId) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const checkEmployeeIdSql = 'SELECT * FROM users WHERE employee_id = ?';
  db.query(checkEmployeeIdSql, [employeeId], (err, results) => {
    if (err) {
      console.error('Database error (check existing employee ID):', err);
      return res.status(500).json({ success: false, message: 'Server error checking employee ID' });
    }

    if (results.length > 0) {
      return res.status(409).json({ success: false, message: 'Employee ID already exists' });
    }

    const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailSql, [email], (err, results) => {
      if (err) {
        console.error('Database error (check existing email):', err);
        return res.status(500).json({ success: false, message: 'Server error checking email' });
      }

      if (results.length > 0) {
        return res.status(409).json({ success: false, message: 'User already exists with this email' });
      }

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

    try {
      profile.salarySlips = JSON.parse(profile.salarySlips || '[]');
      profile.educationDocs = JSON.parse(profile.educationDocs || '[]');
      profile.experienceDocs = JSON.parse(profile.experienceDocs || '[]');
    } catch (parseErr) {
      console.warn('⚠️ JSON parse error:', parseErr);
    }

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

// ==================== ENHANCED TICKET ROUTES WITH CONVERSATION LOGGING ====================

// Enhanced ticket creation with comprehensive logging
router.post('/raise-ticket', upload.array('files', 5), async (req, res) => {
  try {
    const {
      asset_id,
      reported_by,
      issue_description,
    } = req.body;

    if (!asset_id || !reported_by || !issue_description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Asset ID, reporter email, and issue description are required' 
      });
    }

    const year = new Date().getFullYear();
    const prefix = `TID${year}`;
    
    const getNextTicketIdSql = `
      SELECT LPAD(COALESCE(MAX(CAST(SUBSTRING(ticket_id, 8) AS UNSIGNED)), 0) + 1, 4, '0') AS seq
      FROM maintenance_tickets
      WHERE ticket_id LIKE ?
    `;

    db.query(getNextTicketIdSql, [`${prefix}%`], async (err, results) => {
      if (err) {
        console.error('Error generating ticket ID:', err);
        return res.status(500).json({ success: false, message: 'Error generating ticket ID' });
      }

      const seq = results[0]?.seq || '0001';
      const ticket_id = `${prefix}${seq}`;
      const created_at = new Date();

      const insertTicketSql = `
        INSERT INTO maintenance_tickets (
          ticket_id, asset_id, reported_by, issue_description, status, created_at
        ) VALUES (?, ?, ?, ?, 'Open', ?, ?)
      `;

      db.query(insertTicketSql, [ticket_id, asset_id, reported_by, issue_description , created_at], async (err, result) => {
        if (err) {
          console.error('Error inserting ticket:', err);
          return res.status(500).json({ success: false, message: 'Failed to create ticket' });
        }

        try {
          const employee = await getEmployeeDetailsByEmail(reported_by);

          // 🔹 Log into ticket_conversations
          await logTicketConversation(
            ticket_id,
            'ticket_created',
            `New ticket created: "${issue_description}"`,
            reported_by,
            employee.name,
            {
              issue_description: issue_description,
              asset_id: asset_id,
              has_evidence: req.files && req.files.length > 0,
              evidence_count: req.files ? req.files.length : 0
            }
          );

          // 🔹 Insert into activity_logs table
          const insertActivitySql = `
            INSERT INTO activity_logs (
              employee_email, employee_id, employee_name,
              action_type, action_description,
              asset_id, ticket_id,
              performed_by, performed_by_name,
              created_at, additional_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          // const activityData = [
          //   reported_by,
          //   employee.id,   // assuming getEmployeeDetailsByEmail returns {id, name, email,...}
          //   employee.name,
          //   'ticket_created',
          //   `Raised new ticket for asset ${asset_id}`,
          //   asset_id,
          //   ticket_id,
          //   reported_by,
          //   employee.name,
          //   new Date(),
          //   JSON.stringify({
          //     issue_description,
          //     priority,
          //     has_evidence: req.files && req.files.length > 0,
          //     evidence_count: req.files ? req.files.length : 0
          //   })
          // ];

          db.query(insertActivitySql, activityData, (err3) => {
            if (err3) {
              console.error('Error inserting into activity_logs:', err3);
            }
          });

          // 🔹 Handle evidence uploads
          if (req.files && req.files.length > 0) {
            const evidenceValues = req.files.map(file => [
              ticket_id,
              file.mimetype.startsWith('video') ? 'video' : 'image',
              file.filename,
              new Date()
            ]);

            const insertEvidenceSql = `
              INSERT INTO ticket_evidence (ticket_id, file_type, file_path, uploaded_at)
              VALUES ?
            `;

            db.query(insertEvidenceSql, [evidenceValues], async (err2) => {
              if (!err2) {
                await logTicketConversation(
                  ticket_id,
                  'evidence_uploaded',
                  `Uploaded ${req.files.length} evidence file(s)`,
                  reported_by,
                  employee.name,
                  {
                    files: req.files.map(f => ({
                      name: f.filename,
                      type: f.mimetype.startsWith('video') ? 'video' : 'image',
                      size: f.size
                    }))
                  }
                );
              }
            });
          }

          res.json({ 
            success: true, 
            message: 'Ticket raised successfully.',
            data: { ticket_id }
          });

        } catch (logError) {
          console.error('Error logging ticket creation:', logError);
          res.json({ 
            success: true, 
            message: 'Ticket raised successfully.',
            data: { ticket_id }
          });
        }
      });
    });

  } catch (error) {
    console.error('Unexpected error in raise-ticket:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// Get leave requests
router.post('/leave-requests', (req, res) => {
  const { emailId, leaveType, fromDate, toDate, status, reason } = req.body;

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
    console.log("Fetched results:", results);
    res.json({ leaveRequests: results });
  });
});

router.get('/leave-requests-emp', (req, res) => {
  const emailId = req.query.emailId;
  const sql = 'SELECT * FROM all_leaves WHERE emailId = ?';

  db.query(sql, [emailId], (err, result) => {
    if (err) {
      console.error('Error fetching leave requests:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(result);
  });
});

router.delete('/leave-requests-del', (req, res) => {
  const email = req.query.emailId;
  const id = parseInt(req.query.id, 10);

  if (!email || isNaN(id)) {
    return res.status(400).json({ error: 'Valid Email and Leave ID are required' });
  }

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

router.post('/update-leave-status', (req, res) => {
  const { leaveId, status } = req.body;

  if (status !== 'Approved' && status !== 'Rejected') {
    return res.status(400).send({ message: 'Invalid status' });
  }

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

    if (currentStatus === status) {
      return res.status(400).send({ message: `Leave is already ${status.toLowerCase()}` });
    }

    const updateLeaveQuery = `UPDATE all_leaves SET status = ? WHERE id = ?`;

    db.query(updateLeaveQuery, [status, leaveId], (err) => {
      if (err) {
        console.error('Error updating leave status:', err);
        return res.status(500).send({ message: 'Failed to update leave status' });
      }

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

router.get('/get-rejected-leaves', (req, res) => {
  const query = 'SELECT * FROM all_leaves WHERE status = "Rejected"';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to retrieve rejected leaves' });
    }
    res.json({ leaveRequests: results });
  });
});

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

router.get('/assets', (req, res) => {
  const { 
    search, status, type, brand, vendor, emp_email, 
    page = 1, limit = 10 
  } = req.query;

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
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
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

  if (emp_email && emp_email !== '') {
    sql += ` AND a.emp_email = ?`;
    params.push(emp_email);
  }

  const offset = (page - 1) * limit;
  sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  let countSql = `SELECT COUNT(*) as total FROM assets a WHERE 1=1`;
  let countParams = [];

  if (search) {
    countSql += ` AND (a.asset_id LIKE ? OR a.name LIKE ? OR a.model LIKE ? OR a.allocated_to LIKE ?)`;
    const searchTerm = `%${search}%`;
    countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
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

  if (emp_email && emp_email !== '') {
    countSql += ` AND a.emp_email = ?`;
    countParams.push(emp_email);
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

// Enhanced asset creation with activity logging
router.post('/assets', async (req, res) => {
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
    purchase_cost,
    reason
  } = req.body;

  const insert = async (finalAssetId, emp_email, emp_name) => {
    const sql = `
      INSERT INTO assets (
        asset_id, serial_no, name, type, brand, model, status, allocated_to, 
        vendor, vendor_email, vendor_contact, warranty_expiry, 
        purchase_date, purchase_cost, reason, emp_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      finalAssetId,
      serial_number,
      name,
      type,
      brand,
      model,
      status || 'Available',
      allocated_to,
      vendor,
      vendor_email,
      vendor_contact,
      warranty_expiry,
      purchase_date,
      purchase_cost,
      reason || null,
      emp_email
    ];

    db.query(sql, values, async (err, results) => {
      if (err) {
        console.error('Error creating asset:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, message: 'Asset ID already exists' });
        }
        return res.status(500).json({ success: false, message: 'Server error while inserting asset' });
      }

      if (allocated_to && emp_email) {
        try {
          await createActivityLog({
            employee_id: allocated_to,
            employee_email: emp_email,
            employee_name: emp_name,
            action_type: 'asset_allocated',
            action_description: `Asset ${finalAssetId} (${name}) allocated`,
            asset_id: finalAssetId,
            performed_by: 'HR',
            performed_by_name: 'HR Team',
            additional_data: {
              asset_name: name,
              asset_type: type,
              brand: brand,
              model: model,
              status: status
            }
          });
        } catch (logError) {
          console.error('Failed to create activity log for asset allocation:', logError);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Asset created successfully',
        data: { id: results.insertId, asset_id: finalAssetId }
      });
    });
  };

  const proceed = (emp_email, emp_name) => {
    if (asset_id) {
      return insert(asset_id, emp_email, emp_name);
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
        console.error('Error generating next asset ID:', err);
        return res.status(500).json({ success: false, message: 'Server error while generating asset ID' });
      }

      const seq = results[0]?.seq || '0001';
      const nextId = `${prefix}${seq}`;
      insert(nextId, emp_email, emp_name);
    });
  };

 if (!allocated_to || allocated_to.trim() === '') {
  return proceed(null, null);
}

  const getEmployeeSql = `SELECT email, name FROM users WHERE employee_id = ?`;

  db.query(getEmployeeSql, [allocated_to], (err, results) => {
    if (err) {
      console.error('Error fetching user details:', err);
      return res.status(500).json({ success: false, message: 'Server error while fetching user details' });
    }

    if (results.length === 0) {
      console.warn(`User with employee ID ${allocated_to} not found.`);
      return res.status(404).json({ success: false, message: 'User not found with this employee_id' });
    }

    const emp_email = results[0].email;
    const emp_name = results[0].name;
    proceed(emp_email, emp_name);
  });
});

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
    purchase_cost,
    reason
  } = req.body;

  const getEmailSql = `SELECT email FROM users WHERE employee_id = ?`;

  db.query(getEmailSql, [allocated_to], (err, results) => {
    if (err) {
      console.error('Error fetching user email:', err);
      return res.status(500).json({ success: false, message: 'Server error while fetching user email' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found with this employee_id' });
    }

    const emp_email = results[0].email;

    const updateSql = `
      UPDATE assets SET 
        name = ?, type = ?, brand = ?, model = ?, status = ?, 
        allocated_to = ?, vendor = ?, vendor_email = ?, vendor_contact = ?, 
        warranty_expiry = ?, purchase_date = ?, purchase_cost = ?, reason = ?, emp_email = ?
      WHERE asset_id = ?
    `;

    const values = [
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
      purchase_cost,
      reason || null,
      emp_email,
      id
    ];

    db.query(updateSql, values, (err, results) => {
      if (err) {
        console.error('Error updating asset:', err);
        return res.status(500).json({ success: false, message: 'Server error while updating asset' });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Asset not found' });
      }

      res.json({ success: true, message: 'Asset updated successfully' });
    });
  });
});

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

router.delete('/vendors/:id', (req, res) => {
  const { id } = req.params;

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

// ==================== ENHANCED TICKET MANAGEMENT APIS ====================

router.get('/maintenance_tickets', (req, res) => {
  const { reported_by } = req.query;

  if (!reported_by) {
    return res.status(400).json({ success: false, message: 'Missing reported_by email' });
  }

  const ticketSql = `
    SELECT 
      mt.*,
      a.model
    FROM maintenance_tickets mt
    LEFT JOIN assets a ON mt.asset_id = a.asset_id
    WHERE mt.reported_by = ?
    ORDER BY mt.created_at DESC
  `;

  db.query(ticketSql, [reported_by], (err, tickets) => {
    if (err) {
      console.error('Error fetching tickets:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (!tickets.length) {
      return res.json({ success: true, data: [] });
    }

    const ticketIds = tickets.map(t => t.ticket_id);
    const placeholders = ticketIds.map(() => '?').join(',');

    const evidenceSql = `
      SELECT * FROM ticket_evidence
      WHERE ticket_id IN (${placeholders})
    `;

    db.query(evidenceSql, ticketIds, (err2, evidence) => {
      if (err2) {
        console.error('Error fetching evidence:', err2);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      const evidenceMap = {};
      evidence.forEach(e => {
        if (!evidenceMap[e.ticket_id]) evidenceMap[e.ticket_id] = [];
        evidenceMap[e.ticket_id].push(e);
      });

      const result = tickets.map(ticket => ({
        ...ticket,
        evidence: evidenceMap[ticket.ticket_id] || []
      }));

      res.json({ success: true, data: result });
    });
  });
});

router.get('/hr-responses', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const sql = `
    SELECT 
      mt.ticket_id,
      mt.asset_id,
      a.model,
      mt.issue_description as description,
      mt.status,
      mt.resolution_notes as hr_response,
      mt.updated_at as hr_response_date,
      mt.created_at
    FROM maintenance_tickets mt
    LEFT JOIN assets a ON mt.asset_id = a.asset_id
    WHERE mt.reported_by = ? 
    AND mt.resolution_notes IS NOT NULL
    ORDER BY mt.updated_at DESC
  `;

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('Error fetching HR responses:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    res.json({ success: true, data: results });
  });
});

// Enhanced ticket cancellation with logging
router.delete('/tickets/:ticketId', async (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    return res.status(400).json({ success: false, message: 'Ticket ID is required' });
  }

  try {
    const getTicketSql = `
      SELECT mt.*, u.employee_id, u.name as employee_name
      FROM maintenance_tickets mt
      LEFT JOIN users u ON mt.reported_by = u.email
      WHERE mt.ticket_id = ?
    `;
    
    const ticketResults = await new Promise((resolve, reject) => {
      db.query(getTicketSql, [ticketId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (ticketResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const ticket = ticketResults[0];

    await logTicketConversation(
      ticketId,
      'ticket_cancelled',
      `Ticket cancelled by employee`,
      ticket.reported_by,
      ticket.employee_name,
      {
        reason: 'Cancelled by employee',
        original_issue: ticket.issue_description,
        status_at_cancellation: ticket.status
      }
    );

    db.beginTransaction(async (err) => {
      if (err) {
        console.error('Error starting transaction:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      try {
        await new Promise((resolve, reject) => {
          const deleteEvidenceSql = 'DELETE FROM ticket_evidence WHERE ticket_id = ?';
          db.query(deleteEvidenceSql, [ticketId], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        await new Promise((resolve, reject) => {
          const deleteTicketSql = 'DELETE FROM maintenance_tickets WHERE ticket_id = ?';
          db.query(deleteTicketSql, [ticketId], (err, result) => {
            if (err) reject(err);
            else if (result.affectedRows === 0) reject(new Error('Ticket not found'));
            else resolve(result);
          });
        });

        db.commit((err) => {
          if (err) {
            db.rollback(() => {
              console.error('Error committing transaction:', err);
              res.status(500).json({ success: false, message: 'Server error' });
            });
          } else {
            res.json({ success: true, message: 'Ticket cancelled successfully' });
          }
        });

      } catch (deleteError) {
        db.rollback(() => {
          console.error('Error during deletion:', deleteError);
          res.status(500).json({ success: false, message: 'Error cancelling ticket' });
        });
      }
    });

  } catch (error) {
    console.error('Error in ticket cancellation:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get ticket conversation history
router.get('/tickets/:ticketId/conversation', (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    return res.status(400).json({ success: false, message: 'Ticket ID is required' });
  }

  const sql = `
    SELECT 
      al.*,
      DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') as formatted_date
    FROM activity_logs al
    WHERE al.ticket_id = ?
    ORDER BY al.created_at ASC
  `;

  db.query(sql, [ticketId], (err, results) => {
    if (err) {
      console.error('Error fetching ticket conversation:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    const conversation = results.map(log => ({
      id: log.id,
      timestamp: log.created_at,
      action_type: log.action_type,
      message: log.action_description,
      performed_by: log.performed_by,
      performed_by_name: log.performed_by_name,
      additional_data: log.additional_data ? JSON.parse(log.additional_data) : null,
      is_hr: log.performed_by === 'HR' || log.performed_by_name === 'HR Team'
    }));

    res.json({ success: true, data: conversation });
  });
});

router.get('/ticket-logs/:ticketId', (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    return res.status(400).json({ success: false, message: 'Ticket ID is required' });
  }

  const ticketSql = `
    SELECT 
      mt.*,
      a.model,
      a.name as asset_name
    FROM maintenance_tickets mt
    LEFT JOIN assets a ON mt.asset_id = a.asset_id
    WHERE mt.ticket_id = ?
  `;

  db.query(ticketSql, [ticketId], (err, ticketResults) => {
    if (err) {
      console.error('Error fetching ticket details:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (ticketResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const ticket = ticketResults[0];

    const evidenceSql = 'SELECT * FROM ticket_evidence WHERE ticket_id = ? ORDER BY uploaded_at DESC';
    
    db.query(evidenceSql, [ticketId], (err, evidenceResults) => {
      if (err) {
        console.error('Error fetching ticket evidence:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      const activities = [];

      activities.push({
        date: ticket.created_at,
        user: ticket.reported_by,
        message: `Ticket created: ${ticket.issue_description}`,
        type: 'created',
        attachments: evidenceResults.map(e => e.file_path)
      });

      if (ticket.resolution_notes) {
        activities.push({
          date: ticket.updated_at,
          user: 'HR Team',
          message: ticket.resolution_notes,
          type: 'response',
          attachments: []
        });
      }

      res.json({ success: true, data: activities });
    });
  });
});

router.get('/tickets/next-id', (req, res) => {
  const year = new Date().getFullYear();
  const prefix = `TID${year}`;
  
  const sql = `
    SELECT LPAD(COALESCE(MAX(CAST(SUBSTRING(ticket_id, 8) AS UNSIGNED)), 0) + 1, 4, '0') AS seq
    FROM maintenance_tickets
    WHERE ticket_id LIKE ?
  `;

  db.query(sql, [`${prefix}%`], (err, results) => {
    if (err) {
      console.error('Error fetching next ticket id:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    const seq = results[0]?.seq || '0001';
    const nextId = `${prefix}${seq}`;
    
    res.json({ success: true, data: { nextId } });
  });
});

// ==================== HR TICKET MANAGEMENT ====================

router.get('/hr/tickets', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  let sql = `
    SELECT 
      mt.ticket_id,
      mt.asset_id,
      mt.reported_by,
      mt.issue_description,
      mt.status,
      mt.created_at,
      mt.assigned_to,
      mt.resolution_notes,
      mt.updated_at,
      a.model as asset_model,
      a.name as asset_name,
      u.name as employee_name,
      u.employee_id
    FROM maintenance_tickets mt
    LEFT JOIN assets a ON mt.asset_id = a.asset_id
    LEFT JOIN users u ON mt.reported_by = u.email
    WHERE 1=1
  `;

  let params = [];

  if (status && status !== 'all') {
    sql += ` AND mt.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY mt.created_at DESC`;

  const offset = (page - 1) * limit;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  db.query(sql, params, (err, tickets) => {
    if (err) {
      console.error('Error fetching tickets for HR:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (tickets.length > 0) {
      const ticketIds = tickets.map(t => t.ticket_id);
      const placeholders = ticketIds.map(() => '?').join(',');

      const evidenceSql = `
        SELECT ticket_id, file_type, file_path, uploaded_at
        FROM ticket_evidence
        WHERE ticket_id IN (${placeholders})
        ORDER BY uploaded_at DESC
      `;

      db.query(evidenceSql, ticketIds, (err2, evidence) => {
        if (err2) {
          console.error('Error fetching evidence:', err2);
          const result = tickets.map(ticket => ({
            ...ticket,
            evidence: []
          }));
          return res.json({ success: true, data: result });
        }

        const evidenceMap = {};
        evidence.forEach(e => {
          if (!evidenceMap[e.ticket_id]) evidenceMap[e.ticket_id] = [];
          evidenceMap[e.ticket_id].push({
            file_type: e.file_type,
            file_path: e.file_path,
            updated_at: e.updated_at
          });
        });

        const result = tickets.map(ticket => ({
          ...ticket,
          evidence: evidenceMap[ticket.ticket_id] || []
        }));

        res.json({ success: true, data: result });
      });
    } else {
      res.json({ success: true, data: [] });
    }
  });
});

router.get('/hr/ticket-stats', (req, res) => {
  const statsSql = `
    SELECT 
      status,
      COUNT(*) as count
    FROM maintenance_tickets
    GROUP BY status
  `;

  db.query(statsSql, (err, results) => {
    if (err) {
      console.error('Error fetching ticket stats:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    const stats = {
      open: 0,
      'under review': 0,
      escalated: 0,
      closed: 0,
      total: 0
    };

    results.forEach(row => {
      const status = row.status.toLowerCase();
      stats[status] = row.count;
      stats.total += row.count;
    });

    res.json({ success: true, data: stats });
  });
});

// Enhanced HR ticket response with comprehensive logging
router.put('/hr/tickets/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const { 
    status, 
    hrResponse, 
    informationRequest, 
    assignedTo 
  } = req.body;

  if (!ticketId) {
    return res.status(400).json({ success: false, message: 'Ticket ID is required' });
  }

  try {
    const getTicketSql = `
      SELECT mt.*, u.employee_id, u.name as employee_name, u.email as employee_email
      FROM maintenance_tickets mt
      LEFT JOIN users u ON mt.reported_by = u.email
      WHERE mt.ticket_id = ?
    `;
    
    const ticketResults = await new Promise((resolve, reject) => {
      db.query(getTicketSql, [ticketId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (ticketResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const currentTicket = ticketResults[0];

    let updateFields = [];
    let updateValues = [];
    let logActions = [];

    if (status && status !== currentTicket.status) {
      updateFields.push('status = ?');
      updateValues.push(status);
      logActions.push({
        type: 'status_updated',
        description: `Ticket status changed from "${currentTicket.status}" to "${status}"`,
        data: { old_status: currentTicket.status, new_status: status }
      });
    }

    if (hrResponse && hrResponse.trim()) {
      updateFields.push('resolution_notes = ?');
      updateValues.push(hrResponse.trim());
      logActions.push({
        type: 'hr_response',
        description: `HR responded: "${hrResponse.trim()}"`,
        data: { response: hrResponse.trim() }
      });
    }

    if (informationRequest && informationRequest.trim()) {
      logActions.push({
        type: 'information_request',
        description: `HR requested more information: "${informationRequest.trim()}"`,
        data: { request: informationRequest.trim() }
      });
    }

    if (assignedTo && assignedTo !== currentTicket.assigned_to) {
      updateFields.push('assigned_to = ?');
      updateValues.push(assignedTo);
      logActions.push({
        type: 'ticket_assigned',
        description: `Ticket assigned to ${assignedTo}`,
        data: { assigned_to: assignedTo, previous_assignee: currentTicket.assigned_to }
      });
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date());

    if (updateFields.length === 1) {
      return res.status(400).json({ success: false, message: 'No updates provided' });
    }

    const updateSql = `
      UPDATE maintenance_tickets 
      SET ${updateFields.join(', ')}
      WHERE ticket_id = ?
    `;

    updateValues.push(ticketId);

    await new Promise((resolve, reject) => {
      db.query(updateSql, updateValues, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // 🔹 Process all log actions (ticket_conversations + activity_logs)
    for (const action of logActions) {
      try {
        // Ticket conversation log
        await logTicketConversation(
          ticketId,
          action.type,
          action.description,
          'HR',
          'HR Team',
          action.data
        );

        // Activity log entry
        const insertActivitySql = `
          INSERT INTO activity_logs (
            employee_email, employee_id, employee_name,
            action_type, action_description,
            asset_id, ticket_id,
            performed_by, performed_by_name,
            created_at, additional_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // const activityData = [
        //   currentTicket.employee_email,
        //   currentTicket.employee_id,
        //   currentTicket.employee_name,
        //   action.type,
        //   action.description,
        //   currentTicket.asset_id,
        //   ticketId,
        //   'HR',
        //   'HR Team',
        //   new Date(),
        //   JSON.stringify(action.data || {})
        // ];

        db.query(insertActivitySql, activityData, (err2) => {
          if (err2) {
            console.error('Error inserting activity log:', err2);
          }
        });
      } catch (logError) {
        console.error('Error logging action:', action.type, logError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Ticket updated successfully',
      data: { 
        ticketId, 
        status, 
        hrResponse, 
        informationRequest,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ==================== ACTIVITY LOGS ====================

router.post("/activity-logs", async (req, res) => {
  try {
    const logData = req.body;

    if (!logData.action_type || !logData.action_description || !logData.performed_by || !logData.performed_by_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await createActivityLog(logData);
    res.status(201).json({
      message: "Activity log created successfully",
      log_id: result.insertId,
    });
  } catch (err) {
    console.error("Error creating activity log:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/hr/activity-logs', (req, res) => {
  const { 
    employee_name, 
    employee_id, 
    start_date, 
    end_date, 
    page = 1, 
    limit = 20,
    group_by = 'employee' 
  } = req.query;

  let sql = `
    SELECT 
      al.*,
      DATE(al.created_at) as log_date
    FROM activity_logs al
    WHERE 1=1
  `;
  
  let params = [];

  if (employee_name && employee_name.trim()) {
    sql += ` AND al.employee_name LIKE ?`;
    params.push(`%${employee_name.trim()}%`);
  }

  if (employee_id && employee_id.trim()) {
    sql += ` AND al.employee_id LIKE ?`;
    params.push(`%${employee_id.trim()}%`);
  }

  if (start_date) {
    sql += ` AND DATE(al.created_at) >= ?`;
    params.push(start_date);
  }

  if (end_date) {
    sql += ` AND DATE(al.created_at) <= ?`;
    params.push(end_date);
  }

  sql += ` ORDER BY al.created_at DESC`;

  const offset = (page - 1) * limit;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching activity logs for HR:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (group_by === 'employee') {
      const groupedLogs = {};
      results.forEach(log => {
        const key = `${log.employee_id || 'unknown'}-${log.employee_email || 'unknown'}`;
        if (!groupedLogs[key]) {
          groupedLogs[key] = {
            employee_id: log.employee_id,
            employee_email: log.employee_email,
            employee_name: log.employee_name,
            activities: []
          };
        }
        groupedLogs[key].activities.push(log);
      });

      const groupedResults = Object.values(groupedLogs);
      res.json({ success: true, data: groupedResults, grouped: true });
    } else {
      res.json({ success: true, data: results, grouped: false });
    }
  });
});

router.get('/employee/activity-logs', (req, res) => {
  const { employee_email } = req.query;

  if (!employee_email) {
    return res.status(400).json({ success: false, message: 'Employee email is required' });
  }

  const sql = `
    SELECT * FROM activity_logs 
    WHERE employee_email = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [employee_email], (err, results) => {
    if (err) {
      console.error('Error fetching employee activity logs:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    res.json({ success: true, data: results });
  });
});

// ==================== DEPARTMENT AND EMPLOYEE ROUTES ====================

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
    SELECT employee_id, name, grp_id, email
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

// Add these new routes to your existing router.js file

// ==================== NEW EMPLOYEE TICKET APIS ====================

// Get tickets with latest updates for employee
router.get('/employee/tickets-with-updates', (req, res) => {
  const { reported_by } = req.query;

  if (!reported_by) {
    return res.status(400).json({ success: false, message: 'Missing reported_by email' });
  }

  const ticketSql = `
    SELECT 
      mt.*,
      a.model
    FROM maintenance_tickets mt
    LEFT JOIN assets a ON mt.asset_id = a.asset_id
    WHERE mt.reported_by = ?
    ORDER BY mt.created_at DESC
  `;

  db.query(ticketSql, [reported_by], (err, tickets) => {
    if (err) {
      console.error('Error fetching tickets:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (!tickets.length) {
      return res.json({ success: true, data: [] });
    }

    // Get latest update for each ticket
    const ticketIds = tickets.map(t => t.ticket_id);
    const placeholders = ticketIds.map(() => '?').join(',');

    const latestUpdateSql = `
      SELECT 
        al1.*
      FROM activity_logs al1
      INNER JOIN (
        SELECT 
          ticket_id,
          MAX(created_at) as max_created_at
        FROM activity_logs
        WHERE ticket_id IN (${placeholders})
        AND ticket_id IS NOT NULL
        GROUP BY ticket_id
      ) al2 ON al1.ticket_id = al2.ticket_id AND al1.created_at = al2.max_created_at
    `;

    db.query(latestUpdateSql, ticketIds, (err2, updates) => {
      if (err2) {
        console.error('Error fetching latest updates:', err2);
        // Return tickets without updates
        const result = tickets.map(ticket => ({
          ...ticket,
          latest_update: null
        }));
        return res.json({ success: true, data: result });
      }

      // Map updates to tickets
      const updateMap = {};
      updates.forEach(update => {
        updateMap[update.ticket_id] = {
          message: update.action_description,
          date: update.created_at,
          is_hr: update.performed_by === 'HR'
        };
      });

      const result = tickets.map(ticket => ({
        ...ticket,
        latest_update: updateMap[ticket.ticket_id] || null
      }));

      res.json({ success: true, data: result });
    });
  });
});

// Submit employee ticket update
router.post('/employee/update-ticket', upload.array('files', 5), async (req, res) => {
  try {
    const {
      ticket_id,
      message,
      updated_by
    } = req.body;

    if (!ticket_id || !message || !updated_by) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket ID, message, and updated_by are required' 
      });
    }

    // Get ticket and employee details
    const getTicketSql = `
      SELECT mt.*, u.employee_id, u.name as employee_name
      FROM maintenance_tickets mt
      LEFT JOIN users u ON mt.reported_by = u.email
      WHERE mt.ticket_id = ?
    `;

    db.query(getTicketSql, [ticket_id], async (err, ticketResults) => {
      if (err) {
        console.error('Error fetching ticket:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      if (ticketResults.length === 0) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
      }

      const ticket = ticketResults[0];

      // Verify the person updating is the ticket owner
      if (ticket.reported_by !== updated_by) {
        return res.status(403).json({ success: false, message: 'Unauthorized to update this ticket' });
      }

      try {
        // Log the employee response
        await logTicketConversation(
          ticket_id,
          'employee_response',
          `Employee response: "${message}"`,
          updated_by,
          ticket.employee_name,
          {
            response: message,
            has_evidence: req.files && req.files.length > 0,
            evidence_count: req.files ? req.files.length : 0
          }
        );

        // Handle evidence uploads if any
        if (req.files && req.files.length > 0) {
          const evidenceValues = req.files.map(file => [
            ticket_id,
            file.mimetype.startsWith('video') ? 'video' : 'image',
            file.filename,
            new Date()
          ]);

          const insertEvidenceSql = `
            INSERT INTO ticket_evidence (ticket_id, file_type, file_path, uploaded_at)
            VALUES ?
          `;

          db.query(insertEvidenceSql, [evidenceValues], async (err2) => {
            if (!err2) {
              await logTicketConversation(
                ticket_id,
                'evidence_uploaded',
                `Employee uploaded ${req.files.length} additional evidence file(s)`,
                updated_by,
                ticket.employee_name,
                {
                  files: req.files.map(f => ({
                    name: f.filename,
                    type: f.mimetype.startsWith('video') ? 'video' : 'image',
                    size: f.size
                  }))
                }
              );
            }
          });
        }

        res.json({ 
          success: true, 
          message: 'Ticket updated successfully.',
          data: { 
            ticket_id,
            message,
            updated_at: new Date()
          }
        });

      } catch (logError) {
        console.error('Error logging ticket update:', logError);
        res.json({ 
          success: true, 
          message: 'Ticket updated successfully.',
          data: { ticket_id }
        });
      }
    });

  } catch (error) {
    console.error('Unexpected error in employee ticket update:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get activity logs grouped by ticket for employee
router.get('/employee/activity-logs-by-ticket', (req, res) => {
  const { employee_email } = req.query;

  if (!employee_email) {
    return res.status(400).json({ success: false, message: 'Employee email is required' });
  }

  const sql = `
    SELECT 
      al.*
    FROM activity_logs al
    WHERE al.employee_email = ?
    AND al.ticket_id IS NOT NULL
    ORDER BY al.ticket_id, al.created_at ASC
  `;

  db.query(sql, [employee_email], (err, results) => {
    if (err) {
      console.error('Error fetching employee activity logs by ticket:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    // Group activities by ticket_id
    const groupedLogs = {};
    results.forEach(activity => {
      const ticketId = activity.ticket_id;
      if (!groupedLogs[ticketId]) {
        groupedLogs[ticketId] = {
          ticket_id: ticketId,
          activities: []
        };
      }
      groupedLogs[ticketId].activities.push(activity);
    });

    // Convert to array and sort by most recent activity
    const groupedArray = Object.values(groupedLogs).sort((a, b) => {
      const latestA = Math.max(...a.activities.map(act => new Date(act.created_at).getTime()));
      const latestB = Math.max(...b.activities.map(act => new Date(act.created_at).getTime()));
      return latestB - latestA;
    });

    res.json({ success: true, data: groupedArray });
  });
});

// ==================== ENHANCED HR TICKET MANAGEMENT ====================

// Get all tickets for HR with latest activities
router.get('/hr/tickets-enhanced', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  let sql = `
    SELECT 
      mt.ticket_id,
      mt.asset_id,
      mt.reported_by,
      mt.issue_description,
      mt.status,
      mt.created_at,
      mt.assigned_to,
      mt.resolution_notes,
      mt.updated_at,
      a.model as asset_model,
      a.name as asset_name,
      u.name as employee_name,
      u.employee_id
    FROM maintenance_tickets mt
    LEFT JOIN assets a ON mt.asset_id = a.asset_id
    LEFT JOIN users u ON mt.reported_by = u.email
    WHERE 1=1
  `;

  let params = [];

  if (status && status !== 'all') {
    sql += ` AND mt.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY mt.created_at DESC`;

  const offset = (page - 1) * limit;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  db.query(sql, params, (err, tickets) => {
    if (err) {
      console.error('Error fetching tickets for HR:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (tickets.length > 0) {
      const ticketIds = tickets.map(t => t.ticket_id);
      const placeholders = ticketIds.map(() => '?').join(',');

      // Get latest activity for each ticket
      const latestActivitySql = `
        SELECT 
          al1.*
        FROM activity_logs al1
        INNER JOIN (
          SELECT 
            ticket_id,
            MAX(created_at) as max_created_at
          FROM activity_logs
          WHERE ticket_id IN (${placeholders})
          GROUP BY ticket_id
        ) al2 ON al1.ticket_id = al2.ticket_id AND al1.created_at = al2.max_created_at
      `;

      db.query(latestActivitySql, ticketIds, (err2, activities) => {
        if (err2) {
          console.error('Error fetching latest activities:', err2);
          return res.json({ success: true, data: tickets });
        }

        // Map activities to tickets
        const activityMap = {};
        activities.forEach(activity => {
          activityMap[activity.ticket_id] = {
            message: activity.action_description,
            date: activity.created_at,
            performed_by: activity.performed_by,
            is_employee_response: activity.performed_by !== 'HR'
          };
        });

        const result = tickets.map(ticket => ({
          ...ticket,
          latest_activity: activityMap[ticket.ticket_id] || null
        }));

        res.json({ success: true, data: result });
      });
    } else {
      res.json({ success: true, data: [] });
    }
  });
});

// Get full conversation/activity log for a specific ticket
router.get('/hr/tickets/:ticketId/conversation', (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    return res.status(400).json({ success: false, message: 'Ticket ID is required' });
  }

  const sql = `
    SELECT 
      al.*,
      DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') as formatted_date
    FROM activity_logs al
    WHERE al.ticket_id = ?
    ORDER BY al.created_at ASC
  `;

  db.query(sql, [ticketId], (err, results) => {
    if (err) {
      console.error('Error fetching ticket conversation:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    // Get evidence files for this ticket
    const evidenceSql = 'SELECT * FROM ticket_evidence WHERE ticket_id = ? ORDER BY uploaded_at DESC';
    
    db.query(evidenceSql, [ticketId], (err2, evidenceResults) => {
      if (err2) {
        console.error('Error fetching ticket evidence:', err2);
        // Continue without evidence
      }

      const conversation = results.map(log => ({
        id: log.id,
        timestamp: log.created_at,
        action_type: log.action_type,
        message: log.action_description,
        performed_by: log.performed_by,
        performed_by_name: log.performed_by_name,
        additional_data: log.additional_data ? JSON.parse(log.additional_data) : null,
        is_hr: log.performed_by === 'HR',
        is_employee: log.performed_by !== 'HR'
      }));

      res.json({ 
        success: true, 
        data: {
          conversation,
          evidence: evidenceResults || []
        }
      });
    });
  });
});

// Enhanced HR response with better logging
router.put('/hr/tickets/:ticketId/respond', async (req, res) => {
  const { ticketId } = req.params;
  const { 
    status, 
    hrResponse, 
    informationRequest, 
    assignedTo,
    respondedBy = 'HR'
  } = req.body;

  if (!ticketId) {
    return res.status(400).json({ success: false, message: 'Ticket ID is required' });
  }

  try {
    // Get current ticket details
    const getTicketSql = `
      SELECT mt.*, u.employee_id, u.name as employee_name, u.email as employee_email
      FROM maintenance_tickets mt
      LEFT JOIN users u ON mt.reported_by = u.email
      WHERE mt.ticket_id = ?
    `;
    
    const ticketResults = await new Promise((resolve, reject) => {
      db.query(getTicketSql, [ticketId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (ticketResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const currentTicket = ticketResults[0];

    // Prepare updates
    let updateFields = [];
    let updateValues = [];
    let logActions = [];

    if (status && status !== currentTicket.status) {
      updateFields.push('status = ?');
      updateValues.push(status);
      logActions.push({
        type: 'status_updated',
        description: `HR changed ticket status from "${currentTicket.status}" to "${status}"`,
        data: { old_status: currentTicket.status, new_status: status }
      });
    }

    if (hrResponse && hrResponse.trim()) {
      updateFields.push('resolution_notes = ?');
      updateValues.push(hrResponse.trim());
      logActions.push({
        type: 'hr_response',
        description: `HR responded: "${hrResponse.trim()}"`,
        data: { response: hrResponse.trim() }
      });
    }

    if (informationRequest && informationRequest.trim()) {
      logActions.push({
        type: 'information_request',
        description: `HR requested more information: "${informationRequest.trim()}"`,
        data: { request: informationRequest.trim() }
      });
    }

    if (assignedTo && assignedTo !== currentTicket.assigned_to) {
      updateFields.push('assigned_to = ?');
      updateValues.push(assignedTo);
      logActions.push({
        type: 'ticket_assigned',
        description: `HR assigned ticket to ${assignedTo}`,
        data: { assigned_to: assignedTo, previous_assignee: currentTicket.assigned_to }
      });
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date());

    if (updateFields.length === 1) {
      // Only updated_at was added, no real changes
      return res.status(400).json({ success: false, message: 'No updates provided' });
    }

    // Update the ticket
    const updateSql = `
      UPDATE maintenance_tickets 
      SET ${updateFields.join(', ')}
      WHERE ticket_id = ?
    `;

    updateValues.push(ticketId);

    await new Promise((resolve, reject) => {
      db.query(updateSql, updateValues, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Log all actions
    for (const action of logActions) {
      try {
        await logTicketConversation(
          ticketId,
          action.type,
          action.description,
          'HR',
          'HR Team',
          action.data
        );
      } catch (logError) {
        console.error('Error logging HR action:', action.type, logError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Ticket updated successfully by HR',
      data: { 
        ticketId, 
        status, 
        hrResponse, 
        informationRequest,
        assignedTo,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in HR ticket response:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== ACTIVITY LOGS MANAGEMENT ====================

// Get activity summary for dashboard
router.get('/employee/activity-summary', (req, res) => {
  const { employee_email } = req.query;

  if (!employee_email) {
    return res.status(400).json({ success: false, message: 'Employee email is required' });
  }

  const sql = `
    SELECT 
      COUNT(*) as total_activities,
      COUNT(DISTINCT ticket_id) as total_tickets,
      COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_activities,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_activities,
      action_type,
      COUNT(*) as type_count
    FROM activity_logs
    WHERE employee_email = ?
    GROUP BY action_type
    ORDER BY type_count DESC
  `;

  db.query(sql, [employee_email], (err, results) => {
    if (err) {
      console.error('Error fetching activity summary:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    // Process results into summary format
    const summary = {
      total_activities: 0,
      total_tickets: 0,
      today_activities: 0,
      week_activities: 0,
      activity_types: {}
    };

    if (results.length > 0) {
      // Take summary values from first row (they should be the same across all rows)
      summary.total_activities = results[0].total_activities;
      summary.total_tickets = results[0].total_tickets;
      summary.today_activities = results[0].today_activities;
      summary.week_activities = results[0].week_activities;

      // Build activity types breakdown
      results.forEach(row => {
        summary.activity_types[row.action_type] = row.type_count;
      });
    }

    res.json({ success: true, data: summary });
  });
});

// Export activity logs for employee
router.get('/employee/activity-logs/export', (req, res) => {
  const { employee_email, start_date, end_date } = req.query;

  if (!employee_email) {
    return res.status(400).json({ success: false, message: 'Employee email is required' });
  }

  let sql = `
    SELECT 
      al.*,
      DATE_FORMAT(al.created_at, '%Y-%m-%d') as activity_date,
      TIME_FORMAT(al.created_at, '%H:%i:%s') as activity_time
    FROM activity_logs al
    WHERE al.employee_email = ?
  `;
  
  let params = [employee_email];

  if (start_date) {
    sql += ` AND DATE(al.created_at) >= ?`;
    params.push(start_date);
  }

  if (end_date) {
    sql += ` AND DATE(al.created_at) <= ?`;
    params.push(end_date);
  }

  sql += ` ORDER BY al.created_at DESC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching activity logs for export:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    // Format for CSV export
    const csvData = results.map(log => ({
      date: log.activity_date,
      time: log.activity_time,
      action_type: log.action_type,
      description: log.action_description,
      asset_id: log.asset_id || '',
      ticket_id: log.ticket_id || '',
      performed_by: log.performed_by,
      performed_by_name: log.performed_by_name || ''
    }));

    res.json({ 
      success: true, 
      data: csvData,
      total_records: results.length 
    });
  });
});

  return router;
};
