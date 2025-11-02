// remove-unique-index.js
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from the correct .env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function removeUniqueIndex() {
  try {
    // Check if MONGODB_URI is available
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables. Please check your .env file');
    }

    console.log('🔗 Connecting to MongoDB...');
    console.log('URI:', process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    const collection = mongoose.connection.collection('quizsubmissions');
    
    // List all indexes first
    const indexes = await collection.indexes();
    console.log('\n📊 Current indexes:');
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, index.key, `unique: ${index.unique}`);
    });
    
    // Drop the unique index if it exists
    let droppedIndexes = [];
    try {
      await collection.dropIndex('quiz_1_student_1');
      console.log('✅ Unique index quiz_1_student_1 dropped successfully');
      droppedIndexes.push('quiz_1_student_1');
    } catch (error) {
      console.log('ℹ️ Index quiz_1_student_1 not found or already dropped');
    }
    
    // Also drop any other potential unique indexes
    const uniqueIndexes = indexes.filter(index => index.unique && index.name !== '_id_');
    for (const index of uniqueIndexes) {
      if (index.name !== '_id_') { // Don't drop the default _id index
        try {
          await collection.dropIndex(index.name);
          console.log(`✅ Dropped unique index: ${index.name}`);
          droppedIndexes.push(index.name);
        } catch (error) {
          console.log(`ℹ️ Could not drop index ${index.name}:`, error.message);
        }
      }
    }
    
    if (droppedIndexes.length === 0) {
      console.log('ℹ️ No unique indexes found to drop');
    }
    
    // Create only non-unique indexes
    console.log('\n🔧 Creating non-unique indexes...');
    
    try {
      await collection.createIndex(
        { quiz: 1, student: 1, attemptNumber: 1 }, 
        { unique: false, name: 'quiz_student_attempt_composite' }
      );
      console.log('✅ Created non-unique composite index: quiz_student_attempt_composite');
    } catch (error) {
      console.log('ℹ️ Composite index may already exist:', error.message);
    }
    
    try {
      await collection.createIndex(
        { quiz: 1, student: 1 }, 
        { unique: false, name: 'quiz_student_non_unique' }
      );
      console.log('✅ Created non-unique index: quiz_student_non_unique');
    } catch (error) {
      console.log('ℹ️ Index may already exist:', error.message);
    }
    
    // Verify final indexes
    const finalIndexes = await collection.indexes();
    console.log('\n📋 Final indexes:');
    finalIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, index.key, `unique: ${index.unique}`);
    });
    
    console.log('\n🎉 Index cleanup completed successfully!');
    console.log('✅ Unique indexes removed permanently');
    console.log('✅ Non-unique indexes created for better performance');
    
  } catch (error) {
    console.error('❌ Error removing index:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Check if MongoDB is running');
    console.log('2. Verify MONGODB_URI in your .env file');
    console.log('3. Ensure the database connection string is correct');
    process.exit(1);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n⚠️ Script interrupted by user');
  await mongoose.connection.close();
  process.exit(0);
});

removeUniqueIndex();