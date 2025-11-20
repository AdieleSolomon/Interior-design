const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // This allows manual copy-paste
);

const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
});

console.log('🔗 Authorize this app by visiting this URL:', authUrl);
console.log('\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('📋 Enter the authorization code from that page: ', (code) => {
    rl.close();

    oauth2Client.getToken(code, (err, tokens) => {
        if (err) {
            console.error('❌ Error getting tokens:', err);
            return;
        }

        console.log('\n✅ Success! Add this to your .env file:');
        console.log('YOUTUBE_REFRESH_TOKEN=', tokens.refresh_token);
        console.log('\n🔑 Access Token:', tokens.access_token);
        console.log('🔄 Refresh Token:', tokens.refresh_token);
        console.log('⏰ Expires in:', tokens.expiry_date);
    });
});