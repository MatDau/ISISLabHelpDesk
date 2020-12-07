// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

// Import required types from libraries
const {
    TextPrompt,
    ChoicePrompt,
    ComponentDialog,
    DialogSet,
    DialogTurnStatus,
    WaterfallDialog,
    AttachmentPrompt
} = require('botbuilder-dialogs');
const {
    ActivityTypes
} = require('botbuilder');
const {
    BlobServiceClient
} = require('@azure/storage-blob');
const axios = require('axios');

const RESERVATION_DIALOG = 'RESERVATION_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const CHOICE_PROMPT = 'CHOICE_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const ATTACHMENT_PROMPT = 'ATTACHMENT_PROMPT';

// Update this value with the ones taken from Azure Bing Search
const BING_SEARCH_API_KEY = process.env.BingSearchAPI;
// Update these values with the ones taken from Azure Storage Account
const STORAGE_ACCOUNT_NAME = process.env.StorageAccountName;
const SA_CONNECTION_STRING = process.env.SAConnectionString;
// Update this value with the ones taken from Azure FunctionApp
const FUNCTION_ENDPOINT = process.env.FunctionEndpoint;

// Secondary dialog, manages the reservation of a new seminar by composing an email
class ReservationDialog extends ComponentDialog {
    constructor(userState) {
        super(RESERVATION_DIALOG);

        // Adding used dialogs
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new AttachmentPrompt(ATTACHMENT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.speakerStep.bind(this),
            this.titleStep.bind(this),
            this.abstractStep.bind(this),
            this.pictureChoiceStep.bind(this),
            this.pictureStep.bind(this),
            this.imageSearchStep.bind(this),
            this.summaryStep.bind(this),
            this.sendEmailStep.bind(this)
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

    async speakerStep(step) {
        await step.context.sendActivity('Per tenere un tuo seminario bisogna inviare una mail con tutti i dati necessari. Prepariamola insieme!');
        if (!step.values.speaker) {
            return await step.prompt(TEXT_PROMPT, 'Inserisci il tuo nome e cognome.');

        } else {
            return await step.next(step.values.speaker);
        }
    }
    async titleStep(step) {
        step.values.speaker = step.result;
        if (!step.values.title) {
            return await step.prompt(TEXT_PROMPT, 'Inserisci il titolo del seminario.');

        } else {
            return await step.next(step.values.title);
        }
    }

    async abstractStep(step) {
        step.values.title = step.result;
        if (!step.values.abstract) {
            return await step.prompt(TEXT_PROMPT, 'Inserisci l\'abstract del seminario, ovvero una breve descrizione dell\'argomento che sarà trattato.');

        } else {
            return await step.next(step.values.abstract);
        }
    }

    async pictureChoiceStep(step) {
        step.values.abstract = step.result;
        return await step.prompt(CHOICE_PROMPT, 'Hai già un\'immagine da utilizzare?', ['Si', 'No']);
    }

    async pictureStep(step) {
        step.values.choice = step.result.value;
        if (step.values.choice === 'Si' || step.values.choice.toLowerCase().includes('s')) {
            return await step.prompt(TEXT_PROMPT, 'Inserisci la path (percorso) completo dell\'immagine.');

        } else {
            // User said "no" so the bot asks for a search
            await step.context.sendActivity('Posso aiutarti a cerca un\'immagine adatta!');
            return await step.prompt(TEXT_PROMPT, 'Scrivi una o più parole chiave per la ricerca!');
        }
    }

    async imageSearchStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        if (step.values.choice === 'Si' || step.values.choice.toLowerCase().includes('s')) {
            var imageSent = step.result;

            // Create the BlobServiceClient object which will be used to create a container client
            const connectionString = SA_CONNECTION_STRING;
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

            // Get a reference to a container
            const containerName = 'public';
            const containerClient = blobServiceClient.getContainerClient(containerName);

            // Get a block blob client
            const blockBlobClient = containerClient.getBlockBlobClient('image.png');

            // Upload the image on the container
            const blobOptions = {
                blobHTTPHeaders: {
                    blobContentType: 'image/png'
                }
            };
            await blockBlobClient.uploadFile(imageSent, blobOptions);

            // Save the URL of the uploaded image
            step.values.picture = 'https://' + STORAGE_ACCOUNT_NAME + '.blob.core.windows.net/public/image.png';

            return await step.continueDialog();

        } else {
            var keyWords = step.result;

            var url = 'https://api.bing.microsoft.com/v7.0/images/search?q=' + encodeURIComponent(keyWords);
            var res = await axios.get(url, {
                headers: {
                    'Ocp-Apim-Subscription-Key': BING_SEARCH_API_KEY,
                    "Accept": "application/json"
                },
            })

            step.values.searchImage = res.data.value[0].contentUrl

            reply.text = 'Ecco un\'immagine che potrebbe essere adatta in base alle parole chiave \'' + keyWords + '\'!';
            reply.attachments = [{
                name: 'architecture-resize.png',
                contentType: 'image/png',
                contentUrl: step.values.searchImage
            }];
            await step.context.sendActivity(reply);

            return await step.prompt(CHOICE_PROMPT, 'Vuoi utilizzarla per il tuo seminario? Se scegli no verrà utilizzata un\'immagine standard provvisoria!', ['Si', 'No']);
        }
    }

    async summaryStep(step) {
        if (step.values.choice === 'No' || step.values.choice.toLowerCase().includes('n')) {
            // The user says no when asking for image searching
            if (step.result.value === 'Si' || step.result.value.toLowerCase().includes('s')) {
                // The user says yes so the image will be used
                step.values.picture = step.values.searchImage;

            } else {
                step.values.picture = 'https://www.isislab.it/wp-content/uploads/2019/08/logo-verticale-1024.png';
            }
        }

        // Get all the informations from user state to show a summary
        const seminarDetails = step.values;
        seminarDetails.speaker = step.values.speaker;
        seminarDetails.title = step.values.title;
        seminarDetails.abstract = step.values.abstract;
        seminarDetails.picture = step.values.picture;

        await step.context.sendActivity('Ecco la tua richiesta di seminario:');

        const speaker = `-Speaker del seminario: ${ seminarDetails.speaker }`;
        await step.context.sendActivity(speaker);

        const title = `-Titolo del seminario: ${ seminarDetails.title }`;
        await step.context.sendActivity(title);

        const abstract = `-Abstract: ${ seminarDetails.abstract }`;
        await step.context.sendActivity(abstract);

        const picture = `-Path dell\'immagine: ${ seminarDetails.picture }`;
        await step.context.sendActivity(picture);

        return await step.prompt(CHOICE_PROMPT, 'Posso inviarla?', ['Si', 'No']);
    }

    async sendEmailStep(step) {
        // Get all the informations from user state to fill in the email
        const seminarDetails = step.values;
        seminarDetails.speaker = step.values.speaker;
        seminarDetails.title = step.values.title;
        seminarDetails.abstract = step.values.abstract;
        seminarDetails.picture = step.values.picture;

        const speaker = `-Speaker del seminario: ${ seminarDetails.speaker }`;
        const title = `-Titolo del seminario: ${ seminarDetails.title }`;
        const abstract = `-Abstract: ${ seminarDetails.abstract }`;
        const reservation = speaker + '\n\n' + title + '\n\n' + abstract + '\n\n\n' + 'Questo messaggio è stato inviato tramite ISISLabHelpDesk.'
        const subject = "Richiesta prenotazione seminario " + seminarDetails.speaker

        if (step.result.value === 'Si' || step.result.value.toLowerCase().includes('s')) {
            // User said yes so the email will be sent
            await step.context.sendActivity('Sto inviando la richiesta!');

            var url = FUNCTION_ENDPOINT;
            var option = {
                method: 'post',
                url: url,
                data: {
                    subject: subject,
                    object: reservation,
                    attachment: seminarDetails.picture
                }
            }
            const res = await axios(option);

            if (res.status = 200) {
                // Email successfully sent
                await step.context.sendActivity('Richiesta inviata con successo!');
            } else {
                // Failed to send the email
                await step.context.sendActivity('Mi dispiace, non sono riuscito ad inviare la richiesta.');
            }

            return await step.endDialog();
        } else {
            // User said "no" so the email will be not sent
            await step.context.sendActivity('La tua richiesta non sarà inviata.');
            return await step.endDialog();
        }
    }
}

module.exports.ReservationDialog = ReservationDialog;
module.exports.RESERVATION_DIALOG = RESERVATION_DIALOG;