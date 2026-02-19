/**
 * Winston Logger — Post Service
 */

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, json, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  let msg = `${ts} [${level}] : ${message}`;
  if (Object.keys(meta).length > 0) msg += ` ${JSON.stringify(meta)}`;
  return msg;
});

export const logger = winston.createLogger({
  level: config.LOG.LEVEL,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  defaultMeta: { service: config.SERVICE_NAME, environment: config.NODE_ENV },
  transports: [
    new winston.transports.Console({
      format:
        config.NODE_ENV === 'development'
          ? combine(colorize(), timestamp(), devFormat)
          : combine(timestamp(), json()),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
    new winston.transports.File({ filename: 'logs/combined.log', maxsize: 5242880, maxFiles: 5 }),
  ],
  exceptionHandlers: [new winston.transports.File({ filename: 'logs/exceptions.log' })],
  rejectionHandlers: [new winston.transports.File({ filename: 'logs/rejections.log' })],
});

export default logger;
