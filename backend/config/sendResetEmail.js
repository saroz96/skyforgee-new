const { transporter, generateToken } = require('../config/email');

const sendResetEmail = async (email, resetURL) => {
    try {
        const mailOptions = {
            //from: process.env.EMAIL_FROM || '<noreply@skyforgee.com>',
            from: process.env.EMAIL_USER || '<noreply@skyforgee.com>',
            to: email,
            subject: 'Password Reset Request - Action Required',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #333; margin-bottom: 5px;">Password Reset Request</h2>
                        <div style="height: 2px; background-color: #4CAF50; width: 80px; margin: 0 auto;"></div>
                    </div>
                    
                    <p style="color: #555; line-height: 1.5;">You recently requested to reset your password for your account. Click the button below to proceed:</p>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${resetURL}" 
                           style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; 
                                  text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #555; line-height: 1.5;">If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
                    
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
                        <p>For security reasons, this link will expire in 10 minutes.</p>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="word-break: break-all;">${resetURL}</p>
                    </div>
                </div>
            `,
            text: `Password Reset Request\n\n
You requested a password reset for your account. Please use the following link to reset your password:\n
${resetURL}\n\n
This link will expire in 10 minutes.\n\n
If you didn't request this password reset, please ignore this email.\n\n
Thank you,\n
The Sarathi Team`
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Failed to send reset email');
    }
};

module.exports = {
    sendResetEmail
};