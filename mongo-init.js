// MongoDB initialization script
print('Starting MongoDB initialization...');

// Switch to the application database
db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'portfolio_db');

// Create application user with read/write permissions
db.createUser({
  user: process.env.MONGO_INITDB_ROOT_USERNAME || 'admin',
  pwd: process.env.MONGO_INITDB_ROOT_PASSWORD || 'password',
  roles: [
    {
      role: 'readWrite',
      db: process.env.MONGO_INITDB_DATABASE || 'portfolio_db'
    }
  ]
});

// Create indexes for better performance
db.contacts.createIndex({ "email": 1 });
db.contacts.createIndex({ "created_at": -1 });

// Create a sample collection with initial data (optional)
db.app_settings.insertOne({
  _id: "app_config",
  version: "1.0.0",
  initialized_at: new Date(),
  features: {
    contact_form: true,
    fiscal_alerts: true,
    chat_bot: true
  }
});

print('MongoDB initialization completed successfully!');