const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
const createUploadsDir = async () => {
  try {
    await fs.access('uploads');
  } catch {
    await fs.mkdir('uploads', { recursive: true });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
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
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'animals.json');

// Initialize data directory and file
const initializeData = async () => {
  try {
    await fs.access(path.dirname(DATA_FILE));
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  }

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
  }
};

// Helper functions
const readData = async () => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return [];
  }
};

const writeData = async (data) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data:', error);
    throw error;
  }
};

// Validation middleware
const validateAnimalReport = [
  body('type').isIn(['dog', 'cat', 'other']).withMessage('Type must be dog, cat, or other'),
  body('status').isIn(['found', 'lost', 'rescued']).withMessage('Status must be found, lost, or rescued'),
  body('location').notEmpty().withMessage('Location is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('contactName').notEmpty().withMessage('Contact name is required'),
  body('contactPhone').isMobilePhone().withMessage('Valid phone number is required'),
  body('contactEmail').isEmail().withMessage('Valid email is required')
];

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'StraySafe API is running' });
});

// Get all animal reports
app.get('/api/animals', async (req, res) => {
  try {
    const animals = await readData();
    const { type, status, location } = req.query;

    let filteredAnimals = animals;

    if (type) {
      filteredAnimals = filteredAnimals.filter(animal => animal.type === type);
    }

    if (status) {
      filteredAnimals = filteredAnimals.filter(animal => animal.status === status);
    }

    if (location) {
      filteredAnimals = filteredAnimals.filter(animal => 
        animal.location.toLowerCase().includes(location.toLowerCase())
      );
    }

    res.json({
      success: true,
      data: filteredAnimals,
      total: filteredAnimals.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching animal reports',
      error: error.message
    });
  }
});

// Get single animal report
app.get('/api/animals/:id', async (req, res) => {
  try {
    const animals = await readData();
    const animal = animals.find(a => a.id === req.params.id);

    if (!animal) {
      return res.status(404).json({
        success: false,
        message: 'Animal report not found'
      });
    }

    res.json({
      success: true,
      data: animal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching animal report',
      error: error.message
    });
  }
});

// Create new animal report
app.post('/api/animals', upload.single('image'), validateAnimalReport, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const animals = await readData();
    
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
      dateReported: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    animals.push(newAnimal);
    await writeData(animals);

    res.status(201).json({
      success: true,
      message: 'Animal report created successfully',
      data: newAnimal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating animal report',
      error: error.message
    });
  }
});

// Update animal report
app.put('/api/animals/:id', upload.single('image'), validateAnimalReport, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const animals = await readData();
    const animalIndex = animals.findIndex(a => a.id === req.params.id);

    if (animalIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Animal report not found'
      });
    }

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
      lastUpdated: new Date().toISOString()
    };

    if (req.file) {
      updatedAnimal.image = `/uploads/${req.file.filename}`;
    }

    animals[animalIndex] = updatedAnimal;
    await writeData(animals);

    res.json({
      success: true,
      message: 'Animal report updated successfully',
      data: updatedAnimal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating animal report',
      error: error.message
    });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const animals = await readData();
    
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
        .sort((a, b) => new Date(b.dateReported) - new Date(a.dateReported))
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

// Initialize and start server
const startServer = async () => {
  try {
    await createUploadsDir();
    await initializeData();
    
    app.listen(PORT, () => {
      console.log(`🚀 StraySafe API Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📁 API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();