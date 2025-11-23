/**
 * Test script for Decodo API authentication
 * Run with: node test-decodo-api.js
 */

const username = "U0000325993";
const password = "PW_1204851d9672b739805dbbe7da71cc1f5";

console.log('Credential check:');
console.log('Username length:', username.length, '(should be 10)');
console.log('Password length:', password.length, '(should be 13)');
console.log('Username bytes:', Buffer.from(username).toString('hex'));
console.log('Password bytes:', Buffer.from(password).toString('hex'));

// HTTP Basic Authentication
const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

const testDecodoAPI = async () => {
  console.log('Testing Decodo API authentication...\n');
  console.log('Username:', username);
  console.log('Password:', password.substring(0, 5) + '***');
  console.log('Basic Auth Token:', basicAuth.substring(0, 20) + '...\n');

  try {
    const response = await fetch('https://scraper-api.decodo.com/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        target: 'google_search',
        query: 'kitchen knives',
        parse: true,
        limit: 10
      })
    });

    console.log('Response Status:', response.status, response.statusText);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ SUCCESS! API authentication works!\n');
      console.log('Response Data:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('\n❌ FAILED! API returned error:\n');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
};

testDecodoAPI();
