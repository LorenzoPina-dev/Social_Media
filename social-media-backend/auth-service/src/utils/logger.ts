/**
 * Winston Logger Configuration
 * Structured logging for production
 */

import winston from 'winston';
import { config } from '../config';


const { combine, timestamp, json, printf, colorize } = winston.format;
// Custom format for development
const devFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
  let msg = `${ts} [${level}] : ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOG.LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: {
    service: config.SERVICE_NAME,
    environment: config.NODE_ENV,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.NODE_ENV === 'development'
        ? combine(colorize(), timestamp(), devFormat)
        : combine(timestamp(), json()),
    }),

    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

export default logger;
