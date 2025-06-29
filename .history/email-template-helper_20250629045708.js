const fs = require('fs');
const path = require('path');

class EmailTemplateHelper {
    static async loadTemplate(templateName) {
        try {
            const templatePath = path.join(__dirname, 'email-templates', `${templateName}.html`);
            return fs.readFileSync(templatePath, 'utf8');
        } catch (error) {
            console.error(`Error loading email template ${templateName}:`, error);
            return null;
        }
    }

    static processTemplate(template, variables) {
        if (!template) return '';
        
        let processedTemplate = template;
        
        // Replace simple variables {{VARIABLE}}
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            processedTemplate = processedTemplate.replace(regex, variables[key] || '');
        });
        
        // Handle conditional blocks {{#VARIABLE}}...{{/VARIABLE}}
        Object.keys(variables).forEach(key => {
            const value = variables[key];
            const startRegex = new RegExp(`{{#${key}}}`, 'g');
            const endRegex = new RegExp(`{{/${key}}}`, 'g');
            
            if (value && value.trim() !== '') {
                // Show the content if variable has value
                processedTemplate = processedTemplate.replace(startRegex, '');
                processedTemplate = processedTemplate.replace(endRegex, '');
            } else {
                // Remove the entire block if variable is empty
                const blockRegex = new RegExp(`{{#${key}}}[\\s\\S]*?{{/${key}}}`, 'g');
                processedTemplate = processedTemplate.replace(blockRegex, '');
            }
        });
        
        return processedTemplate;
    }

    static async sendDonationNotification(donation, recipientEmail, baseUrl) {
        const template = await this.loadTemplate('donation-notification');
        if (!template) return null;
        
        const variables = {
            TITLE: donation.title,
            DESCRIPTION: donation.description,
            ADDRESS: donation.address || 'Austin, TX',
            TYPE: donation.type,
            DROPOFF_INSTRUCTIONS: donation.dropoffInstructions,
            BASE_URL: baseUrl,
            EMAIL: recipientEmail
        };
        
        return this.processTemplate(template, variables);
    }

    static async sendPickupConfirmation(donation, pickerName, trackingId, baseUrl) {
        const template = await this.loadTemplate('pickup-confirmation');
        if (!template) return null;
        
        const variables = {
            PICKER_NAME: pickerName,
            DONATION_TITLE: donation.title,
            DELIVERY_CONFIRMATION_URL: `${baseUrl}/delivery-confirmation?tracking=${trackingId}`
        };
        
        return this.processTemplate(template, variables);
    }

    static async sendWelcomeEmail(fullName) {
        const template = await this.loadTemplate('welcome');
        if (!template) return null;
        
        const variables = {
            FULL_NAME: fullName
        };
        
        return this.processTemplate(template, variables);
    }

    static async sendAccountApproval(fullName, loginUrl) {
        const template = await this.loadTemplate('account-approved');
        if (!template) return null;
        
        const variables = {
            FULL_NAME: fullName,
            LOGIN_URL: loginUrl
        };
        
        return this.processTemplate(template, variables);
    }

    static async sendDeliveryThankYou(pickerName, deliveryLocation, deliveredTo, deliveryNotes) {
        const template = await this.loadTemplate('delivery-thank-you');
        if (!template) return null;
        
        const variables = {
            PICKER_NAME: pickerName,
            DELIVERY_LOCATION: deliveryLocation,
            DELIVERED_TO: deliveredTo,
            DELIVERY_NOTES: deliveryNotes
        };
        
        return this.processTemplate(template, variables);
    }
}

module.exports = EmailTemplateHelper;
