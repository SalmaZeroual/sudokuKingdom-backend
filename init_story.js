const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function initStory() {
  console.log('📚 Initializing Story Mode...\n');
  
  try {
    // Login avec un compte admin ou créer un compte
    console.log('1️⃣ Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Logged in\n');
    
    // Initialize chapters
    console.log('2️⃣ Initializing chapters...');
    const initRes = await axios.post(`${BASE_URL}/story/initialize`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅', initRes.data.message, '\n');
    
    // Get chapters
    console.log('3️⃣ Getting chapters...');
    const chaptersRes = await axios.get(`${BASE_URL}/story/chapters`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Chapters loaded:');
    chaptersRes.data.forEach(chapter => {
      console.log(`   - Chapter ${chapter.chapter_order}: ${chapter.title}`);
    });
    
    console.log('\n✅ Story mode initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

initStory();