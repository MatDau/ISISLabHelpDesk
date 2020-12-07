// Import required types from libraries
const {
    ActionTypes,
    ActivityTypes,
    CardFactory,
    MessageFactory,
    InputHints
} = require('botbuilder');
const {
    TextPrompt,
    ComponentDialog,
    DialogSet,
    DialogTurnStatus,
    WaterfallDialog
} = require('botbuilder-dialogs');
const {
    LuisRecognizer
} = require('botbuilder-ai');

// Import secondary dialogs
const {
    SEMINAR_DIALOG,
    SeminarDialog
} = require('./seminarDialog');
const {
    RESERVATION_DIALOG,
    ReservationDialog
} = require('./reservationDialog');
const {
    CALENDAR_DIALOG,
    CalendarDialog
} = require('./calendarDialog');

const MAIN_DIALOG = 'MAIN_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const USER_PROFILE_PROPERTY = 'USER_PROFILE_PROPERTY';


// Main dialog showed as first forwards to the dialog based on the user request
class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, userState) {
        super(MAIN_DIALOG);

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        this.userState = userState;
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);

        // Adding used dialogs
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new SeminarDialog(luisRecognizer));
        this.addDialog(new ReservationDialog());
        this.addDialog(new CalendarDialog());
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.welcomeStep.bind(this),
            this.menuStep.bind(this),
            this.optionsStep.bind(this),
            this.loopStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system
     * If no dialog is active, it will start the default dialog
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

    // Welcome message, forward the text to next step
    async welcomeStep(step) {
        if (!this.luisRecognizer.isConfigured) {
            var messageText = 'ATTENZIONE: LUIS non configurato. Controlla il file .env!';
            await step.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await step.next();
        }

        var messageText = step.options.restartMsg ? step.options.restartMsg : 'Come posso aiutarti?\n\nSe vuoi sapere cosa posso fare per te scrivi \"menu\"';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await step.prompt(TEXT_PROMPT, {
            prompt: promptMessage
        });
    }

    // Shows the menu or forward the text to next step
    async menuStep(step) {
        const message = step.result;

        if (message === 'menu') {
            const reply = {
                type: ActivityTypes.Message
            };

            const buttons = [{
                    type: ActionTypes.ImBack,
                    title: 'Informazioni utili ai nuovi membri',
                    value: 'Info'
                },
                {
                    type: ActionTypes.ImBack,
                    title: 'Canali social del laboratorio',
                    value: 'Social'
                },
                {
                    type: ActionTypes.ImBack,
                    title: 'Seminari',
                    value: 'Seminari'
                }
            ];

            const card = CardFactory.heroCard(
                '',
                undefined,
                buttons, {
                    text: 'ISISLabHelpDesk menu'
                }
            );

            reply.attachments = [card];

            await step.context.sendActivity(reply);

            return await step.prompt(TEXT_PROMPT, {
                prompt: 'Seleziona un\'opzione dal menu per proseguire!'
            });
        } else {
            return await step.next(message);
        }
    }

    // Forwards to the correct dialog based on the menu option or the intent recognized by LUIS
    async optionsStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };

        const option = step.result;

        // Call LUIS and gather user request.
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);

        if (option === 'Info' || LuisRecognizer.topIntent(luisResult) === 'Informazioni') {

            var cardSite = CardFactory.thumbnailCard(
                'Cos\'è ISISLab?',
                [{
                    url: 'https://www.isislab.it/wp-content/uploads/2019/08/logo-verticale-1024.png'
                }],
                [{
                    type: 'openUrl',
                    title: 'Vai su ISISLab.it',
                    value: 'https://www.isislab.it'
                }], {
                    subtitle: 'https://www.isislab.it',
                    text: 'ISISLab è il laboratorio diretto da Alberto Negro e Vittorio Scarano e in cui si svolgono attività di ricerca e di didattica. Se vuoi saperne di più visita il sito o partecipa ai nostri seminari!'
                }
            );
            reply.attachments = [cardSite];
            await step.context.sendActivity(reply);

            var cardDiscord = CardFactory.thumbnailCard(
                'ISISLab è ora su Discord!',
                [{
                    url: 'https://pbs.twimg.com/profile_images/1324044062890942464/B_osBEcZ_400x400.jpg'
                }],
                [{
                    type: 'openUrl',
                    title: 'Entra nel canale',
                    value: 'https://discord.gg/BTt5fUp'
                }], {
                    subtitle: 'https://discord.gg/BTt5fUp',
                    text: 'Entra a far parte della nostra community virtuale iscrivendoti al canale Discord ufficiale del laboratorio ISISLab! Qui si svolgono tutti gli eventi e puoi entrare in contatto con i nostri membri!'
                }
            );
            reply.attachments = [cardDiscord];
            await step.context.sendActivity(reply);

        } else if (option === 'Social' || LuisRecognizer.topIntent(luisResult) === 'Social') {
            var cardDiscord = CardFactory.thumbnailCard(
                'ISISLab è ora su Discord!',
                [{
                    url: 'https://pbs.twimg.com/profile_images/1324044062890942464/B_osBEcZ_400x400.jpg'
                }],
                [{
                    type: 'openUrl',
                    title: 'Entra nel canale',
                    value: 'https://discord.gg/BTt5fUp'
                }], {
                    subtitle: 'https://discord.gg/BTt5fUp',
                    text: 'Entra a far parte della nostra community virtuale iscrivendoti al canale Discord ufficiale del laboratorio ISISLab! Qui si svolgono tutti gli eventi e puoi entrare in contatto con i nostri membri!'
                }
            );
            reply.attachments = [cardDiscord];
            await step.context.sendActivity(reply);

            const social = [{
                    type: 'openUrl',
                    title: 'Facebook',
                    value: 'https://www.facebook.com/ISISLabUNISA/'
                },
                {
                    type: 'openUrl',
                    title: 'Instagram',
                    value: 'https://www.instagram.com/isislab_unisa/'
                },
                {
                    type: 'openUrl',
                    title: 'Twitter',
                    value: 'https://twitter.com/isislab'
                }
            ];
            const cardSocial = CardFactory.heroCard(
                '',
                undefined,
                social, {
                    text: 'Puoi anche trovare ISISLab su tutti i social, seguici per non perdere nessuna novità!'
                }
            );
            reply.attachments = [cardSocial];
            await step.context.sendActivity(reply);

        } else if (option === 'Seminari' || LuisRecognizer.topIntent(luisResult) === 'Seminari') {
            return await step.beginDialog(SEMINAR_DIALOG);

        } else if (LuisRecognizer.topIntent(luisResult) === 'Prenotazione') {
            return await step.beginDialog(RESERVATION_DIALOG);

        } else if (LuisRecognizer.topIntent(luisResult) === 'Calendario') {
            return await step.beginDialog(CALENDAR_DIALOG);

        } else {
            // The user did not enter input that this bot was built to handle.
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply)
        }

        return await step.replaceDialog(this.id);
    }

    async loopStep(step) {
        return await step.replaceDialog(this.id);
    }
}

module.exports.MainDialog = MainDialog;
module.exports.MAIN_DIALOG = MAIN_DIALOG;