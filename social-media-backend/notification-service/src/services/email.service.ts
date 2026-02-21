/**
 * Email Service — Nodemailer
 */

import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.SMTP.HOST,
    port: config.SMTP.PORT,
    secure: config.SMTP.PORT === 465,
    auth: config.SMTP.USER
      ? { user: config.SMTP.USER, pass: config.SMTP.PASS }
      : undefined,
  });

  return transporter;
}

export class EmailService {
  async send(to: string, subject: string, htmlContent: string): Promise<boolean> {
    try {
      if (!config.SMTP.USER) {
        logger.debug('SMTP not configured, skipping email', { to, subject });
        return false;
      }

      const transport = getTransporter();
      await transport.sendMail({
        from: config.SMTP.FROM,
        to,
        subject,
        html: htmlContent,
      });

      logger.info('Email sent', { to, subject });
      metrics.incrementCounter('notification_sent', { channel: 'email', status: 'ok' });
      return true;
    } catch (error) {
      logger.error('Email send failed', { to, subject, error });
      metrics.incrementCounter('notification_sent', { channel: 'email', status: 'error' });
      return false;
    }
  }

  buildLikeEmail(actorName: string, postTitle: string): string {
    return `<p><strong>${actorName}</strong> ha messo like al tuo post <em>${postTitle}</em>.</p>`;
  }

  buildCommentEmail(actorName: string, postTitle: string, commentBody: string): string {
    return `<p><strong>${actorName}</strong> ha commentato il tuo post <em>${postTitle}</em>:</p><blockquote>${commentBody}</blockquote>`;
  }

  buildFollowEmail(actorName: string): string {
    return `<p><strong>${actorName}</strong> ha iniziato a seguirti!</p>`;
  }
}

export const emailService = new EmailService();
