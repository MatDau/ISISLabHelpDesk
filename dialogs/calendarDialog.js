// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

// Import required types from libraries
const {
    TextPrompt,
    ComponentDialog,
    DialogSet,
    DialogTurnStatus,
    WaterfallDialog
} = require('botbuilder-dialogs');

// Import Google API for Google Calendar
const {
    google
} = require('googleapis');

const CALENDAR_DIALOG = 'CALENDAR_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';

// Update these values with the ones taken from Google API
const API_KEY = process.env.GoogleAPIKey;
const CAL_EMAIL = process.env.GoogleCalendarEmail;

// Secondary dialog, manages the visualization of the next event of the passed Google Calendar
class CalendarDialog extends ComponentDialog {
    constructor(userState) {
        super(CALENDAR_DIALOG);

        // Adding used dialogs
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.displayStep.bind(this),
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async displayStep(step) {
        await step.context.sendActivity('Ecco il calendario dei seminari!');
        let eventMsg = 'Prossimi eventi: \n\n';

        const calendar = google.calendar({
            version: 'v3',
            auth: API_KEY
        });

        // Get five next events starting from today
        const params = {
            calendarId: CAL_EMAIL,
            timeMin: (new Date()).toISOString(),
            maxResults: 5,
            singleEvents: true,
            orderBy: 'startTime',
        };

        try {
            const res = await calendar.events.list(params);
            const events = res.data.items;
            for (var i = 0; i < events.length; i++) {
                var dateTime = new Date(events[i].start.dateTime).toDateString()
                eventMsg += (dateTime + ' - ' + events[i].summary + '\n\n');
            }
            await step.context.sendActivity(eventMsg);
        } catch (err) {
            console.error(err);
            await step.context.sendActivity('Non sono riuscito ad accedere al calendario!');
        }

        return await step.endDialog();
    }

}

module.exports.CalendarDialog = CalendarDialog;
module.exports.CALENDAR_DIALOG = CALENDAR_DIALOG;