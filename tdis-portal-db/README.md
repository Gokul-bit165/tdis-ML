# Event Detection Database Scripts

A collection of scripts for managing and processing event detection data in PostgreSQL database.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- npm package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/TexasDIS/event-detection-db.git
cd event-detection-db
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the `data_import` directory with your database configuration:
```
PORT=your_port
HOST=your_host
USER=your_username
PASSWORD=your_password
DATABASE=your_database
```

## Project Structure

- `migrations/` - Database migration scripts for schema changes and updates
- `data_import/` - Scripts for importing and processing event detection data
- `docs/` - Schema notes. `WILDFIRE_IGNITION_SCHEMA.md` covers migration 042 (wildfire ignition predictions: tables, indexes, retention, rollback)
- `node_modules/` - Project dependencies
- `package.json` - Project configuration and dependencies

## Dependencies

- `pg` - PostgreSQL client for Node.js
- `dotenv` - Environment variable management
