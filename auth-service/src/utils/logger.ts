/**
 * Logger Utility
 * Winston-based structured logging
 */

import winston from 'winston';
import { config } from '../config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Create logger format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create transports
const transports: winston.transport[] = [];

// Always add console transport
if (config.LOG.PRETTY_PRINT) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format,
    })
  );
}

// Add file transports in production
if (config.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format,
    })
  );
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOG.LEVEL,
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream for morgan (if needed)
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
