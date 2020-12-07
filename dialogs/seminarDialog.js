// Import required types from libraries
const {
    ActionTypes,
    ActivityTypes,
    CardFactory,
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
    RESERVATION_DIALOG,
    ReservationDialog
} = require('./reservationDialog');
const {
    CALENDAR_DIALOG,
    CalendarDialog
} = require('./calendarDialog');

const SEMINAR_DIALOG = 'SEMINAR_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';

// Secondary dialog, can be started by the main dialog forwards to the dialog based on the user request
class SeminarDialog extends ComponentDialog {
    constructor(luisRecognizer, userState) {
        super(SEMINAR_DIALOG);
        this.luisRecognizer = luisRecognizer;

        // Adding used dialogs
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ReservationDialog());
        this.addDialog(new CalendarDialog());
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.choiceStep.bind(this),
            this.eventStep.bind(this),
            this.finalStep.bind(this)
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

    async choiceStep(step) {
        const info = 'Tutti i membri di ISISLab tengono dei seminari con regolarità, se ne tiene uno a settimana!\n\nPartecipare ai seminari permette di conoscere meglio gli argomenti trattati in laboratorio e sapere su cosa stanno lavorando i vari membri!\n\nTenere un seminario fornisce la possibilità di fare esperienza nel presentare il proprio lavoro e permette di avere feedback per migliorare!';
        await step.context.sendActivity(info);

        const reply = {
            type: ActivityTypes.Message
        };
        const buttons = [{
                type: ActionTypes.ImBack,
                title: 'Prenota un seminario',
                value: 'Prenota'
            },
            {
                type: ActionTypes.ImBack,
                title: 'Mostrami il calendario dei seminari',
                value: 'Calendario'
            },
        ];
        const card = CardFactory.heroCard(
            '',
            undefined,
            buttons, {
                text: 'Vuoi prenotare un seminario o sapere quando ci sarà il prossimo?'
            }
        );
        reply.attachments = [card];
        await step.context.sendActivity(reply);

        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Seleziona un\'opzione dal menu per proseguire!'
        });
    }

    async eventStep(step) {
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);

        const message = step.result;
        if (message === 'Prenota' || LuisRecognizer.topIntent(luisResult) === 'Prenotazione') {
            return await step.beginDialog(RESERVATION_DIALOG);

        } else if (message === 'Calendario' || LuisRecognizer.topIntent(luisResult) === 'Calendario') {
            return await step.beginDialog(CALENDAR_DIALOG);
        }

        return await step.next();
    }

    async finalStep(step) {
        return await step.endDialog();
    }

}

module.exports.SeminarDialog = SeminarDialog;
module.exports.SEMINAR_DIALOG = SEMINAR_DIALOG;