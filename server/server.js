const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Data file path
const dataFilePath = path.join(__dirname, 'data', 'animals.json');

// Helper function to read data
const readData = () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error reading data:', error);
    return [];
  }
};

// Helper function to write data
const writeData = (data) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
};

// Validation rules
const animalValidation = [
  body('type').isIn(['dog', 'cat', 'other']).withMessage('Type must be dog, cat, or other'),
  body('breed').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('color').isString().trim().isLength({ min: 1, max: 50 }),
  body('size').isIn(['small', 'medium', 'large']).withMessage('Size must be small, medium, or large'),
  body('location').isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 1000 }),
  body('contactName').isString().trim().isLength({ min: 1, max: 100 }),
  body('contactPhone').isString().trim().matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number'),
  body('contactEmail').isEmail().withMessage('Invalid email address'),
  body('status').optional().isIn(['found', 'lost', 'adopted', 'reunited']).withMessage('Invalid status')
];

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all animals with optional filtering
app.get('/api/animals', (req, res) => {
  try {
    let animals = readData();
    
    // Apply filters
    const { type, status, location, search } = req.query;
    
    if (type) {
      animals = animals.filter(animal => animal.type === type);
    }
    
    if (status) {
      animals = animals.filter(animal => animal.status === status);
    }
    
    if (location) {
      animals = animals.filter(animal => 
        animal.location.toLowerCase().includes(location.toLowerCase())
      );
    }
    
    if (search) {
      const searchTerm = search.toLowerCase();
      animals = animals.filter(animal => 
        animal.breed?.toLowerCase().includes(searchTerm) ||
        animal.color.toLowerCase().includes(searchTerm) ||
        animal.description?.toLowerCase().includes(searchTerm) ||
        animal.location.toLowerCase().includes(searchTerm)
      );
    }
    
    // Sort by date (newest first)
    animals.sort((a, b) => new Date(b.dateReported) - new Date(a.dateReported));
    
    res.json({
      success: true,
      data: animals,
      count: animals.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching animals',
      error: error.message
    });
  }
});

// Get single animal by ID
app.get('/api/animals/:id', (req, res) => {
  try {
    const animals = readData();
    const animal = animals.find(a => a.id === req.params.id);
    
    if (!animal) {
      return res.status(404).json({
        success: false,
        message: 'Animal not found'
      });
    }
    
    res.json({
      success: true,
      data: animal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching animal',
      error: error.message
    });
  }
});

// Create new animal report
app.post('/api/animals', upload.single('photo'), animalValidation, (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const animals = readData();
    
    const newAnimal = {
      id: uuidv4(),
      type: req.body.type,
      breed: req.body.breed || '',
      color: req.body.color,
      size: req.body.size,
      location: req.body.location,
      description: req.body.description || '',
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      status: req.body.status || 'found',
      dateReported: new Date().toISOString(),
      photo: req.file ? `/uploads/${req.file.filename}` : null
    };
    
    animals.push(newAnimal);
    
    if (writeData(animals)) {
      res.status(201).json({
        success: true,
        message: 'Animal report created successfully',
        data: newAnimal
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error saving animal report'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating animal report',
      error: error.message
    });
  }
});

// Update animal report
app.put('/api/animals/:id', upload.single('photo'), animalValidation, (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const animals = readData();
    const animalIndex = animals.findIndex(a => a.id === req.params.id);
    
    if (animalIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Animal not found'
      });
    }
    
    const updatedAnimal = {
      ...animals[animalIndex],
      type: req.body.type,
      breed: req.body.breed || '',
      color: req.body.color,
      size: req.body.size,
      location: req.body.location,
      description: req.body.description || '',
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      status: req.body.status || animals[animalIndex].status,
      lastUpdated: new Date().toISOString()
    };
    
    // Update photo if new one is uploaded
    if (req.file) {
      updatedAnimal.photo = `/uploads/${req.file.filename}`;
    }
    
    animals[animalIndex] = updatedAnimal;
    
    if (writeData(animals)) {
      res.json({
        success: true,
        message: 'Animal report updated successfully',
        data: updatedAnimal
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error updating animal report'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating animal report',
      error: error.message
    });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const animals = readData();
    
    const stats = {
      total: animals.length,
      byType: {
        dog: animals.filter(a => a.type === 'dog').length,
        cat: animals.filter(a => a.type === 'cat').length,
        other: animals.filter(a => a.type === 'other').length
      },
      byStatus: {
        found: animals.filter(a => a.status === 'found').length,
        lost: animals.filter(a => a.status === 'lost').length,
        adopted: animals.filter(a => a.status === 'adopted').length,
        reunited: animals.filter(a => a.status === 'reunited').length
      },
      recentReports: animals
        .sort((a, b) => new Date(b.dateReported) - new Date(a.dateReported))
        .slice(0, 5)
        .map(animal => ({
          id: animal.id,
          type: animal.type,
          location: animal.location,
          dateReported: animal.dateReported,
          status: animal.status
        }))
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 StraySafe Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🐕 API Base URL: http://localhost:${PORT}/api`);
});

module.exports = app;