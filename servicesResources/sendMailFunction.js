const nodemailer = require('nodemailer');

module.exports = async function (context, req) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'myEmail@gmail.com', // your GMail email address 
            pass: 'password' // your Gmail password
        }
    });

    const subject = (req.query.subject || (req.body && req.body.subject));
    const object = (req.query.object || (req.body && req.body.object));
    const attachment = (req.query.attachment || (req.body && req.body.attachment));

    const mailOptions = {
        from: 'myEmail@gmail.com', // your GMail email address 
        to: 'destinationEmail@email.com', // destination email address 
        subject: subject,
        text: object,
        attachments: [{
            path: attachment
        }]
    };

    let success;

    try {
        success = await transporter.sendMail(mailOptions);
    } catch (err) {
        context.log(err);
        success = false;
    }

    if (success) {
        await context.log('Richiesta inviata con successo!');
    } else {
        await context.log('Mi dispiace, non sono riuscito ad inviare la richiesta.');
    }

}
