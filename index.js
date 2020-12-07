// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

const restify = require('restify');

// Import required bot services.
const {
    BotFrameworkAdapter,
    ConversationState,
    MemoryStorage,
    UserState
} = require('botbuilder');

// Import bot
const {
    ISISLabBot
} = require('./bots/ISISLabBot');

// Import main dialog
const {
    MainDialog
} = require('./dialogs/mainDialog');

// Import LUIS
const {
    ISISLabRecognizer
} = require('./cognitiveModels/ISISLabRecognizer');


// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`\n${ server.name } listening to ${ server.url }`);
});

// Create adapter
// Update these values with the ones taken from Azure Bot Service
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Create conversation and user state with in-memory storage provider
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// Create LUIS Recognizer
// Update these values with the ones taken from Azure LUIS
const {
    LuisAppId,
    LuisAPIKey,
    LuisAPIHostName
} = process.env;
const luisConfig = {
    applicationId: LuisAppId,
    endpointKey: LuisAPIKey,
    endpoint: `https://${ LuisAPIHostName }`
};
const luisRecognizer = new ISISLabRecognizer(luisConfig);

// Create the bot and the main dialog
const dialog = new MainDialog(luisRecognizer, userState);
const bot = new ISISLabBot(conversationState, userState, dialog);

// Catch-all for errors
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights
    console.error(`\n [onTurnError] unhandled error: ${ error }`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${ error }`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    await context.sendActivity('The bot encountered an error or bug.');
    await context.sendActivity('To continue to run this bot, please fix the bot source code.');

    // Clear out state
    await conversationState.delete(context);
};

// Listen for incoming requests
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        // Route to main dialog
        await bot.run(context);
    });
});