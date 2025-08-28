const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const users = await User.findByEmail(email);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Email not found' });
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, 'secretfortoken', { expiresIn: '1h' });

    res.status(200).json({
      message: 'Login successful',
      token: token,
      userId: user.id,
      name: user.name
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
