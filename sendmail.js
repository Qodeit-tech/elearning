const nodemailer = require('nodemailer');

const sendEmail = async options => {

    //Data from Loop
    const String = Object.entries(options)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');


    // 1) Create a transporter
    const transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NODEMAILER_AUTH,
            pass: process.env.NODEMAILER_PASSWORD
        }
    });

    // 2) Define the email options
    const mailOptions = {
        // from: 'akshay.pranav.kalathil@gmail.com',
        from: 'chatbotusingchatgpt@gmail.com',
        // to: options.email,
        to: 'akshay.kalathil.pranav@gmail.com',
        // to: 'aqibshk28@gmail.com',
        // to: 'aqibshk28@gmail.com',
        subject: "User data",
        text: String,
        envelope: {
            from: 'chatbotusingchatgpt@gmail.com',
            // to: options.email

            to: 'akshay.kalathil.pranav@gmail.com'
        },
    };

    // 3) Actually send the email
    transport.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};

module.exports = sendEmail;