# StraySafe Backend API

A RESTful API for managing stray animal reports built with Node.js and Express.

## Features

- 🐕 Animal report management (CRUD operations)
- 📸 Image upload support
- 🔍 Search and filtering capabilities
- 📊 Statistics and analytics
- ✅ Input validation and error handling
- 🔒 File upload security

## API Endpoints

### Health Check
- `GET /api/health` - Check API status

### Animal Reports
- `GET /api/animals` - Get all animal reports (with optional filters)
- `GET /api/animals/:id` - Get specific animal report
- `POST /api/animals` - Create new animal report
- `PUT /api/animals/:id` - Update animal report

### Statistics
- `GET /api/stats` - Get system statistics

## Query Parameters

### GET /api/animals
- `type` - Filter by animal type (dog, cat, other)
- `status` - Filter by status (found, lost, rescued)
- `location` - Filter by location (partial match)

## Request Body Structure

### Animal Report
```json
{
  "type": "dog|cat|other",
  "status": "found|lost|rescued",
  "location": "string",
  "description": "string",
  "breed": "string (optional)",
  "color": "string (optional)",
  "size": "string (optional)",
  "age": "string (optional)",
  "contactName": "string",
  "contactPhone": "string",
  "contactEmail": "string",
  "image": "file (optional)"
}
```

## Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Or start the production server:
```bash
npm start
```

The API will be available at `http://localhost:5000`

## File Upload

- Supported formats: JPEG, JPG, PNG, GIF
- Maximum file size: 5MB
- Files are stored in the `uploads/` directory
- Images are accessible via `/uploads/filename`

## Data Storage

Animal reports are stored in a JSON file (`data/animals.json`) for simplicity. In production, consider using a proper database like MongoDB or PostgreSQL.

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "errors": ["Validation errors array (if applicable)"]
}
```

## Success Responses

All successful responses follow this format:

```json
{
  "success": true,
  "message": "Success message (optional)",
  "data": "Response data",
  "total": "Total count (for list endpoints)"
}
```