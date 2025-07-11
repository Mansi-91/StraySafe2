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
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Data file path
const dataFile = path.join(dataDir, 'animals.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(dataFile)) {
  const initialData = [];
  fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
}

// Helper functions
const readData = () => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return [];
  }
};

const writeData = (data) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
};

// Validation rules
const animalValidation = [
  body('type').isIn(['dog', 'cat', 'other']).withMessage('Type must be dog, cat, or other'),
  body('status').isIn(['found', 'lost', 'rescued']).withMessage('Status must be found, lost, or rescued'),
  body('location').notEmpty().withMessage('Location is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('contactName').notEmpty().withMessage('Contact name is required'),
  body('contactPhone').notEmpty().withMessage('Contact phone is required'),
  body('contactEmail').isEmail().withMessage('Valid email is required')
];

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'StraySafe API is running',
    timestamp: new Date().toISOString()
  });
});

// Get all animals with optional filtering
app.get('/api/animals', (req, res) => {
  try {
    let animals = readData();
    const { type, status, location } = req.query;

    // Apply filters
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

    res.json({
      success: true,
      data: animals,
      total: animals.length
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
app.post('/api/animals', upload.single('image'), animalValidation, (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const animals = readData();
    const newAnimal = {
      id: uuidv4(),
      type: req.body.type,
      status: req.body.status,
      location: req.body.location,
      description: req.body.description,
      breed: req.body.breed || '',
      color: req.body.color || '',
      size: req.body.size || '',
      age: req.body.age || '',
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
app.put('/api/animals/:id', upload.single('image'), animalValidation, (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
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

    // Update animal data
    const updatedAnimal = {
      ...animals[animalIndex],
      type: req.body.type,
      status: req.body.status,
      location: req.body.location,
      description: req.body.description,
      breed: req.body.breed || '',
      color: req.body.color || '',
      size: req.body.size || '',
      age: req.body.age || '',
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      updatedAt: new Date().toISOString()
    };

    // Update image if new one is uploaded
    if (req.file) {
      updatedAnimal.image = `/uploads/${req.file.filename}`;
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
        rescued: animals.filter(a => a.status === 'rescued').length
      },
      recentReports: animals
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
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
    message: 'Something went wrong!',
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
  console.log(`🚀 StraySafe API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🐕 Animals API: http://localhost:${PORT}/api/animals`);
});

module.exports = app;